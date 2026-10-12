# Testnet deployments

Every id and transaction below is on Stellar testnet and can be looked up on [stellar.expert](https://stellar.expert/explorer/testnet) or in Horizon. Times are UTC.

## Current deployment, 2026-10-12

| Item | Id |
|---|---|
| Game contract | `CDEAFSBG7JBN6XMP4HRL7LFBL7L67K4RJK3CIRBV23W3TJQCEADZ7R6N` |
| `DMCOMMON` contract | `CAAFYL2QZU274NLA2IFDB4L6SUNVQKT6OLB6UXGL5L5LMQCFJXSUYFO3` |
| `DMRARE` contract | `CC4RQ4HLTPTXMCZ3OKDL546XXJGOQ5PI2ET6U33C2XTO4BTS6AJV4ANA` |
| `DMCORE` contract | `CC27JVKNDSUM5FDGP4JZDZTKGHJ5RJV7XHJGITTUGOUFE4DVPN6PGLMI` |
| Relic issuer | `GAD752QFRTNEMQW2SELGHQ5VAMIV3O7H4XRLJN2K2TQFGGXKNFG7CQUK` |
| Game admin and deployer | `GCZCKB4FUIS5BGEMJOC3EQWKLGH662BOY3HFLH3WWPCGQJXOILDXP7GZ` |
| Wasm sha256 | `256f445c6e3e31708f7a52257a8145afffc0cd9b12abf9f2657cfe5379fbcf2c` |

The wasm hash can be checked against the chain with `stellar contract fetch --id <game contract> --network testnet` followed by `shasum -a 256` on the output.

### Setup transactions

In order. The first column is the ledger close time of the transaction.

| Time | Step | Transaction |
|---|---|---|
| 03:53:57 | Create the issuer account | `705b19f25b8325ab390cedbce7a5a7687f10bd1f83729d2d52dc23cddebaf5ea` |
| 03:54:02 | Create the deployer account | `340f96f54028f3909e81a37223005afcffc76cf0e5865ce2298abf2e69439147` |
| 03:54:07 | Deploy the Stellar Asset Contract of the first relic asset | `d39f4d9eff766c03d93d474d6f96b181e8cd2d02723587542b2b330d34819d31` |
| 03:54:12 | Deploy the Stellar Asset Contract of the second relic asset | `1351cee92dd107ecb0d534239e5ec7becae90b8e31638b8ed6ce1de30b8a80e4` |
| 03:54:17 | Deploy the Stellar Asset Contract of the third relic asset | `ae5e077d040f4b5dba254c8decb6e22dcd17c1cd2f5329c2464eea825184e2f5` |
| 03:54:22 | Upload the game wasm | `fa6a32a4cbfbc5ed2dbbf272f3717d5f56efae0375e4e7d9532beea196dfea04` |
| 03:54:27 | Deploy the game contract, with the admin as constructor argument | `737080c6b5c25fcc2f5726bf8327ca3a73dcec06c40ee3dc2b42f52224d935c2` |
| 03:54:32 | Set the game contract as admin of the first relic contract | `9d000b0a1b89168a9fc531a69c48d5e9f39e1b3ec98da79c5f9f03b951c4f9c6` |
| 03:54:37 | Set the game contract as admin of the second relic contract | `0722fdcbb03d87d21f85f3fa2af4bc9c6071b5d275ce572cc8c6b3dc9039fb23` |
| 03:54:42 | Set the game contract as admin of the third relic contract | `9e606376fd11b1394aea1e035e73462fd7712772a3bd4fc0a19c2cdc9406fcec` |
| 03:54:47 | Lock the issuer: master key weight set to 0 | `792dd0919d33938e0603b3ea3a4e6bac4a40de61f8680701dbbf25746447fc40` |

The issuer was checked on Horizon after the lock: one signer with weight 0 and thresholds at 0. A transaction signed with the issuer's own key was rejected with `TxBadAuth`. The admin of each relic contract was read back and is the game contract.

### End to end run on the new deployment

`client/scripts/chain-smoke.ts` with a fresh account, three runs. All three transactions are `successful`.

| Ledger | What | Transaction |
|---|---|---|
| 5150756 | `finish_run` with a defeat | `602d5a167cadfd23e81857282429f8ae41d85522a367613c9888edf6e6da89c0` |
| 5150764 | `finish_run` with a full clear, which earns delver 0 and mints relics | `28b5a324723890ff494860b0661a6083f5dcdf7f9f6bef2f1fbee8928fadf850` |
| 5150771 | `finish_run` with a full clear by the veteran delver, now at 2 clears | `a73fa14a5c92ef3fcc4fece8a7803322ef2170672cfcea6f0de9982d775bed2f` |

## Upgrade and renounce experiment

The admin paths were exercised on a separate, disposable contract so the game contract keeps its admin and its state. It was deployed from the same deployer, upgraded to a build that reports version 2 with the open run intact, and then frozen with `renounce_admin`. After that `admin()` returned nothing and `upgrade` failed with `Frozen`.

| Item | Id |
|---|---|
| Disposable contract (frozen) | `CDKXM55BE7NG5DTFKJWB7XZTCTAGUHUH6JQSCE6OO5IRF55N45AJTA6S` |

| Time | Step | Transaction |
|---|---|---|
| 03:56:17 | Deploy the disposable contract | `6c037979bae62269c8d6af763036cca601402028c70b332afd1cd89399b91ed8` |
| 03:56:27 | Start a run on it | `31eccf8a271dc353d8569b55b7834481c67c2bf285ad1c4086b010e475c553f4` |
| 03:56:32 | Upload the version 2 wasm | `51de58877faafcdf4cc994c9a60b5c570ae492f57a7c6c21ae38ec0081a448b0` |
| 03:56:37 | `upgrade` to the version 2 wasm | `b452ac33f126ed2ba3e4d91ce775ad7782319b21db0effd7a659a9ef6d18a5b3` |
| 03:56:52 | `renounce_admin` | `7f7e7eee7d640c53ff453a363d9195fadae62e11a88906a25b7165b1eb3e1cd5` |

The game contract itself has not been upgraded or renounced. Its admin is still a single key, see `docs/threat-model.md`.

## Previous deployment

The first testnet deployment (contract `CDL7OO7MGCNMHZBF5QPJCMBLLY3ORR44TJ54ON44M25YUX6UZ7L46UZW`) is retired. Its relic issuer was never locked and the contract had no admin, so it could not be upgraded. The client no longer reads it, and nothing earned there migrates.
