//! deepmark-contract: verified runs and relic assets for Deepmark.
//!
//! A run has two on-chain steps and neither blocks play:
//!
//! 1. `start_run` opens a run and issues the seed on chain.
//! 2. `finish_run` takes the player's action log, replays the whole run with
//!    the same deterministic simulation the game client uses, derives the
//!    result itself, updates the profile and leaderboard, and mints the banked
//!    relics through Stellar Asset Contracts.
//!
//! The contract never trusts a claimed result. See `sim.rs` for the replay and
//! `docs/architecture/onchain-boundary.md` for what this does and does not
//! prove. Scaffolded with the Cougr CLI, but plain `soroban-sdk` storage is
//! used because the data model is one record per player address, which does
//! not fit an entity-component model.

#![no_std]

#[cfg(test)]
extern crate std;

pub mod components;
pub mod rng;
pub mod sim;
pub mod systems;
pub mod world;
#[cfg(test)]
mod test;

use components::{
    DataKey, PlayerRecord, PlayerSummary, RelicTokens, RunOutcome, RunTicket, TopEntry, ACTIONS_PER_LEDGER,
    MAX_ACTIONS, MAX_PAGE, RUN_TTL, START_COOLDOWN_LEDGERS, TOP_SIZE, TTL_EXTEND_TO, TTL_THRESHOLD,
};
use sim::{Ending, Outcome, SimError};
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, token::StellarAssetClient, xdr::ToXdr, Address, Bytes,
    Env, Vec,
};
use systems::{apply_outcome, rank_key};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    InvalidHero = 1,
    RunNotStarted = 2,
    TooManyActions = 3,
    InvalidAction = 4,
    RunIncomplete = 5,
    TrailingActions = 6,
    TooFast = 7,
    StartCooldown = 8,
}

impl From<SimError> for Error {
    fn from(value: SimError) -> Self {
        match value {
            SimError::UnknownHero => Error::InvalidHero,
            SimError::UnknownAction => Error::InvalidAction,
            SimError::Incomplete => Error::RunIncomplete,
            SimError::TrailingActions => Error::TrailingActions,
        }
    }
}

/// Topic: ("run_started", player).
#[contractevent]
pub struct RunStarted {
    #[topic]
    pub player: Address,
    pub seed: u32,
    pub hero: u32,
}

/// Topic: ("run_finished", player).
#[contractevent]
pub struct RunFinished {
    #[topic]
    pub player: Address,
    pub extracted: bool,
    pub floor_reached: u32,
    pub score: u32,
    pub relics_common: u32,
    pub relics_rare: u32,
    pub relics_core: u32,
    pub hp_left: u32,
    pub actions: u32,
    pub is_new_best: bool,
    pub minted: bool,
}

#[contract]
#[derive(Clone)]
pub struct DeepmarkContract;

#[contractimpl]
impl DeepmarkContract {
    /// Sets the three relic Stellar Asset Contracts once. There is no admin
    /// and no upgrade path: what is deployed is what runs.
    pub fn __constructor(env: Env, relic_common: Address, relic_rare: Address, relic_core: Address) {
        let tokens = RelicTokens { common: relic_common, rare: relic_rare, core: relic_core };
        env.storage().instance().set(&DataKey::Relics, &tokens);
    }

    /// Open a run for `player` and issue its seed. Starting while another run
    /// is open forfeits the old one, which stays on the profile.
    pub fn start_run(env: Env, player: Address, hero: u32) -> Result<RunTicket, Error> {
        player.require_auth();
        if world::hero(hero).is_none() {
            return Err(Error::InvalidHero);
        }

        let now = env.ledger().sequence();
        let record_key = DataKey::Record(player.clone());
        let existing: Option<PlayerRecord> = env.storage().persistent().get(&record_key);
        let is_new_player = existing.is_none();
        let mut record = existing.unwrap_or_else(PlayerRecord::empty);

        if record.last_start_ledger > 0 && now < record.last_start_ledger.saturating_add(START_COOLDOWN_LEDGERS) {
            return Err(Error::StartCooldown);
        }

        let run_key = DataKey::Run(player.clone());
        if env.storage().temporary().has(&run_key) {
            record.forfeits = record.forfeits.saturating_add(1);
            record.total_runs = record.total_runs.saturating_add(1);
        }

        let seed = derive_seed(&env, &player, record.total_runs);
        let ticket = RunTicket { seed, hero, start_ledger: now };
        env.storage().temporary().set(&run_key, &ticket);
        env.storage().temporary().extend_ttl(&run_key, RUN_TTL, RUN_TTL);

        record.last_start_ledger = now;
        save_record(&env, &record_key, &record);
        if is_new_player {
            register_player(&env, &player);
        }

        RunStarted { player, seed, hero }.publish(&env);
        Ok(ticket)
    }

