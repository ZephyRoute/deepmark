//! Storage lifetime. Persistent entries are archived when their TTL runs out,
//! so every call that already writes also keeps the shared and the touched
//! entries alive. `extend_ttl` with a threshold is a no-op (and costs no rent)
//! while an entry still has more than `TTL_THRESHOLD` ledgers left.

use crate::components::{DataKey, TTL_EXTEND_TO, TTL_THRESHOLD};
use soroban_sdk::{Address, Env};

/// Entries every player depends on: the player counter, the delver counter and
/// both leaderboards. They only change on rare events, so without this they
/// could idle past their TTL.
const SHARED_KEYS: [DataKey; 4] = [
    DataKey::PlayerCount,
    DataKey::HeroCount,
    DataKey::TopFresh,
    DataKey::TopVeteran,
];

/// Keep the contract instance (admin, relic tokens, and with it the code) alive
/// while the game is being played.
pub fn extend_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
}

/// Extend an existing persistent entry. Missing entries are skipped because
/// `extend_ttl` would trap on them.
pub fn keep_alive(env: &Env, key: &DataKey) {
    let storage = env.storage().persistent();
    if storage.has(key) {
        storage.extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND_TO);
    }
}

/// Keep the counters and leaderboards alive. Called by `start_run`.
pub fn keep_shared_alive(env: &Env) {
    for key in SHARED_KEYS.iter() {
        keep_alive(env, key);
    }
}

/// Keep a veteran and its owner's index alive when it is used for a run.
pub fn keep_hero_alive(env: &Env, id: u32, owner: &Address) {
    keep_alive(env, &DataKey::Hero(id));
    keep_alive(env, &DataKey::HeroesOf(owner.clone()));
}

/// Write a persistent value and extend its lifetime.
pub fn save_persistent<V: soroban_sdk::IntoVal<Env, soroban_sdk::Val>>(
    env: &Env,
    key: &DataKey,
    value: &V,
) {
    env.storage().persistent().set(key, value);
    env.storage()
        .persistent()
        .extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND_TO);
}
