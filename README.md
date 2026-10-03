# Deepmark

A turn-based dungeon-crawler roguelite on Stellar/Soroban. Descend, decide, bank your gains or push for more, and leave a permanent, verifiable mark in the depths.

Built for the Find Your Way Meridian Hackathon (Stellar Passport). This repository is private during development and will be published closer to the submission deadline; see `deepmark-internal` for the full design and schedule.

Status: live on Stellar testnet. The contract replays every run from its action log, so a result cannot be claimed without playing it, and a verified extraction mints relics as real Stellar assets (`DMCOMMON`, `DMRARE`, `DMCORE`). No wallet or extension is needed. See `docs/architecture/onchain-boundary.md` for exactly what is and is not verified on-chain.

Contract (testnet): `CBOYTAF2YADTF2FKHKMJHQCZW7EXHBQLCMLBX6FHMOE2WOQH5T3VQCCW`

## Run it locally

The client uses [Bun](https://bun.com) 1.3.14 or newer as its package manager.

```bash
cd client
bun install
bun run dev
```

`bun run typecheck` checks the TypeScript project. `bun run golden` regenerates the vectors that tie the TypeScript game to the contract's Rust replay. `bun run build` typechecks and writes the production bundle to `client/dist`.

WASD or arrow keys to move, Enter to confirm/attack/descend, Esc to retreat/extract. M opens your record: runs in this browser, and your verified record and relic balances on Stellar testnet. `/stats` is the public traction page: every address with a finished run, run totals and best floors, read from the testnet contract. On a narrow screen the board scales to the window and on-screen controls take over. A Stellar testnet account is created and funded automatically on first run; no wallet or extension needed.

## Contract

```
cd contracts/deepmark-contract
cargo test
stellar contract build
```

Deployed to testnet with three relic Stellar Asset Contracts. The deployment script lives in the private `deepmark-internal` repository and is described in `contracts/deepmark-contract/README.md`.

## Checks

GitHub Actions runs the client commands when `client/` changes, and the contract commands when `contracts/` changes. A change to either workflow file runs that workflow. The client commands are `bun run typecheck` and `bun run build`. The contract commands are `cargo test` and `stellar contract build`.
