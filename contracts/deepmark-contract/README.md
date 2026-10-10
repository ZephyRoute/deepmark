# deepmark-contract

Verified runs and relic assets for Deepmark, on Stellar/Soroban. The contract replays every run itself and never trusts a claimed result.

Scaffolded with `cougr new --template starter` for the crate layout, `wasm32v1-none` build and test conventions. The generated entity-component demo was replaced: the data model is one record per player address, which does not fit an ECS built for many anonymous entities, so `cougr-core` is not a dependency. See `docs/architecture/onchain-boundary.md` in the main repo for the full reasoning.

## Public contract API

| Function | Parameters | Returns | Description |
| --- | --- | --- | --- |
| `__constructor` | `relic_common`, `relic_rare`, `relic_core`: `Address` | none | Sets the three relic Stellar Asset Contracts once. No admin, no upgrade. |
| `start_run` | `player: Address`, `choice: HeroChoice` | `Result<RunTicket, Error>` | Opens a run, issues its seed on chain and fixes the delver: `Fresh(look, base, weapon, charm)` or `Veteran(hero_id)` that the player owns. Starting while a run is open forfeits it. Cooldown between starts. Requires the player's signature. |
| `finish_run` | `player: Address`, `actions: Bytes` | `Result<RunOutcome, Error>` | Replays the action log, derives the result, updates the profile and the right leaderboard, mints banked relics, and after a full clear earns the delver (fresh) or adds a victory (veteran). Consumes the open run. Requires the player's signature. |
| `verify_run` | `base`, `weapon`, `charm`, `rank`, `seed`: `u32`, `actions: Bytes` | `Result<RunOutcome, Error>` | Pure replay with no writes. Anyone can audit a run. |
| `get_record` | `player: Address` | `Option<PlayerRecord>` | A player's profile. |
| `get_open_run` | `player: Address` | `Option<RunTicket>` | The run a player has open. |
| `top_fresh` | none | `Vec<TopEntry>` | The best 100 verified runs by fresh delvers, best first, one per player. |
| `top_veteran` | none | `Vec<TopEntry>` | The same for veterans. |
| `player_count` | none | `u32` | Distinct players that ever opened a run. Not capped. |
| `players` | `start: u32`, `limit: u32` | `Vec<PlayerSummary>` | Profiles in first-seen order, at most 50 per call. |
| `relic_tokens` | none | `RelicTokens` | The three relic asset contracts. |
| `hero` | `id: u32` | `Option<Hero>` | A delver: look, kit, victories, and the verified first clear that earned it. |
| `owner_of` | `id: u32` | `Option<Address>` | Who owns a delver. |
| `heroes_of` | `owner: Address` | `Vec<u32>` | Every delver an address owns, at most 64. |
| `balance` | `owner: Address` | `u32` | How many delvers an address owns. |
| `hero_count` | none | `u32` | How many delvers have ever been earned. |
| `transfer` | `from`, `to: Address`, `id: u32` | `Result<(), Error>` | Give a delver away. Requires the owner's signature. |

Errors: `InvalidHero` 1, `RunNotStarted` 2, `TooManyActions` 3, `InvalidAction` 4, `RunIncomplete` 5, `TrailingActions` 6, `TooFast` 7, `StartCooldown` 8, `InvalidName` 9, `HeroNotFound` 10, `NotHeroOwner` 11.

## Delvers and ownership

A delver is a base (Lantern or Cinder), one weapon, one charm, and a look (name, emblem, cloak). Weapons and charms only change hit points and the damage range, so the replay gains no new rules. `stats_for` in `world.rs` is mirrored by `statsFor` in `client/src/game/loadout.ts`, and the golden vectors cover random kits.

A delver becomes the player's own only when a fresh delver extracts from floor 3 in a verified replay. The Hero record keeps the verified score, HP and move count of that clear. A veteran earns one point of rank (one extra hit point, up to three) per clear and competes on its own leaderboard. Transferring a delver is allowed; a run started with a veteran cannot be finished by anyone but the current owner.

## Delvers and the NFT standard

Delvers are not standard tokens. The shape follows the `NonFungibleToken` interface of SEP-0050 (draft 0.1.0) and the OpenZeppelin `stellar-contracts` module (release `v0.7.2`) for `balance`, `owner_of` and `transfer`, checked on 2026-10-10. The deviations:

- `owner_of` returns an `Option` and does not fail on an unknown id. The standard returns an `Address` and fails with `NonExistentToken`.
- Errors use this contract's codes (`HeroNotFound` 10, `NotHeroOwner` 11), not the standard's 200 and above.
- No `transfer_from`, `approve`, `approve_for_all`, `get_approved`, `is_approved_for_all`, `name`, `symbol` or `token_uri`.
- Events are `hero_transfer` and `hero_earned`, not the standard `transfer` and `mint`.
- An owner can hold at most 64 delvers, and `transfer` refuses a recipient at the cap.
- Wallet and explorer visibility has not been tested, and no support is claimed.

The comparison, the two ways to comply and the recommendation are in `docs/architecture/nft-standard.md`.

## Action encoding

One byte per action: `0` up, `1` down, `2` left, `3` right, `4` attack, `5` retreat, `6` descend, `7` extract. At most 2048 per run. The log must end exactly on the action that finishes the run.

## Layout

```
lib.rs          entrypoints: require_auth, replay, persist, mint, emit events
  components.rs   data shapes and limits
  rng.rs          Mulberry32, bit exact port of client/src/game/rng.ts
  world.rs        delvers, enemies and the three floors
  sim.rs          deterministic replay of a run, pure Rust, no Env
  systems.rs      ranking key and profile update, pure Rust, no Env
tests/golden.rs   replays 600 runs played by the real TypeScript game
```

## Trust model

- **Verified.** Floor, score, relics and HP are derived by the replay. A forged log fails or produces a legitimate run.
- **Seed.** Issued on chain from ledger data, the player's run counter and address.
- **Replay protection.** Finishing consumes the open run.
- **Authorization.** Both writing entrypoints require the player's own signature.
- **Relics.** Minted through Stellar Asset Contracts whose admin is this contract. A release deployment locks the issuer account (`--lock` in the deploy script), so nothing else can mint. The current testnet issuer is not locked yet: on 2026-10-10 Horizon shows a single signer with weight 1 on `GAH27KP7NDO7HSYGIUFT7O5ONGW7M6RKCXRXIHCTLWKBM2PNU6336YMP`, so the supply claim holds only after the release deployment. A mint uses `try_mint`, so a player without a trustline never loses a verified result.
- **No admin and no upgrade path.** There is nothing valuable to protect and a key would only add attack surface.

Not covered: seed rerolling is limited by a cooldown and a visible abandoned run counter, not eliminated, and a solver can still play a legal perfect run. There is no third party audit. Review that did happen: 63 unit and entrypoint tests, 600 cross-language vectors with random kits, a mutation check that the vectors catch RNG drift, and live testnet attempts to replay a log, forge a floor 3 run and restart too soon, all rejected.

## Storage

Persistent storage for profiles, the player index and the top list, each with its TTL extended on write. The open run lives in temporary storage and expires on its own after two days. The number of players is not capped because each player is an independent entry.

## Build and test

```bash
cargo test
stellar contract build
```

`cargo test` also runs the golden vectors. Regenerate them after any change to the game simulation with `bun run golden > ../contracts/deepmark-contract/tests/golden.txt` in `client/`.
