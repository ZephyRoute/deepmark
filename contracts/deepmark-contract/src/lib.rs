//! deepmark-contract: verified runs, earned delvers and relic assets.
//!
//! A run has two on-chain steps and neither blocks play:
//!
//! 1. `start_run` opens a run, issues the seed on chain, and fixes the delver:
//!    a fresh one built in the creator, or a veteran the player owns.
//! 2. `finish_run` takes the action log, replays the run with the same
//!    deterministic simulation the client uses, derives the result itself,
//!    ranks it, mints banked relics, and, if a fresh delver cleared all three
//!    floors, mints that delver to the player.
//!
//! The contract never trusts a claimed result. See `sim.rs` for the replay and
//! `docs/architecture/onchain-boundary.md` for what this does and does not
//! prove.

#![no_std]

#[cfg(test)]
extern crate std;

pub mod components;
pub mod rng;
pub mod sim;
pub mod systems;
#[cfg(test)]
mod test;
pub mod world;

use components::{
    DataKey, FreshHero, Hero, HeroChoice, Look, PlayerRecord, PlayerSummary, RelicTokens,
    RunOutcome, RunTicket, TopEntry, ACTIONS_PER_LEDGER, MAX_ACTIONS, MAX_HEROES_PER_OWNER,
    MAX_PAGE, RELIC_UNIT, RUN_TTL, START_COOLDOWN_LEDGERS, TOP_SIZE, TTL_EXTEND_TO, TTL_THRESHOLD,
};
use sim::{Ending, Outcome, SimError};
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, token::StellarAssetClient, xdr::ToXdr,
    Address, Bytes, Env, String, Vec,
};
use systems::{apply_outcome, rank_key};
use world::{Loadout, MAX_FLOOR, MAX_RANK};

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
    InvalidName = 9,
    HeroNotFound = 10,
    NotHeroOwner = 11,
}

