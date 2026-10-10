# Threat model

The attacks considered against the Deepmark contract, what stops each one, and what is left. Every "stops" entry names the code path and the test that covers it, so it can be checked: `contracts/deepmark-contract/src/lib.rs` for the entrypoints and `src/test.rs` for the tests. The suite is run with `cargo test` and was green on 2026-10-10: 63 unit and entrypoint tests plus the 600 cross-language vectors.

## What is protected

- A **result**: the floor reached, relics, score and HP of a run, and its place on a leaderboard.
- A **relic**: a unit of `DMCOMMON`, `DMRARE` or `DMCORE`. Its only claim to value is that a verified run produced it.
- A **delver**: a character that exists because a fresh one cleared all three floors.
- A **player's access**: nobody else can start, finish or move things for an address.

There is no money in the contract and no admin or upgrade key. The worst realistic outcome of any attack below is a false leaderboard row or a relic that was not earned. That sets how much defence is proportionate.

## Attacks

### Forged result

*Claim a floor, score or relic count the player did not earn.*

**Stops it.** `finish_run` takes only the action log. It never accepts a claimed result. It replays the log with `sim::replay` against the seed and delver that `start_run` stored, and derives everything from that replay (`lib.rs`, `finish_run`). A log that is not a legal sequence of the game is rejected: an unknown action byte, a log that does not end exactly on the action that finishes the run, padding after the end, or more than 2,048 actions. Tests: `a_claim_the_game_cannot_produce_is_rejected`, `unknown_actions_incomplete_logs_and_padding_are_rejected`, `oversized_logs_are_rejected`. The Rust replay is a port of the TypeScript game, and `tests/golden.rs` checks 600 runs played by the real client byte for byte, so the two cannot drift without `cargo test` failing. The README of the contract records a mutation check that those vectors catch RNG drift.

**Remains.** A forged log either fails or is a legitimate run. A solver can play a perfect legal run, since the game is deterministic and the seed is public in the `run_started` event. That cannot be prevented in a deterministic game. Ties are broken by HP left and then fewest actions. The Rust port is only as correct as its tests, and there has been no third party audit.

### Replay of a log or a run

*Submit the same log twice, or reuse another run's log.*

**Stops it.** Finishing removes the open run (`finish_run` removes the `Run` entry from temporary storage), so a second submission fails with `RunNotStarted`. Tests: `the_same_log_cannot_be_claimed_twice`, `finishing_without_starting_is_rejected`. A log taken from someone else's run is replayed against the caller's own seed, which is derived from the ledger, the run counter and the caller's address (`derive_seed`), so it produces whatever that log produces under that seed, or fails. Test: `seeds_differ_between_players_and_ledgers`. `finish_run` also needs the caller's signature, and a Soroban signature covers the call's arguments, so a relayer cannot swap in another log.

**Remains.** Nothing specific. A replayed log that happens to be a valid run under the new seed is a legitimate run.

### Seed rerolling

*Discard unfavourable seeds until one gives an easy run.*

**Stops it, partly.** The client cannot choose the seed. It is derived on chain from the ledger sequence, the ledger time, the player's run counter and the address (`derive_seed`). Starting again costs a transaction and a cooldown of 6 ledgers, about 30 seconds (`START_COOLDOWN_LEDGERS`), and starting while a run is open counts that run as abandoned on the profile (`forfeits`). Test: `starting_again_too_soon_is_rejected_and_later_it_forfeits_the_open_run`.

**Remains.** A patient player can keep starting runs and only finish the ones with a good seed. The cost is time and fees, and the abandoned counter is visible, but the limit is economic, not absolute. The finish must come at least `actions / 16` ledgers after the start (`TooFast`, `ACTIONS_PER_LEDGER`), so a bot cannot submit a plan instantly, but it can plan during that wait. Test: `a_run_cannot_be_submitted_faster_than_it_could_be_played`.

### Lockout

*Stop another player from playing, finishing or keeping what they earned.*

**Stops it.** Both writing entrypoints call `require_auth` on the player, so nobody can start, finish or give away for an address that did not sign. Test: `nobody_can_act_for_an_address_that_did_not_sign`. A failed replay returns an error before the open run is removed, and the transaction reverts, so a bad or partial log never consumes or blocks a run. An open run that is never finished expires after two days (`RUN_TTL`), and a player can start again after the cooldown, which forfeits it. A veteran that was given away in the middle of a run cannot be finished by the old owner, who can start a new run. Test: `a_veteran_given_away_mid_run_cannot_finish_for_the_old_owner`.

