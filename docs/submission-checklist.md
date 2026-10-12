# Submission checklist

Status as of 2026-10-12, after the evening redeploy of the testnet contract. "Engineering" items are done in the repository and can be checked there. "Owner" items need the project owner's accounts, devices or a decision, and are left open on purpose. A line marked done says how it was checked.

## Confirm first

| Item | Owner | Status |
|---|---|---|
| Submission deadline | Owner | Confirmed by the owner: 2026-10-12. `CLAUDE.md` was updated to match |

## Repository and public text

| Item | Owner | Status |
|---|---|---|
| README that gets a stranger playing in a minute, with contract and asset ids from the code | Engineering | Done, `README.md` |
| Threat model with the attacks considered, what stops each, and what remains | Engineering | Done, `docs/threat-model.md` |
| Every README claim traceable to code, a test or an id on the explorer | Engineering | Done for this version. Re-read after any later edit |
| No em dash in public text | Engineering | Done for the working tree: the only occurrence is the rule quoted in `CLAUDE.md`. Git history contains older ones (9 outside `.claude/` on 2026-10-10) and has not been rewritten |
| No AI sounding filler in public text | Owner | Open. Final read of README and docs by a person |
| Licence file | Engineering | Done. Apache 2.0 in `LICENSE`, and the contract crate declares `Apache-2.0` |
| `.claude/` toolkit files in the tree | Owner | Decided 2026-10-12: they stay in the public repository |
| Dependency licence audit | Owner | Not planned for this submission. Left open on purpose |
| Verify a run in 60 seconds, with a real seed and log | Engineering | Done, README. `verify_run` was run read only against the redeployed contract on 2026-10-12 with a run from that deployment and matches the `run_finished` event |
| Measured costs table from real transactions | Engineering | Done, README, from the six playtest runs on the redeployed contract. Testnet only, no mainnet figures |
| Roadmap, business model and a Spanish summary | Engineering | Done, `docs/roadmap.md`, `docs/business-model.md`, README. Third party claims are marked unverified |
| Stale facts fixed (test and vector counts, `verify_run` signature, two leaderboards, missing deploy script) | Engineering | Done 2026-10-12 |
| Threat model states sybil and solver farming, the admin without a timelock and the browser key as remaining, and the fixed items as fixed | Engineering | Done, `docs/threat-model.md`. The self transfer bug, the failed mint retry and the expiry of shared entries are fixed in the redeploy, with tests |
| Live link in the README | Engineering | Done, https://deepmark-dun.vercel.app. The deployed bundle carries the same contract and asset ids as `client/src/stellar/config.ts` |

## Secrets and visibility

| Item | Owner | Status |
|---|---|---|
| Secrets scan of the full history | Engineering | Done 2026-10-12 with gitleaks 8.30.1: 70 commits on the current branch, no leaks. Earlier run 2026-10-10: 59 commits, no leaks. A second pattern search for Stellar secret keys (`S` followed by 55 base32 characters) over all revisions found none. Run both again at the freeze |
| Secrets scan again at the T-1 freeze, on the final history | Owner | Open |
| Visibility flip, after the freeze audit | Owner | Open. The repository is private |

## Contract

| Item | Owner | Status |
|---|---|---|
| `cargo test` | Engineering | Done, re-run 2026-10-12: 80 tests and 600 golden vectors pass (`cargo test`) |
| Golden vectors current against the client | Engineering | Checked by the client workflow on every change |
| Testnet deployment, ids and transactions published | Engineering | Done 2026-10-12, in the README and `docs/deployments.md`: the redeployed game contract `CDQDI2SN...H7RX` (wasm sha256 `db721cb9...0d07`, 28,107 bytes, matches `stellar contract fetch`), all 13 setup transactions and the 12 playtest transactions, each read back from Horizon as successful. The earlier deployments are listed as superseded |
| Real transactions through the real client on the redeployed contract | Engineering | Done 2026-10-12: six runs (early extraction, rare extraction, death, two full clears with a delver each, a veteran run), supply equals mints, `verify_run` matches, costs measured. Evidence is in the README and `docs/deployments.md` |
| Issuer account locked | Engineering | Done on the current testnet deployment (lock transaction 2026-10-12 18:30 UTC): one signer with weight 0 and thresholds 0, re-read on Horizon after the playtest. A signed attempt with the issuer key was not repeated on this issuer |
| Admin renounced or moved to a multisig | Owner | Open. The testnet admin `GCJWADMY...2WEX` is a single key and can upgrade the contract. The owner decides whether to call `renounce_admin` (it freezes the contract for good, so only after the last fix) before the final submission |
| Mainnet or an explicit statement that there is none | Owner | Open. Needs a funded deployer and presence for the transactions |
| Standard NFT interface or an explicit list of deviations | Engineering | Done as a list of deviations, `docs/architecture/delvers-and-nft-standard.md` |
| A delver visible in an explorer | Engineering | Open. The contract does not yet expose the metadata calls and events an explorer looks for |

## Client quality

| Item | Owner | Status |
|---|---|---|
| Typecheck and build | Engineering | Checked by the client workflow |
| Performance budgets enforced | Engineering | Done, `.github/workflows/perf.yml` and `docs/performance.md` |
| Accessibility checks and the manual keyboard walkthrough | Engineering | Done, `.github/workflows/a11y.yml` and `docs/accessibility.md`. No screen reader pass yet |
| Clean browser verification on a laptop | Owner | Partly done 2026-10-12. Headless Chrome, fresh profile, 1280x800 against the live URL: loads in under 2 seconds, the account is created and the relic trustlines are added behind the title, no console errors, and requests go only to the site, Friendbot, Soroban RPC and Horizon. A full run to a verified result in a real browser is still open |
| Clean browser verification on a phone, iOS Safari and a mid range Android | Owner | Partly done 2026-10-12. The same check at 390x844 with touch emulation passes. Real devices are still open |

## Media

| Item | Owner | Status |
|---|---|---|
| Trailer, 30 and 90 second cuts, share card, and README media | Owner | Done 2026-10-12. Unlisted on YouTube and linked from the README: [30 s](https://youtu.be/X5GZSp7EFE8), [90 s](https://youtu.be/F-gPDj1Yt5A), [share card](https://youtu.be/uJX_Ii3xAXE) |

## Owner actions still open on 2026-10-12

- Submit the project on Stellar Passport.
- Record the pitch video (see Media above).
- Test a full run on a real iPhone and a real mid range Android phone.
- Decide on `renounce_admin` for the testnet contract.
- Final read of README and docs for filler, the secrets scan and the visibility flip at the freeze.
- Playtest issues to triage: simultaneous new player starts collide on the player index (2 of 3 failed in the playtest, the client now retries, a keyed registry is a later contract fix), and the veteran result screen shows the new delver copy.
