# Deepmark roadmap

This is where Deepmark is headed. It is a plan, not a promise, and dates will move. Each step is tied to a limit of the game today.

## Where we are

Deepmark is a turn-based dungeon crawler on Stellar testnet. When you extract, a smart contract replays your run from the seed it issued and works out the result itself, so a score, a rank or a relic cannot be claimed without playing for it. The game needs no wallet or sign-up. The known limits are listed in the [README](../README.md#limitations) and in the [threat model](threat-model.md): testnet only, an admin who can still upgrade the contract, delvers that are not yet standard NFTs, an account kept in your browser, no cap on relics, and no third party audit yet.

## Fixes the threat model asks for

These are bugs and gaps, not features. Several need a contract change, which means a redeploy and new ids.

- Stop `transfer` from duplicating a delver id when it is sent to its own owner.
- Keep shared entries alive without a write, and have the client restore archived entries, so idle data does not break a call after about 120 days.
- Let a player claim relics a failed mint left behind, instead of losing them.
- Let a recipient refuse a delver, so nobody can fill another player's slots.
- Add friction against many accounts farming relics and boards: a mint budget, or a cost to start a run. The right design is not decided.
- A timelock on `upgrade`, or renounce the admin.

## Next few weeks

- Keep the game stable and fix what players report.
- Share cards and challenge links, so you can send someone a run to beat.
- Clearer first-run guidance.
- Decide the plan for the contract admin role, and publish it with a date.

## Next few months

- **Accounts that survive clearing your browser.** We are evaluating social login and passkey accounts. The provider is not decided, and we will only choose one that does not hold your keys on a server.
- **Sponsored fees,** so that a new player never needs to buy anything to play.
- **Mainnet.** Only after the contract admin is renounced or moved to a multisig, an independent review is done, and our own release checklist passes.
- **Standard NFT support for delvers.** We will follow the Stellar NFT standard once we have tested it with real wallets and explorers, and we will not claim support before then.
- **A first season:** a ladder with a fixed ruleset and verified results.

## Later

- **More floors and procedural runs.** This needs a committed seed so layouts cannot be exploited, and a fresh look at the on-chain cost of longer runs. A fixed three floor layout can be solved offline once the seed is known, which is also why prize ladders need this first.
- **Seasons with sponsored prizes.** Prizes would be funded by sponsors, never by players paying to enter, and paid out only for runs the contract has replayed. See [business-model.md](business-model.md).
- **Crews:** shared ladders for groups of players, with no treasury and no token.
- **An open replay kit.** The way Deepmark verifies runs could help other small games do the same. We plan to publish it as open source and see whether anyone wants it.
- **Optional cosmetics.** Looks only. They will never affect play, and they will stay clearly separate from delvers you earned.

## Principles we will keep

- The game has to be fun with the blockchain ignored.
- No speculative token.
- Nothing you can buy makes you stronger.
- Only a verified extraction can create a relic or an earned delver.
- No server ever holds your keys.
- We will say what is not done yet.

## How we will know it works

We will watch whether new players finish a run, whether they come back, and whether verified results stay clean. We will publish honest numbers when we have them, including the bad ones.

## What is not yet verified

Plans that rely on outside projects depend on testing we have not done yet. Until then they are plans, not features.

- **Social login and passkey providers.** One provider, Cavos, says in its public documentation that it supports Stellar accounts, with hosted login and sponsored execution. That is a claim from its docs. We could not find a Stellar specific page, and we have not tried it, so who holds the key, how recovery works and what it costs are unknown. Passkey Kit and Blux are other options that we have only seen described, not tested.
- **The Stellar NFT standard.** It is a draft, and we have not tested delvers against any wallet or explorer.
- **Wallet and explorer support** for delvers or relics beyond what the explorer already shows for classic assets.
- **Sponsored fees on mainnet.** The testnet fees we measured are in the README. We have no mainnet numbers.
