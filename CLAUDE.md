# Deepmark

Deepmark is a turn-based dungeon-crawler roguelite with a bank-or-push extraction mechanic, built on Stellar/Soroban for the Find Your Way Meridian Hackathon (submission deadline: October 12, 2026). See `docs/architecture/onchain-boundary.md` for what lives on-chain and why.

## Mission

Ship a small, exceptionally polished game first. Stellar must provide meaningful capability (verifiable run results, persistent scarce relics, competitive integrity), never decoration. The game must be fun with the blockchain layer switched off in your head.

## Architecture rules

- The contract (`contracts/deepmark-contract`) is scaffolded with the Cougr CLI but does not use `cougr-core`'s ECS at runtime: Deepmark's data model is one persistent record per player address, which does not fit an entity-component model built for many anonymous game entities. Plain `soroban-sdk` storage is correct here; do not force ECS macros onto this contract. If a future contract genuinely needs many synced game entities (a shared dungeon, live multiplayer), Cougr's `turn-based`/`hidden-info`/`session-auth` templates are the right starting point then, not now.
- Two on-chain transactions per run, not one per floor or per combat exchange: `start_run` (the contract issues the seed) and `finish_run` (the contract replays the action log, derives the result, ranks it and mints relics). Soroban round trips take seconds; a transaction per attack would make the game unplayable. See `docs/architecture/onchain-boundary.md` for what this provides.
- The contract never trusts a claimed result. `contracts/deepmark-contract/src/{rng,world,sim}.rs` is a bit exact port of `client/src/game/`. Any change to the TypeScript simulation, floors, heroes or enemies must be mirrored in Rust and the golden vectors regenerated (`bun run golden` in `client/`), or `cargo test` fails.
- No dungeon-seed commitment on-chain: the three floors are fixed, hand-authored layouts, so there is nothing about the layout to hide. The seed only drives combat rolls and is issued by the contract so a client cannot choose a favourable one.
- Rendering, animation, particles, camera and audio are entirely client-side and never block on a transaction confirmation. `start_run` happens while the descent animation plays, `finish_run` after the result screen is already showing. If Stellar is unreachable the game falls back to a clearly labelled practice run.

## Coding rules

- Rust contracts: `#![no_std]`, explicit types, small modules per Cougr's canonical layout, no speculative abstractions.
- Client: TypeScript strict mode. No `any` without a comment explaining why.
- No giant files, no magic constants, no duplicated logic.

## Performance rules

- Target 60 FPS on modern desktop, graceful degradation on low-power devices.
- Batch and cache: never re-fetch immutable on-chain metadata every frame.
- Time-to-interactive and bundle size are tracked, not assumed.

## Blockchain rules

- Testnet first, always. Mainnet only after the full checklist in `deepmark-internal` passes.
- No custodial key handling on any server: the player's Stellar keypair is generated in the browser and kept in that browser's `localStorage`, and Claude never logs or prints a real secret key. This is a stand-in for Cavos's passkey onboarding, which needs an app ID from Cavos's own dashboard; swap it in by replacing `client/src/stellar/account.ts` only, nothing else depends on how the keypair was obtained.
- No speculative token. Relics are three classic assets (`DMCOMMON`, `DMRARE`, `DMCORE`) wrapped by Stellar Asset Contracts whose admin is the game contract, with the issuer account locked. Only a replay verified extraction can mint, there is no sale, swap or emission schedule, and nothing is pay to win.

## Security rules

- No secrets, API keys or credentials in this repository, ever, including in comments or test fixtures.
- Validate every external response, asset identifier, amount and transaction parameter before acting on it.
- Test authorization boundaries, replay protection and duplicate-claim protection before any mainnet candidate build.

## Art and UX rules

- Follow the art direction and design system once published in `deepmark-internal/studio/`. No generic icon-library assets for hero elements, no mixed visual styles.
- Onboarding must not require the player to understand wallets. No wallet terminology in the first session.

## Repository rules

- This repository is the eventual public submission repo. It stays private until the T-1 freeze (see internal submission checklist), at which point secrets, history and dependencies are audited before flipping visibility.
- Internal planning docs, unpublished assets, balance tools and private operational material live in `deepmark-internal`, not here.

## Testing and deployment

- Every contract entrypoint ships with tests (`cargo test`) before it is considered done. Pure rule logic (see `systems.rs`) is unit tested directly, without an `Env`; entrypoints are tested through `Env::default()` plus `mock_all_auths()`.
- Deployment order: `cargo test` and `stellar contract build` locally, then Stellar testnet with a real end-to-end call (verify the actual transaction, not just the simulation) before trusting a client integration against it, then a mainnet candidate build only if safe.

## Style

- Never use the em dash character (—) anywhere: code, comments, docs, UI copy, commit messages. Use commas, periods, colons or parentheses instead.
- Commit and attribution conventions are inherited from the global CLAUDE.md (Conventional Commits, English, one line, no Claude/Anthropic attribution).
