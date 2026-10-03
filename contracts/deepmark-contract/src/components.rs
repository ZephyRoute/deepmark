//! Data shapes and limits for deepmark-contract.
//!
//! The contract replays each run itself (see `sim.rs`), so everything stored
//! here is derived from a verified run, never from a number the client claims.

use soroban_sdk::{contracttype, Address};

/// A run the contract has opened for a player. The seed is issued on chain, so
/// the client cannot pick a favourable one.
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RunTicket {
    pub seed: u32,
    pub hero: u32,
    pub start_ledger: u32,
}

/// The result of a verified run, derived by replaying the action log.
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RunOutcome {
    pub extracted: bool,
    pub floor_reached: u32,
    pub relics_common: u32,
    pub relics_rare: u32,
    pub relics_core: u32,
    pub score: u32,
    pub hp_left: u32,
    pub actions: u32,
    pub rank_key: u64,
}

/// A player's persistent profile. `best_*` describe their best verified run
/// by `best_key`; the counters cover every run, including forfeited ones.
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PlayerRecord {
    pub best_key: u64,
    pub best_floor: u32,
    pub best_score: u32,
    pub best_hp_left: u32,
    pub best_actions: u32,
    pub total_runs: u32,
    pub extractions: u32,
    pub deaths: u32,
    pub forfeits: u32,
    pub relics_banked: u32,
    pub last_start_ledger: u32,
}

impl PlayerRecord {
    pub fn empty() -> Self {
        PlayerRecord {
            best_key: 0,
            best_floor: 0,
            best_score: 0,
            best_hp_left: 0,
            best_actions: 0,
            total_runs: 0,
            extractions: 0,
            deaths: 0,
            forfeits: 0,
            relics_banked: 0,
            last_start_ledger: 0,
        }
    }
}

/// One row of the on-chain leaderboard. A player appears at most once, with
/// their best verified run.
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TopEntry {
    pub player: Address,
    pub rank_key: u64,
    pub floor: u32,
    pub score: u32,
    pub hp_left: u32,
    pub actions: u32,
}

/// A player and their profile, for paged reads.
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PlayerSummary {
    pub player: Address,
    pub record: PlayerRecord,
}

/// The three relic assets, each a Stellar Asset Contract.
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RelicTokens {
    pub common: Address,
    pub rare: Address,
    pub core: Address,
}

#[contracttype]
pub enum DataKey {
    Relics,
    PlayerCount,
    PlayerAt(u32),
    Record(Address),
    Top,
    Run(Address),
}

/// Classic assets carry seven decimals. One relic is minted as one whole unit
/// so a wallet shows `1.0000000 DMCOMMON`, not a dust amount.
pub const RELIC_UNIT: i128 = 10_000_000;

pub const DAY_IN_LEDGERS: u32 = 17_280;
pub const TTL_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
pub const TTL_EXTEND_TO: u32 = 120 * DAY_IN_LEDGERS;
/// An unfinished run expires on its own after two days.
pub const RUN_TTL: u32 = 2 * DAY_IN_LEDGERS;

/// Most actions a single run may contain. A full three floor run with
/// generous wandering stays far below this.
pub const MAX_ACTIONS: u32 = 2048;
/// Entries kept in the sorted leaderboard.
pub const TOP_SIZE: u32 = 100;
/// Most players returned by one `players` call.
pub const MAX_PAGE: u32 = 50;
/// Ledgers (about five seconds each) a player must wait between starting runs.
/// Makes seed rerolling cost real time, not only a fee.
pub const START_COOLDOWN_LEDGERS: u32 = 6;
/// A run needs at least `actions / ACTIONS_PER_LEDGER` ledgers between start
/// and finish, so a run cannot be submitted faster than a person could play it.
pub const ACTIONS_PER_LEDGER: u32 = 16;