impl From<SimError> for Error {
    fn from(value: SimError) -> Self {
        match value {
            SimError::UnknownLoadout => Error::InvalidHero,
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
    pub base: u32,
    pub weapon: u32,
    pub charm: u32,
    pub rank: u32,
    pub veteran: Option<u32>,
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
    pub hero_id: Option<u32>,
}

/// Topic: ("hero_earned", player). A delver became the player's own.
#[contractevent]
pub struct HeroEarned {
    #[topic]
    pub player: Address,
    pub hero_id: u32,
    pub name: String,
}

/// Topic: ("hero_transfer", from).
#[contractevent]
pub struct HeroTransfer {
    #[topic]
    pub from: Address,
    pub to: Address,
    pub hero_id: u32,
}

#[contract]
#[derive(Clone)]
pub struct DeepmarkContract;

#[contractimpl]
impl DeepmarkContract {
    /// Sets the three relic Stellar Asset Contracts once. There is no admin
    /// and no upgrade path: what is deployed is what runs.
    pub fn __constructor(
        env: Env,
        relic_common: Address,
        relic_rare: Address,
        relic_core: Address,
    ) {
        let tokens = RelicTokens {
            common: relic_common,
            rare: relic_rare,
            core: relic_core,
        };
        env.storage().instance().set(&DataKey::Relics, &tokens);
    }

    /// Open a run for `player`, issue its seed and fix the delver. Starting
    /// while another run is open forfeits the old one, which stays on the
    /// profile. A veteran must be owned by `player`.
    pub fn start_run(env: Env, player: Address, choice: HeroChoice) -> Result<RunTicket, Error> {
        player.require_auth();

        let (loadout, look, veteran) = match choice {
            HeroChoice::Fresh(fresh) => {
                let loadout = validate_fresh(&fresh)?;
                (loadout, fresh.look, None)
            }
            HeroChoice::Veteran(id) => {
                let hero = load_hero(&env, id)?;
                if hero.owner != player {
                    return Err(Error::NotHeroOwner);
                }
                let rank = hero.clears.min(MAX_RANK);
                let loadout = Loadout {
                    base: hero.base,
                    weapon: hero.weapon,
                    charm: hero.charm,
                    rank,
                };
                (loadout, hero.look, Some(id))
            }
        };

        let now = env.ledger().sequence();
        let record_key = DataKey::Record(player.clone());
        let existing: Option<PlayerRecord> = env.storage().persistent().get(&record_key);
        let is_new_player = existing.is_none();
        let mut record = existing.unwrap_or_else(PlayerRecord::empty);

        if record.last_start_ledger > 0
            && now
                < record
                    .last_start_ledger
                    .saturating_add(START_COOLDOWN_LEDGERS)
        {
            return Err(Error::StartCooldown);
        }

        let run_key = DataKey::Run(player.clone());
        if env.storage().temporary().has(&run_key) {
            record.forfeits = record.forfeits.saturating_add(1);
            record.total_runs = record.total_runs.saturating_add(1);
        }

        let seed = derive_seed(&env, &player, record.total_runs);
        let ticket = RunTicket {
            seed,
            start_ledger: now,
            base: loadout.base,
            weapon: loadout.weapon,
            charm: loadout.charm,
            rank: loadout.rank,
            look,
            veteran,
        };
        env.storage().temporary().set(&run_key, &ticket);
        env.storage()
            .temporary()
            .extend_ttl(&run_key, RUN_TTL, RUN_TTL);

        record.last_start_ledger = now;
        save_record(&env, &record_key, &record);
        if is_new_player {
            register_player(&env, &player);
        }

        RunStarted {
            player,
            seed,
            base: loadout.base,
            weapon: loadout.weapon,
            charm: loadout.charm,
            rank: loadout.rank,
            veteran,
        }
        .publish(&env);
        Ok(ticket)
    }

    /// Replay `actions` against the open run, derive the result, update the
    /// profile and the right leaderboard, mint banked relics, and earn or
    /// advance a delver after a full clear. The run is consumed, so the same
    /// log cannot be claimed twice.
    pub fn finish_run(env: Env, player: Address, actions: Bytes) -> Result<RunOutcome, Error> {
        player.require_auth();
        if actions.len() > MAX_ACTIONS {
            return Err(Error::TooManyActions);
        }

        let run_key = DataKey::Run(player.clone());
        let ticket: RunTicket = env
            .storage()
            .temporary()
            .get(&run_key)
            .ok_or(Error::RunNotStarted)?;

        // A veteran that changed hands mid run cannot finish for the old owner.
        if let Some(id) = ticket.veteran {
            let hero = load_hero(&env, id)?;
            if hero.owner != player {
                return Err(Error::NotHeroOwner);
            }
        }

        let earliest = ticket
            .start_ledger
            .saturating_add(actions.len().div_ceil(ACTIONS_PER_LEDGER));
        if env.ledger().sequence() < earliest {
            return Err(Error::TooFast);
        }

        let loadout = Loadout {
            base: ticket.base,
            weapon: ticket.weapon,
            charm: ticket.charm,
            rank: ticket.rank,
        };
        let outcome = sim::replay(&loadout, ticket.seed, actions.iter())?;
        let key = rank_key(&outcome);
        env.storage().temporary().remove(&run_key);

        let veteran = ticket.veteran.is_some();
        let record_key = DataKey::Record(player.clone());
        let existing: Option<PlayerRecord> = env.storage().persistent().get(&record_key);
        let (record, is_new_best) = apply_outcome(existing, &outcome, key, veteran);
        save_record(&env, &record_key, &record);

        if is_new_best {
            let board = if veteran {
                DataKey::TopVeteran
            } else {
                DataKey::TopFresh
            };
            update_top(&env, board, &player, &outcome, key, &ticket.look);
        }

        let cleared = outcome.ending == Ending::Extracted && outcome.floor_reached == MAX_FLOOR;
        let hero_id = if cleared {
            earn_or_advance(&env, &player, &ticket, &outcome)
        } else {
            None
        };

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
            hero_id,
        }
        .publish(&env);

        Ok(to_contract_outcome(&outcome, key, hero_id))
    }

    /// Replay any run without touching state. Anyone can audit a result with
    /// the delver, the seed from the `run_started` event, and the action log.
    pub fn verify_run(
        _env: Env,
        base: u32,
        weapon: u32,
        charm: u32,
        rank: u32,
        seed: u32,
        actions: Bytes,
    ) -> Result<RunOutcome, Error> {
        if actions.len() > MAX_ACTIONS {
            return Err(Error::TooManyActions);
        }
        let loadout = Loadout {
            base,
            weapon,
            charm,
            rank,
        };
        let outcome = sim::replay(&loadout, seed, actions.iter())?;
        Ok(to_contract_outcome(&outcome, rank_key(&outcome), None))
    }

    /// A player's persistent profile, or `None` if they have never started a run.
    pub fn get_record(env: Env, player: Address) -> Option<PlayerRecord> {
        env.storage().persistent().get(&DataKey::Record(player))
    }

    /// The run a player has open, if any.
    pub fn get_open_run(env: Env, player: Address) -> Option<RunTicket> {
        env.storage().temporary().get(&DataKey::Run(player))
    }

    /// Best verified runs by fresh delvers, best first, at most `TOP_SIZE`.
    pub fn top_fresh(env: Env) -> Vec<TopEntry> {
        env.storage()
            .persistent()
            .get(&DataKey::TopFresh)
            .unwrap_or_else(|| Vec::new(&env))
    }

    /// Best verified runs by veterans, best first, at most `TOP_SIZE`.
    pub fn top_veteran(env: Env) -> Vec<TopEntry> {
        env.storage()
            .persistent()
            .get(&DataKey::TopVeteran)
            .unwrap_or_else(|| Vec::new(&env))
    }

    /// How many distinct players have ever started a run. Not capped.
    pub fn player_count(env: Env) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::PlayerCount)
            .unwrap_or(0)
    }

    /// Players in the order they first appeared, with profiles, at most
    /// `MAX_PAGE` per call.
    pub fn players(env: Env, start: u32, limit: u32) -> Vec<PlayerSummary> {
        let count: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::PlayerCount)
            .unwrap_or(0);
        let end = start.saturating_add(limit.min(MAX_PAGE)).min(count);
        let mut out = Vec::new(&env);
        let mut i = start;
        while i < end {
            let address: Option<Address> = env.storage().persistent().get(&DataKey::PlayerAt(i));
            if let Some(player) = address {
                let record: Option<PlayerRecord> = env
                    .storage()
                    .persistent()
                    .get(&DataKey::Record(player.clone()));
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

    /// A delver by id, or `None`.
    pub fn hero(env: Env, id: u32) -> Option<Hero> {
        env.storage().persistent().get(&DataKey::Hero(id))
    }

    /// Who owns a delver, or `None`.
    pub fn owner_of(env: Env, id: u32) -> Option<Address> {
        let hero: Option<Hero> = env.storage().persistent().get(&DataKey::Hero(id));
        hero.map(|h| h.owner)
    }

    /// The ids of every delver `owner` holds.
    pub fn heroes_of(env: Env, owner: Address) -> Vec<u32> {
        env.storage()
            .persistent()
            .get(&DataKey::HeroesOf(owner))
            .unwrap_or_else(|| Vec::new(&env))
    }

    /// How many delvers `owner` holds.
    pub fn balance(env: Env, owner: Address) -> u32 {
        let ids: Vec<u32> = env
            .storage()
            .persistent()
            .get(&DataKey::HeroesOf(owner))
            .unwrap_or_else(|| Vec::new(&env));
        ids.len()
    }

    /// How many delvers have ever been earned.
    pub fn hero_count(env: Env) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::HeroCount)
            .unwrap_or(0)
    }

    /// Give a delver you own to another address.
    pub fn transfer(env: Env, from: Address, to: Address, id: u32) -> Result<(), Error> {
        from.require_auth();
        let mut hero = load_hero(&env, id)?;
        if hero.owner != from {
            return Err(Error::NotHeroOwner);
        }
        let mut theirs: Vec<u32> = env
            .storage()
            .persistent()
            .get(&DataKey::HeroesOf(to.clone()))
            .unwrap_or_else(|| Vec::new(&env));
        if theirs.len() >= MAX_HEROES_PER_OWNER {
            return Err(Error::InvalidHero);
        }

        let mine: Vec<u32> = env
            .storage()
            .persistent()
            .get(&DataKey::HeroesOf(from.clone()))
            .unwrap_or_else(|| Vec::new(&env));
        let mut remaining = Vec::new(&env);
        for owned in mine.iter() {
            if owned != id {
                remaining.push_back(owned);
            }
        }
        save_persistent(&env, &DataKey::HeroesOf(from.clone()), &remaining);

        theirs.push_back(id);
        save_persistent(&env, &DataKey::HeroesOf(to.clone()), &theirs);

        hero.owner = to.clone();
        save_persistent(&env, &DataKey::Hero(id), &hero);
        HeroTransfer {
            from,
            to,
            hero_id: id,
        }
        .publish(&env);
        Ok(())
    }
}

