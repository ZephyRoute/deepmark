//! Data shapes for deepmark-contract.
//!
//! Deepmark's run simulation (floor generation, combat, rewards) runs
//! entirely client-side for instant feedback; see
//! `docs/architecture/onchain-boundary.md` in the main repo for why. This
//! contract is the one on-chain transaction per run: it persists the result,
//! keyed by the player's own Stellar address, so it is owned by the player
//! and outside the app's own database rather than something the app could
//! quietly edit later.

use soroban_sdk::{contracttype, Address};

/// A player's best-ever results across every run they have recorded.
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PlayerRecord {
    pub best_floor: u32,
    pub best_relics: u32,
    pub total_runs: u32,
}

impl PlayerRecord {
    pub fn empty() -> Self {
        PlayerRecord {
            best_floor: 0,
            best_relics: 0,
            total_runs: 0,
        }
    }
}

#[contracttype]
pub enum DataKey {
    /// One entry per player who has ever recorded a run.
    Record(Address),
    /// Addresses that have recorded at least one run, oldest first, capped at
    /// `MAX_LEADERBOARD`. The client reads each address's record separately
    /// to render a leaderboard: keeping the contract itself simple was
    /// preferred over also sorting or paginating on-chain for a 7-day scope.
    Leaderboard,
}

/// The highest floor Deepmark's Phase 2 vertical slice contains. Any
/// `floor_reached` above this is clamped, not trusted at face value.
pub const MAX_FLOOR: u32 = 3;

/// Leaderboard size cap so `Leaderboard` storage cannot grow without bound.
pub const MAX_LEADERBOARD: u32 = 500;

pub const DAY_IN_LEDGERS: u32 = 17_280;
pub const TTL_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
pub const TTL_EXTEND_TO: u32 = 120 * DAY_IN_LEDGERS;
