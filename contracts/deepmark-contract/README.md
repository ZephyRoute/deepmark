# deepmark-contract

Records the result of a finished Deepmark run and a leaderboard, on Stellar/Soroban.

Scaffolded with `cougr new --template starter` (correct `Cargo.toml`, `wasm32v1-none` build, and test conventions out of the box). The generated spawn-and-move ECS demo underneath was replaced: Deepmark's actual need is one persistent record per player address, which does not fit Cougr's entity-component model, built for many anonymous game entities rather than one row per wallet. `cougr-core` was removed from `Cargo.toml` accordingly; nothing here depends on it. See `docs/architecture/onchain-boundary.md` in the main `deepmark` repo for the full reasoning, including why combat stays client-side instead of becoming a transaction per attack.

## Public contract API

| Function | Parameters | Returns | Description |
| --- | --- | --- | --- |
| `record_run` | `player: Address`, `floor_reached: u32`, `relics_kept: u32` | `Result<PlayerRecord, Error>` | Persist one run's result for `player`. Requires `player`'s own signature. `floor_reached` is clamped to the shipped max floor. |
| `get_record` | `player: Address` | `Option<PlayerRecord>` | A player's best floor, best relics, and total runs, or `None`. |
| `leaderboard` | — | `Vec<Address>` | Every address that has ever recorded a run, oldest first, capped at 500. |

`PlayerRecord { best_floor: u32, best_relics: u32, total_runs: u32 }`.

## Architecture overview

```
lib.rs         contract entrypoints — require_auth, apply a pure rule, persist, emit an event
  ├─ components.rs   PlayerRecord, DataKey, leaderboard cap, TTL constants
  └─ systems.rs      apply_run() — pure record-update rule, no storage access, unit tested directly
```

## Trust model (read this before assuming more than it provides)

This contract does **not** re-simulate a run to verify the claimed result. Deepmark's floor generation and combat resolution run entirely in the browser for instant feedback; `record_run` only persists what the client already computed. That is a deliberate trade-off for a 7-day hackathon window, not an oversight: putting every combat exchange on-chain would mean a multi-second wallet/network round trip per attack, which would make the game unplayable. What the chain genuinely provides here is that the result becomes the player's own, portable, tamper-evident-once-written record instead of a row in a database the developers could quietly edit, and `require_auth` means nobody can write a result under an address that is not theirs. Closing the remaining gap, verifying the claimed result actually happened, would mean moving combat resolution on-chain turn by turn (Cougr's `turn-based` and `hidden-info` templates exist for exactly that) and is a documented next step, not a claim made about the current build.

## Storage model

`Record(Address)` and `Leaderboard` are both **persistent** storage entries (per-key TTL, survives indefinitely if kept alive), not **instance** storage, because per-player data is unbounded in count and must not live in the single instance entry. Every write extends that key's TTL (30-day threshold, 120-day extend-to) so active players' state does not get archived between hackathon sessions.

## Build and test

```bash
cargo test
stellar contract build
```

`stellar contract build` needs the WASM target and the Stellar CLI:

```bash
rustup target add wasm32v1-none
cargo install --locked stellar-cli
```

The build writes `target/wasm32v1-none/release/deepmark_contract.wasm`, which is what you deploy with `stellar contract deploy`.

## Known limitations

- No re-simulation of the run; see "Trust model" above.
- The leaderboard is an unsorted address list capped at 500 entries; the client sorts by reading each record. A round with more than 500 distinct players would need a different structure.
- `floor_reached` and `relics_kept` are trusted inputs beyond the floor clamp; there is no check that `relics_kept` is plausible for the claimed floor.
