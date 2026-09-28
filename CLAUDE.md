# Deepmark

Deepmark is a turn-based dungeon-crawler roguelite with a bank-or-push extraction mechanic, built on Stellar/Soroban for the Find Your Way Meridian Hackathon (submission deadline: October 5, 2026, 4:00 PM Costa Rica time). See `docs/architecture/onchain-boundary.md` for what lives on-chain and why.

## Mission

Ship a small, exceptionally polished game first. Stellar must provide meaningful capability (verifiable run results, persistent scarce relics, competitive integrity), never decoration. The game must be fun with the blockchain layer switched off in your head.

## Architecture rules

- Game simulation runs on Cougr (ECS on Soroban, `soroban-sdk` 25.1, `wasm32v1-none`). Use the `turn-based` and `hidden-info` templates as the base; do not hand-roll a custom ECS.
- One on-chain transaction per meaningful decision (floor entry, combat resolution, extract-or-push, claim). Never one transaction per frame or per input.
- Dungeon seeds are committed as a hash and revealed progressively (hidden-info pattern) so no client can precompute the layout.
- Session keys (Cougr `session-auth`) authorize a run's worth of turns after one signature. Do not prompt a wallet signature on every action.
- Rendering, animation, particles, camera and audio are entirely client-side and never block on a transaction confirmation except at extract/death.

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
- No custodial key handling in application code. Cavos embedded wallets keep the private key on-device; Claude never generates, stores or logs a real private key or seed phrase.
- No speculative token. Layer 1 (off-chain currency) and Layer 2 (scarce on-chain relics) come before any Layer 3 SAC token, and only if the design actually requires it.

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

- Every contract ships with a Cougr `GameHarness` test suite before it is considered done.
- Deployment order: local simulation, then Stellar testnet with end-to-end gameplay and failure-mode tests, then a mainnet candidate build only if safe.

## Style

- Never use the em dash character (—) anywhere: code, comments, docs, UI copy, commit messages. Use commas, periods, colons or parentheses instead.
- Commit and attribution conventions are inherited from the global CLAUDE.md (Conventional Commits, English, one line, no Claude/Anthropic attribution).
