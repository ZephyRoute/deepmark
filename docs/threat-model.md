# Threat model

The attacks considered against the Deepmark contract, what stops each one, and what is left. Every "stops" entry names the code path and the test that covers it, so it can be checked: `contracts/deepmark-contract/src/lib.rs` for the entrypoints and `src/test.rs` for the tests. The suite is run with `cargo test` and was green on 2026-10-12: 80 unit and entrypoint tests plus the 600 cross-language vectors. A test passing means the listed defence works as written. It does not mean the list of attacks is complete, and the "Remains" entries are the part to read carefully.

## What is protected

- A **result**: the floor reached, relics, score and HP of a run, and its place on a leaderboard.
- A **relic**: a unit of `DMCOMMON`, `DMRARE` or `DMCORE`. Its only claim to value is that a verified run produced it.
- A **delver**: a character that exists because a fresh one cleared all three floors.
- A **player's access**: nobody else can start, finish or move things for an address.

There is no money in the contract. It does have an admin who can upgrade it, which is the largest trust assumption and is covered under "The admin" below. Apart from the admin, the worst realistic outcome of any attack below is a leaderboard row or a relic that a bot produced rather than a distinct person, or a lost relic. That sets how much defence is proportionate on testnet. It would not be enough for mainnet value.

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

**Remains.** A patient player can keep starting runs and only finish the ones with a good seed. The cooldown and the abandoned counter are per address, so a player with several funded addresses starts runs on all of them in the same ledger, solves the seeds offline (the game is deterministic and the seed is public in the `run_started` event), finishes only the best run, and leaves the discarded runs as abandoned on throwaway addresses. On testnet Friendbot funds those addresses for free, so the real limit today is effort, not cost. The seed is also predictable per address: it is a hash of public inputs (ledger sequence and time, the run counter and the address), so someone can generate addresses offline and fund only the ones that map to an easy seed. The finish must come at least `actions / 16` ledgers after the start (`TooFast`, `ACTIONS_PER_LEDGER`), so a bot cannot submit a plan instantly, but it can plan during that wait. Test: `a_run_cannot_be_submitted_faster_than_it_could_be_played`.

### Lockout

*Stop another player from playing, finishing or keeping what they earned.*

**Stops it.** Both writing entrypoints call `require_auth` on the player, so nobody can start, finish or give away for an address that did not sign. Test: `nobody_can_act_for_an_address_that_did_not_sign`. A failed replay returns an error before the open run is removed, and the transaction reverts, so a bad or partial log never consumes or blocks a run. An open run that is never finished expires after two days (`RUN_TTL`), and a player can start again after the cooldown, which forfeits it. A veteran that was given away in the middle of a run cannot be finished by the old owner, who can start a new run. Test: `a_veteran_given_away_mid_run_cannot_finish_for_the_old_owner`.

**Fixed in the 2026-10-12 redeploy.** `transfer(a, a, id)` used to save the id twice in the owner's list. It now returns early as an authorized no-op, with no write and no event, and still needs the owner's signature. Tests: `giving_a_delver_to_its_own_owner_changes_nothing`, `a_self_transfer_still_needs_the_owner`, `transfers_keep_every_delver_in_exactly_one_list` (`src/test_safety.rs`). Entries that expire while idle are now renewed where the game already writes: `start_run` extends the player counter, the delver counter and both leaderboards, and the owner's delver and its index when a veteran starts a run. Tests: `starting_a_run_keeps_the_shared_entries_alive`, `using_a_veteran_keeps_it_and_its_owner_index_alive`, `keeping_entries_alive_costs_no_rent_while_they_are_fresh`.

