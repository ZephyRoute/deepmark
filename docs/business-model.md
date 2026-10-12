# Business model

Deepmark is a free game. There is no token and nothing for sale that makes a delver stronger. This page says how it could be funded without breaking that, and what is not planned. Nothing here is signed, live or earning today, and none of the numbers it would depend on have been measured yet.

## What stays fixed

- No speculative token.
- Nothing pay to win, directly or through a market.
- Only a replay verified extraction can mint a relic or earn a delver.
- The game must be fun with the blockchain ignored.
- No server holds a player's keys.

Every option below was checked against those rules, and the ones that fail them are listed at the end.

## The plan: sponsored seasonal ladders

A season is a few weeks with a fixed ruleset and a ladder ranked by the order the contract already uses: extraction, score, floor, HP left, then fewest actions. A sponsor funds the prizes. Entry is free for players. Prizes would be paid only to ranks that `verify_run` can reproduce, so a sponsor can audit that its money went to results that were legitimately played.

That auditable payout is the thing a sponsor would be buying, together with the attention of the players on the ladder.

What has to be true first:

- **Enough players to be worth sponsoring.** There is no player count worth quoting yet.
- **A ruleset that resists solvers.** The game is deterministic and the seed is public, so a bot can play a legal perfect run. A prize ladder needs procedural floors or a seed issued late, and protection against one person running many accounts. The [threat model](threat-model.md) describes both gaps.
- **Sponsored fees.** A new player cannot pay fees without holding XLM, so a ladder needs a fee sponsor that does not hold player keys. The testnet fees we measured are in the README.
- **Legal review** of prizes in the places players live. This is not done.

## Cost side

Fee sponsorship is a cost, not income, and it is what makes the rest possible. It is funded from sponsorship and grants. The abuse risk is bots spamming `start_run`, which the cooldown and per account limits would have to contain. We have not measured mainnet fees and will not quote a cost per player until we have.

## Smaller pieces

- **Optional cosmetics.** Looks only, with no effect on play. An earned delver keeps a mark that cannot be bought, so a bought look is never mistaken for a verified clear.
- **An open replay kit.** The way Deepmark replays runs could help other small deterministic games. The idea is to publish it as open source under the existing licence first, and offer integration help only if another studio asks.

## What is not planned

- **A token, of any kind.** Not without publicly rewriting the principles first.
- **Entry fees for tournaments.** They bring gambling and licensing exposure and push toward pay to play. Sponsor funded free entry is the version we would run.
- **A marketplace fee on delvers.** A market would let someone buy a won delver, which undoes the point of verification.
- **Selling power, relics or ladder places.**

## Honest summary

On the numbers we can imagine, this is a project funded by grants and sponsors, and a small studio's portfolio, not a venture scale business. If that changes it will be because the audience is much larger or because other studios use the replay kit. We will say so here when we know.
