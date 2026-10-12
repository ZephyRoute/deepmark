# deepmark-contract

Live on Stellar testnet as [`CDQDI2SNKQHPC7YW7YCW7USYLHXW2XTV5JBXWC24K53KDMY43DBHH7RX`](https://stellar.expert/explorer/testnet/contract/CDQDI2SNKQHPC7YW7YCW7USYLHXW2XTV5JBXWC24K53KDMY43DBHH7RX), admin [`GCJWADMY...2WEX`](https://stellar.expert/explorer/testnet/account/GCJWADMYI4N42EDLCRAYGORAHPXLRSIZVQSN75H552H2GWKF3SXL2WEX). The relic contracts are [`DMCOMMON`](https://stellar.expert/explorer/testnet/contract/CDK5SL4OP6CAFZPFJ2YOTSBN3NDHCJ4A23UA4TXIZP5DFO7RT6IH4S5R), [`DMRARE`](https://stellar.expert/explorer/testnet/contract/CCQFEYZR3D4XHTMLV3XJZBTZUT4WXZS2LUXHPFTH7DRRZENZNU2NVZ5L) and [`DMCORE`](https://stellar.expert/explorer/testnet/contract/CAHKK75BOXGBKSXBB3EFPWS6C3IZIXIFLYI3A74GYCRSI4U6NKVZTLIM), with the issuer [`GAEZFWDU...FA7Q`](https://stellar.expert/explorer/testnet/account/GAEZFWDURKH2UF5DF5S26AXHLTUE4NNQ4YDDROFRXNTDO46THSXJFA7Q). The deployed wasm is 28,107 bytes, sha256 `db721cb97242bf5d9710d70752959a5658c2be81fee70d5fdd7253b878f80d07`. To replay a real run yourself, see "Verify a run in 60 seconds" in the main README.

Verified runs and relic assets for Deepmark, on Stellar/Soroban. The contract replays every run itself and never trusts a claimed result.

Scaffolded with `cougr new --template starter` for the crate layout, `wasm32v1-none` build and test conventions. The generated entity-component demo was replaced: the data model is one record per player address, which does not fit an ECS built for many anonymous entities, so `cougr-core` is not a dependency. See `docs/architecture/onchain-boundary.md` in the main repo for the full reasoning.

## Public contract API

| Function | Parameters | Returns | Description |
| --- | --- | --- | --- |
| `__constructor` | `admin`, `relic_common`, `relic_rare`, `relic_core`: `Address` | none | Sets the admin and the three relic Stellar Asset Contracts once. The admin must sign the deployment. |
| `start_run` | `player: Address`, `choice: HeroChoice` | `Result<RunTicket, Error>` | Opens a run, issues its seed on chain and fixes the delver: `Fresh(look, base, weapon, charm)` or `Veteran(hero_id)` that the player owns. Starting while a run is open forfeits it. Cooldown between starts. Requires the player's signature. |
| `finish_run` | `player: Address`, `actions: Bytes` | `Result<RunOutcome, Error>` | Replays the action log, derives the result, updates the profile and the right leaderboard, mints banked relics, and after a full clear earns the delver (fresh) or adds a victory (veteran). Consumes the open run. If a relic mint fails (for example no trustline for that relic) the call fails with `MintFailed` and nothing is recorded, so the run stays open and can be finished again once the cause is fixed. Requires the player's signature. |
| `verify_run` | `base`, `weapon`, `charm`, `rank`, `seed`: `u32`, `actions: Bytes` | `Result<RunOutcome, Error>` | Pure replay with no writes. Anyone can audit a run. |
| `get_record` | `player: Address` | `Option<PlayerRecord>` | A player's profile. |
| `get_open_run` | `player: Address` | `Option<RunTicket>` | The run a player has open. |
| `top_fresh` | none | `Vec<TopEntry>` | The best 100 verified runs by fresh delvers, best first, one per player. |
| `top_veteran` | none | `Vec<TopEntry>` | The same for veterans. |
| `player_count` | none | `u32` | Distinct players that ever opened a run. Not capped. |
| `players` | `start: u32`, `limit: u32` | `Vec<PlayerSummary>` | Profiles in first-seen order, at most 50 per call. |
| `relic_tokens` | none | `Result<RelicTokens, Error>` | The three relic asset contracts, or `NotInitialized` if they are missing from storage. |
| `admin` | none | `Option<Address>` | Who can upgrade the code, or `None` once the role was renounced. |
| `version` | none | `u32` | The contract release, bumped whenever behavior changes. |
| `upgrade` | `new_wasm_hash: BytesN<32>` | `Result<(), Error>` | Replaces the contract code with an uploaded wasm. Storage is kept. Admin only. Emits `upgraded`. |
| `set_admin` | `new_admin: Address` | `Result<(), Error>` | Hands the admin role over. Both the current and the new admin must sign, so the role cannot go to a mistyped address. Emits `admin_changed`. |
| `renounce_admin` | none | `Result<(), Error>` | Gives the role up for good. The code can never change afterwards. Emits `admin_renounced`. |
| `hero` | `id: u32` | `Option<Hero>` | A delver: look, kit, victories, and the verified first clear that earned it. |
| `owner_of` | `id: u32` | `Option<Address>` | Who owns a delver. |
| `heroes_of` | `owner: Address` | `Vec<u32>` | Every delver an address owns, at most 64. |
| `balance` | `owner: Address` | `u32` | How many delvers an address owns. |
| `hero_count` | none | `u32` | How many delvers have ever been earned. |
| `transfer` | `from`, `to: Address`, `id: u32` | `Result<(), Error>` | Give a delver away. Requires the owner's signature. Giving a delver to its current owner succeeds and changes nothing (no event). |

Errors: `InvalidHero` 1, `RunNotStarted` 2, `TooManyActions` 3, `InvalidAction` 4, `RunIncomplete` 5, `TrailingActions` 6, `TooFast` 7, `StartCooldown` 8, `InvalidName` 9, `HeroNotFound` 10, `NotHeroOwner` 11, `Frozen` 12 (the admin role was renounced), `NotInitialized` 13 (relic tokens missing), `MintFailed` 14 (a relic mint was rejected, the run stays open).

## Delvers and ownership

A delver is a base (Lantern or Cinder), one weapon, one charm, and a look (name, emblem, cloak). Weapons and charms only change hit points and the damage range, so the replay gains no new rules. `stats_for` in `world.rs` is mirrored by `statsFor` in `client/src/game/loadout.ts`, and the golden vectors cover random kits.

A delver becomes the player's own only when a fresh delver extracts from floor 3 in a verified replay. The Hero record keeps the verified score, HP and move count of that clear. A veteran earns one point of rank (one extra hit point, up to three) per clear and competes on its own leaderboard. Transferring a delver is allowed; a run started with a veteran cannot be finished by anyone but the current owner.

## Action encoding

One byte per action: `0` up, `1` down, `2` left, `3` right, `4` attack, `5` retreat, `6` descend, `7` extract. At most 2048 per run. The log must end exactly on the action that finishes the run.

## Layout

```
lib.rs          entrypoints: require_auth, replay, persist, mint, emit events
  admin.rs        admin role: upgrade, hand over, renounce, with their events
  components.rs   data shapes and limits
  rng.rs          Mulberry32, bit exact port of client/src/game/rng.ts
  world.rs        delvers, enemies and the three floors
  sim.rs          deterministic replay of a run, pure Rust, no Env
  systems.rs      ranking key and profile update, pure Rust, no Env
tests/golden.rs   replays the 600 runs in golden.txt, played by the real TypeScript game
```

## Trust model

- **Verified.** Floor, score, relics and HP are derived by the replay. A forged log fails or produces a legitimate run.
- **Seed.** Issued on chain from ledger data, the player's run counter and address.
- **Replay protection.** Finishing consumes the open run.
- **Authorization.** Both writing entrypoints require the player's own signature.
- **Relics.** Minted through Stellar Asset Contracts whose admin is this contract. The current testnet deployment locked the issuer account (master weight zero, no other signer) in [one transaction](https://stellar.expert/explorer/testnet/tx/ddae4f0c5f28ff1bc08af97949dd85861fe3b087eefb67b1e4893b354c514e28), and `docs/deployments.md` records the check on Horizon. There is no deploy script in this repository: the steps are the transactions listed there. A mint failure (a SAC rejects it when the player has no trustline for the relic, or it is full or deauthorized) fails the whole `finish_run` and reverts its writes, so the run stays open and no relic is silently dropped. Players need the three relic trustlines before extracting with relics.
- **Admin and upgrade path.** The deployer is the admin and can replace the code with `upgrade`. This is a real trust assumption: an admin could upgrade to code that mints relics without a replay, rewrites the leaderboard or moves delvers. Replay verification protects players from forged logs, not from the admin while the role exists. The role is meant to be temporary:
  - `renounce_admin` removes it for good, after which `upgrade` and `set_admin` fail with `Frozen` and the deployed code is final.
  - Before a mainnet release, either renounce, or `set_admin` to a multisig account so no single key can change the code.
  - `set_admin` needs both signatures so the role cannot be lost to a mistyped address.
  - Storage layout is not versioned: an upgrade must keep every `DataKey` and stored struct readable. `version()` tells a client which release runs.

Not covered: seed rerolling is limited by a cooldown and a visible abandoned run counter, both per address, so many throwaway addresses defeat them. A solver can play a legal perfect run, relics have no supply cap, and persistent entries that nobody touches for about 120 days can still be archived (the counters, leaderboards, a used veteran and its owner index are renewed by `start_run`, but the records and index entries of players who stop playing are not). `docs/threat-model.md` has each of these. There is no third party audit. Review that did happen: 80 unit and entrypoint tests (including the admin paths), 600 cross-language vectors with random kits, a mutation check that the vectors catch RNG drift, and live testnet attempts to replay a log, forge a floor 3 run and restart too soon, all rejected.

## Storage

Persistent storage for profiles, the player index and the top list, each with its TTL extended on write. `start_run` also renews the player counter, the delver counter, both leaderboards and, for a veteran run, that delver and its owner index; these renewals cost nothing while the entries have more than 30 days left. `verify_run` and the getters never write. Instance storage holds the admin and the relic tokens, and its TTL is extended on every `start_run` and `finish_run`, which keeps the contract instance and its code alive while the game is played. The open run lives in temporary storage and expires on its own after two days. The number of players is not capped because each player is an independent entry.

## Build and test

```bash
cargo test
stellar contract build
```

`cargo test` also runs the golden vectors. Regenerate them after any change to the game simulation with `bun run golden > ../contracts/deepmark-contract/tests/golden.txt` in `client/`.
