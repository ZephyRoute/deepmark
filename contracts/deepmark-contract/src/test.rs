//! Entrypoint tests for deepmark-contract, run against a sandbox `Env`.
//!
//! Pure rules live in `sim.rs`, `world.rs` and `systems.rs` and are tested
//! there without an `Env`. These tests cover storage, authorization, replay
//! protection, ranking, paging and relic minting.

use crate::components::{PlayerRecord, MAX_ACTIONS, RELIC_UNIT, TOP_SIZE};
use crate::sim::{
    ACTION_ATTACK, ACTION_DESCEND, ACTION_DOWN, ACTION_EXTRACT, ACTION_LEFT, ACTION_RIGHT,
    ACTION_UP,
};
use crate::{DeepmarkContract, DeepmarkContractClient, Error};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{StellarAssetClient, TokenClient},
    Address, Bytes, Env,
};
use std::{vec, vec::Vec};

struct Fixture<'a> {
    env: Env,
    client: DeepmarkContractClient<'a>,
    common: Address,
    rare: Address,
    core: Address,
}

fn set_ledger(env: &Env, sequence: u32) {
    env.ledger().with_mut(|l| {
        l.sequence_number = sequence;
        l.timestamp = 1_700_000_000 + sequence as u64 * 5;
    });
}

fn setup<'a>() -> Fixture<'a> {
    let env = Env::default();
    env.mock_all_auths();
    set_ledger(&env, 100);

    let issuer = Address::generate(&env);
    let common = env
        .register_stellar_asset_contract_v2(issuer.clone())
        .address();
    let rare = env
        .register_stellar_asset_contract_v2(issuer.clone())
        .address();
    let core = env.register_stellar_asset_contract_v2(issuer).address();

    let contract_id = env.register(
        DeepmarkContract,
        (common.clone(), rare.clone(), core.clone()),
    );
    for token in [&common, &rare, &core] {
        StellarAssetClient::new(&env, token).set_admin(&contract_id);
    }
    let client = DeepmarkContractClient::new(&env, &contract_id);
    Fixture {
        env,
        client,
        common,
        rare,
        core,
    }
}

fn bytes(env: &Env, actions: &[u8]) -> Bytes {
    Bytes::from_slice(env, actions)
}

fn repeat(action: u8, times: usize) -> Vec<u8> {
    core::iter::repeat_n(action, times).collect()
}

/// Floor 1 without a fight: over the detour to the stairs, then extract.
/// It touches no RNG, so it is valid for any issued seed.
fn free_extraction() -> Vec<u8> {
    let mut a = Vec::new();
    a.extend(repeat(ACTION_UP, 3));
    a.extend(repeat(ACTION_RIGHT, 7));
    a.extend(repeat(ACTION_DOWN, 3));
    a.push(ACTION_RIGHT);
    a.push(ACTION_EXTRACT);
    a
}

/// Beat the floor 1 Warden, take the common relic from the pocket, walk out
/// over the detour and extract. Extra attacks after the kill are ignored by
/// the simulation, so this is valid for any seed and either delver.
fn relic_extraction() -> Vec<u8> {
    let mut a = repeat(ACTION_RIGHT, 4);
    a.extend(repeat(ACTION_ATTACK, 3));
    a.extend(repeat(ACTION_RIGHT, 2));
    a.extend(repeat(ACTION_LEFT, 2));
    a.extend(repeat(ACTION_UP, 3));
    a.extend(repeat(ACTION_RIGHT, 4));
    a.extend(repeat(ACTION_DOWN, 3));
    a.push(ACTION_RIGHT);
    a.push(ACTION_EXTRACT);
    a
}

fn finish_ledger(f: &Fixture, actions: usize) {
    let now = f.env.ledger().sequence();
    set_ledger(&f.env, now + (actions as u32 / 16) + 1);
}

#[test]
fn start_run_issues_a_ticket_and_registers_the_player() {
    let f = setup();
    let player = Address::generate(&f.env);

    let ticket = f.client.start_run(&player, &0);

    assert_eq!(ticket.hero, 0);
    assert_eq!(ticket.start_ledger, 100);
    assert_eq!(f.client.get_open_run(&player), Some(ticket));
    assert_eq!(f.client.player_count(), 1);
    assert_eq!(f.client.get_record(&player).unwrap().total_runs, 0);
}

#[test]
fn an_unknown_hero_is_rejected() {
    let f = setup();
    let player = Address::generate(&f.env);
    assert_eq!(
        f.client.try_start_run(&player, &9),
        Err(Ok(Error::InvalidHero))
    );
}