**Remains.**
- **Delver slot griefing.** An account can hold at most 64 delvers (`MAX_HEROES_PER_OWNER`), and `transfer` needs only the sender's signature, so someone who owns 64 delvers could send them to a victim and fill that victim's slots. After that a clear by the victim still counts and still mints relics, but `earn_or_advance` returns no new delver. The attacker needs 64 verified full clears first. That is 64 runs of effort for a human, but a solver bot with several accounts can produce them quickly, so this is not a strong barrier. It is a known gap, and the fix is to let a recipient refuse or to remove the cap.
- **Idle entries of inactive players can still be archived.** `start_run` now renews the shared entries and the delver in use (see above), and a player's own record and the player index entries are extended when written. A player who does not return for about 120 days can have those archived, and calls that need them fail until someone restores them. Nothing is lost, but the client does not restore automatically. The contract instance is extended on every `start_run` and `finish_run`, and at deploy time its instance and wasm were extended too ([instance](https://stellar.expert/explorer/testnet/tx/3a174eec310202b9124525f8099e6228a8042c310ce08838b7a2b47a0609d4ba), [wasm](https://stellar.expert/explorer/testnet/tx/ae8a038a8470479fc2fa603dee70d718b7f75838bed101d13a09739661c389fb)).
- **New player registration is serialized.** A new player is appended to a sequential index (`PlayerAt(i)`), so several brand new players whose `start_run` lands in the same ledger simulate the same next index, and the later transactions fail with `storage exceeded_limit` on the key `PlayerAt N`. In the playtest, 3 fresh accounts starting together gave 2 failures out of 3. This is a throughput limit of new player registration, about one per ledger (about 5 seconds). The client detects a failed `start_run` (`client/src/stellar/txOutcome.ts`), retries up to 4 times with jittered backoff and re-simulates, and a local re-run had 6 of 6 starts succeed. A returning player is never affected. A registry keyed by address would remove the limit in a later contract version.
- **A lost log.** If a player closes the tab before the log is sent, the run is lost and later counted as abandoned. The client does not yet persist an unsent log across a closed tab.
- **The browser keypair.** The player's key is kept in that browser's `localStorage`. Clearing storage loses the identity and its records, and script running on the page could read it. The live site sent no content security policy header when checked with `curl -I` on 2026-10-12, so a script injection or a bad dependency would not be stopped by the browser. A passkey account is the planned replacement, and no custodial key is held by any server.

### Minting without play

*Obtain relics or a delver without a verified run.*

**Stops it.** The only code that mints relics is `mint_relics`, called from `finish_run` with the amounts the replay derived and only for an extraction. The only code that creates a delver is `earn_or_advance`, also inside `finish_run`, and only for a fresh delver that extracted from floor 3. The relics are Stellar Asset Contracts whose admin is the game contract, set in three transactions recorded in [`deployments.md`](deployments.md) and checkable with the `admin` call shown in the README. Tests: `a_banked_relic_is_minted_as_a_stellar_asset`, `a_run_without_relics_mints_nothing`, `a_run_that_does_not_clear_all_three_floors_earns_nothing`. A mint failure, for example a missing trustline, makes `finish_run` return `MintFailed` (14) and reverts every write, so the run is not consumed, nothing is recorded and the player can fix the cause and finish again. Test: `a_failed_mint_fails_the_finish_and_keeps_the_run_open`. Missing relic configuration returns `NotInitialized` (13) instead of a panic. Test: `a_missing_relic_configuration_is_a_typed_error`.