**Remains.**
- **Delver slot griefing.** An account can hold at most 64 delvers (`MAX_HEROES_PER_OWNER`), and `transfer` needs only the sender's signature, so someone who owns 64 delvers could send them to a victim and fill that victim's slots. After that a clear by the victim still counts and still mints relics, but `earn_or_advance` returns no new delver. The attacker needs 64 verified full clears first, which is a high price. It is a known gap, and the fix is to let a recipient refuse or to remove the cap.
- **A lost log.** If a player closes the tab before the log is sent, the run is lost and later counted as abandoned. Persisting the unsent log and resuming is tracked in the issue tracker.
- **The browser keypair.** The player's key is kept in that browser's `localStorage`. Clearing storage loses the identity and its records, and script running on the page could read it. A passkey account is the planned replacement, and no custodial key is held by any server.

### Minting without play

*Obtain relics or a delver without a verified run.*

**Stops it.** The only code that mints relics is `mint_relics`, called from `finish_run` with the amounts the replay derived and only for an extraction. The only code that creates a delver is `earn_or_advance`, also inside `finish_run`, and only for a fresh delver that extracted from floor 3. The relics are Stellar Asset Contracts whose admin is the game contract, set by `scripts/deploy-testnet.sh`. Tests: `a_banked_relic_is_minted_as_a_stellar_asset`, `a_run_without_relics_mints_nothing`, `a_run_that_does_not_clear_all_three_floors_earns_nothing`. A mint failure, for example a missing trustline, is isolated with `try_mint`, so the run is still recorded. Test: `a_failed_mint_never_loses_the_verified_run`.

**Remains.**
- **The testnet issuer is not locked.** On 2026-10-10 Horizon shows one signer with weight 1 on the issuer `GAH27KP7NDO7HSYGIUFT7O5ONGW7M6RKCXRXIHCTLWKBM2PNU6336YMP`. The key holder can still issue the three classic assets by a normal payment, which bypasses the contract. The deploy script locks the issuer with `--lock`, and that has not been run for this deployment. Until a release deployment does it, the claim that only a verified extraction can mint holds for the contract and not for the key holder. This is tracked in the mainnet readiness issue.
- **A missed mint is not retried.** If `try_mint` fails, the run reports `minted: false` and the relics are not issued later.
- **Delvers move freely.** A delver can be given to anyone, which is intended. It means a delver does not prove the current holder played it, only that its first clear was verified.

### Leaderboard flooding

*Fill the board, grow storage, or push real players out.*

**Stops it.** Each sorted list holds the best 100 entries with one row per player, and only a run that beats that player's own best is inserted (`update_top`). A worse run does not replace a better one. Tests: `the_leaderboard_ranks_by_the_verified_result_and_lists_each_player_once`, `a_worse_run_does_not_replace_a_better_leaderboard_entry`, `the_sorted_top_is_bounded_but_players_are_not`. Fresh delvers and veterans have separate lists. The list of all players is paged at 50 per call (`players_are_paged_without_a_cap_on_how_many_exist`), so reading it has a bounded cost.

**Remains.**
- **Many accounts.** A person with many funded accounts can occupy rows, each with a real verified run. On testnet, Friendbot funds accounts for free, so the cost is only the work of playing. The board proves that a run was verified. It does not prove that a distinct person played it.
- **Index growth.** The player index is not capped. Each entry costs its creator a funded account and the fees of a start, and the storage lifetime is extended in the same write.
- **Exact ties.** Two runs with the same ranking key (extraction, score, floor, HP left, actions) are ordered by who got there first, because `update_top` inserts a new entry only above a strictly lower key.

## What is not covered

- No third party audit. The review that exists is the test suite above, a mutation check on the vectors, and live testnet attempts to replay a log, forge a floor 3 run and restart too soon, all rejected, as recorded in the contract README.
- Testnet only. A mainnet deployment needs the checklist in the internal repository, a locked issuer, and a decision on how players are funded.
- The client is not a trust boundary. Everything it computes is advisory, and the contract replays it again.