fn name_is_valid(name: &String) -> bool {
    let len = name.len() as usize;
    if !(world::NAME_MIN..=world::NAME_MAX).contains(&len) {
        return false;
    }
    let mut buffer = [0u8; world::NAME_MAX];
    name.copy_into_slice(&mut buffer[..len]);
    world::is_valid_name(&buffer[..len])
}

fn validate_fresh(fresh: &FreshHero) -> Result<Loadout, Error> {
    if !name_is_valid(&fresh.look.name) {
        return Err(Error::InvalidName);
    }
    if fresh.look.emblem >= world::EMBLEM_COUNT || fresh.look.cloak >= world::CLOAK_COUNT {
        return Err(Error::InvalidHero);
    }
    let loadout = Loadout {
        base: fresh.base,
        weapon: fresh.weapon,
        charm: fresh.charm,
        rank: 0,
    };
    if world::stats_for(&loadout).is_none() {
        return Err(Error::InvalidHero);
    }
    Ok(loadout)
}

fn load_hero(env: &Env, id: u32) -> Result<Hero, Error> {
    env.storage()
        .persistent()
        .get(&DataKey::Hero(id))
        .ok_or(Error::HeroNotFound)
}

fn derive_seed(env: &Env, player: &Address, runs: u32) -> u32 {
    let mut material = Bytes::new(env);
    material.append(&Bytes::from_array(
        env,
        &env.ledger().sequence().to_be_bytes(),
    ));
    material.append(&Bytes::from_array(
        env,
        &env.ledger().timestamp().to_be_bytes(),
    ));
    material.append(&Bytes::from_array(env, &runs.to_be_bytes()));
    material.append(&player.clone().to_xdr(env));
    let hash = env.crypto().sha256(&material).to_array();
    u32::from_be_bytes([hash[0], hash[1], hash[2], hash[3]])
}