**Remains.**
- **The issuer is locked, the admin is not.** The relic issuer [`GAEZFWDURKH2UF5DF5S26AXHLTUE4NNQ4YDDROFRXNTDO46THSXJFA7Q`](https://stellar.expert/explorer/testnet/account/GAEZFWDURKH2UF5DF5S26AXHLTUE4NNQ4YDDROFRXNTDO46THSXJFA7Q) has a single signer with weight 0 and thresholds at 0 (read on Horizon on 2026-10-12 after the redeploy, set by [this transaction](https://stellar.expert/explorer/testnet/tx/ddae4f0c5f28ff1bc08af97949dd85861fe3b087eefb67b1e4893b354c514e28)), so nobody holds a key that can sign for it. (On the superseded deployment a transaction signed with the issuer key was also rejected with `TxBadAuth`. That test was not repeated on this issuer.) So the only minter is the game contract. While the contract admin exists, the admin can upgrade the contract to code that mints without a replay. See "The admin".
- **A rejected mint blocks the finish until the cause is fixed.** The player cannot lose relics to a missing trustline, but an account that can never receive a relic (for example one that removed its trustline and cannot restore it) cannot finish a run that banked that relic. The client adds the three trustlines at account setup.
- **Relics have no supply cap.** Nothing limits mints per address, per day or in total. The scarcity is that a verified run is needed, so a bot that solves seeds can mint without limit (see "Many accounts"). Calling relics scarce is only fair while testnet runs are the unit of effort.
- **Delvers move freely.** A delver can be given to anyone, which is intended. It means a delver does not prove the current holder played it, only that its first clear was verified.

### Leaderboard flooding

*Fill the board, grow storage, or push real players out.*

**Stops it.** Each sorted list holds the best 100 entries with one row per player, and only a run that beats that player's own best is inserted (`update_top`). A worse run does not replace a better one. Tests: `the_leaderboard_ranks_by_the_verified_result_and_lists_each_player_once`, `a_worse_run_does_not_replace_a_better_leaderboard_entry`, `the_sorted_top_is_bounded_but_players_are_not`. Fresh delvers and veterans have separate lists. The list of all players is paged at 50 per call (`players_are_paged_without_a_cap_on_how_many_exist`), so reading it has a bounded cost.

**Remains.**
- **Many accounts.** A person with many funded accounts can occupy rows, each with a real verified run. On testnet, Friendbot funds accounts for free, so the cost is the work of playing, and for a bot that work is solving a seed offline, which takes little time. The same farm can fill both boards, mint relics without bound, produce delvers to dump on a victim, and pass veterans between its accounts. The board proves that a run was verified. It does not prove that a distinct person played it. The 2026-10-12 playtest is an example: about 19 throwaway accounts were created in a few hours with Friendbot, so the trustline counts on the relic assets count test accounts, not players. Closing this needs a cost or an identity layer (a start fee, sponsored fees with per-account limits, or a mint budget), which is not built.
- **Index growth.** The player index is not capped. Each entry costs its creator a funded account and the fees of a start, and the storage lifetime is extended in the same write.
- **Unmoderated names.** A delver name is any 3 to 16 character ASCII alphanumeric string, so a board can show offensive or impersonating names. They are rendered as text, so this is not a script injection risk.
- **Exact ties.** Two runs with the same ranking key (extraction, score, floor, HP left, actions) are ordered by who got there first, because `update_top` inserts a new entry only above a strictly lower key.

### The admin

*Replace the contract code with code that skips the replay.*

**Stops it.** `upgrade`, `set_admin` and `renounce_admin` all require the admin's signature, and handing the role over needs the signatures of both the current and the new admin, so a mistyped address cannot take it. Every change emits an event. Tests in `src/admin.rs`: `nobody_without_the_admin_signature_can_change_anything`, `the_admin_can_upgrade_and_the_swap_is_announced`, `handing_over_the_role_needs_both_signatures`, `a_new_admin_that_did_not_sign_cannot_be_installed`, `renouncing_freezes_the_contract_for_good`. After `renounce_admin` the contract rejects `upgrade` and `set_admin` with `Frozen`, which was also checked on a throwaway testnet deployment.

**Remains.**
- **While the role exists, players trust the admin.** The admin can upgrade to code that mints relics without a replay, rewrites the leaderboard or moves delvers. Replay verification protects players from forged logs, not from the admin. The testnet admin is `GCJWADMYI4N42EDLCRAYGORAHPXLRSIZVQSN75H552H2GWKF3SXL2WEX`, a single key.
- **No timelock.** `upgrade` takes effect in the same transaction it is signed in. Players get no warning window, only the `upgraded` event afterwards.
- **The way out is planned, not done.** Before any mainnet release the role is renounced, or moved with `set_admin` to a multisig account so no single key can change the code.
- **Storage is not versioned.** An upgrade has to keep every stored key and struct readable. `version()` tells a client which release is running.

## What is not covered

- No third party audit. The review that exists is the test suite above, a mutation check on the vectors, and live testnet attempts to replay a log, forge a floor 3 run and restart too soon, all rejected, as recorded in the contract README. Those attempts are not transactions linked here, so treat them as the author's report. The deployed transactions that can be checked are in [`deployments.md`](deployments.md).
- Testnet only. A mainnet deployment needs a release checklist, a locked issuer, a renounced or multisig admin, an independent review and a decision on how players are funded. None of that is done.
- A malicious or faulty RPC could return a ticket that differs from the one on chain. The client did not range check it when reviewed on 2026-10-12, so the effect would be a run that `finish_run` rejects or scores differently, not a forged win.
- The client is not a trust boundary. Everything it computes is advisory, and the contract replays it again.
