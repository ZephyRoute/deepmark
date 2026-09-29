//! Integration tests for deepmark-contract, run against a fresh sandbox `Env`.

use crate::components::PlayerRecord;
use crate::{DeepmarkContract, DeepmarkContractClient};
use soroban_sdk::{testutils::Address as _, Address, Env};

fn setup() -> (Env, DeepmarkContractClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(DeepmarkContract, ());
    let client = DeepmarkContractClient::new(&env, &contract_id);
    let player = Address::generate(&env);
    (env, client, player)
}

#[test]
fn recording_a_first_run_creates_the_record() {
    let (_env, client, player) = setup();

    let record = client.record_run(&player, &2, &1);

    assert_eq!(record, PlayerRecord { best_floor: 2, best_relics: 1, total_runs: 1 });
    assert_eq!(client.get_record(&player), Some(record));
}

#[test]
fn a_second_worse_run_still_counts_but_keeps_the_best() {
    let (_env, client, player) = setup();

    client.record_run(&player, &3, &2);
    let record = client.record_run(&player, &1, &0);

    assert_eq!(record, PlayerRecord { best_floor: 3, best_relics: 2, total_runs: 2 });
}

#[test]
fn floor_reached_above_the_shipped_max_is_clamped() {
    let (_env, client, player) = setup();

    let record = client.record_run(&player, &99, &0);

    assert_eq!(record.best_floor, 3);
}

#[test]
fn a_new_player_is_added_to_the_leaderboard_once() {
    let (_env, client, player) = setup();

    client.record_run(&player, &1, &0);
    client.record_run(&player, &2, &1);

    let board = client.leaderboard();
    assert_eq!(board.len(), 1);
    assert_eq!(board.get(0), Some(player));
}

#[test]
fn two_players_each_get_their_own_record_and_both_appear_on_the_leaderboard() {
    let (env, client, alice) = setup();
    let bob = Address::generate(&env);

    client.record_run(&alice, &2, &1);
    client.record_run(&bob, &3, &3);

    assert_eq!(client.get_record(&alice).unwrap().best_floor, 2);
    assert_eq!(client.get_record(&bob).unwrap().best_floor, 3);
    assert_eq!(client.leaderboard().len(), 2);
}

#[test]
fn unknown_player_has_no_record() {
    let (env, client, _player) = setup();
    let stranger = Address::generate(&env);

    assert_eq!(client.get_record(&stranger), None);
}
