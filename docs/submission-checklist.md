# Submission checklist

Status as of 2026-10-10. "Engineering" items are done in the repository and can be checked there. "Owner" items need the project owner's accounts, devices or a decision, and are left open on purpose. A line marked done says how it was checked.

## Confirm first

| Item | Owner | Status |
|---|---|---|
| Confirm the submission deadline. `CLAUDE.md` gives 2026-10-05 16:00 Costa Rica time, and this checklist was written on 2026-10-10 | Owner | Open |

## Repository and public text

| Item | Owner | Status |
|---|---|---|
| README that gets a stranger playing in a minute, with contract and asset ids from the code | Engineering | Done, `README.md` |
| Threat model with the attacks considered, what stops each, and what remains | Engineering | Done, `docs/threat-model.md` |
| Every README claim traceable to code, a test or an id on the explorer | Engineering | Done for this version. Re-read after any later edit |
| No em dash in public text | Engineering | Done for the working tree: the only occurrence is the rule quoted in `CLAUDE.md`. Git history contains older ones (9 outside `.claude/` on 2026-10-10) and has not been rewritten |
| No AI sounding filler in public text | Owner | Open. Final read of README and docs by a person |
| Licence file | Engineering | Done. Apache 2.0 in `LICENSE`, and the contract crate declares `Apache-2.0` |
| `.claude/` toolkit files in the tree | Owner | Open. 169 tracked files of third party skills. Decide whether they belong in the public repository. History also holds a merge titled `add-toolkit-claude` |
| Dependency licence audit | Owner | Open |
| Live link in the README | Owner | Open. The game has no public deployment yet, and the repository is private |

## Secrets and visibility

| Item | Owner | Status |
|---|---|---|
| Secrets scan of the full history | Engineering | Done 2026-10-10 with gitleaks 8.30.1: 59 commits, no leaks. A second pattern search for Stellar secret keys (`S` followed by 55 base32 characters) over all revisions found none. Run both again at the freeze |
| Secrets scan again at the T-1 freeze, on the final history | Owner | Open |
| Visibility flip, after the freeze audit | Owner | Open. The repository is private |

## Contract

| Item | Owner | Status |
|---|---|---|
| `cargo test` | Engineering | Done 2026-10-11: 71 tests and 600 golden vectors pass |
| Golden vectors current against the client | Engineering | Checked by the client workflow on every change |
| Testnet deployment, ids published | Engineering | Done, in the README |
| Issuer account locked | Engineering | Done on the 2026-10-11 testnet deployment: one signer with weight 0, and a transaction signed with its key is rejected |
| Admin renounced or moved to a multisig | Owner | Open. The testnet admin is a single key and can upgrade the contract. Decide before mainnet and before the final submission |
| Mainnet or an explicit statement that there is none | Owner | Open. Needs a funded deployer and presence for the transactions |
| Standard NFT interface or an explicit list of deviations | Engineering | Done as a list of deviations, `docs/architecture/nft-standard.md` |
| A delver visible in an explorer | Engineering | Open. The contract does not yet expose the metadata calls and events an explorer looks for |

## Client quality

| Item | Owner | Status |
|---|---|---|
| Typecheck and build | Engineering | Checked by the client workflow |
| Performance budgets enforced | Engineering | Done, `.github/workflows/perf.yml` and `docs/performance.md` |
| Accessibility checks and the manual keyboard walkthrough | Engineering | Done, `.github/workflows/a11y.yml` and `docs/accessibility.md`. No screen reader pass yet |
| Clean browser verification on a laptop | Owner | Open. A fresh profile, from the title to a verified result |
| Clean browser verification on a phone, iOS Safari and a mid range Android | Owner | Open. Needs the devices |

## Media

| Item | Owner | Status |
|---|---|---|
| Trailer, 30 and 90 second cuts, and README media | Owner | Open. Tracked in its own issue |