    /// Replay `actions` against the open run, derive the result, update the
    /// profile and leaderboard, and mint banked relics. The run is consumed,
    /// so the same log cannot be claimed twice.
    pub fn finish_run(env: Env, player: Address, actions: Bytes) -> Result<RunOutcome, Error> {
        player.require_auth();
        if actions.len() > MAX_ACTIONS {
            return Err(Error::TooManyActions);
        }

        let run_key = DataKey::Run(player.clone());
        let ticket: RunTicket = env.storage().temporary().get(&run_key).ok_or(Error::RunNotStarted)?;

        let earliest = ticket.start_ledger.saturating_add(actions.len().div_ceil(ACTIONS_PER_LEDGER));
        if env.ledger().sequence() < earliest {
            return Err(Error::TooFast);
        }

        let outcome = sim::replay(ticket.hero, ticket.seed, actions.iter())?;
        let key = rank_key(&outcome);
        env.storage().temporary().remove(&run_key);

        let record_key = DataKey::Record(player.clone());
        let existing: Option<PlayerRecord> = env.storage().persistent().get(&record_key);
        let (record, is_new_best) = apply_outcome(existing, &outcome, key);
        save_record(&env, &record_key, &record);

        if is_new_best {
            update_top(&env, &player, &outcome, key);
        }

        let minted = outcome.ending == Ending::Extracted && mint_relics(&env, &player, &outcome);

        RunFinished {
            player,
            extracted: outcome.ending == Ending::Extracted,
            floor_reached: outcome.floor_reached,
            score: outcome.score,
            relics_common: outcome.relics_common,
            relics_rare: outcome.relics_rare,
            relics_core: outcome.relics_core,
            hp_left: outcome.hp_left,
            actions: outcome.actions,
            is_new_best,
            minted,
        }
        .publish(&env);

        Ok(to_contract_outcome(&outcome, key))
    }

    /// Replay any run without touching state. Anyone can audit a result with
    /// the hero, the seed from the `run_started` event, and the action log.
    pub fn verify_run(_env: Env, hero: u32, seed: u32, actions: Bytes) -> Result<RunOutcome, Error> {
        if actions.len() > MAX_ACTIONS {
            return Err(Error::TooManyActions);
        }
        let outcome = sim::replay(hero, seed, actions.iter())?;
        Ok(to_contract_outcome(&outcome, rank_key(&outcome)))
    }

    /// A player's persistent profile, or `None` if they have never started a run.
    pub fn get_record(env: Env, player: Address) -> Option<PlayerRecord> {
        env.storage().persistent().get(&DataKey::Record(player))
    }

    /// The run a player has open, if any.
    pub fn get_open_run(env: Env, player: Address) -> Option<RunTicket> {
        env.storage().temporary().get(&DataKey::Run(player))
    }

    /// The leaderboard, best first, at most `TOP_SIZE` entries, in one call.
    pub fn top(env: Env) -> Vec<TopEntry> {
        env.storage().persistent().get(&DataKey::Top).unwrap_or_else(|| Vec::new(&env))
    }

    /// How many distinct players have ever started a run. Not capped.
    pub fn player_count(env: Env) -> u32 {
        env.storage().persistent().get(&DataKey::PlayerCount).unwrap_or(0)
    }

    /// Players in the order they first appeared, with profiles, at most
    /// `MAX_PAGE` per call. Lets a client page through every player without
    /// one request per address.
    pub fn players(env: Env, start: u32, limit: u32) -> Vec<PlayerSummary> {
        let count: u32 = env.storage().persistent().get(&DataKey::PlayerCount).unwrap_or(0);
        let end = start.saturating_add(limit.min(MAX_PAGE)).min(count);
        let mut out = Vec::new(&env);
        let mut i = start;
        while i < end {
            let address: Option<Address> = env.storage().persistent().get(&DataKey::PlayerAt(i));
            if let Some(player) = address {
                let record: Option<PlayerRecord> = env.storage().persistent().get(&DataKey::Record(player.clone()));
                if let Some(record) = record {
                    out.push_back(PlayerSummary { player, record });
                }
            }
            i += 1;
        }
        out
    }

