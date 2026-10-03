# deepmark-contract

Verified runs and relic assets for Deepmark, on Stellar/Soroban. The contract replays every run itself and never trusts a claimed result.

Scaffolded with `cougr new --template starter` for the crate layout, `wasm32v1-none` build and test conventions. The generated entity-component demo was replaced: the data model is one record per player address, which does not fit an ECS built for many anonymous entities, so `cougr-core` is not a dependency. See `docs/architecture/onchain-boundary.md` in the main repo for the full reasoning.

## Public contract API

| Function | Parameters | Returns | Description |
| --- | --- | --- | --- |
| `__constructor` | `relic_common`, `relic_rare`, `relic_core`: `Address` | none | Sets the three relic Stellar Asset Contracts once. No admin, no upgrade. |
| `start_run` | `player: Address`, `hero: u32` | `Result<RunTicket, Error>` | Opens a run and issues its seed on chain. Starting while a run is open forfeits it. Cooldown between starts. Requires the player's signature. |
| `finish_run` | `player: Address`, `actions: Bytes` | `Result<RunOutcome, Error>` | Replays the action log, derives the result, updates the profile and leaderboard, mints banked relics. Consumes the open run. Requires the player's signature. |
| `verify_run` | `hero: u32`, `seed: u32`, `actions: Bytes` | `Result<RunOutcome, Error>` | Pure replay with no writes. Anyone can audit a run. |
| `get_record` | `player: Address` | `Option<PlayerRecord>` | A player's profile. |
| `get_open_run` | `player: Address` | `Option<RunTicket>` | The run a player has open. |
| `top` | none | `Vec<TopEntry>` | The best 100 verified runs, best first, one per player. |
| `player_count` | none | `u32` | Distinct players that ever opened a run. Not capped. |
| `players` | `start: u32`, `limit: u32` | `Vec<PlayerSummary>` | Profiles in first-seen order, at most 50 per call. |
| `relic_tokens` | none | `RelicTokens` | The three relic asset contracts. |

Errors: `InvalidHero` 1, `RunNotStarted` 2, `TooManyActions` 3, `InvalidAction` 4, `RunIncomplete` 5, `TrailingActions` 6, `TooFast` 7, `StartCooldown` 8.

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
tests/golden.rs   replays 400 runs played by the real TypeScript game
```

## Trust model

- **Verified.** Floor, score, relics and HP are derived by the replay. A forged log fails or produces a legitimate run.
- **Seed.** Issued on chain from ledger data, the player's run counter and address.
- **Replay protection.** Finishing consumes the open run.
- **Authorization.** Both writing entrypoints require the player's own signature.
- **Relics.** Minted through Stellar Asset Contracts whose admin is this contract. The issuer account is locked after deployment, so nothing else can mint. A mint uses `try_mint`, so a player without a trustline never loses a verified result.
- **No admin and no upgrade path.** There is nothing valuable to protect and a key would only add attack surface.

Not covered: seed rerolling is limited by a cooldown and a visible abandoned run counter, not eliminated, and a solver can still play a legal perfect run. There is no third party audit. Review that did happen: 50 unit and entrypoint tests, 400 cross-language vectors, a mutation check that the vectors catch RNG drift, and live testnet attempts to replay a log, forge a floor 3 run and restart too soon, all rejected.

## Storage

Persistent storage for profiles, the player index and the top list, each with its TTL extended on write. The open run lives in temporary storage and expires on its own after two days. The number of players is not capped because each player is an independent entry.

## Build and test

```bash
cargo test
stellar contract build
```

`cargo test` also runs the golden vectors. Regenerate them after any change to the game simulation with `bun run golden > ../contracts/deepmark-contract/tests/golden.txt` in `client/`.
