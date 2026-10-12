# Delvers and the Stellar NFT standard

Research note, written on 2026-10-10. It compares the delver entry points of the game contract with the current Stellar standard for non-fungible tokens and says what would be needed to comply. It does not claim explorer support, and the last section says what was and was not checked.

## What was consulted

| Source | Version and date |
|---|---|
| SEP-0050, Non-Fungible Tokens | Status Draft, version 0.1.0, created and updated 2025-03-10. The file was last changed in `stellar/stellar-protocol` on 2025-06-17 (commit `d4d17e6`) |
| OpenZeppelin `stellar-contracts`, `non_fungible` module, `NonFungibleToken` trait | Release `v0.7.2`, 2026-06-09 (commit `a9c4216`). The newest release, `v0.8.0-rc.3` of 2026-06-16, has a byte for byte identical `non_fungible/mod.rs` |
| Deployed game contract interface | Read from testnet with `stellar contract info interface` for the contract that was live when this note was written (`CDL7OO7MGCNMHZBF5QPJCMBLLY3ORR44TJ54ON44M25YUX6UZ7L46UZW`, since replaced, see the README for the current id) |

SEP-0050 is a draft authored by OpenZeppelin, and the OpenZeppelin module is its reference implementation, so the two are compared together. The standard also notes a classic alternative, SEP-0039 plus a Stellar Asset Contract, and the reasons it is a poor fit (one asset per token, or fungible tokens inside one asset). Delvers carry a look, a kit and an on-chain proof, which that route cannot hold.

## Where the delver interface matches and where it differs

| Standard (`NonFungibleToken`, token id `u32`) | Game contract today | Verdict |
|---|---|---|
| `balance(account) -> u32` | `balance(owner) -> u32` | Matches |
| `owner_of(token_id) -> Address`, fails with `NonExistentToken` (200) | `owner_of(id) -> Option<Address>` | Differs. Returns `None` for an unknown id instead of failing |
| `transfer(from, to, token_id)`, fails with `IncorrectOwner` (201) or `NonExistentToken` (200) | `transfer(from, to, id) -> Result<(), Error>`, fails with `NotHeroOwner` (11) or `HeroNotFound` (10) | Same call shape, different errors |
| `transfer_from(spender, from, to, token_id)` | none | Missing |
| `approve`, `approve_for_all`, `get_approved`, `is_approved_for_all` | none | Missing |
| `name`, `symbol`, `token_uri(token_id)` | none | Missing. A delver's metadata is readable through `hero(id)`, which returns the look, kit and the proof of the first clear, but not through the standard calls |
| Event `transfer`, topics `["transfer", from, to]`, data `token_id` | `hero_transfer`, topic `from`, data `to` and `hero_id` | Differs. An indexer that listens for the standard event does not see delver transfers |
| Event `mint`, topics `["mint", to]`, data `token_id` | `hero_earned`, topic `player`, data `hero_id` and `name` | Differs |
| No cap on tokens an account can hold | `MAX_HEROES_PER_OWNER` is 64, and `transfer` refuses a recipient already at the cap with `InvalidHero` (1) | Deviation. It keeps each owner's index bounded, and it lets someone fill another player's slots, see `docs/threat-model.md` |
| Optional extensions: enumerable, burnable, consecutive, royalties | `heroes_of(owner)` and `hero_count()` play the part of enumeration. Nothing burns | Not required |

The token id type, `u32`, is the same, and ids are sequential from zero, as in the OpenZeppelin sequential extension.

So the shape follows the standard for ownership and transfer, and does not comply with it. An explorer or indexer that discovers tokens through the standard calls and events would find no name, no symbol, no URI, and no events it knows.

## Two ways to comply

**A. Implement the trait in the game contract.** Add the missing calls and events, make `owner_of` fail on an unknown id, and add `name`, `symbol` and `token_uri`. The contract stays the single registry, so a delver is still minted only inside `finish_run`, after the replay. The cost is one dependency and one design decision:

- `stellar-tokens` from `v0.7.2` requires `soroban-sdk` 26.1.0, and the contract is on 25.1.0. `v0.7.0` pins 25.3.0, which satisfies the current requirement. Its trait would need the same line by line check as above before relying on it.
- `token_uri` has to return something an explorer can fetch. A static client cannot serve one JSON file per delver. Either a small metadata endpoint is added, which is new infrastructure for a game that has none, or the contract builds a `data:` URI from the stored delver, which needs a size check and a check against an explorer.

**B. A separate collection contract that the game mints through.** The game contract would call a token contract that is a standard NFT. That keeps the game contract small, but the token contract needs an owner or minter role to authorise the game contract, which brings back the admin key the design deliberately does not have, and a second contract to audit.

**Recommendation: A**, done together with the release deployment tracked in the mainnet readiness issue. The contract now has an admin and an upgrade path, so adding the interface no longer forces a redeploy, as long as the storage layout stays readable. A redeploy would still need a fresh relic issuer because a Stellar Asset Contract admin cannot be reassigned. Delvers earned on an earlier deployment do not migrate.

Until then the README says what is true: delvers have an ownership and transfer interface shaped like the standard, and they are not standard tokens.

## What was and was not checked

Checked, from public sources on 2026-10-10:

- The standard's call list, error codes and events against the game contract's source, and the deployed contract's interface against both.
- The deployed contract exposes `balance`, `owner_of`, `transfer`, `heroes_of`, `hero` and `hero_count` for delvers, and none of `name`, `symbol`, `token_uri`, `transfer_from` or the approval calls.

Not checked, and why:

- **Explorers.** No explorer was loaded with a delver. Players never need one, because the game creates and holds their account for them, so this only matters for anyone who wants to inspect a delver from outside. Whether `stellar.expert` or another explorer renders a Soroban contract that follows the standard is not documented in the sources above, and it is not claimed here.

This stays open on the issue. The acceptance criterion about a link showing a delver in an explorer is therefore not met, and the honest statement for now is: not supported, because the contract does not expose the metadata calls and events an explorer looks for, and nothing has been tested against one.
