//! Tests for the audited weaknesses: self transfers, a missing relic
//! configuration, failed mints, and storage lifetime.

use crate::components::{DataKey, HeroChoice, DAY_IN_LEDGERS, TTL_EXTEND_TO, TTL_THRESHOLD};
use crate::test::{
    bytes, clear_all_floors, finish_ledger, free_extraction, plain, relic_extraction, set_ledger,
    setup, strong,
};
use crate::{DeepmarkContract, DeepmarkContractClient, Error};
use soroban_sdk::{
    testutils::{storage::Persistent as _, Address as _},
    Address, Env,
};

fn ttl_of(f: &crate::test::Fixture, key: &DataKey) -> u32 {
    f.env.as_contract(&f.client.address, || {
        f.env.storage().persistent().get_ttl(key)
    })
}

#[test]
fn giving_a_delver_to_its_own_owner_changes_nothing() {
    let f = setup();
    let owner = Address::generate(&f.env);
    let (choice, solver) = strong(&f.env, "Mara Voss");
    let id = clear_all_floors(&f, &owner, &choice, &solver)
        .hero_id
        .unwrap();

    f.client.transfer(&owner, &owner, &id);
    f.client.transfer(&owner, &owner, &id);

    assert_eq!(f.client.balance(&owner), 1);
    assert_eq!(f.client.heroes_of(&owner).len(), 1);
    assert_eq!(f.client.heroes_of(&owner).get(0), Some(id));
    assert_eq!(f.client.owner_of(&id), Some(owner));
    assert_eq!(f.client.hero_count(), 1);
}

#[test]
fn a_self_transfer_still_needs_the_owner() {
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
        f.client.try_transfer(&owner, &owner, &999),
        Err(Ok(Error::HeroNotFound))
    );
    assert_eq!(f.client.balance(&other), 0);
    assert_eq!(f.client.balance(&owner), 1);
}

#[test]
fn transfers_keep_every_delver_in_exactly_one_list() {
    let f = setup();
    let first = Address::generate(&f.env);
    let second = Address::generate(&f.env);
    let (choice, solver) = strong(&f.env, "Mara Voss");
    let id = clear_all_floors(&f, &first, &choice, &solver)
        .hero_id
        .unwrap();

    f.client.transfer(&first, &second, &id);
    f.client.transfer(&second, &second, &id);
    f.client.transfer(&second, &first, &id);
    f.client.transfer(&first, &second, &id);

    assert_eq!(f.client.heroes_of(&first).len(), 0);
    assert_eq!(f.client.heroes_of(&second).len(), 1);
    assert_eq!(f.client.balance(&first) + f.client.balance(&second), 1);
    assert_eq!(f.client.owner_of(&id), Some(second));
}

#[test]
fn a_missing_relic_configuration_is_a_typed_error() {
    let f = setup();
    let player = Address::generate(&f.env);
    f.client.start_run(&player, &plain(&f.env));
    f.env.as_contract(&f.client.address, || {
        f.env.storage().instance().remove(&DataKey::Relics);
    });

    assert_eq!(f.client.try_relic_tokens(), Err(Ok(Error::NotInitialized)));

    let log = relic_extraction();
    finish_ledger(&f, log.len());
    assert_eq!(
        f.client.try_finish_run(&player, &bytes(&f.env, &log)),
        Err(Ok(Error::NotInitialized))
    );
    assert!(f.client.get_open_run(&player).is_some());
}

/// A contract whose relic addresses are not tokens, so every mint fails the
/// way a mint to a player without a trustline does.
fn failing_mint_setup<'a>(env: &'a Env) -> DeepmarkContractClient<'a> {
    let id = env.register(
        DeepmarkContract,
        (
            Address::generate(env),
            Address::generate(env),
            Address::generate(env),
            Address::generate(env),
        ),
    );
    DeepmarkContractClient::new(env, &id)
}

