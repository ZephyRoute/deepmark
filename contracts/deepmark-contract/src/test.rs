//! Entrypoint tests for deepmark-contract, run against a sandbox `Env`.
//!
//! Pure rules live in `sim.rs`, `world.rs` and `systems.rs` and are tested
//! there without an `Env`. These tests cover storage, authorization, replay
//! protection, ranking, paging, relic minting and delver ownership.

use crate::components::{FreshHero, HeroChoice, Look, MAX_ACTIONS, RELIC_UNIT, TOP_SIZE};
use crate::sim::{
    Run, ACTION_ATTACK, ACTION_DESCEND, ACTION_DOWN, ACTION_EXTRACT, ACTION_LEFT, ACTION_RIGHT,
    ACTION_UP,
};
use crate::world::Loadout;
use crate::{DeepmarkContract, DeepmarkContractClient, Error};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{StellarAssetClient, TokenClient},
    Address, Bytes, Env, String,
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

fn look(env: &Env, name: &str) -> Look {
    Look {
        name: String::from_str(env, name),
        emblem: 1,
        cloak: 2,
    }
}

fn fresh(env: &Env, base: u32, weapon: u32, charm: u32, name: &str) -> HeroChoice {
    HeroChoice::Fresh(FreshHero {
        look: look(env, name),
        base,
        weapon,
        charm,
    })
}

