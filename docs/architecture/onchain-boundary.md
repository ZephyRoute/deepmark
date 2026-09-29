# On-chain boundary

Deepmark is a turn-based dungeon-crawler roguelite. The loop: enter a run, descend up to 3 floors, fight or avoid the enemy guarding each floor's shortcut, grab relics, then choose to extract your gains or push deeper. Death or extraction ends the run.

This document originally described a design (per-floor seed commitment, per-combat transactions, relics as individually owned assets) that Phase 3 implementation did not build once the actual game turned out not to need it. What follows is what is actually deployed, not the earlier plan; see "What changed and why" at the bottom for the reasoning.

## On-chain (Soroban)

Contract: `contracts/deepmark-contract`, deployed to Stellar testnet at `CDSY2SAMUJ43TWKN7IOGWXMOSYCD3BHHZZJY4YZHSSNRKHQPH5T3LQSH`.

- **Run result.** One transaction, submitted when a run ends (extraction or death): `record_run(player, floor_reached, relics_kept)`. Requires the player's own signature (`require_auth`), so nobody can write a result under an address that is not theirs.
- **Player record.** `best_floor`, `best_relics`, `total_runs` per address, persisted and readable by anyone (`get_record`). This is what makes a "best run" claim mean something beyond a `localStorage` value only the player's own browser can see.
- **Leaderboard.** Every address that has ever recorded a run, in a capped on-chain list (`leaderboard`), so a client can build a real leaderboard without a separate indexer. Not yet wired into the game's UI; the contract-level support exists ahead of the client screen.

## Off-chain (client)

- Floor layout, movement, room navigation, camera, animation, particles, screen shake, sound.
- Combat resolution, relic drops, and the extract-or-descend decision: all computed live in the browser with a seeded RNG, so the player gets instant feedback with no transaction in the loop during play.
- `localStorage` best-run tracking, shown instantly on the title screen without waiting on a network round trip.
- The player's Stellar keypair itself: generated once per device, kept in `localStorage`, never a seed phrase the player has to see.

## What this trust model actually provides, and what it does not

`record_run` does **not** re-simulate the run to check that the claimed floor and relics are real. Deepmark's floor generation and combat run entirely client-side; the contract call only persists whatever the client already computed and displayed. For a 7-day hackathon build, this was a deliberate trade-off, not an oversight: verifying the claim would mean moving combat resolution on-chain turn by turn, and a multi-second Soroban round trip per attack would make the game unplayable, directly against the "never block gameplay waiting for a blockchain confirmation" rule in `CLAUDE.md`.

What Stellar genuinely buys here: the result becomes the player's own record, readable by anyone, outside a database the developers could quietly edit, and tied to an address only that player controls. What it does not buy (yet): protection against a player lying about their own run. Closing that gap would mean moving floor and combat resolution into a Cougr `turn-based`/`hidden-info` contract, one transaction per meaningful in-run decision, which is the natural next step if the project continues past the hackathon, not a claim made about the current build.

## What changed and why

The first draft of this document (written before any contract existed) planned: a committed-and-revealed dungeon seed, one transaction per combat resolution, and relics as individually owned assets. None of that survived contact with the actual game:

- Deepmark's three floors are hand-authored, fixed layouts, not generated from the run seed, so there was never anything about the layout to hide or commit to. The seed only drives combat damage rolls, which the player experiences turn by turn in real time; there is no "regenerate a favorable outcome after seeing it" exploit to close.
- One transaction per combat exchange would mean a multi-second wait on every attack. That was never going to ship as a fun game, so the design collapsed to one transaction per finished run, at the point the player already sees a result screen and would tolerate a brief "saving..." message.
- Relics are counted per rarity, not minted as individual on-chain assets. Building real transferable ownership (a token or NFT-like registry per relic) was judged to be scope the 7-day window did not have room for; the per-address record still gives a genuine, persistent, player-owned result without that machinery.