#[test]
fn seeds_differ_between_players_and_ledgers() {
    let f = setup();
    let a = Address::generate(&f.env);
    let b = Address::generate(&f.env);
    let seed_a = f.client.start_run(&a, &0).seed;
    let seed_b = f.client.start_run(&b, &0).seed;
    assert_ne!(seed_a, seed_b);

    set_ledger(&f.env, 200);
    let seed_a_later = f.client.start_run(&a, &0).seed;
    assert_ne!(seed_a, seed_a_later);
}

#[test]
fn a_verified_run_updates_the_record_and_consumes_the_run() {
    let f = setup();
    let player = Address::generate(&f.env);
    f.client.start_run(&player, &0);
    let log = free_extraction();
    finish_ledger(&f, log.len());

    let outcome = f.client.finish_run(&player, &bytes(&f.env, &log));

    assert!(outcome.extracted);
    assert_eq!(outcome.floor_reached, 1);
    assert_eq!(outcome.score, 0);
    assert_eq!(outcome.hp_left, 10);
    assert_eq!(outcome.actions as usize, log.len());

    let record = f.client.get_record(&player).unwrap();
    assert_eq!(record.total_runs, 1);
    assert_eq!(record.extractions, 1);
    assert_eq!(record.best_key, outcome.rank_key);
    assert_eq!(f.client.get_open_run(&player), None);
    assert_eq!(f.client.top().len(), 1);
}

#[test]
fn the_same_log_cannot_be_claimed_twice() {
    let f = setup();
    let player = Address::generate(&f.env);
    f.client.start_run(&player, &0);
    let log = free_extraction();
    finish_ledger(&f, log.len());
    f.client.finish_run(&player, &bytes(&f.env, &log));

    let again = f.client.try_finish_run(&player, &bytes(&f.env, &log));
    assert_eq!(again, Err(Ok(Error::RunNotStarted)));
    assert_eq!(f.client.get_record(&player).unwrap().total_runs, 1);
}

#[test]
fn finishing_without_starting_is_rejected() {
    let f = setup();
    let player = Address::generate(&f.env);
    let result = f
        .client
        .try_finish_run(&player, &bytes(&f.env, &free_extraction()));
    assert_eq!(result, Err(Ok(Error::RunNotStarted)));
}

#[test]
fn a_run_cannot_be_submitted_faster_than_it_could_be_played() {
    let f = setup();
    let player = Address::generate(&f.env);
    f.client.start_run(&player, &0);
    let log = free_extraction();

    let too_early = f.client.try_finish_run(&player, &bytes(&f.env, &log));
    assert_eq!(too_early, Err(Ok(Error::TooFast)));

    finish_ledger(&f, log.len());
    assert!(f
        .client
        .try_finish_run(&player, &bytes(&f.env, &log))
        .is_ok());
}

#[test]
fn oversized_logs_are_rejected() {
    let f = setup();
    let player = Address::generate(&f.env);
    f.client.start_run(&player, &0);
    let huge = repeat(ACTION_LEFT, MAX_ACTIONS as usize + 1);
    let result = f.client.try_finish_run(&player, &bytes(&f.env, &huge));
    assert_eq!(result, Err(Ok(Error::TooManyActions)));
}

#[test]
fn unknown_actions_incomplete_logs_and_padding_are_rejected() {
    let f = setup();
    let player = Address::generate(&f.env);
    f.client.start_run(&player, &0);
    set_ledger(&f.env, 300);

    let unknown = f
        .client
        .try_finish_run(&player, &bytes(&f.env, &[ACTION_UP, 42]));
    assert_eq!(unknown, Err(Ok(Error::InvalidAction)));

    let incomplete = f
        .client
        .try_finish_run(&player, &bytes(&f.env, &repeat(ACTION_UP, 3)));
    assert_eq!(incomplete, Err(Ok(Error::RunIncomplete)));

    let mut padded = free_extraction();
    padded.push(ACTION_UP);
    let trailing = f.client.try_finish_run(&player, &bytes(&f.env, &padded));
    assert_eq!(trailing, Err(Ok(Error::TrailingActions)));

    // None of the failures consumed the run.
    assert!(f.client.get_open_run(&player).is_some());
}

#[test]
fn a_claim_the_game_cannot_produce_is_rejected() {
    // Reaching the extraction prompt on floor 3 by skipping the fights is not
    // possible, so a "perfect run" log that ignores the guards never verifies.
    let f = setup();
    let player = Address::generate(&f.env);
    f.client.start_run(&player, &0);
    set_ledger(&f.env, 400);
    let mut cheat = free_extraction();
    cheat.pop();
    cheat.push(ACTION_DESCEND);
    cheat.extend(repeat(ACTION_RIGHT, 12));
    cheat.push(ACTION_EXTRACT);
    let result = f.client.try_finish_run(&player, &bytes(&f.env, &cheat));
    assert!(result.is_err());
}

