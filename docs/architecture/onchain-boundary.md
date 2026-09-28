# On-chain boundary

Deepmark is a turn-based dungeon-crawler roguelite. The loop: enter a run, descend floors, make a decision each floor (fight, loot, rest, or push deeper), then choose to extract your gains or risk them on the next floor. Death or extraction ends the run and its result becomes permanent.

## On-chain (Soroban, via Cougr)

- **Run seed commitment.** The dungeon seed is hashed and committed before the run starts, then revealed floor by floor. This is the only way a leaderboard can be trusted: without it, a client could regenerate a favorable layout after seeing the outcome.
- **Run result.** Floor reached, relics extracted, and cause of end (extracted or died) are written on completion. This is what a leaderboard actually ranks, so it has to be tamper-evident, not a value the client self-reports to a database.
- **Relic ownership.** Relics extracted from a run become scarce, persistent, player-owned assets. Ownership only means something if it survives outside our own server, which is the actual reason to put it on Soroban instead of a Postgres row.
- **Claims.** Converting an extracted relic or reward into something the player holds outside a single run is a state transition with real consequences (it cannot be taken back by restarting the app), so it is a transaction, not a client-side flag.

## Off-chain (client)

- Movement, room navigation, camera, animation, particles, screen shake, sound.
- The floor-by-floor decision UI and combat resolution math the player sees in real time. The client computes the same deterministic result the contract will later confirm, so the player gets instant feedback and the transaction is a confirmation, not a wait.
- Tutorial state, settings, cosmetic-only preferences.
- Matchmaking and leaderboard display (the display reads from indexed contract events; the ranking itself is derived from on-chain data, not stored off-chain as the source of truth).

## Why this split

Every on-chain item above fails a simple test if moved off-chain: a self-reported run result cannot be trusted for a competitive leaderboard, a relic that only exists in our database is not actually owned by the player, and an unrevealed seed that the client already knows is not actually hidden. Everything in the off-chain list fails the opposite test: animating a footstep does not need consensus, and paying a transaction fee to move a camera would make the game unplayable and would not make the camera movement any more true.

This document will be updated as Phase 1-3 implementation clarifies edge cases (partial-floor disconnects, contested leaderboard ties, relic transfer between players).