/// Bulwark Pike and Stone Heart on Lantern: 13 HP, damage 2 to 3.
fn plain(env: &Env) -> HeroChoice {
    fresh(env, 0, 2, 2, "Ash")
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

/// Plays all three floors for a given seed, fighting only what blocks the way
/// to the stairs. Returns the log if the run ends in a floor 3 extraction.
fn try_clear(loadout: &Loadout, seed: u32) -> Option<Vec<u8>> {
    let mut run = Run::new(loadout, seed).ok()?;
    let mut log: Vec<u8> = Vec::new();

    fn step(run: &mut Run, log: &mut Vec<u8>, actions: &[u8]) -> bool {
        for a in actions {
            if run.apply(*a).is_err() {
                return false;
            }
            log.push(*a);
        }
        true
    }
    fn fight(run: &mut Run, log: &mut Vec<u8>) -> bool {
        while run.in_combat() {
            if !step(run, log, &[ACTION_ATTACK]) || run.is_finished() {
                return false;
            }
        }
        true
    }

    // Floor 1: the free detour to the stairs.
    let mut a = repeat(ACTION_UP, 3);
    a.extend(repeat(ACTION_RIGHT, 7));
    a.extend(repeat(ACTION_DOWN, 3));
    a.push(ACTION_RIGHT);
    a.push(ACTION_DESCEND);
    if !step(&mut run, &mut log, &a) {
        return None;
    }

    // Floor 2: the detour is held by the Skitter.
    let mut a = repeat(ACTION_UP, 3);
    a.extend(repeat(ACTION_RIGHT, 4));
    if !step(&mut run, &mut log, &a) || !fight(&mut run, &mut log) {
        return None;
    }
    let mut a = repeat(ACTION_RIGHT, 4);
    a.extend(repeat(ACTION_DOWN, 3));
    a.push(ACTION_RIGHT);
    a.push(ACTION_DESCEND);
    if !step(&mut run, &mut log, &a) {
        return None;
    }

    // Floor 3: the boss, then the walk to the stairs over the core relic.
    let a = repeat(ACTION_RIGHT, 4);
    if !step(&mut run, &mut log, &a) || !fight(&mut run, &mut log) {
        return None;
    }
    if !step(&mut run, &mut log, &repeat(ACTION_RIGHT, 6)) {
        return None;
    }

    let outcome = run.outcome(log.len() as u32)?;
    (outcome.floor_reached == 3 && outcome.ending == crate::sim::Ending::Extracted).then_some(log)
}

fn finish_ledger(f: &Fixture, actions: usize) {
    let now = f.env.ledger().sequence();
    set_ledger(&f.env, now + (actions as u32 / 16) + 1);
}

/// Opens runs, one after another, until the issued seed lets the scripted
/// player clear all three floors, then finishes that run. Returns the outcome.
fn clear_all_floors(
    f: &Fixture,
    player: &Address,
    choice: &HeroChoice,
    solver: &Loadout,
) -> crate::components::RunOutcome {
    for attempt in 0..300u32 {
        let now = f.env.ledger().sequence();
        set_ledger(&f.env, now + 10 + attempt % 3);
        let ticket = f.client.start_run(player, choice);
        if let Some(log) = try_clear(solver, ticket.seed) {
            finish_ledger(f, log.len());
            return f.client.finish_run(player, &bytes(&f.env, &log));
        }
    }
    panic!("no seed in 300 attempts allowed a clear");
}

/// A strong, sturdy fresh delver the scripted player can clear with often.
fn strong(env: &Env, name: &str) -> (HeroChoice, Loadout) {
    (
        fresh(env, 1, 1, 0, name),
        Loadout {
            base: 1,
            weapon: 1,
            charm: 0,
            rank: 0,
        },
    )
}

#[test]
fn start_run_issues_a_ticket_and_registers_the_player() {
    let f = setup();
    let player = Address::generate(&f.env);

    let ticket = f.client.start_run(&player, &plain(&f.env));

    assert_eq!(
        (ticket.base, ticket.weapon, ticket.charm, ticket.rank),
        (0, 2, 2, 0)
    );
    assert_eq!(ticket.start_ledger, 100);
    assert_eq!(ticket.veteran, None);
    assert_eq!(f.client.get_open_run(&player), Some(ticket));
    assert_eq!(f.client.player_count(), 1);
    assert_eq!(f.client.get_record(&player).unwrap().total_runs, 0);
}

#[test]
fn invalid_delvers_are_rejected() {
    let f = setup();
    let player = Address::generate(&f.env);
    let env = &f.env;

    assert_eq!(
        f.client.try_start_run(&player, &fresh(env, 9, 0, 0, "Ash")),
        Err(Ok(Error::InvalidHero))
    );
    assert_eq!(
        f.client.try_start_run(&player, &fresh(env, 0, 9, 0, "Ash")),
        Err(Ok(Error::InvalidHero))
    );
    assert_eq!(
        f.client.try_start_run(&player, &fresh(env, 0, 0, 9, "Ash")),
        Err(Ok(Error::InvalidHero))
    );

    for bad in [
        "Al",
        "A very long delver name",
        " Ash",
        "Ash ",
        "Ash  Voss",
        "Ash!",
        "Ash\u{e9}",
    ] {
        assert_eq!(
            f.client.try_start_run(&player, &fresh(env, 0, 0, 0, bad)),
            Err(Ok(Error::InvalidName)),
            "{bad}"
        );
    }

    let mut emblem = FreshHero {
        look: look(env, "Ash"),
        base: 0,
        weapon: 0,
        charm: 0,
    };
    emblem.look.emblem = 99;
    assert_eq!(
        f.client.try_start_run(&player, &HeroChoice::Fresh(emblem)),
        Err(Ok(Error::InvalidHero))
    );
    let mut cloak = FreshHero {
        look: look(env, "Ash"),
        base: 0,
        weapon: 0,
        charm: 0,
    };
    cloak.look.cloak = 99;
    assert_eq!(
        f.client.try_start_run(&player, &HeroChoice::Fresh(cloak)),
        Err(Ok(Error::InvalidHero))
    );
}

#[test]
fn seeds_differ_between_players_and_ledgers() {
    let f = setup();
    let a = Address::generate(&f.env);
    let b = Address::generate(&f.env);
    let seed_a = f.client.start_run(&a, &plain(&f.env)).seed;
    let seed_b = f.client.start_run(&b, &plain(&f.env)).seed;
    assert_ne!(seed_a, seed_b);

    set_ledger(&f.env, 200);
    let seed_a_later = f.client.start_run(&a, &plain(&f.env)).seed;
    assert_ne!(seed_a, seed_a_later);
}

#[test]
fn a_verified_run_updates_the_record_and_consumes_the_run() {
    let f = setup();
    let player = Address::generate(&f.env);
    f.client.start_run(&player, &plain(&f.env));
    let log = free_extraction();
    finish_ledger(&f, log.len());

    let outcome = f.client.finish_run(&player, &bytes(&f.env, &log));

    assert!(outcome.extracted);
    assert_eq!(outcome.floor_reached, 1);
    assert_eq!(outcome.score, 0);
    assert_eq!(outcome.hp_left, 13);
    assert_eq!(outcome.hero_id, None);
    assert_eq!(outcome.actions as usize, log.len());

    let record = f.client.get_record(&player).unwrap();
    assert_eq!(record.total_runs, 1);
    assert_eq!(record.extractions, 1);
    assert_eq!(record.best_key, outcome.rank_key);
    assert_eq!(f.client.get_open_run(&player), None);
    assert_eq!(f.client.top_fresh().len(), 1);
    assert_eq!(
        f.client.top_fresh().get(0).unwrap().name,
        String::from_str(&f.env, "Ash")
    );
    assert_eq!(f.client.top_veteran().len(), 0);
}

#[test]
fn the_same_log_cannot_be_claimed_twice() {
    let f = setup();
    let player = Address::generate(&f.env);
    f.client.start_run(&player, &plain(&f.env));
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
    f.client.start_run(&player, &plain(&f.env));
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
    f.client.start_run(&player, &plain(&f.env));
    let huge = repeat(ACTION_LEFT, MAX_ACTIONS as usize + 1);
    let result = f.client.try_finish_run(&player, &bytes(&f.env, &huge));
    assert_eq!(result, Err(Ok(Error::TooManyActions)));
}

#[test]
fn unknown_actions_incomplete_logs_and_padding_are_rejected() {
    let f = setup();
    let player = Address::generate(&f.env);
    f.client.start_run(&player, &plain(&f.env));
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
    let f = setup();
    let player = Address::generate(&f.env);
    f.client.start_run(&player, &plain(&f.env));
    set_ledger(&f.env, 400);
    let mut cheat = free_extraction();
    cheat.pop();
    cheat.push(ACTION_DESCEND);
    cheat.extend(repeat(ACTION_RIGHT, 12));
    cheat.push(ACTION_EXTRACT);
    assert!(f
        .client
        .try_finish_run(&player, &bytes(&f.env, &cheat))
        .is_err());
}

#[test]
fn starting_again_too_soon_is_rejected_and_later_it_forfeits_the_open_run() {
    let f = setup();
    let player = Address::generate(&f.env);
    f.client.start_run(&player, &plain(&f.env));

    set_ledger(&f.env, 103);
    assert_eq!(
        f.client.try_start_run(&player, &plain(&f.env)),
        Err(Ok(Error::StartCooldown))
    );

    set_ledger(&f.env, 106);
    let second = f
        .client
        .start_run(&player, &fresh(&f.env, 1, 0, 0, "Cinder One"));
    assert_eq!(second.base, 1);

    let record = f.client.get_record(&player).unwrap();
    assert_eq!(record.forfeits, 1);
    assert_eq!(record.total_runs, 1);
    assert_eq!(f.client.player_count(), 1);
}

#[test]
fn a_banked_relic_is_minted_as_a_stellar_asset() {
    let f = setup();
    let player = Address::generate(&f.env);
    f.client.start_run(&player, &plain(&f.env));
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

    client.start_run(&player, &plain(&env));
    let log = relic_extraction();
    set_ledger(&env, 100 + log.len() as u32 / 16 + 1);
    let outcome = client.finish_run(&player, &bytes(&env, &log));

    assert_eq!(outcome.relics_common, 1);
    let record = client.get_record(&player).unwrap();
    assert_eq!(record.extractions, 1);
    assert_eq!(client.top_fresh().len(), 1);
}

#[test]
fn a_run_without_relics_mints_nothing() {
    let f = setup();
    let player = Address::generate(&f.env);
    f.client.start_run(&player, &plain(&f.env));
    let log = free_extraction();
    finish_ledger(&f, log.len());
    f.client.finish_run(&player, &bytes(&f.env, &log));
    assert_eq!(TokenClient::new(&f.env, &f.common).balance(&player), 0);
}

#[test]
fn the_leaderboard_ranks_by_the_verified_result_and_lists_each_player_once() {
    let f = setup();
    let plain_player = Address::generate(&f.env);
    let relic_player = Address::generate(&f.env);

    f.client.start_run(&plain_player, &plain(&f.env));
    f.client
        .start_run(&relic_player, &fresh(&f.env, 0, 2, 2, "Relic Hunter"));
    let free = free_extraction();
    let rich = relic_extraction();
    finish_ledger(&f, rich.len());
    f.client.finish_run(&plain_player, &bytes(&f.env, &free));
    f.client.finish_run(&relic_player, &bytes(&f.env, &rich));

    let top = f.client.top_fresh();
    assert_eq!(top.len(), 2);
    assert_eq!(top.get(0).unwrap().player, relic_player);
    assert_eq!(top.get(0).unwrap().score, 1);
    assert_eq!(
        top.get(0).unwrap().name,
        String::from_str(&f.env, "Relic Hunter")
    );
    assert_eq!(top.get(1).unwrap().player, plain_player);

    // The lower ranked player improves and overtakes. Still two rows.
    set_ledger(&f.env, f.env.ledger().sequence() + 10);
    f.client.start_run(&plain_player, &plain(&f.env));
    finish_ledger(&f, rich.len());
    f.client.finish_run(&plain_player, &bytes(&f.env, &rich));
    assert_eq!(f.client.top_fresh().len(), 2);
}

#[test]
fn a_worse_run_does_not_replace_a_better_leaderboard_entry() {
    let f = setup();
    let player = Address::generate(&f.env);
    f.client.start_run(&player, &plain(&f.env));
    let rich = relic_extraction();
    finish_ledger(&f, rich.len());
    f.client.finish_run(&player, &bytes(&f.env, &rich));
    let best = f.client.get_record(&player).unwrap().best_key;

    set_ledger(&f.env, f.env.ledger().sequence() + 10);
    f.client.start_run(&player, &plain(&f.env));
    let free = free_extraction();
    finish_ledger(&f, free.len());
    f.client.finish_run(&player, &bytes(&f.env, &free));

    let record = f.client.get_record(&player).unwrap();
    assert_eq!(record.best_key, best);
    assert_eq!(record.total_runs, 2);
    assert_eq!(f.client.top_fresh().len(), 1);
}

#[test]
fn the_sorted_top_is_bounded_but_players_are_not() {
    let f = setup();
    let champion = Address::generate(&f.env);
    f.client.start_run(&champion, &plain(&f.env));
    let rich = relic_extraction();
    let free = free_extraction();
    finish_ledger(&f, rich.len());
    f.client.finish_run(&champion, &bytes(&f.env, &rich));

    let total = TOP_SIZE as usize + 20;
    for _ in 0..total {
        let player = Address::generate(&f.env);
        f.client.start_run(&player, &plain(&f.env));
        finish_ledger(&f, free.len());
        f.client.finish_run(&player, &bytes(&f.env, &free));
    }

    assert_eq!(f.client.player_count() as usize, total + 1);
    let top = f.client.top_fresh();
    assert_eq!(top.len(), TOP_SIZE);
    assert_eq!(top.get(0).unwrap().player, champion);
}

#[test]
fn players_are_paged_without_a_cap_on_how_many_exist() {
    let f = setup();
    let mut all = Vec::new();
    for _ in 0..5 {
        let p = Address::generate(&f.env);
        f.client.start_run(&p, &plain(&f.env));
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
    let outcome = f
        .client
        .verify_run(&0, &2, &2, &0, &12345, &bytes(&f.env, &log));
    assert!(outcome.extracted);
    assert_eq!(outcome.relics_common, 1);
    assert_eq!(f.client.player_count(), 0);

    let bad = f.client.try_verify_run(
        &0,
        &2,
        &2,
        &0,
        &12345,
        &bytes(&f.env, &repeat(ACTION_UP, 2)),
    );
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
    assert!(f.client.get_record(&Address::generate(&f.env)).is_none());
}

#[test]
fn nobody_can_act_for_an_address_that_did_not_sign() {
    let env = Env::default();
    set_ledger(&env, 100);
    let a = Address::generate(&env);
    let id = env.register(DeepmarkContract, (a.clone(), a.clone(), a.clone()));
    let client = DeepmarkContractClient::new(&env, &id);
    let victim = Address::generate(&env);

    assert!(client.try_start_run(&victim, &plain(&env)).is_err());
    assert!(client
        .try_finish_run(&victim, &bytes(&env, &free_extraction()))
        .is_err());
    assert!(client.try_transfer(&victim, &a, &0).is_err());
}

#[test]
fn the_worst_case_log_stays_far_under_the_cpu_budget() {
    let f = setup();
    let player = Address::generate(&f.env);
    f.client.start_run(&player, &plain(&f.env));

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

// ---- earned delvers ----

#[test]
fn clearing_all_three_floors_with_a_fresh_delver_earns_it() {
    let f = setup();
    let player = Address::generate(&f.env);
    let (choice, solver) = strong(&f.env, "Mara Voss");

    let outcome = clear_all_floors(&f, &player, &choice, &solver);

    assert!(outcome.extracted);
    assert_eq!(outcome.floor_reached, 3);
    let id = outcome.hero_id.expect("the delver should have been earned");
    let hero = f.client.hero(&id).unwrap();
    assert_eq!(hero.owner, player);
    assert_eq!(hero.look.name, String::from_str(&f.env, "Mara Voss"));
    assert_eq!((hero.base, hero.weapon, hero.charm), (1, 1, 0));
    assert_eq!(hero.clears, 1);
    assert_eq!(hero.proof_score, outcome.score);
    assert_eq!(hero.proof_hp_left, outcome.hp_left);
    assert_eq!(f.client.owner_of(&id), Some(player.clone()));
    assert_eq!(f.client.heroes_of(&player).len(), 1);
    assert_eq!(f.client.balance(&player), 1);
    assert_eq!(f.client.hero_count(), 1);
    // The scripted player skips the optional pockets, so only the boss relic is banked.
    assert_eq!(outcome.score, 3);
    assert_eq!(outcome.relics_core, 1);
    assert_eq!(
        TokenClient::new(&f.env, &f.core).balance(&player),
        RELIC_UNIT
    );
}

#[test]
fn a_run_that_does_not_clear_all_three_floors_earns_nothing() {
    let f = setup();
    let player = Address::generate(&f.env);
    f.client.start_run(&player, &plain(&f.env));
    let log = relic_extraction();
    finish_ledger(&f, log.len());
    let outcome = f.client.finish_run(&player, &bytes(&f.env, &log));

    assert_eq!(outcome.hero_id, None);
    assert_eq!(f.client.hero_count(), 0);
    assert_eq!(f.client.balance(&player), 0);
}

#[test]
fn a_veteran_needs_an_owner_and_an_existing_delver() {
    let f = setup();
    let owner = Address::generate(&f.env);
    let thief = Address::generate(&f.env);
    let (choice, solver) = strong(&f.env, "Mara Voss");
    let id = clear_all_floors(&f, &owner, &choice, &solver)
        .hero_id
        .unwrap();

    assert_eq!(
        f.client.try_start_run(&thief, &HeroChoice::Veteran(id)),
        Err(Ok(Error::NotHeroOwner))
    );
    assert_eq!(
        f.client.try_start_run(&owner, &HeroChoice::Veteran(999)),
        Err(Ok(Error::HeroNotFound))
    );
}

#[test]
fn a_veteran_descends_with_a_rank_bonus_and_climbs_its_own_ladder() {
    let f = setup();
    let player = Address::generate(&f.env);
    let (choice, solver) = strong(&f.env, "Mara Voss");
    let id = clear_all_floors(&f, &player, &choice, &solver)
        .hero_id
        .unwrap();
    assert_eq!(f.client.top_veteran().len(), 0);

    set_ledger(&f.env, f.env.ledger().sequence() + 10);
    let ticket = f.client.start_run(&player, &HeroChoice::Veteran(id));
    assert_eq!(ticket.rank, 1, "one victory is one point of rank");
    assert_eq!(ticket.veteran, Some(id));
    assert_eq!(ticket.look.name, String::from_str(&f.env, "Mara Voss"));

    // Finish a run as the veteran. A free extraction is enough to land on the ladder.
    let log = free_extraction();
    finish_ledger(&f, log.len());
    let outcome = f.client.finish_run(&player, &bytes(&f.env, &log));
    assert_eq!(
        outcome.hero_id, None,
        "a partial run does not advance the delver"
    );
    assert_eq!(f.client.hero(&id).unwrap().clears, 1);
    assert_eq!(f.client.top_veteran().len(), 1);
    assert_eq!(f.client.get_record(&player).unwrap().veteran_runs, 1);
}

#[test]
fn a_veteran_that_clears_again_gains_a_victory_and_no_new_delver() {
    let f = setup();
    let player = Address::generate(&f.env);
    let (choice, solver) = strong(&f.env, "Mara Voss");
    let id = clear_all_floors(&f, &player, &choice, &solver)
        .hero_id
        .unwrap();

    let vet_solver = Loadout {
        base: 1,
        weapon: 1,
        charm: 0,
        rank: 1,
    };
    let outcome = clear_all_floors(&f, &player, &HeroChoice::Veteran(id), &vet_solver);

    assert_eq!(outcome.hero_id, Some(id));
    assert_eq!(f.client.hero(&id).unwrap().clears, 2);
    assert_eq!(f.client.hero_count(), 1);
    assert_eq!(f.client.balance(&player), 1);
}

#[test]
fn delvers_can_be_given_away_and_the_new_owner_can_use_them() {
    let f = setup();
    let first = Address::generate(&f.env);
    let second = Address::generate(&f.env);
    let (choice, solver) = strong(&f.env, "Mara Voss");
    let id = clear_all_floors(&f, &first, &choice, &solver)
        .hero_id
        .unwrap();

    f.client.transfer(&first, &second, &id);

    assert_eq!(f.client.owner_of(&id), Some(second.clone()));
    assert_eq!(f.client.balance(&first), 0);
    assert_eq!(f.client.balance(&second), 1);
    assert_eq!(
        f.client.try_start_run(&first, &HeroChoice::Veteran(id)),
        Err(Ok(Error::NotHeroOwner))
    );
    set_ledger(&f.env, f.env.ledger().sequence() + 10);
    assert!(f
        .client
        .try_start_run(&second, &HeroChoice::Veteran(id))
        .is_ok());
}

#[test]
fn only_the_owner_can_give_a_delver_away() {
    let f = setup();
    let owner = Address::generate(&f.env);
    let other = Address::generate(&f.env);
    let (choice, solver) = strong(&f.env, "Mara Voss");
    let id = clear_all_floors(&f, &owner, &choice, &solver)
        .hero_id
        .unwrap();

    assert_eq!(
        f.client.try_transfer(&other, &other, &id),
        Err(Ok(Error::NotHeroOwner))
    );
    assert_eq!(
        f.client.try_transfer(&owner, &other, &999),
        Err(Ok(Error::HeroNotFound))
    );
    assert_eq!(f.client.owner_of(&id), Some(owner));
}

#[test]
fn a_veteran_given_away_mid_run_cannot_finish_for_the_old_owner() {
    let f = setup();
    let first = Address::generate(&f.env);
    let second = Address::generate(&f.env);
    let (choice, solver) = strong(&f.env, "Mara Voss");
    let id = clear_all_floors(&f, &first, &choice, &solver)
        .hero_id
        .unwrap();

    set_ledger(&f.env, f.env.ledger().sequence() + 10);
    f.client.start_run(&first, &HeroChoice::Veteran(id));
    f.client.transfer(&first, &second, &id);

    let log = free_extraction();
    finish_ledger(&f, log.len());
    assert_eq!(
        f.client.try_finish_run(&first, &bytes(&f.env, &log)),
        Err(Ok(Error::NotHeroOwner))
    );
}
