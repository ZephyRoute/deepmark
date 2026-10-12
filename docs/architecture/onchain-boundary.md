# On-chain boundary

Deepmark is a turn-based dungeon-crawler roguelite. The loop: enter a run, descend up to 3 floors, fight or avoid the enemy guarding each floor's shortcut, grab relics, then choose to extract your gains or push deeper. Death or extraction ends the run.

Terms used below:

- **Soroban**: Stellar's smart contract platform. The game contract is a Soroban contract.
- **Stellar Asset Contract (SAC)**: a contract that exposes a classic Stellar asset to smart contracts. Each relic asset has one.
- **Replay**: running the recorded moves through the same rules, from the same seed, to get the result again.
- **Golden vectors**: runs played by the real TypeScript game and stored with their results, so `cargo test` can check the Rust replay gives the same answer byte for byte.
- **TTL**: how many ledgers a stored entry lives before it is archived unless its lifetime is extended.

The rule that shapes everything below: **the contract never trusts a claimed result.** The whole game is small and deterministic, so the contract replays each run itself and derives the result.

## How a run touches the chain

Diagrams are generated in `diagrams/` and are embedded here once built.

![System context of the browser, Stellar services, the game contract and the relic contracts.](../../diagrams/out/svg/01-system-context.svg)

![One run as two transactions.](../../diagrams/out/svg/02-run-sequence.svg)

1. `start_run(player, choice)`: the contract issues the run's seed on chain and stores an open run for the player. The client plays the run with that seed. This happens while the descent animation plays.
2. The player plays entirely locally. Every input that changed the game is appended to an action log, one byte each (move up, down, left, right, attack, retreat, descend, extract).
3. `finish_run(player, actions)`: after the result screen is already showing, the client sends the log. The contract replays it with a Rust port of the game simulation, derives the floor, relics, score and HP, ranks the run, updates the profile and mints the banked relics.

If Stellar is unreachable, the game falls back to a practice run that is labelled as not recorded. The game never depends on the chain being up.

## Earned delvers

Every descent starts by building a delver: name, emblem, cloak, a base, one weapon and one charm from predefined items. `start_run` validates all of it and fixes it in the run's ticket. Only a fresh delver that extracts from floor 3 in a verified replay becomes the player's own, as an owned record stored in the contract with the verified clear as its proof. It is not a standard token, see `delvers-and-nft-standard.md`. Dying first loses the character. An owned delver can descend again as a veteran, gaining one hit point of rank per clear up to three, and veterans have their own leaderboard so they never compete with fresh delvers.

## On-chain (Soroban)

Contract: `contracts/deepmark-contract`.

- **Seed.** Derived from ledger sequence, ledger time, the player's run counter and address. The client cannot choose it.
- **Replay.** `sim.rs` is a bit exact port of `client/src/game/`: the same Mulberry32 generator, the same floors, enemies and delvers. Golden vectors played by the real TypeScript game are checked byte for byte by `cargo test`, so the two cannot drift silently.
- **Profile.** Per address: best verified run, runs, extractions, deaths, abandoned runs, relics banked.
- **Leaderboards.** Two sorted lists, `top_fresh` for fresh delvers and `top_veteran` for veterans, each the best 100 verified runs with one row per player, read in a single call each, ranked by extraction, score, floor, HP left, then fewest actions. The number of players is not capped, and players are listed through a paged call.
- **Audit.** `verify_run(base, weapon, charm, rank, seed, actions)` replays any run without writing anything, so anyone can check a result from the `run_started` event and the log. A worked example with real values is in the README.
- **Delvers.** The contract is also the registry of earned delvers: `owner_of`, `heroes_of`, `hero`, `balance` and `transfer`. Mint happens only inside `finish_run`, after the replay.
- **Relic assets.** Three classic assets (`DMCOMMON`, `DMRARE`, `DMCORE`), each wrapped by a Stellar Asset Contract. The game contract is the admin of each, and the issuer account is locked (master weight zero, no other signer), so nothing can mint except a verified extraction. If a mint is rejected, for example because the player has no trustline for that relic, `finish_run` returns `MintFailed` and reverts, so the run stays open and can be finished again.
- **Storage lifetime.** Writes extend the entry they touch to 120 days when it has under 30 left. `start_run` also renews the player counter, the delver counter, both leaderboards and the delver a veteran run uses, and the contract instance is extended on every start and finish. The deployment itself extended the instance and wasm lifetimes, so the first call is not charged that rent. Records of players who stop playing are not renewed and can expire after about 120 days.
- **Admin and upgrade.** The game contract has an admin (the deployer) that can replace its code, hand the role to another address or renounce it. While the role exists, players trust that admin not to ship code that skips the replay. Renouncing, or moving the role to a multisig, is the step that removes that trust, and is planned before any mainnet release.

