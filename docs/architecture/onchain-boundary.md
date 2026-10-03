# On-chain boundary

Deepmark is a turn-based dungeon-crawler roguelite. The loop: enter a run, descend up to 3 floors, fight or avoid the enemy guarding each floor's shortcut, grab relics, then choose to extract your gains or push deeper. Death or extraction ends the run.

The rule that shapes everything below: **the contract never trusts a claimed result.** The whole game is small and deterministic, so the contract replays each run itself and derives the result.

## How a run touches the chain

1. `start_run(player, hero)`: the contract issues the run's seed on chain and stores an open run for the player. The client plays the run with that seed. This happens while the descent animation plays.
2. The player plays entirely locally. Every input that changed the game is appended to an action log, one byte each (move up, down, left, right, attack, retreat, descend, extract).
3. `finish_run(player, actions)`: after the result screen is already showing, the client sends the log. The contract replays it with a Rust port of the game simulation, derives the floor, relics, score and HP, ranks the run, updates the profile and mints the banked relics.

If Stellar is unreachable, the game falls back to a practice run that is labelled as not recorded. The game never depends on the chain being up.

## On-chain (Soroban)

Contract: `contracts/deepmark-contract`.

- **Seed.** Derived from ledger sequence, ledger time, the player's run counter and address. The client cannot choose it.
- **Replay.** `sim.rs` is a bit exact port of `client/src/game/`: the same Mulberry32 generator, the same floors, enemies and delvers. Golden vectors played by the real TypeScript game are checked byte for byte by `cargo test`, so the two cannot drift silently.
- **Profile.** Per address: best verified run, runs, extractions, deaths, abandoned runs, relics banked.
- **Leaderboard.** One sorted list of the best 100 verified runs, read in a single call, ranked by extraction, score, floor, HP left, then fewest actions. The number of players is not capped, and players are listed through a paged call.
- **Audit.** `verify_run(hero, seed, actions)` replays any run without writing anything, so anyone can check a result from the `run_started` event and the log.
- **Relic assets.** Three classic assets (`DMCOMMON`, `DMRARE`, `DMCORE`), each wrapped by a Stellar Asset Contract. The game contract is the admin of each, and the issuer account is locked, so nothing can mint except a verified extraction.

## Off-chain (client)

- Floor rendering, movement, camera, animation, particles, screen shake, sound.
- The live simulation, so combat gives instant feedback with no transaction in the loop.
- `localStorage` progress shown instantly on the title screen.
- The player's Stellar keypair: generated once per device, kept in `localStorage`, funded on testnet, with relic trustlines added invisibly. No seed phrase and no wallet vocabulary in the first session.

## What this provides

- A result cannot be claimed without playing it: a forged log either fails the replay or produces a legitimate result.
- A run cannot be claimed twice: finishing consumes the open run.
- Nobody can act for an address that did not sign.
- The client cannot choose a favourable seed.
- Relics exist only because a verified run banked them, and anyone can see the supply.

## What it does not provide

- **Seed rerolling is limited, not eliminated.** Starting another run costs a transaction and a short cooldown, and an abandoned run is counted on the profile, but a determined player can still discard seeds.
- **A solver can play a legal perfect run.** Any deterministic game allows it. The result is still a run the game could produce, and ties are broken by HP left and fewest actions.
- **The keypair lives in the browser.** Clearing storage loses the identity and its records. A passkey smart account is the planned replacement.
- **Testnet only** until a mainnet deployment is made.

## Costs measured

The worst case `finish_run` in the test suite (2,000 inputs of wall bumps plus a legal path) uses about 3.6 million CPU instructions against the 400 million limit. The contract wasm is about 16 KB.

## What changed from the first design

The original plan hid a procedurally generated dungeon behind a seed commitment and put every combat exchange on chain. Neither survived contact with the game: the floors are fixed layouts with nothing to hide, and a multi-second round trip per attack would make combat unplayable. The first deployed version recorded a result the client reported. This version replaces trust with replay.