    /// The Stellar Asset Contracts that hold relics.
    pub fn relic_tokens(env: Env) -> RelicTokens {
        env.storage().instance().get(&DataKey::Relics).unwrap()
    }
}

fn derive_seed(env: &Env, player: &Address, runs: u32) -> u32 {
    let mut material = Bytes::new(env);
    material.append(&Bytes::from_array(env, &env.ledger().sequence().to_be_bytes()));
    material.append(&Bytes::from_array(env, &env.ledger().timestamp().to_be_bytes()));
    material.append(&Bytes::from_array(env, &runs.to_be_bytes()));
    material.append(&player.clone().to_xdr(env));
    let hash = env.crypto().sha256(&material).to_array();
    u32::from_be_bytes([hash[0], hash[1], hash[2], hash[3]])
}

fn save_record(env: &Env, key: &DataKey, record: &PlayerRecord) {
    env.storage().persistent().set(key, record);
    env.storage().persistent().extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

fn register_player(env: &Env, player: &Address) {
    let count: u32 = env.storage().persistent().get(&DataKey::PlayerCount).unwrap_or(0);
    let slot = DataKey::PlayerAt(count);
    env.storage().persistent().set(&slot, player);
    env.storage().persistent().extend_ttl(&slot, TTL_THRESHOLD, TTL_EXTEND_TO);
    env.storage().persistent().set(&DataKey::PlayerCount, &count.saturating_add(1));
    env.storage()
        .persistent()
        .extend_ttl(&DataKey::PlayerCount, TTL_THRESHOLD, TTL_EXTEND_TO);
}

/// Keep `Top` sorted best first with one entry per player. Only called when a
/// run improved the player's best, so the old entry (if any) is replaced.
fn update_top(env: &Env, player: &Address, outcome: &Outcome, key: u64) {
    let board_key = DataKey::Top;
    let old: Vec<TopEntry> = env.storage().persistent().get(&board_key).unwrap_or_else(|| Vec::new(env));

    let entry = TopEntry {
        player: player.clone(),
        rank_key: key,
        floor: outcome.floor_reached,
        score: if outcome.ending == Ending::Extracted { outcome.score } else { 0 },
        hp_left: outcome.hp_left,
        actions: outcome.actions,
    };

    let mut next = Vec::new(env);
    let mut placed = false;
    for existing in old.iter() {
        if existing.player == *player {
            continue;
        }
        if !placed && key > existing.rank_key {
            next.push_back(entry.clone());
            placed = true;
        }
        next.push_back(existing);
    }
    if !placed {
        next.push_back(entry);
    }
    while next.len() > TOP_SIZE {
        next.pop_back();
    }

    env.storage().persistent().set(&board_key, &next);
    env.storage().persistent().extend_ttl(&board_key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

/// Mint the relics a verified extraction banked. Uses `try_mint` so a player
/// without a trustline never loses their verified result: the run is recorded
/// either way and `minted` reports whether every mint succeeded.
fn mint_relics(env: &Env, player: &Address, outcome: &Outcome) -> bool {
    let tokens: RelicTokens = env.storage().instance().get(&DataKey::Relics).unwrap();
    let mut all_minted = true;
    for (token, amount) in [
        (&tokens.common, outcome.relics_common),
        (&tokens.rare, outcome.relics_rare),
        (&tokens.core, outcome.relics_core),
    ] {
        if amount == 0 {
            continue;
        }
        let result = StellarAssetClient::new(env, token).try_mint(player, &(amount as i128));
        if !matches!(result, Ok(Ok(()))) {
            all_minted = false;
        }
    }
    all_minted
}

fn to_contract_outcome(outcome: &Outcome, key: u64) -> RunOutcome {
    RunOutcome {
        extracted: outcome.ending == Ending::Extracted,
        floor_reached: outcome.floor_reached,
        relics_common: outcome.relics_common,
        relics_rare: outcome.relics_rare,
        relics_core: outcome.relics_core,
        score: outcome.score,
        hp_left: outcome.hp_left,
        actions: outcome.actions,
        rank_key: key,
    }
}