## Off-chain (client)

- Floor rendering, movement, camera, animation, particles, screen shake, sound.
- The live simulation, so combat gives instant feedback with no transaction in the loop.
- `localStorage` progress shown instantly on the title screen.
- The player's Stellar keypair: generated once per device, kept in `localStorage`, funded on testnet, with relic trustlines added invisibly. No seed phrase and no wallet vocabulary in the first session.

## What this provides

- A delver cannot be claimed without winning with it, and a result cannot be claimed without playing it: a forged log either fails the replay or produces a legitimate result.
- A run cannot be claimed twice: finishing consumes the open run.
- Nobody can act for an address that did not sign.
- The client cannot choose a favourable seed.
- Relics exist only because a verified run banked them, and anyone can see the supply.
- Upgrades are visible: every code swap, handover and renounce emits an event, and `admin()` reports `None` once the contract is frozen.

## What it does not provide

- **Seed rerolling is limited, not eliminated.** Starting another run costs a transaction and a short cooldown, and an abandoned run is counted on the profile, but both are per address. A determined player can discard seeds, and a new funded address starts with a clean record.
- **Relics have no supply cap.** Only a verified extraction mints, but a bot that solves seeds offline can run many accounts. A relic proves a replayed legal run, not a distinct person.
- **A solver can play a legal perfect run.** Any deterministic game allows it. The result is still a run the game could produce, and ties are broken by HP left and fewest actions.
- **New players register one per ledger.** A new player is appended to a sequential index (`PlayerAt(i)`), so several brand new players whose `start_run` lands in the same ledger simulate the same next index, and the later transactions fail with `storage exceeded_limit` on the key `PlayerAt N`. In the playtest, 3 fresh accounts starting together gave 2 failures out of 3. This is a throughput limit of new player registration, about one per ledger (about 5 seconds). The client detects a failed `start_run` (`client/src/stellar/txOutcome.ts`), retries up to 4 times with jittered backoff and re-simulates, and a local re-run had 6 of 6 starts succeed. A returning player is never affected. A registry keyed by address would remove the limit in a later contract version.
- **The keypair lives in the browser.** Clearing storage loses the identity and its records. A passkey smart account is the planned replacement.
- **Delvers are not yet standard NFTs.** They live in the game contract with a compatible shape, and the exact standard is to be verified before any claim of wallet support.
- **Testnet only** until a mainnet deployment is made.

## Costs measured

The worst case `finish_run` in the test suite (2,000 inputs of wall bumps plus a legal path, `the_worst_case_log_stays_far_under_the_cpu_budget` in `src/test.rs`) uses about 3.6 million CPU instructions against the 400 million limit. The deployed wasm is 28,107 bytes, fetched with `stellar contract fetch` on 2026-10-12 and matching the sha256 in `docs/deployments.md`. Fees of real transactions on testnet are in the README under "Measured costs": almost all of every fee is one time storage rent, a new player pays about 0.79 XLM once, and a later `start_run` costs about 0.006 XLM.

## What changed from the first design

The original plan hid a procedurally generated dungeon behind a seed commitment and put every combat exchange on chain. Neither survived contact with the game: the floors are fixed layouts with nothing to hide, and a multi-second round trip per attack would make combat unplayable. The first deployed version recorded a result the client reported. This version replaces trust with replay.