fn save_persistent<V: soroban_sdk::IntoVal<Env, soroban_sdk::Val>>(
    env: &Env,
    key: &DataKey,
    value: &V,
) {
    env.storage().persistent().set(key, value);
    env.storage()
        .persistent()
        .extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

fn save_record(env: &Env, key: &DataKey, record: &PlayerRecord) {
    save_persistent(env, key, record);
}

fn register_player(env: &Env, player: &Address) {
    let count: u32 = env
        .storage()
        .persistent()
        .get(&DataKey::PlayerCount)
        .unwrap_or(0);
    save_persistent(env, &DataKey::PlayerAt(count), player);
    save_persistent(env, &DataKey::PlayerCount, &count.saturating_add(1));
}

/// Keep a leaderboard sorted best first with one entry per player. Only called
/// when a run improved the player's best on that ladder, so the old entry (if
/// any) is replaced.
fn update_top(
    env: &Env,
    board_key: DataKey,
    player: &Address,
    outcome: &Outcome,
    key: u64,
    look: &Look,
) {
    let old: Vec<TopEntry> = env
        .storage()
        .persistent()
        .get(&board_key)
        .unwrap_or_else(|| Vec::new(env));

    let entry = TopEntry {
        player: player.clone(),
        rank_key: key,
        floor: outcome.floor_reached,
        score: if outcome.ending == Ending::Extracted {
            outcome.score
        } else {
            0
        },
        hp_left: outcome.hp_left,
        actions: outcome.actions,
        name: look.name.clone(),
        emblem: look.emblem,
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
    save_persistent(env, &board_key, &next);
}

/// A full clear. A fresh delver becomes the player's own; a veteran gains a
/// victory. Returns the id of the delver involved, or `None` if an owner is
/// already at the cap and no new delver could be minted.
fn earn_or_advance(
    env: &Env,
    player: &Address,
    ticket: &RunTicket,
    outcome: &Outcome,
) -> Option<u32> {
    if let Some(id) = ticket.veteran {
        let mut hero: Hero = env.storage().persistent().get(&DataKey::Hero(id))?;
        hero.clears = hero.clears.saturating_add(1);
        save_persistent(env, &DataKey::Hero(id), &hero);
        return Some(id);
    }

    let mut owned: Vec<u32> = env
        .storage()
        .persistent()
        .get(&DataKey::HeroesOf(player.clone()))
        .unwrap_or_else(|| Vec::new(env));
    if owned.len() >= MAX_HEROES_PER_OWNER {
        return None;
    }

    let id: u32 = env
        .storage()
        .persistent()
        .get(&DataKey::HeroCount)
        .unwrap_or(0);
    let hero = Hero {
        id,
        owner: player.clone(),
        look: ticket.look.clone(),
        base: ticket.base,
        weapon: ticket.weapon,
        charm: ticket.charm,
        clears: 1,
        minted_ledger: env.ledger().sequence(),
        proof_score: outcome.score,
        proof_hp_left: outcome.hp_left,
        proof_actions: outcome.actions,
    };
    save_persistent(env, &DataKey::Hero(id), &hero);
    owned.push_back(id);
    save_persistent(env, &DataKey::HeroesOf(player.clone()), &owned);
    save_persistent(env, &DataKey::HeroCount, &id.saturating_add(1));

    HeroEarned {
        player: player.clone(),
        hero_id: id,
        name: ticket.look.name.clone(),
    }
    .publish(env);
    Some(id)
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
        let result =
            StellarAssetClient::new(env, token).try_mint(player, &(amount as i128 * RELIC_UNIT));
        if !matches!(result, Ok(Ok(()))) {
            all_minted = false;
        }
    }
    all_minted
}

fn to_contract_outcome(outcome: &Outcome, key: u64, hero_id: Option<u32>) -> RunOutcome {
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
        hero_id,
    }
}