#[test]
fn a_failed_mint_fails_the_finish_and_keeps_the_run_open() {
    let env = Env::default();
    env.mock_all_auths();
    set_ledger(&env, 100);
    let client = failing_mint_setup(&env);
    let player = Address::generate(&env);

    let ticket = client.start_run(&player, &plain(&env));
    let log = relic_extraction();
    set_ledger(&env, 100 + log.len() as u32 / 16 + 1);
    assert_eq!(
        client.try_finish_run(&player, &bytes(&env, &log)),
        Err(Ok(Error::MintFailed))
    );

    // Nothing was recorded and the very same run can still be finished.
    assert_eq!(client.get_open_run(&player), Some(ticket));
    let record = client.get_record(&player).unwrap();
    assert_eq!(record.extractions, 0);
    assert_eq!(client.top_fresh().len(), 0);
}

#[test]
fn an_extraction_without_relics_needs_no_mint() {
    let env = Env::default();
    env.mock_all_auths();
    set_ledger(&env, 100);
    let client = failing_mint_setup(&env);
    let player = Address::generate(&env);

    client.start_run(&player, &plain(&env));
    let log = free_extraction();
    set_ledger(&env, 100 + log.len() as u32 / 16 + 1);
    let outcome = client.finish_run(&player, &bytes(&env, &log));

    assert!(outcome.extracted);
    assert_eq!(client.get_record(&player).unwrap().extractions, 1);
    assert!(client.get_open_run(&player).is_none());
}

#[test]
fn starting_a_run_keeps_the_shared_entries_alive() {
    let f = setup();
    let player = Address::generate(&f.env);
    f.client.start_run(&player, &plain(&f.env));
    let log = free_extraction();
    finish_ledger(&f, log.len());
    f.client.finish_run(&player, &bytes(&f.env, &log));

    // 100 days idle: still alive, but under the renewal threshold.
    let idle = f.env.ledger().sequence() + 100 * DAY_IN_LEDGERS;
    set_ledger(&f.env, idle);
    for key in [
        DataKey::PlayerCount,
        DataKey::TopFresh,
        DataKey::PlayerAt(0),
    ] {
        assert!(ttl_of(&f, &key) < TTL_THRESHOLD);
    }

    f.client.start_run(&player, &plain(&f.env));

    for key in [DataKey::PlayerCount, DataKey::TopFresh] {
        assert_eq!(ttl_of(&f, &key), TTL_EXTEND_TO);
    }
    assert_eq!(f.client.player_count(), 1);
    assert_eq!(f.client.top_fresh().len(), 1);
}

#[test]
fn using_a_veteran_keeps_it_and_its_owner_index_alive() {
    let f = setup();
    let owner = Address::generate(&f.env);
    let (choice, solver) = strong(&f.env, "Mara Voss");
    let id = clear_all_floors(&f, &owner, &choice, &solver)
        .hero_id
        .unwrap();

    set_ledger(&f.env, f.env.ledger().sequence() + 100 * DAY_IN_LEDGERS);
    assert!(ttl_of(&f, &DataKey::Hero(id)) < TTL_THRESHOLD);

    f.client.start_run(&owner, &HeroChoice::Veteran(id));

    assert_eq!(ttl_of(&f, &DataKey::Hero(id)), TTL_EXTEND_TO);
    assert_eq!(ttl_of(&f, &DataKey::HeroesOf(owner.clone())), TTL_EXTEND_TO);
    assert_eq!(f.client.owner_of(&id), Some(owner));
}

#[test]
fn keeping_entries_alive_costs_no_rent_while_they_are_fresh() {
    let f = setup();
    let player = Address::generate(&f.env);
    f.client.start_run(&player, &plain(&f.env));
    set_ledger(&f.env, f.env.ledger().sequence() + 10);
    f.client.start_run(&player, &plain(&f.env));

    let resources = f.env.cost_estimate().resources();
    assert_eq!(resources.persistent_entry_rent_bumps, 0);
}

#[test]
fn verify_run_never_writes() {
    let f = setup();
    let log = free_extraction();
    let outcome = f
        .client
        .verify_run(&0, &2, &2, &0, &1234, &bytes(&f.env, &log));

    assert!(outcome.extracted);
    let resources = f.env.cost_estimate().resources();
    assert_eq!(resources.write_entries, 0);
    assert_eq!(resources.persistent_entry_rent_bumps, 0);
}
