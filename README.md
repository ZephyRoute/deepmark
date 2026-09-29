# Deepmark

A turn-based dungeon-crawler roguelite on Stellar/Soroban. Descend, decide, bank your gains or push for more, and leave a permanent, verifiable mark in the depths.

Built for the Find Your Way Meridian Hackathon (Stellar Passport). This repository is private during development and will be published closer to the submission deadline; see `deepmark-internal` for the full design and schedule.

Status: Phase 3, live on Stellar testnet. Every finished run records its result to a deployed Soroban contract (`contracts/deepmark-contract`, id `CDSY2SAMUJ43TWKN7IOGWXMOSYCD3BHHZZJY4YZHSSNRKHQPH5T3LQSH`), with a non-custodial browser keypair and no wallet prompts. See `docs/architecture/onchain-boundary.md` for exactly what is and is not verified on-chain.

## Run it locally

```
cd client
npm install
npm run dev
```

WASD or arrow keys to move, Enter to confirm/attack/descend, Esc to retreat/extract. A Stellar testnet account is created and funded automatically on first run; no wallet or extension needed.

## Contract

```
cd contracts/deepmark-contract
cargo test
stellar contract build
```

Deployed to testnet as `deepmark` (see `stellar contract deploy` in the repo history for the exact command).