#[test]
fn starting_again_too_soon_is_rejected_and_later_it_forfeits_the_open_run() {
    let f = setup();
    let player = Address::generate(&f.env);
    f.client.start_run(&player, &0);

    set_ledger(&f.env, 103);
    assert_eq!(
        f.client.try_start_run(&player, &0),
        Err(Ok(Error::StartCooldown))
    );

    set_ledger(&f.env, 106);
    let second = f.client.start_run(&player, &1);
    assert_eq!(second.hero, 1);

    let record = f.client.get_record(&player).unwrap();
    assert_eq!(record.forfeits, 1);
    assert_eq!(record.total_runs, 1);
    assert_eq!(f.client.player_count(), 1);
}

#[test]
fn a_banked_relic_is_minted_as_a_stellar_asset() {
    let f = setup();
    let player = Address::generate(&f.env);
    f.client.start_run(&player, &0);
    let log = relic_extraction();
    finish_ledger(&f, log.len());

    let outcome = f.client.finish_run(&player, &bytes(&f.env, &log));

    assert!(outcome.extracted);
    assert_eq!(outcome.relics_common, 1);
    assert_eq!(outcome.score, 1);
    assert_eq!(
        TokenClient::new(&f.env, &f.common).balance(&player),
        RELIC_UNIT
    );
    assert_eq!(TokenClient::new(&f.env, &f.rare).balance(&player), 0);
    assert_eq!(TokenClient::new(&f.env, &f.core).balance(&player), 0);
    assert_eq!(f.client.get_record(&player).unwrap().relics_banked, 1);
}

#[test]
fn a_failed_mint_never_loses_the_verified_run() {
    // Relic addresses that are not tokens make every mint fail, which is what
    // a player with no trustline looks like. The run must still be recorded.
    let env = Env::default();
    env.mock_all_auths();
    set_ledger(&env, 100);
    let bogus = [
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
    ];
    let id = env.register(
        DeepmarkContract,
        (bogus[0].clone(), bogus[1].clone(), bogus[2].clone()),
    );
    let client = DeepmarkContractClient::new(&env, &id);
    let player = Address::generate(&env);

    client.start_run(&player, &0);
    let log = relic_extraction();
    set_ledger(&env, 100 + log.len() as u32 / 16 + 1);
    let outcome = client.finish_run(&player, &bytes(&env, &log));

    assert_eq!(outcome.relics_common, 1);
    let record = client.get_record(&player).unwrap();
    assert_eq!(record.extractions, 1);
    assert_eq!(client.top().len(), 1);
}

#[test]
fn a_run_without_relics_mints_nothing() {
    let f = setup();
    let player = Address::generate(&f.env);
    f.client.start_run(&player, &0);
    let log = free_extraction();
    finish_ledger(&f, log.len());
    f.client.finish_run(&player, &bytes(&f.env, &log));
    assert_eq!(TokenClient::new(&f.env, &f.common).balance(&player), 0);
}

#[test]
fn the_leaderboard_ranks_by_the_verified_result_and_lists_each_player_once() {
    let f = setup();
    let plain = Address::generate(&f.env);
    let relic = Address::generate(&f.env);

    f.client.start_run(&plain, &0);
    f.client.start_run(&relic, &0);
    let free = free_extraction();
    let rich = relic_extraction();
    finish_ledger(&f, rich.len());
    f.client.finish_run(&plain, &bytes(&f.env, &free));
    f.client.finish_run(&relic, &bytes(&f.env, &rich));

    let top = f.client.top();
    assert_eq!(top.len(), 2);
    assert_eq!(top.get(0).unwrap().player, relic);
    assert_eq!(top.get(0).unwrap().score, 1);
    assert_eq!(top.get(1).unwrap().player, plain);

    // The lower ranked player improves and overtakes. Still two rows.
    set_ledger(&f.env, f.env.ledger().sequence() + 10);
    f.client.start_run(&plain, &0);
    finish_ledger(&f, rich.len());
    f.client.finish_run(&plain, &bytes(&f.env, &rich));
    let top = f.client.top();
    assert_eq!(top.len(), 2);
}

