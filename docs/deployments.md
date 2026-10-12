# Testnet deployments

Every id and transaction below is on Stellar testnet and can be looked up on [stellar.expert](https://stellar.expert/explorer/testnet) or in Horizon. Times are UTC.

## Current deployment, 2026-10-12 (evening)

Deployed and exercised with the Stellar CLI and the real client. Times are UTC and the deployment record is kept outside this repository.

| Item | Id |
|---|---|
| Game contract | [`CDQDI2SNKQHPC7YW7YCW7USYLHXW2XTV5JBXWC24K53KDMY43DBHH7RX`](https://stellar.expert/explorer/testnet/contract/CDQDI2SNKQHPC7YW7YCW7USYLHXW2XTV5JBXWC24K53KDMY43DBHH7RX) |
| `DMCOMMON` contract | [`CDK5SL4OP6CAFZPFJ2YOTSBN3NDHCJ4A23UA4TXIZP5DFO7RT6IH4S5R`](https://stellar.expert/explorer/testnet/contract/CDK5SL4OP6CAFZPFJ2YOTSBN3NDHCJ4A23UA4TXIZP5DFO7RT6IH4S5R) |
| `DMRARE` contract | [`CCQFEYZR3D4XHTMLV3XJZBTZUT4WXZS2LUXHPFTH7DRRZENZNU2NVZ5L`](https://stellar.expert/explorer/testnet/contract/CCQFEYZR3D4XHTMLV3XJZBTZUT4WXZS2LUXHPFTH7DRRZENZNU2NVZ5L) |
| `DMCORE` contract | [`CAHKK75BOXGBKSXBB3EFPWS6C3IZIXIFLYI3A74GYCRSI4U6NKVZTLIM`](https://stellar.expert/explorer/testnet/contract/CAHKK75BOXGBKSXBB3EFPWS6C3IZIXIFLYI3A74GYCRSI4U6NKVZTLIM) |
| Relic issuer (locked) | [`GAEZFWDURKH2UF5DF5S26AXHLTUE4NNQ4YDDROFRXNTDO46THSXJFA7Q`](https://stellar.expert/explorer/testnet/account/GAEZFWDURKH2UF5DF5S26AXHLTUE4NNQ4YDDROFRXNTDO46THSXJFA7Q) |
| Game admin and deployer | [`GCJWADMYI4N42EDLCRAYGORAHPXLRSIZVQSN75H552H2GWKF3SXL2WEX`](https://stellar.expert/explorer/testnet/account/GCJWADMYI4N42EDLCRAYGORAHPXLRSIZVQSN75H552H2GWKF3SXL2WEX) |
| Wasm | 28,107 bytes, sha256 `db721cb97242bf5d9710d70752959a5658c2be81fee70d5fdd7253b878f80d07` |

The wasm was fetched with `stellar contract fetch --id <game contract> --network testnet` on 2026-10-12 and its size and sha256 match the line above. The issuer was read back from Horizon: one signer with weight 0, thresholds 0 / 0 / 0, no authorization flags. `admin()` on `DMCOMMON` returns the game contract (checked above in the README, and by simulation on all three relic contracts).

### Setup transactions

In order, 18:29 to 18:30 UTC. Every hash was read back from Horizon and is `successful`.

| Time | Step | Transaction |
|---|---|---|
| 18:29:37 | Create the issuer account | [`22642ffb30c2ec71bad745fb7269fe17c5a048805e0bfbeb7f40367e866d9bff`](https://stellar.expert/explorer/testnet/tx/22642ffb30c2ec71bad745fb7269fe17c5a048805e0bfbeb7f40367e866d9bff) |
| 18:29:42 | Create the deployer account | [`d5db5a13165a3be9d646adf9c424b62f721384a44ae559a3fda91b9aa982d047`](https://stellar.expert/explorer/testnet/tx/d5db5a13165a3be9d646adf9c424b62f721384a44ae559a3fda91b9aa982d047) |
| 18:29:47 | Deploy the Stellar Asset Contract of the first relic asset | [`86f218b79270a684a63db9598df2315316f94561a3ff8fd66c8f49d295cddbe9`](https://stellar.expert/explorer/testnet/tx/86f218b79270a684a63db9598df2315316f94561a3ff8fd66c8f49d295cddbe9) |
| 18:29:52 | Deploy the Stellar Asset Contract of the second relic asset | [`2337cf6a15a699001aebc51a271c1fbebf65227e1fcc4ef2e71b2377d627c23f`](https://stellar.expert/explorer/testnet/tx/2337cf6a15a699001aebc51a271c1fbebf65227e1fcc4ef2e71b2377d627c23f) |
| 18:29:57 | Deploy the Stellar Asset Contract of the third relic asset | [`eed89eb140d5c55d2fb460996092de12b224f9d67aa7a11902deb632ae66830b`](https://stellar.expert/explorer/testnet/tx/eed89eb140d5c55d2fb460996092de12b224f9d67aa7a11902deb632ae66830b) |
| 18:30:02 | Upload the game wasm | [`593d2ea0e7a185d29bb8f498755c33acb69138aee50aab8208a016e51ac6369f`](https://stellar.expert/explorer/testnet/tx/593d2ea0e7a185d29bb8f498755c33acb69138aee50aab8208a016e51ac6369f) |
| 18:30:07 | Deploy the game contract, with the admin and the three relic contracts as constructor arguments | [`dd0f5f24645ebe85f14e63ec05a38b51e0979f29032dd14980990dd0d5d61313`](https://stellar.expert/explorer/testnet/tx/dd0f5f24645ebe85f14e63ec05a38b51e0979f29032dd14980990dd0d5d61313) |
| 18:30:12 | Extend the lifetime of the contract instance (`extend_footprint_ttl`) | [`3a174eec310202b9124525f8099e6228a8042c310ce08838b7a2b47a0609d4ba`](https://stellar.expert/explorer/testnet/tx/3a174eec310202b9124525f8099e6228a8042c310ce08838b7a2b47a0609d4ba) |
| 18:30:17 | Extend the lifetime of the wasm code (`extend_footprint_ttl`) | [`ae8a038a8470479fc2fa603dee70d718b7f75838bed101d13a09739661c389fb`](https://stellar.expert/explorer/testnet/tx/ae8a038a8470479fc2fa603dee70d718b7f75838bed101d13a09739661c389fb) |
| 18:30:22 | Set the game contract as admin of `DMCOMMON` | [`bca24a68f421f526b68e555a90a52724d1c99dca947cae2846040d1ac95798ab`](https://stellar.expert/explorer/testnet/tx/bca24a68f421f526b68e555a90a52724d1c99dca947cae2846040d1ac95798ab) |
| 18:30:27 | Set the game contract as admin of `DMRARE` | [`f80fac47b939a10364514d4cd93d54b0d8b27d17fa2a8ce9cb59e0aa3df22d95`](https://stellar.expert/explorer/testnet/tx/f80fac47b939a10364514d4cd93d54b0d8b27d17fa2a8ce9cb59e0aa3df22d95) |
| 18:30:32 | Set the game contract as admin of `DMCORE` | [`94b33a09e5d6e95ce073fbfd970963600b5cbdaec6c5ab72d74869af00825881`](https://stellar.expert/explorer/testnet/tx/94b33a09e5d6e95ce073fbfd970963600b5cbdaec6c5ab72d74869af00825881) |
| 18:30:37 | Lock the issuer: master key weight set to 0 | [`ddae4f0c5f28ff1bc08af97949dd85861fe3b087eefb67b1e4893b354c514e28`](https://stellar.expert/explorer/testnet/tx/ddae4f0c5f28ff1bc08af97949dd85861fe3b087eefb67b1e4893b354c514e28) |

The `set_admin` steps target `DMCOMMON`, `DMRARE` and `DMCORE` in that order, as read from each transaction's arguments. The three Stellar Asset Contract deploys are listed as first, second and third because their asset was not decoded. Each step closed in the next ledger it could, five seconds after the one before. There is no deploy script in this repository, the steps were run by hand.

### Playtest on the new deployment

Six runs through the real client (production build, headless Chrome), each on a fresh throwaway account funded by Friendbot. The seed of every run was issued by the contract in `start_run`, and the winning key sequences were computed offline with the repository's own simulation and replayed as key presses. All transactions are `successful`.

| # | Run | `start_run` | `finish_run` | Result |
|---|---|---|---|---|
| 1 | Early extraction, floor 1 (first call on the contract) | [`d1dc76e76d4498adec6396fccdc9cad8e0314b832c8d0f0e8908a461c76e100b`](https://stellar.expert/explorer/testnet/tx/d1dc76e76d4498adec6396fccdc9cad8e0314b832c8d0f0e8908a461c76e100b) | [`aecb8b3fa89b0340ce84b6695ea2570d3e327de010e79f460447e63c6d53db6a`](https://stellar.expert/explorer/testnet/tx/aecb8b3fa89b0340ce84b6695ea2570d3e327de010e79f460447e63c6d53db6a) | 27 actions, score 1, 1 `DMCOMMON` |
| 2 | Extraction, floor 2 | [`a6ebcd48129c055face7b92f484343f098e673c59083ed06245669203f6d91e8`](https://stellar.expert/explorer/testnet/tx/a6ebcd48129c055face7b92f484343f098e673c59083ed06245669203f6d91e8) | [`51d74c53126f42064f0208346da18ee941289bc1009ae72e8b9b8fd70380e7cc`](https://stellar.expert/explorer/testnet/tx/51d74c53126f42064f0208346da18ee941289bc1009ae72e8b9b8fd70380e7cc) | 48 actions, score 3, 1 `DMCOMMON`, 1 `DMRARE` |
| 3 | Death on floor 2 | [`967ec9d6e577d8025082b1f614d44458f5dd81c26ad199d9f3e9e0222fd37b21`](https://stellar.expert/explorer/testnet/tx/967ec9d6e577d8025082b1f614d44458f5dd81c26ad199d9f3e9e0222fd37b21) | [`bd2647098500dc954db3a4c989471ba703110343343798982587b91566c54841`](https://stellar.expert/explorer/testnet/tx/bd2647098500dc954db3a4c989471ba703110343343798982587b91566c54841) | 29 actions, score 0, no relics |
| 4 | Full clear, fresh delver (id 0) | [`7abbf360511ef3d548b167a69507c9cd57272e5ff93256277da12fd1df441f09`](https://stellar.expert/explorer/testnet/tx/7abbf360511ef3d548b167a69507c9cd57272e5ff93256277da12fd1df441f09) | [`7881adabe0dd17c9319a9b975d8c7e76796bb112214df5dac114d31805159334`](https://stellar.expert/explorer/testnet/tx/7881adabe0dd17c9319a9b975d8c7e76796bb112214df5dac114d31805159334) | 76 actions, score 6, 3 relics, `hero_earned` 0 |
| 5 | Full clear, fresh delver (id 1) | [`5fdccef0e229953a20cd832e6dce9d5732065ee604b3a3c1b9cec3ec791ca090`](https://stellar.expert/explorer/testnet/tx/5fdccef0e229953a20cd832e6dce9d5732065ee604b3a3c1b9cec3ec791ca090) | [`349e4df814b2a0f3b6a530d05855a5d70f935a321fac37067de62a6de12e7524`](https://stellar.expert/explorer/testnet/tx/349e4df814b2a0f3b6a530d05855a5d70f935a321fac37067de62a6de12e7524) | 75 actions, score 6, 3 relics, `hero_earned` 1 |
| 6 | Veteran run with delver 1 (same account as run 5) | [`9ca436ee1f760f5d5d8a1cb8b8c12263dfca98423af55f78a1660fd77aa3a9cc`](https://stellar.expert/explorer/testnet/tx/9ca436ee1f760f5d5d8a1cb8b8c12263dfca98423af55f78a1660fd77aa3a9cc) | [`5b74020c03ac5dc0e43d4092ee2dd3338eaf220dafc76f67ce521bab53609c3f`](https://stellar.expert/explorer/testnet/tx/5b74020c03ac5dc0e43d4092ee2dd3338eaf220dafc76f67ce521bab53609c3f) | 46 actions, score 3, 1 `DMCORE`, delver 1 now at 2 clears |

Checks after the six runs, read from Horizon and the contract:

- The authorized supply equals the mints in the `run_finished` events: 4 `DMCOMMON`, 3 `DMRARE`, 3 `DMCORE`. Claimable balances and contract holdings are 0.
- The holder counts Horizon shows for the three assets count throwaway test accounts (each one holds all three trustlines), not players, and they grow with every test pass. Some of those accounts only opened a run and never finished it.
- `verify_run` replayed runs 3, 5 and 6 read only and matched their `run_finished` events. The command for run 5 is in the README.
- `top_fresh` lists five players and `top_veteran` one, as expected from the runs.
- Fees and rent of each transaction are in the README under "Measured costs". The first `start_run` cost 8,970,532 stroops (0.897 XLM), against 183.9 XLM on the superseded deployment.

Client side issues seen during the playtest (the contract is not involved): when three fresh accounts started at the same moment, two of them fell back to a practice run. The cause is the sequential player index, described in the README under Limitations, and the client now retries a failed `start_run`. Also, the veteran result screen still shows the copy for a new delver although the contract only raised the existing delver's clears. Single sequential starts never failed.

## Superseded deployment, 2026-10-12 morning

This deployment is replaced by the one above. It had four known problems that the new contract fixes: `transfer` to the same owner duplicated the delver in that owner's list, a failed relic mint was recorded as `minted: false` and never retried, `relic_tokens` and the mint path used `unwrap()`, and `start_run` did not renew the shared counters, the leaderboards or a veteran. The instance and wasm lifetimes were also not extended at deploy time, which is the likely reason its first `start_run` cost 183.9 XLM (not isolated further). Its relics and runs do not migrate. The client no longer reads it.

| Item | Id |
|---|---|
| Game contract | [`CDEAFSBG7JBN6XMP4HRL7LFBL7L67K4RJK3CIRBV23W3TJQCEADZ7R6N`](https://stellar.expert/explorer/testnet/contract/CDEAFSBG7JBN6XMP4HRL7LFBL7L67K4RJK3CIRBV23W3TJQCEADZ7R6N) |
| `DMCOMMON` contract | [`CAAFYL2QZU274NLA2IFDB4L6SUNVQKT6OLB6UXGL5L5LMQCFJXSUYFO3`](https://stellar.expert/explorer/testnet/contract/CAAFYL2QZU274NLA2IFDB4L6SUNVQKT6OLB6UXGL5L5LMQCFJXSUYFO3) |
| `DMRARE` contract | [`CC4RQ4HLTPTXMCZ3OKDL546XXJGOQ5PI2ET6U33C2XTO4BTS6AJV4ANA`](https://stellar.expert/explorer/testnet/contract/CC4RQ4HLTPTXMCZ3OKDL546XXJGOQ5PI2ET6U33C2XTO4BTS6AJV4ANA) |
| `DMCORE` contract | [`CC27JVKNDSUM5FDGP4JZDZTKGHJ5RJV7XHJGITTUGOUFE4DVPN6PGLMI`](https://stellar.expert/explorer/testnet/contract/CC27JVKNDSUM5FDGP4JZDZTKGHJ5RJV7XHJGITTUGOUFE4DVPN6PGLMI) |
| Relic issuer (locked) | [`GAD752QFRTNEMQW2SELGHQ5VAMIV3O7H4XRLJN2K2TQFGGXKNFG7CQUK`](https://stellar.expert/explorer/testnet/account/GAD752QFRTNEMQW2SELGHQ5VAMIV3O7H4XRLJN2K2TQFGGXKNFG7CQUK) |
| Game admin and deployer | [`GCZCKB4FUIS5BGEMJOC3EQWKLGH662BOY3HFLH3WWPCGQJXOILDXP7GZ`](https://stellar.expert/explorer/testnet/account/GCZCKB4FUIS5BGEMJOC3EQWKLGH662BOY3HFLH3WWPCGQJXOILDXP7GZ) |
| Wasm sha256 | `256f445c6e3e31708f7a52257a8145afffc0cd9b12abf9f2657cfe5379fbcf2c` |

The wasm hash can be checked against the chain with `stellar contract fetch --id <game contract> --network testnet` followed by `shasum -a 256` on the output.

### Setup transactions (superseded)

In order. The first column is the ledger close time of the transaction.

| Time | Step | Transaction |
|---|---|---|
| 03:53:57 | Create the issuer account | [`705b19f25b8325ab390cedbce7a5a7687f10bd1f83729d2d52dc23cddebaf5ea`](https://stellar.expert/explorer/testnet/tx/705b19f25b8325ab390cedbce7a5a7687f10bd1f83729d2d52dc23cddebaf5ea) |
| 03:54:02 | Create the deployer account | [`340f96f54028f3909e81a37223005afcffc76cf0e5865ce2298abf2e69439147`](https://stellar.expert/explorer/testnet/tx/340f96f54028f3909e81a37223005afcffc76cf0e5865ce2298abf2e69439147) |
| 03:54:07 | Deploy the Stellar Asset Contract of the first relic asset | [`d39f4d9eff766c03d93d474d6f96b181e8cd2d02723587542b2b330d34819d31`](https://stellar.expert/explorer/testnet/tx/d39f4d9eff766c03d93d474d6f96b181e8cd2d02723587542b2b330d34819d31) |
| 03:54:12 | Deploy the Stellar Asset Contract of the second relic asset | [`1351cee92dd107ecb0d534239e5ec7becae90b8e31638b8ed6ce1de30b8a80e4`](https://stellar.expert/explorer/testnet/tx/1351cee92dd107ecb0d534239e5ec7becae90b8e31638b8ed6ce1de30b8a80e4) |
| 03:54:17 | Deploy the Stellar Asset Contract of the third relic asset | [`ae5e077d040f4b5dba254c8decb6e22dcd17c1cd2f5329c2464eea825184e2f5`](https://stellar.expert/explorer/testnet/tx/ae5e077d040f4b5dba254c8decb6e22dcd17c1cd2f5329c2464eea825184e2f5) |
| 03:54:22 | Upload the game wasm | [`fa6a32a4cbfbc5ed2dbbf272f3717d5f56efae0375e4e7d9532beea196dfea04`](https://stellar.expert/explorer/testnet/tx/fa6a32a4cbfbc5ed2dbbf272f3717d5f56efae0375e4e7d9532beea196dfea04) |
| 03:54:27 | Deploy the game contract, with the admin as constructor argument | [`737080c6b5c25fcc2f5726bf8327ca3a73dcec06c40ee3dc2b42f52224d935c2`](https://stellar.expert/explorer/testnet/tx/737080c6b5c25fcc2f5726bf8327ca3a73dcec06c40ee3dc2b42f52224d935c2) |
| 03:54:32 | Set the game contract as admin of the first relic contract | [`9d000b0a1b89168a9fc531a69c48d5e9f39e1b3ec98da79c5f9f03b951c4f9c6`](https://stellar.expert/explorer/testnet/tx/9d000b0a1b89168a9fc531a69c48d5e9f39e1b3ec98da79c5f9f03b951c4f9c6) |
| 03:54:37 | Set the game contract as admin of the second relic contract | [`0722fdcbb03d87d21f85f3fa2af4bc9c6071b5d275ce572cc8c6b3dc9039fb23`](https://stellar.expert/explorer/testnet/tx/0722fdcbb03d87d21f85f3fa2af4bc9c6071b5d275ce572cc8c6b3dc9039fb23) |
| 03:54:42 | Set the game contract as admin of the third relic contract | [`9e606376fd11b1394aea1e035e73462fd7712772a3bd4fc0a19c2cdc9406fcec`](https://stellar.expert/explorer/testnet/tx/9e606376fd11b1394aea1e035e73462fd7712772a3bd4fc0a19c2cdc9406fcec) |
| 03:54:47 | Lock the issuer: master key weight set to 0 | [`792dd0919d33938e0603b3ea3a4e6bac4a40de61f8680701dbbf25746447fc40`](https://stellar.expert/explorer/testnet/tx/792dd0919d33938e0603b3ea3a4e6bac4a40de61f8680701dbbf25746447fc40) |

The issuer was checked on Horizon after the lock: one signer with weight 0 and thresholds at 0. A transaction signed with the issuer's own key was rejected with `TxBadAuth`. The admin of each relic contract was read back and is the game contract.

### End to end run (superseded)

`client/scripts/chain-smoke.ts` with a fresh account, three runs on the superseded contract. All three transactions are `successful`.

| Ledger | What | Transaction |
|---|---|---|
| 5150751 | `start_run`, run 1, the first on that deployment | [`d7673948db70b5a7760c68bfebdd56a0364bdf4f92a08af05d5ce43db84018cb`](https://stellar.expert/explorer/testnet/tx/d7673948db70b5a7760c68bfebdd56a0364bdf4f92a08af05d5ce43db84018cb) |
| 5150756 | `finish_run` with a defeat | [`602d5a167cadfd23e81857282429f8ae41d85522a367613c9888edf6e6da89c0`](https://stellar.expert/explorer/testnet/tx/602d5a167cadfd23e81857282429f8ae41d85522a367613c9888edf6e6da89c0) |
| 5150758 | `start_run`, run 2, seed 3840428440 | [`c78b0abb061635742142fed7eb7e3bfee2f7cd9f06ae8aa415acb2b8ebeb854e`](https://stellar.expert/explorer/testnet/tx/c78b0abb061635742142fed7eb7e3bfee2f7cd9f06ae8aa415acb2b8ebeb854e) |
| 5150764 | `finish_run` with a full clear, which earns delver 0 and mints relics (events `run_finished`, `hero_earned` and two `mint`) | [`28b5a324723890ff494860b0661a6083f5dcdf7f9f6bef2f1fbee8928fadf850`](https://stellar.expert/explorer/testnet/tx/28b5a324723890ff494860b0661a6083f5dcdf7f9f6bef2f1fbee8928fadf850) |
| 5150765 | `start_run`, run 3, with the veteran delver | [`ba7149af627a0412b6a209b487bcfda1f47db9d808db289347b3197712e66ab2`](https://stellar.expert/explorer/testnet/tx/ba7149af627a0412b6a209b487bcfda1f47db9d808db289347b3197712e66ab2) |
| 5150771 | `finish_run` with a full clear by the veteran delver, now at 2 clears | [`a73fa14a5c92ef3fcc4fece8a7803322ef2170672cfcea6f0de9982d775bed2f`](https://stellar.expert/explorer/testnet/tx/a73fa14a5c92ef3fcc4fece8a7803322ef2170672cfcea6f0de9982d775bed2f) |

Every hash in this section was read back from Horizon on 2026-10-12 and reports `successful: true`. Fees and resources of the run transactions are in the README under "Measured costs". The contract was deployed by hand with the Stellar CLI in the order of the setup table, there is no deploy script in this repository, and later transactions on the contract, from play or testing, are visible in its event list on the explorer and are not listed here.

## Upgrade and renounce experiment

The admin paths were exercised on a separate, disposable contract so the game contract keeps its admin and its state. This ran before the redeploy and used the code of that time, the upgrade and renounce code has not changed since. It was deployed on the superseded deployment from its deployer (`GCZCKB4FUIS5BGEMJOC3EQWKLGH662BOY3HFLH3WWPCGQJXOILDXP7GZ`), upgraded to a build that reports version 2 with the open run intact, and then frozen with `renounce_admin`. After that `admin()` returned nothing and `upgrade` failed with `Frozen`.

| Item | Id |
|---|---|
| Disposable contract (frozen) | [`CDKXM55BE7NG5DTFKJWB7XZTCTAGUHUH6JQSCE6OO5IRF55N45AJTA6S`](https://stellar.expert/explorer/testnet/contract/CDKXM55BE7NG5DTFKJWB7XZTCTAGUHUH6JQSCE6OO5IRF55N45AJTA6S) |

| Time | Step | Transaction |
|---|---|---|
| 03:56:17 | Deploy the disposable contract | [`6c037979bae62269c8d6af763036cca601402028c70b332afd1cd89399b91ed8`](https://stellar.expert/explorer/testnet/tx/6c037979bae62269c8d6af763036cca601402028c70b332afd1cd89399b91ed8) |
| 03:56:27 | Start a run on it | [`31eccf8a271dc353d8569b55b7834481c67c2bf285ad1c4086b010e475c553f4`](https://stellar.expert/explorer/testnet/tx/31eccf8a271dc353d8569b55b7834481c67c2bf285ad1c4086b010e475c553f4) |
| 03:56:32 | Upload the version 2 wasm | [`51de58877faafcdf4cc994c9a60b5c570ae492f57a7c6c21ae38ec0081a448b0`](https://stellar.expert/explorer/testnet/tx/51de58877faafcdf4cc994c9a60b5c570ae492f57a7c6c21ae38ec0081a448b0) |
| 03:56:37 | `upgrade` to the version 2 wasm | [`b452ac33f126ed2ba3e4d91ce775ad7782319b21db0effd7a659a9ef6d18a5b3`](https://stellar.expert/explorer/testnet/tx/b452ac33f126ed2ba3e4d91ce775ad7782319b21db0effd7a659a9ef6d18a5b3) |
| 03:56:52 | `renounce_admin` | [`7f7e7eee7d640c53ff453a363d9195fadae62e11a88906a25b7165b1eb3e1cd5`](https://stellar.expert/explorer/testnet/tx/7f7e7eee7d640c53ff453a363d9195fadae62e11a88906a25b7165b1eb3e1cd5) |

The game contract itself (the current one above) has not been upgraded or renounced. Its admin is still a single key, see `docs/threat-model.md`.

## First deployment (retired)

The first testnet deployment (contract [`CDL7OO7MGCNMHZBF5QPJCMBLLY3ORR44TJ54ON44M25YUX6UZ7L46UZW`](https://stellar.expert/explorer/testnet/contract/CDL7OO7MGCNMHZBF5QPJCMBLLY3ORR44TJ54ON44M25YUX6UZ7L46UZW)) is retired. Its relic issuer was never locked and the contract had no admin, so it could not be upgraded. The client no longer reads it, and nothing earned there migrates.
