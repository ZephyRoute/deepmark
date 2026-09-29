//! deepmark-contract — the one on-chain transaction per Deepmark run.
//!
//! Scaffolded with the Cougr CLI (`cougr new --template starter`), which set
//! up the crate, the `wasm32v1-none` build, and the test conventions
//! correctly and quickly. The generated code underneath was an anonymous
//! spawn-and-move ECS demo; Deepmark's actual need is a single persistent
//! record per player address, which does not fit Cougr's entity-component
//! model (built for many anonymous game entities, not one row per wallet),
//! so the domain logic here is hand-written soroban-sdk rather than forced
//! into `SorobanGame`. See `docs/architecture/onchain-boundary.md` in the
//! main repo for the full reasoning, including why combat itself stays
//! client-side instead of becoming a transaction per attack.

#![no_std]

pub mod components;
pub mod systems;
#[cfg(test)]
mod test;

use components::{DataKey, PlayerRecord, MAX_FLOOR, MAX_LEADERBOARD, TTL_EXTEND_TO, TTL_THRESHOLD};
use systems::apply_run;

use soroban_sdk::{contract, contracterror, contractevent, contractimpl, Address, Env, Vec};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    LeaderboardFull = 1,
}

/// Topic: ("run_recorded", player). Data: floor_reached, relics_kept, is_new_best.
#[contractevent]
pub struct RunRecorded {
    #[topic]
    pub player: Address,
    pub floor_reached: u32,
    pub relics_kept: u32,
    pub is_new_best: bool,
}

#[contract]
#[derive(Clone)]
pub struct DeepmarkContract;

#[contractimpl]
impl DeepmarkContract {
    /// Record the result of one finished run for `player`.
    ///
    /// Requires `player`'s own signature, so nobody can write a result for an
    /// address that is not theirs. This does not re-simulate the run to
    /// verify it: Deepmark's floor and combat logic run client-side for
    /// instant feedback, and this call only persists the outcome the player
    /// already saw. That is an accepted trust boundary for the hackathon
    /// window, not an oversight; the honest value on-chain is that the
    /// result becomes the player's own, portable, tamper-evident-once-written
    /// record instead of a row in a database only the developers can edit.
    pub fn record_run(env: Env, player: Address, floor_reached: u32, relics_kept: u32) -> Result<PlayerRecord, Error> {
        player.require_auth();
        let floor_reached = floor_reached.min(MAX_FLOOR);

        let key = DataKey::Record(player.clone());
        let existing: Option<PlayerRecord> = env.storage().persistent().get(&key);
        let is_first_run = existing.is_none();

        let (updated, is_new_best) = apply_run(existing, floor_reached, relics_kept);

        env.storage().persistent().set(&key, &updated);
        env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);

        if is_first_run {
            Self::push_leaderboard(&env, &player)?;
        }

        RunRecorded {
            player,
            floor_reached,
            relics_kept,
            is_new_best,
        }
        .publish(&env);

        Ok(updated)
    }

    /// A player's persistent record, or `None` if they have never recorded a run.
    pub fn get_record(env: Env, player: Address) -> Option<PlayerRecord> {
        env.storage().persistent().get(&DataKey::Record(player))
    }

    /// Addresses that have recorded at least one run, oldest first. The
    /// client reads each address's record separately to render a
    /// leaderboard; sorting and pagination stay off-chain on purpose.
    pub fn leaderboard(env: Env) -> Vec<Address> {
        let key = DataKey::Leaderboard;
        env.storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| Vec::new(&env))
    }

    fn push_leaderboard(env: &Env, player: &Address) -> Result<(), Error> {
        let key = DataKey::Leaderboard;
        let mut list: Vec<Address> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| Vec::new(env));

        if list.len() >= MAX_LEADERBOARD {
            return Err(Error::LeaderboardFull);
        }

        list.push_back(player.clone());
        env.storage().persistent().set(&key, &list);
        env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
        Ok(())
    }
}