#[test]
fn a_worse_run_does_not_replace_a_better_leaderboard_entry() {
    let f = setup();
    let player = Address::generate(&f.env);
    f.client.start_run(&player, &0);
    let rich = relic_extraction();
    finish_ledger(&f, rich.len());
    f.client.finish_run(&player, &bytes(&f.env, &rich));
    let best = f.client.get_record(&player).unwrap().best_key;

    set_ledger(&f.env, f.env.ledger().sequence() + 10);
    f.client.start_run(&player, &0);
    let free = free_extraction();
    finish_ledger(&f, free.len());
    f.client.finish_run(&player, &bytes(&f.env, &free));

    let record = f.client.get_record(&player).unwrap();
    assert_eq!(record.best_key, best);
    assert_eq!(record.total_runs, 2);
    assert_eq!(f.client.top().len(), 1);
}

#[test]
fn the_sorted_top_is_bounded_but_players_are_not() {
    let f = setup();
    let champion = Address::generate(&f.env);
    f.client.start_run(&champion, &0);
    let rich = relic_extraction();
    let free = free_extraction();
    finish_ledger(&f, rich.len());
    f.client.finish_run(&champion, &bytes(&f.env, &rich));

    let total = TOP_SIZE as usize + 20;
    for _ in 0..total {
        let player = Address::generate(&f.env);
        f.client.start_run(&player, &0);
        finish_ledger(&f, free.len());
        f.client.finish_run(&player, &bytes(&f.env, &free));
    }

    assert_eq!(f.client.player_count() as usize, total + 1);
    let top = f.client.top();
    assert_eq!(top.len(), TOP_SIZE);
    assert_eq!(top.get(0).unwrap().player, champion);
}

#[test]
fn players_are_paged_without_a_cap_on_how_many_exist() {
    let f = setup();
    let mut all = Vec::new();
    for _ in 0..5 {
        let p = Address::generate(&f.env);
        f.client.start_run(&p, &0);
        all.push(p);
    }
    assert_eq!(f.client.player_count(), 5);

    let first = f.client.players(&0, &2);
    assert_eq!(first.len(), 2);
    assert_eq!(first.get(0).unwrap().player, all[0]);

    let rest = f.client.players(&2, &50);
    assert_eq!(rest.len(), 3);
    assert_eq!(rest.get(2).unwrap().player, all[4]);

    assert_eq!(f.client.players(&9, &10).len(), 0);
}

#[test]
fn verify_run_audits_any_run_without_touching_state() {
    let f = setup();
    let log = relic_extraction();
    let outcome = f.client.verify_run(&0, &12345, &bytes(&f.env, &log));
    assert!(outcome.extracted);
    assert_eq!(outcome.relics_common, 1);
    assert_eq!(f.client.player_count(), 0);

    let bad = f
        .client
        .try_verify_run(&0, &12345, &bytes(&f.env, &repeat(ACTION_UP, 2)));
    assert_eq!(bad, Err(Ok(Error::RunIncomplete)));
}

#[test]
fn relic_tokens_reports_the_configured_assets() {
    let f = setup();
    let tokens = f.client.relic_tokens();
    assert_eq!(tokens.common, f.common);
    assert_eq!(tokens.rare, f.rare);
    assert_eq!(tokens.core, f.core);
}

#[test]
fn unknown_players_have_no_record() {
    let f = setup();
    assert_eq!(
        f.client.get_record(&Address::generate(&f.env)),
        None::<PlayerRecord>
    );
}

#[test]
fn nobody_can_act_for_an_address_that_did_not_sign() {
    let env = Env::default();
    set_ledger(&env, 100);
    let a = Address::generate(&env);
    let id = env.register(DeepmarkContract, (a.clone(), a.clone(), a.clone()));
    let client = DeepmarkContractClient::new(&env, &id);
    let victim = Address::generate(&env);

    assert!(client.try_start_run(&victim, &0).is_err());
    assert!(client
        .try_finish_run(&victim, &bytes(&env, &free_extraction()))
        .is_err());
}

#[test]
fn the_worst_case_log_stays_far_under_the_cpu_budget() {
    let f = setup();
    let player = Address::generate(&f.env);
    f.client.start_run(&player, &0);

    // 2047 inputs: step to the wall, bump it for the rest, step back, then a
    // short legal path. Bumps are no-ops but still cost a replay step each.
    let mut log = vec![ACTION_LEFT];
    log.extend(repeat(ACTION_LEFT, 1900));
    log.push(ACTION_RIGHT);
    log.extend(free_extraction());
    assert!(log.len() < MAX_ACTIONS as usize);
    finish_ledger(&f, log.len());

    f.env.cost_estimate().budget().reset_unlimited();
    f.client.finish_run(&player, &bytes(&f.env, &log));
    let cpu = f.env.cost_estimate().budget().cpu_instruction_cost();
    std::println!("worst case finish_run cpu instructions: {cpu}");
    assert!(
        cpu < 100_000_000,
        "finish_run used {cpu} instructions, limit is 400M"
    );
}
