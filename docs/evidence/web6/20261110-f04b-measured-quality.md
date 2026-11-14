# WEB6 F04b — regression gates and measured-quality disposition

**Date:** 2026-11-14 (Asia/Bangkok). **Latest state:** candidate `web6-20261114-9944f608` reached PairPassed, then FailedRetained in the third Chromium cutover case because the pilot selected an older dispatched Sales Create instead of the intercepted operation. Edge cutover, workload and recovery NOT RUN. Task 6 OPEN with cutover resources retained. A frontend pilot-harness-only correction is locally verified; it is not a live acceptance result.

## Task 6 fresh attempts and exact-wire pilot correction — 2026-11-14

The Owner authorized fresh nonproduction execution for the exact reviewed pair: backend `1a97d159a05cf1000140a795f45797d8f137806b` / tree `e550be0eacf9233e6e0aae9b3b01ec621ee16840` and frontend `78e24ef00738f0b1d09ff466991802a736c67fec` / tree `72a8e252f164c131fb72595cfda52c1432c2027c`. Both repositories had two terminal protected-CI PASS runs for their exact source commits before execution.

Candidate `web6-20261114-f6402db1` authorized successfully but Prepare returned `BLOCKED_PREFLIGHT`, exit 4, before creation of a task root or any SQL, IIS Express or browser allocation. The request resolved the installed `C:\Program Files\nodejs\node.exe`, whose adjacent npm CLI was 10.9.2 rather than the required 11.6.0; the shell `npm.cmd` redirecting to a user-prefix 11.6.0 did not satisfy the adjacent-tool invariant. Its authority, request and SQL-approval records and three empty protected parent directories remain retained. It was not reused, retried or cleaned.

The Owner separately authorized candidate `web6-20261114-9944f608` with a protected current-user-only copy of Node 22.14.0 and adjacent npm 11.6.0. Authorize and Prepare ran once. Prepare returned `PREPARED` / `PIN_MATCHED`; independent admission checks found ordinary resend OFF, the expected candidate marker, 10/10 byte-equal candidate dist/published files, and no task run root, SQL allocation, listener or IIS Express process before Run. One serial Run returned exit 5 / `FailedRetained`.

| Selector | Discovered / executed / passed / failed / skipped | Outcome |
| --- | --- | --- |
| Chromium pair | 1 / 1 / 1 / 0 / 0 | PASS / native ACCEPTED |
| Edge pair | 1 / 1 / 1 / 0 / 0 | PASS / native ACCEPTED |
| Cutover | 1 / 1 / 0 / 1 / 0 | FAIL / third Chromium cutover case |
| Workload | 0 / 0 / 0 / 0 / 0 | NOT RUN / NOT MEASURED |
| Recovery | 0 / 0 / 0 / 0 / 0 | NOT RUN / NOT MEASURED |

The first two Chromium cutover cases passed. The third case, `restart preserves UNKNOWN while revoked and restored epochs fail closed`, failed while creating its UNKNOWN setup. Its wire request carried the new intercepted operation ID, but `createUnknown` selected the first `Sales.Create` / `DISPATCHED` record in IndexedDB. That page already contained the earlier committed-response-loss Sales Create from the preceding case, so the assertion compared two different authentic operations. The selector did not establish a product runtime failure. Edge cutover did not start.

| Receipt or artifact | SHA-256 |
| --- | --- |
| Prepared / PairPassed | `6bf65b4c1b626a47c772ec0c07fd64797acd4c062b1e0e38da9337d81658b6aa` / `8198e0d4bde6671e305619eece982442d75051d61937bf94c750766229e14ab8` |
| FailedRetained | `2ae001520a141efe59eb2a0d0a195ac105024c4ebe1960fa912be1a07e5b1418` |
| Cutover TRX | `ea0fb5f856a7e021d378fe7e467391ef0d0bd5cceede7a1d8d8e35f921852b3c` |

Both pair cleanups were native ACCEPTED: their owned processes drained, queues were absent, SQL was quiescent and each inventory recorded one database, one login, one runtime directory deletion and the owned process/queue disposition. Cutover retained three databases, three runtime logins, three SQL control roots and nine control/runtime/browser staging directories. Six intent and six confirmation records exist, with each confirmation bound to its intent digest; deletion authority is false. The terminal receipt records process-tree drain and no remaining IIS Express or candidate-port listener. No post-failure SQL query, cleanup, retry or access to earlier retained candidates occurred.

The source correction is limited to the frontend pilot harness. `createUnknown` now requires exactly one dispatched Sales Create matching the intercepted wire operation ID. A unit regression supplies an older coexisting dispatched operation and proves that only the current intercepted operation is selected; a missing wire identity fails closed. No product runtime source changed.

| Local correction verification | Result |
| --- | --- |
| Focused RED before helper implementation | 41 passed / 1 failed |
| Focused GREEN | 42 / 42 passed |
| Full unit, 90 files | 1,797 / 1,797 passed |
| TypeScript typecheck | exit 0 |
| Production build | exit 0; 2,579 modules transformed; existing chunk-size warning only |
| Chromium E2E, exact CI command | 286 / 286 passed in 6.6 minutes |
| Production artifact isolation | 2 / 2 passed |

This correction and its verification do not alter the retained candidate and do not authorize another attempt. A new exact frontend commit, backend pin update, protected CI and explicit Owner authorization are required before any fresh live attempt. Ordinary resend remains OFF. Full IIS and unperformed Narrator remain NOT RUN. Staging remains NOT ACCEPTED and production NO-GO.

## Task 6 attempt21 browser pair PASS and cutover response-header timeout

The Owner authorized one fresh nonproduction candidate `web6-20261113-18bc21f2`. Backend source `8c6ff31bd8734df07f71d1b89f8e028da7d3252f` / tree `fb452d281219006b9d78fad663151b83c65fdb28` and frontend source `66b935488d00ee78ec3ffbd183f474da06aa3404` / tree `d417bc5a90e1789cc4b4302d2eb7298b153fae94` were checked out clean and detached. The exact backend frontend pin matched the reviewed frontend diagnostic source.

Prepare ran once from `2026-11-13T14:00:49.3322869+00:00` to `2026-11-13T14:03:31.6340317+00:00`, exit 0 / `PIN_MATCHED`. Independent checks confirmed ordinary resend OFF, exact candidate marker, byte equality of all ten dist/wwwroot files and zero live allocation. The one serial run began 0.849 seconds later and ended at `2026-11-13T14:08:47.2320336+00:00`, exit 5 / `FailedRetained`.

| Selector | Discovered / executed / passed / failed / skipped | Outcome |
| --- | --- | --- |
| Chromium pair | 1 / 1 / 1 / 0 / 0 | PASS / native ACCEPTED |
| Edge pair | 1 / 1 / 1 / 0 / 0 | PASS / native ACCEPTED |
| Cutover | 1 / 1 / 0 / 1 / 0 | FAIL / Chromium cutover response-header timeout |
| Workload | 0 / 0 / 0 / 0 / 0 | NOT RUN / NOT MEASURED |
| Recovery | 0 / 0 / 0 / 0 / 0 | NOT RUN / NOT MEASURED |

Cutover admitted the parent-pinned `PairPassed` digest and sealed artifacts. All three seeds and initial SQL snapshots returned. The four deployments were composed, and the first current IIS Express process passed WMI capture and host admission before Chromium cutover. The retained Playwright log records three discovered, one executed, zero passed, one failed and two did not run. In the first case, `cached WEB4 client on compatible new host has no resend path` at `web6-cutover-live.spec.ts:161`, the new diagnostic reported `oldClientNewHostOn` / `timeout` / `response-header` / `15004 ms` / `socket-timeout`. It contains no optional code or local diagnostic stack. Edge cutover did not start.

The TRX separately records `System.IO.IOException: Pipe is broken.` in `WebFrontendPortBridge.WriteFrame` at line 220 via `WebRecoveryPilotControl.Serve` and `Stop`. In the cutover branch, the response write follows the awaited handler. The browser received no complete response header before its 15-second deadline. The evidence does not timestamp the server phases or identify which phase used the available time. It does not establish whether the cached host switch completed. The incomplete-cutover cleanup refused deletion.

| Receipt or artifact | SHA-256 |
| --- | --- |
| Prepared / PairPassed | `4685e6c3efeb9a0b7d6f2ee0874d191b94ff1dea6e50104c5116305110149726` / `f2360c53081a97363441ad24f503418f877ed47bd8c416e17736569c82f8370a` |
| FailedRetained | `917e9cb8b158c7e2036adca41e39976f0dab1c43626314e39b5fa2199ab3f704` |
| Ordinary dist / manifest | `5c7908157609e24760dcab5da26b170f5194f1918f2343f80aa164aab0ef59ab` / `796d86094b6cfd29efa1d99aac49bd9fd10bb80c73b71d0164d853e74485ef53` |
| Candidate dist / manifest | `d7f6c3d53faa768ad7c667f6d859e2840e2bac213d3a6b18269750706f0f92f3` / `184c14b6b71ca57f92e51f5c978b932a5b437cea1e31eee69bc7882b0a9ce82c` |
| Current / archived backend publish | `3ecc74700bc2eed484a83cfe84eee9ed3c282389ea630f587539d87c0eec968a` / `e520f5c6f93f845fe110128c3383c7a1f376519043a3c5afe5e3628fb46c0946` |
| Chromium cutover browser log | `95c64def5f92581ae704dfd921e9d3f06076b85e166e9cd3d4bd77d7d5647844` |

| Selector | TRX SHA-256 | Native / envelope SHA-256 | Cleanup inventory SHA-256 |
| --- | --- | --- | --- |
| pair-chromium | `73b66fe6c0d2d2c88da545b694289f67908772d08981a5517cbbc480008026d3` | `d36894dcb1a243cbb55707c521c94cfe0784dc1a8235419b4d33b455381074ff` / `5c33499be2ccb0227a98fdda159147149df7a129a5d9ac63ee8dce4b3940ab1e` | `641428d0d7e441334aec52681923fa71211082d51aec2cbf70ea18eeaeedb785` |
| pair-edge | `3844a1aba3c08b0c7067b3f97bf64a00d12ac55523771926b429eafb503aac3a` | `a684f3f91ea57a390345a8bdf82efcbf21897cba5b336335384036620d4b0a85` / `869a49c55fd59ebcd0fc433bcdabe76a20542754bf05f5402407e2c68363b63b` | `f3338b66b649b2b0f2afdf72bb73024b804206c750e33927cb55c73184b8f9e8` |
| cutover | `c0432346b2094ba55b19dcc5e73e8058a94176603950b1ff5a522ee7974f1043` | Absent | Absent |

Both pair cleanups were accepted. Three cutover databases, three logins, three SQL control roots and all nine cutover control/runtime/browser staging directories remain retained. No cutover acceptance or cleanup receipt exists.

Task 6 and B05/F04 remain open. Workload/recovery are NOT RUN. Workload sample floor and observed recovery RPO/RTO are unavailable. No final independent disposition or `CandidateVerified` exists. Ordinary resend stays OFF. Full IIS and unperformed Narrator remain NOT RUN. Staging remains NOT ACCEPTED and production NO-GO. [Backend attempt21 evidence](https://github.com/chung6a8m/MyDmsVn/blob/codex/web6-b05-operations/docs/evidence/web6/20261110-b05b-paired-candidate.md#task-6-attempt21-browser-pair-pass-and-cutover-response-header-timeout).

## Task 6 attempt20 browser pair PASS and cutover control failure

The Owner authorized one fresh nonproduction candidate `web6-20261113-11ddfd6c`. Backend source `512035c8e1f610bf5f9a6ddbe47e57d30ae0d46a` / tree `91997b17ec1075cf6bd608f2186f4a27809c1114` and frontend source `5f355e4ed3d0ca0778e195b940ecbed67b410dc0` / tree `47dc71f900a4977b953f6850f943fde12d64e632` were checked out clean and detached. Frontend docs-only HEAD `1c5aea0faf4221008239eab8d13f0e9cc0a9dd79` was the evidence base.

Prepare ran once from `2026-11-13T12:57:57.2464024+00:00` to `2026-11-13T13:02:07.2463154+00:00`, exit 0 / `PIN_MATCHED`. Independent checks confirmed ordinary resend OFF, the exact candidate marker, byte equality of all ten dist/wwwroot files and zero live allocation. The one serial run began 1.045 seconds later and ended at `2026-11-13T13:08:50.5883301+00:00`, exit 5 / `FailedRetained`.

| Selector | Discovered / executed / passed / failed / skipped | Outcome |
| --- | --- | --- |
| Chromium pair | 1 / 1 / 1 / 0 / 0 | PASS / native ACCEPTED |
| Edge pair | 1 / 1 / 1 / 0 / 0 | PASS / native ACCEPTED |
| Cutover | 1 / 1 / 0 / 1 / 0 | FAIL / Chromium cutover control |
| Workload | 0 / 0 / 0 / 0 / 0 | NOT RUN / NOT MEASURED |
| Recovery | 0 / 0 / 0 / 0 / 0 | NOT RUN / NOT MEASURED |

Cutover admitted the parent-pinned `PairPassed` digest and sealed artifacts. All three seeds and initial SQL snapshots returned, and all four deployments were composed. The first current IIS Express process passed shared launch-plan WMI capture and host admission before the Chromium cutover pack started. The retained Playwright log records three discovered, one executed, zero passed, one failed and two did not run. The first case, `cached WEB4 client on compatible new host has no resend path` at `web6-cutover-live.spec.ts:182`, reported `Owned WEB6 cutover control failed.`. The test contains several control calls, and the retained error does not identify the request/action or underlying pipe failure. TRX reports the generic browser-pilot failure and incomplete-cutover cleanup refusal. It contains no additional cutover host-drain exception. Edge cutover did not start.

| Receipt or artifact | SHA-256 |
| --- | --- |
| Prepared / PairPassed | `65b3e38ca7c41e74da5f26fa5817da24950455cddd25e1f7480f4d82e87f5841` / `e1f5428bcfcae2bcb0c573b17178b5e8974722b31c01e1305b69fd140d0470af` |
| FailedRetained | `a814d811123fbb057e5c32b6d4ebcd5d96641624cc4a1f20f72ce8746d8874d1` |
| Ordinary dist / manifest | `5c7908157609e24760dcab5da26b170f5194f1918f2343f80aa164aab0ef59ab` / `796d86094b6cfd29efa1d99aac49bd9fd10bb80c73b71d0164d853e74485ef53` |
| Candidate dist / manifest | `0e8909d6fe5d6c5897d10acbc515c4f6488c15359c5e7c70096cdcba4bccad08` / `8977d5560ac2819ac422091765c2984414b1b1b781ebb9e279a1f660640eab61` |
| Current / archived backend publish | `fd83d93669e8ee3e3892804003eead32ce59c46155b2b98ec7314c8bdd088323` / `06397c3361de9ba69b2548194df054f0afc271c3dc62d95bef4516e2195f9aef` |
| Chromium cutover browser log | `3a58d5f861f3a7eb919a462180238193375c89765ef9432c71d3afeb7af03f49` |

| Selector | TRX SHA-256 | Native / envelope SHA-256 | Cleanup inventory SHA-256 |
| --- | --- | --- | --- |
| pair-chromium | `7917c61ecdeb74c4934be7fb9503e76ee30f07a18cf3cd7ba4ce4ce08af5a56b` | `e22c51d53245caddb6b34de2d2ff842707242866da6ebdb4178a5f33f89975dd` / `e2aa9484784b460bc7ebae10178dec4a01710d2f9a1a15def79fafda227fe689` | `a99abf44b1c335c19a9678535a09818a97eb47e40caf3c7fa27f5b07c83cc374` |
| pair-edge | `59a6531672f7ea292b63af121167f5cb5d1f8d7bcd60e6a523453516e0d0ed89` | `59920556bb54de65a013ee932fabcf9104e51d303921de94da0915bbafe7b9f1` / `08ecaaf2aa02b4b1975c5051f1379eb854942350a4be9475327c45e59be40386` | `85b44ccd6c29b747d53945aa974fa8b4462e76001fb3aea89d841055fc542197` |
| cutover | `ee6cde808d1c1456daf0465252261e05414a7eeb3ae65733de5f557d39f36b2f` | Absent | Absent |

Both pair cleanups were accepted. Three cutover databases, three logins, three SQL control roots and all nine cutover control/runtime/browser staging directories remain retained. No cutover acceptance or cleanup receipt exists.

Task 6 and B05/F04 remain open. Workload/recovery are NOT RUN. Workload sample floor and observed recovery RPO/RTO are unavailable. No final independent disposition or `CandidateVerified` exists. Ordinary resend stays OFF. Full IIS and unperformed Narrator remain NOT RUN. Staging remains NOT ACCEPTED and production NO-GO. [Backend attempt20 evidence](https://github.com/chung6a8m/MyDmsVn/blob/codex/web6-b05-operations/docs/evidence/web6/20261110-b05b-paired-candidate.md#task-6-attempt20-browser-pair-pass-and-cutover-control-failure).

## Task 6 attempt19 browser pair PASS and cutover IIS identity refusal

The Owner authorized one fresh nonproduction candidate `web6-20261113-b93cedcb`. Backend source `be8c61b43e2311ee0bb59d8ea1c152df3722ffcc` / tree `466d9d79615a2033a2159c533e42fb5b471fa940` and frontend source `5f355e4ed3d0ca0778e195b940ecbed67b410dc0` / tree `47dc71f900a4977b953f6850f943fde12d64e632` were checked out clean and detached. Frontend docs-only HEAD `acf84d7b07b4720ac0ec4d0d4226001f6a303f1c` was the evidence base.

Prepare ran once from `2026-11-13T12:26:09.8136762+00:00` to `2026-11-13T12:28:46.7315933+00:00`, exit 0 / `PIN_MATCHED`. Independent checks confirmed ordinary resend OFF, the exact candidate marker, byte equality of all ten dist/wwwroot files and zero live allocation. The one serial run began 0.550 seconds later and ended at `2026-11-13T12:34:28.0017617+00:00`, exit 5 / `FailedRetained`.

| Selector | Discovered / executed / passed / failed / skipped | Outcome |
| --- | --- | --- |
| Chromium pair | 1 / 1 / 1 / 0 / 0 | PASS / native ACCEPTED |
| Edge pair | 1 / 1 / 1 / 0 / 0 | PASS / native ACCEPTED |
| Cutover | 1 / 1 / 0 / 1 / 0 | FAIL / IIS Express process command-line identity |
| Workload | 0 / 0 / 0 / 0 / 0 | NOT RUN / NOT MEASURED |
| Recovery | 0 / 0 / 0 / 0 / 0 | NOT RUN / NOT MEASURED |

Both paired browser selectors completed their native browser/IndexedDB and SQL/business checks and recorded accepted cleanup. Cutover passed seed, snapshot and native artifact sealing and started its first IIS Express process. The host command-line identity check stopped cutover before the browser lifecycle pack. Three databases and three logins remain retained with their ownership records and cutover staging directories.

| Receipt or artifact | SHA-256 |
| --- | --- |
| Prepared / PairPassed | `15fd28bd4a491150652b2380d220abfb1fd623dc630a285b72527de5f8e72a91` / `f1a919bcab6d53627d22ee91474ca7152696084320decbe67a0f911eadee9bda` |
| FailedRetained | `a7af67ac022d439c3d0d95ad1521e57cb317606f43faea20f5187d016b38e24c` |
| Ordinary dist / manifest | `5c7908157609e24760dcab5da26b170f5194f1918f2343f80aa164aab0ef59ab` / `796d86094b6cfd29efa1d99aac49bd9fd10bb80c73b71d0164d853e74485ef53` |
| Candidate dist / manifest | `e98d4fa10717367352d53bb1a8242a49823e0e449566a950381dbc8234cf3180` / `abeaae8481302385517223e42dce929665f98a344d371ef76d28b3beeaaa721c` |
| Current / archived backend publish | `7a862482fab774d97309b0a19e115c2c1c285169b51f6c138ee1905aeab059ff` / `e95c7810fadfee5641882f20009a6e3b09707137eabaa823637573de00b7234a` |

| Selector | TRX SHA-256 | Native / envelope SHA-256 | Cleanup inventory SHA-256 |
| --- | --- | --- | --- |
| pair-chromium | `7182a86029dccab90a7089fd1eb5f3a472a3545dafc0d403657acda1e39fd28a` | `5a1b6bdfae588573cb595f03068638d5762f93b3435e82dea98fe115c8eb33c0` / `4f5eb7b37351448f044b26c89618e257d0097d656db71989829dd2bf2fa91f73` | `1daf709cbd0a46d6f9b59a1b95471af2fdc269da57a2dab81d2618a80e0676ee` |
| pair-edge | `e476137f8ad7dfc3648546cf269c864f133567a5609927a2df2ba5a3444b1817` | `dcca156ea042d700b5ca69b153ba4842a7dfc5e9e8302e479015c3bcc36151c7` / `d5afb889cf85ea25b164ebb966ac46fc973b2031929548b6c7364c709c93752b` | `b9ec2786292eb0ce4f92042c6391947ae84fba2b964b5a685481397c762fc13c` |
| cutover | `1d47779c75bdb613c13f97b7a9ac9b41b3a62e4cd7b97efb9f48683bf7531d48` | Absent | Absent |

Task 6 and B05/F04 remain open. Workload/recovery are NOT RUN. Workload sample floor and observed recovery RPO/RTO are unavailable. No final independent disposition or `CandidateVerified` exists. Ordinary resend stays OFF. Full IIS and unperformed Narrator remain NOT RUN. Staging remains NOT ACCEPTED and production NO-GO. [Backend attempt19 evidence](https://github.com/chung6a8m/MyDmsVn/blob/codex/web6-b05-operations/docs/evidence/web6/20261110-b05b-paired-candidate.md#task-6-attempt19-browser-pair-pass-and-cutover-iis-identity-refusal).

## Task 6 attempt18 browser pair PASS and cutover path refusal

The Owner authorized one fresh nonproduction candidate `web6-20261113-0f79b843`. Backend source `c1afa4fbb81b17bee08b5e880b16ffca21d448df` / tree `f53075df2c49335bd4b381a2707b015029369434` and frontend source `5f355e4ed3d0ca0778e195b940ecbed67b410dc0` / tree `47dc71f900a4977b953f6850f943fde12d64e632` were checked out clean and detached. Frontend docs-only HEAD `bee476584ca72f3023b59c80e81a0e2f2bb72e55` served as the evidence base.

Prepare ran once from `2026-11-13T11:46:14.3841094+00:00` to `2026-11-13T11:49:56.5100815+00:00`, exit 0 / `PIN_MATCHED`. Independent checks confirmed ordinary resend OFF, the exact candidate marker, byte equality of all ten dist/wwwroot files and zero live allocation. The one serial run began 1.151 seconds later and ended at `2026-11-13T11:55:39.5902778+00:00`, exit 5 / `FailedRetained`.

| Selector | Discovered / executed / passed / failed / skipped | Outcome |
| --- | --- | --- |
| Chromium pair | 1 / 1 / 1 / 0 / 0 | PASS / native ACCEPTED |
| Edge pair | 1 / 1 / 1 / 0 / 0 | PASS / native ACCEPTED |
| Cutover | 1 / 1 / 0 / 1 / 0 | FAIL / contract path canonicalization during deployment sealing |
| Workload | 0 / 0 / 0 / 0 / 0 | NOT RUN / NOT MEASURED |
| Recovery | 0 / 0 / 0 / 0 / 0 | NOT RUN / NOT MEASURED |

Both paired browser selectors completed their native browser/IndexedDB and SQL/business checks and recorded accepted cleanup. Cutover passed the seed and baseline JSON reads, then stopped at a backend contract path check while sealing the current deployment. Cutover did not reach the browser lifecycle. Three databases and three logins remain retained with their ownership records and current cutover staging directories.

| Receipt or artifact | SHA-256 |
| --- | --- |
| Prepared / PairPassed | `bdf7ec52e1ee8f8ecf42d6dddfaa204f24cc6e7339c8b8f54bfc30555ff5a03e` / `d13016f10c080941cb0f17ccd8497ead0f8e2930fcf27740ae7c5261d1b46211` |
| FailedRetained | `fbb8cfad196013c926268edb288e86c6ffe5204f5c27d6bf6dcb68cc1915713c` |
| Ordinary dist / manifest | `5c7908157609e24760dcab5da26b170f5194f1918f2343f80aa164aab0ef59ab` / `796d86094b6cfd29efa1d99aac49bd9fd10bb80c73b71d0164d853e74485ef53` |
| Candidate dist / manifest | `745605e6fe6462ad8095d7f7e2c8f1cd1255e902aee4c3a9965a3d10e8224fe0` / `8ade9200a32f06b055d02626b8d535ec32befef12598c422743bbc9d832d089e` |
| Current / archived backend publish | `bc2c18c482a01e45dfc3507f920b2b8da596934c2ee9fd0d561d68844c3ce762` / `c689d1bc37a10f49336f1b4d8b4c750fb0bc465593667e26bc7fef1dc1e8f346` |

| Selector | TRX SHA-256 | Native / envelope SHA-256 | Cleanup inventory SHA-256 |
| --- | --- | --- | --- |
| pair-chromium | `820fa6db552f85a1f222892cecc48055beb5366a37cf4147a0c9bee16796e05e` | `494a7d4fd5079d4f932db401278db237c365d6af3fba323918a1174fa4c4760b` / `a7d37e449a386ae3bd026e3c8492c5561b4910da2eeacd54e24d6dbe8ae40549` | `bcd5d7a3c19b23c242619991e70b5fd7a36440d69eb41eb5a0ffc27bb0bcc23b` |
| pair-edge | `18b41a8df15b6e502638c5261734a66b952f3e1738c9639f62d4d1a552bcd75b` | `1807a1ec36c4d630b44f7d4d0c877fef4daf4ac46839201f322880db80c2e70b` / `7cdc14b0d833d4882ff7dc23586d540328cd3b07d3bd1816eaf9e4267d998ba7` | `600a9e2bc99c5a3992d7a136b95878e04119363c16696e0c034e2c7d90d89524` |
| cutover | `82e7fc96cc67f0eec8d537258908d7378f3e43d626d390cee32dda017898916f` | Absent | Absent |

Task 6 and B05/F04 remain open. Workload/recovery are NOT RUN. Workload sample floor and observed recovery RPO/RTO are unavailable. No final independent disposition or `CandidateVerified` exists. Ordinary resend stays OFF. Full IIS and unperformed Narrator remain NOT RUN. Staging remains NOT ACCEPTED and production NO-GO. [Backend attempt18 evidence](https://github.com/chung6a8m/MyDmsVn/blob/codex/web6-b05-operations/docs/evidence/web6/20261110-b05b-paired-candidate.md#task-6-attempt18-browser-pair-pass-and-cutover-path-refusal).

## Task 6 attempt17 browser pair PASS and cutover snapshot failure

The Owner authorized one fresh nonproduction attempt for `web6-20261113-0fa528e7`. Backend source `485570368afd64d814d024f0fb435542ff366712` / tree `170acdf7d29701104b0c0978756a063713b8bafb` and frontend source `5f355e4ed3d0ca0778e195b940ecbed67b410dc0` / tree `47dc71f900a4977b953f6850f943fde12d64e632` were prepared in clean detached worktrees. Frontend docs-only HEAD `4240d48c2f866c76aebe56d357ee527199da34f7` was the evidence base.

Prepare ran once from 11:17:59.4793548Z to 11:20:34.2690535Z, exit 0 / `PIN_MATCHED`. Independent checks confirmed ordinary resend OFF, the exact candidate marker, all ten dist files equal to the complete published wwwroot and zero live allocation. Run began 0.695 seconds later and exited 5 / `FailedRetained` at 11:24:55.6297394Z. The reviewed browser-pair bounds applied throughout.

| Selector | Discovered / executed / passed / failed / skipped | Outcome |
| --- | --- | --- |
| Chromium pair | 1 / 1 / 1 / 0 / 0 | PASS / native ACCEPTED |
| Edge pair | 1 / 1 / 1 / 0 / 0 | PASS / native ACCEPTED |
| Cutover | 1 / 1 / 0 / 1 / 0 | FAIL / current baseline SQL snapshot |
| Workload | 0 / 0 / 0 / 0 / 0 | NOT RUN / NOT MEASURED |
| Recovery | 0 / 0 / 0 / 0 / 0 | NOT RUN / NOT MEASURED |

Both pair selectors passed the native browser/IndexedDB and SQL/business checks for the reviewed candidate artifact. Both cleanup receipts were accepted. Cutover reached its initial current-database snapshot after all three seed calls returned. A null SQL JSON value stopped cutover before any IIS/browser lifecycle case. Three cutover databases and three runtime logins were retained with their ownership records and SQL control roots.

| Receipt or artifact | SHA-256 |
| --- | --- |
| Prepared / PairPassed | `0004c675924dee2627778a64f8d04557ca349020431d3b2be6eabb5db901a148` / `d5ef840228c4c93a354556e6beafcaad4bb680fbc218b34b17e81263f9181b16` |
| FailedRetained | `5042f06f3e890d92b6c0ebab249e80d8a02fd3a814973ed92aa78f4f07d9a7e3` |
| Ordinary dist / manifest | `5c7908157609e24760dcab5da26b170f5194f1918f2343f80aa164aab0ef59ab` / `796d86094b6cfd29efa1d99aac49bd9fd10bb80c73b71d0164d853e74485ef53` |
| Candidate dist / manifest | `b5a0a88e0f43c211d10736730bf296ae0038f5b5496e232352b0a45f166296b1` / `2aedf43a7917c9cdacb950aa40a4d3dc9dfaf67d8419de7ce176b68a9e79843b` |
| Current / archived backend publish | `841465ac3198b970414ccdec3876085dbb319e4cd6a95c0edc219e955f47fa8d` / `4359b5c9923415e44b40ad429c65d52c2311d150b6a122cb29cb85e9b57df5b8` |

| Selector | TRX SHA-256 | Native / envelope SHA-256 | Cleanup inventory SHA-256 |
| --- | --- | --- | --- |
| pair-chromium | `dbd37d263dd31f98ca6718619273c43cb644f6e17310d8eec12526682e9f1780` | `34fdd475c9aa101429981a9b9b4a814c08050aa35f0d50af82af7f272be9a25f` / `8edd2dd54604cd387a0fe8c0dc8aae3e4bcc98b8dadb9e042289f50ec2f981ef` | `c14d8a832c4d75f53923b513b272f508a2df54ecf67bf9b5d128156a8fd4422b` |
| pair-edge | `20b7d7dde48e8a225e6476c63ada37f05943a22e4982f8941311c686b3bda7d0` | `e13ba6d13d0f16793d669731ddcef2a097601f725c9f369e902b30b2a6286696` / `dfa59c49ca7d98d2c4ce7be626cf7067d42a56c001d211f8811a3f4b457d3df1` | `c087fc1ee85f8710ac3618aa1c43617a45dfdc1d42ced45c4ca5aca866a0e172` |
| cutover | `935bfd88be34406d47ddab3bafc38ae25f7b7dbcbdb065435c18621b5bfa67e8` | Absent | Absent |

Workload and recovery are NOT RUN. No workload floor or percentile, recovery RPO/RTO, final independent disposition or `CandidateVerified` is available. Task 6 and B05/F04 remain open. Ordinary resend stays OFF. Full IIS and unperformed Narrator remain NOT RUN. Staging remains NOT ACCEPTED and production NO-GO. [Backend attempt17 evidence](https://github.com/chung6a8m/MyDmsVn/blob/codex/web6-b05-operations/docs/evidence/web6/20261110-b05b-paired-candidate.md#task-6-attempt17-browser-pair-pass-and-cutover-snapshot-failure).

## Task 6 attempt16 browser pair PASS and cutover epoch seed failure

The Owner authorized one fresh nonproduction attempt for candidate `web6-20261113-8d732d8c`. The exact backend source `4644b8e9416c2e34d8b7a57e40cdd62e35b052be` / tree `9a4b4a8aef63577a9e347d0c50c7d49a5c398ebc` and frontend source `5f355e4ed3d0ca0778e195b940ecbed67b410dc0` / tree `47dc71f900a4977b953f6850f943fde12d64e632` were prepared in clean detached worktrees. The frontend donor HEAD `935b03ed80d7b3e5f2c958e6e37f1a2b474bae61` was used as the documentation base.

Prepare ran once 10:46:16.4414507Z–10:49:29.0417247Z, exit 0 / `PIN_MATCHED`. The independent check verified ordinary resend OFF, the exact candidate marker, all 10 dist files equal to the complete published wwwroot, and zero live allocations. Run began 0.830 seconds later and ended at 10:54:21.8703337Z, exit 5 / `FailedRetained`. The browser pair used the reviewed 35/50/65-second boundary, 65/35-second one-effect, 170-second mismatch and 32/39/41/44-minute time limits.

| Selector | Discovered / executed / passed / failed / skipped | Outcome |
| --- | --- | --- |
| Chromium pair | 1 / 1 / 1 / 0 / 0 | PASS / native ACCEPTED |
| Edge pair | 1 / 1 / 1 / 0 / 0 | PASS / native ACCEPTED |
| Cutover | 1 / 1 / 0 / 1 / 0 | FAIL / current allocation epoch seed, before host/browser launch |
| Workload | 0 / 0 / 0 / 0 / 0 | NOT RUN / NOT MEASURED |
| Recovery | 0 / 0 / 0 / 0 / 0 | NOT RUN / NOT MEASURED |

Both paired native receipts were accepted. Each binds the exact prepared frontend dist, current backend publication and original allocation/cleanup inventory. The pair gates cover the six original-key mutations and their SQL/business oracle, durable IndexedDB recovery and consent, the two-tab one-effect assertion and synthetic IME coverage. Cutover admitted the exact pair and artifact pins and confirmed three databases and three runtime logins. Its current epoch seed then failed before any cutover browser lifecycle case ran. The pair's accepted cleanup stands. Cutover's allocations and ownership evidence remain retained.

| Receipt or artifact | SHA-256 |
| --- | --- |
| Prepared / PairPassed | `ba23575e22b600768d1b375e446635f8143eb243d7e3f285a0fbc38e30a9402d` / `18983f570ab895626134cd1cb65b78b363d8d39ae296cc985fea00419163d82c` |
| Ordinary dist / manifest | `5c7908157609e24760dcab5da26b170f5194f1918f2343f80aa164aab0ef59ab` / `796d86094b6cfd29efa1d99aac49bd9fd10bb80c73b71d0164d853e74485ef53` |
| Candidate dist / manifest | `6ffbaee981996ace95efd728fb4c477359f954e74f216b4c9981a833b14dcd49` / `250e9a7517bf1a671fa88e4241d0faeea711f3ea64ea2a104884f467318f8410` |
| Current backend publish | `d8e1210460c4418a0048ca1809739c8e38b40525daa9536fd87255f83afab592` |
| FailedRetained | `0442269c4fac79e7b9aa8efaf951b2976abc48683e685d56f174764e9d4ac78a` |

| Selector | TRX SHA-256 | Native / envelope SHA-256 | Cleanup inventory SHA-256 |
| --- | --- | --- | --- |
| pair-chromium | `cc02228c4e8470954761ff83b02ca8485ea9e7bde56a71ec027d8eed02458918` | `b9b410e754c90484535e40f75bccea43206096c3f5b8232be5fa4ce3c3f74df7` / `36899ba1c5d664138c51edae2b276bfd714943fc9fbcc8253635d7b9977e5591` | `414421d85683f06703948de256bf03510952af59b934b785bc273791efc72613` |
| pair-edge | `6607f10a9884db38d7325f1847aeac8da0840ca9b6111df8c6e57988c292cb26` | `a3334e0f84cce6f7b7de8e11f5dbb6c4c89c8791203a37eb7d075a5bf326c8a3` / `95a1159e658aa011d523a94d91951f7e4def58708a4aecc7a44af3434ddb236e` | `f61be89b94ed34dd70e912973d0e4ad3531d11eaeecd9cfa3a482d0fd737da7e` |
| cutover | `3cc8706d5a6f42c7479fbc625be8649a19694f53e9bf2cb9fe5bd4e117d205a3` | Absent | Absent |

No workload percentile/sample floor, observed recovery RPO/RTO, final independent disposition or `CandidateVerified` is available for this candidate. Task 6 and F04 remain open. Ordinary resend stays OFF. Full IIS and unperformed Narrator remain NOT RUN. Staging remains NOT ACCEPTED and production NO-GO. [Backend attempt16 evidence](https://github.com/chung6a8m/MyDmsVn/blob/codex/web6-b05-operations/docs/evidence/web6/20261110-b05b-paired-candidate.md#task-6-attempt16-browser-pair-pass-and-cutover-epoch-seed-failure).

## Task 6 attempt15 browser pair PASS and cutover build-authority failure

The Owner authorized one fresh attempt after independently reviewed boundary/parent budget hierarchy. Candidate `web6-20261110-f1330b4a` used backend `08123da11f21f57be73cd24992a57d7bce9c6d61` / tree `64e22c22e283ccbcfa19969277458bbbcf266825` and frontend `5f355e4ed3d0ca0778e195b940ecbed67b410dc0` / tree `47dc71f900a4977b953f6850f943fde12d64e632`. Reviewed budgets: boundary 35/50/65s, one-effect dispatch 65s/response 35s, mismatch 170s, third test 32m, controller 39m, browser process 41m, pair gate 44m. No external termination occurred; selectors ran serially once.

Before new roots/approval, four ordinary read-only Edge observations at `14:23:50.4361114Z`–`14:24:20.5493631Z` (30.1132517 seconds) matched identity/version `157.0.4341.46`/SHA-256 `3e2c8557b5ca4d78868d3089346146ceab94f198ce3d58526ce8f6c8d4b4167c`. Full independent Node `22.14.0` / npm `11.6.0` identity/hash/current-owner protected ACL/no-link checks passed for all 2,337 files/572 directories, tree `c55ed76c2333bcb335b2327f639195464c2ed7685b329da812f02c85bed29529`. A bounded query reverified approved effective master/server. No custom lock/copy/updater change, installation or global mutation occurred.

Fresh roots, new four-field `web6-cutover` SQL approval, Owner authority and request used Windows PowerShell/net48 protected create-new publication. Exact current-user-only protected ACL/schema/digest/master binding passed; eight-hour expiry `2026-11-10T22:24:34Z`. No old protected payload/resource was inspected, copied, reused or adopted. Authorize once exited 0. Prepare once ran `14:24:50.0741073Z`–`14:27:36.1663528Z`, exit 0 `PIN_MATCHED`. Independent checks confirmed ordinary null candidate ID/OFF, exact candidate marker, ten-file full dist/wwwroot equality, clean detached pins and zero pre-run live allocation.

| Attempt15 record | SHA-256 |
|---|---|
| Release/net48 bootstrap | `cb1cccdaa8a15f16f69143416aa7b0d3ffba61cbcc58ab925fd0c5a64f961d8c` |
| New SQL approval | `f1a94713d3d433b174361735a321baa630a3d23af4c886693dd14ebcb94667b0` |
| Owner authority / request | `546a213df0be4fd44a120cddfbd10c2a6b05c1fcdfb510a5c67d643ccb039fca` / `26245a14fa06bb41a3ea61b8d26516743c1ce4c1c916353eb5e4075d3d638514` |
| Prepared / PairPassed | `6976f8a22906abb9213b4175c5cd8847b97a221d3921db3c3ef547cbc928e3b1` / `121305576939a4acba2872b9c43df7233ceac2a7fe28a7f736daaa7dc6c44d80` |
| FailedRetained terminal | `03e9cbc1f87284cac0f597752bff681c0e4079448212c9e94491139921fb3bff` |
| Ordinary dist / manifest | `5c7908157609e24760dcab5da26b170f5194f1918f2343f80aa164aab0ef59ab` / `796d86094b6cfd29efa1d99aac49bd9fd10bb80c73b71d0164d853e74485ef53` |
| Candidate dist / manifest | `53c88f584e218a6fcb5a30729bb716a1de0dff65abb86608c450a1bbf8bb8473` / `23c4ec5e30801aa4db0733d37d45dfb7157a1e9af7c47604b7229ac73c2e568a` |
| Current / old backend publish | `6402c9e96445d0eff484bd28da0d1b34fde8b81dbef682171db80b28f171ef73` / `05a64c2412b541f14b4c6a712f70a0cafdada1982d16bdf15dd28a7c5a93f7c5` |
| Cutover build authority | `2d4e75842aaeadd271dc3bee99e0cdd3b72664f8262c58f3a4de6f0146201732` |
| Selector DLL | `d2b30b0017f53e4eed8aa82ae8b51c839264a5593d52f90dce16aa40d1479547` |

Run began `14:27:36.9575335Z`, **0.791 seconds** after prepare, and ended `14:32:58.1174857Z`, exit 5 `FailedRetained`; run ID `run-8f075dd55517465bb8b305c1216680d9`. Both browser selectors passed with native `ACCEPTED` receipts and exact hash-bound envelopes. The state reached `PairPassed`, then stopped at cutover; no later selector ran.

| Required selector | Discovered / executed / passed / failed / skipped | Result |
|---|---:|---|
| Chromium pair | 1 / 1 / 1 / 0 / 0 | PASS / native ACCEPTED |
| Edge pair | 1 / 1 / 1 / 0 / 0 | PASS / native ACCEPTED |
| Cutover | 1 / 1 / 0 / 1 / 0 | FAIL / preallocation build-authority guard |
| Workload | 0 / 0 / 0 / 0 / 0 | NOT RUN / NOT MEASURED |
| Recovery | 0 / 0 / 0 / 0 / 0 | NOT RUN / NOT MEASURED |

Chromium selector ran `14:27:57.8968787Z`–`14:30:23.5935539Z` (TRX duration 134.450s), native acceptance `14:30:22.7879398Z`. Edge ran `14:30:27.1988064Z`–`14:32:44.9546728Z` (TRX duration 129.657s), native acceptance `14:32:42.6470948Z`. Cutover ran `14:32:48.5599954Z`–`14:32:58.0375909Z` (TRX duration 2.416s), child exit 1, `NonzeroExit`; terminal records `processTreeDrained:true` / `requiresDispositionProof:true`.

| Gate receipt | TRX SHA-256 | Native / envelope SHA-256 |
|---|---|---|
| pair-chromium | `1db773c0762c45e6a67799949bae32c595e034a5c709ff2505949fa664559e96` | `b903253c458803aa3092c3f48efc451482e80959f61ba86930c3acbe0c47425c` / `133b64d5d5efffa666303387df6d721b306ad5c2aa4017ee89f6c3ab3a2f9a83` |
| pair-edge | `7aa847c1486683a0dd5c69c17d9dc6e27c6074d3f4d59a6636d958b292ba3c64` | `d7fce4e76974bf6bf886648ccb0df60af437caf7a4b75b6cf979e46cacbe4541` / `f9a01578cce371b4d9b3e84b78384d3fe3c652950329060ea56b821d795764e2` |
| cutover | `aa44de3020c2cd17881f444251fb6f00c620c7cf158448e0c586160eed880eb1` | absent |

Cutover exception is exactly `System.IO.IOException : Cutover sealed build authority or published artifact drifted.` at `Web6CandidateManifest.cs:361` via `WebHostIisExpressTests.cs:631`. This guard runs before cutover SQL approval/allocation or host launch. No SqlException appears.

Read-only diagnosis remeasured current attempt artifacts with the native `Web6CandidateFileSet.MeasureTree` and compared the protected build authority. Both archive source/tree/clean checks and every artifact-to-sealed-authority comparison passed. The sole failing guard comparison is `actual.Frontend.ArtifactHash != actual.CurrentPublishedHash`: archived frontend dist `da573ea101e95b9a98850cc1b29270d89a24e6f4d54a8c2044949cfdb9289882` versus full current publish `6402c9e96445d0eff484bd28da0d1b34fde8b81dbef682171db80b28f171ef73`. Both still match their separately sealed expected hashes. This identifies an artifact-scope contract mismatch; no changed artifact bytes were observed. No authority/source patch, digest replacement, retry or post-failure SQL query occurred.

Both pair native receipts record `processDrained/httpQueuesAbsent/sqlQuiescent/resourcesVerified:true`. Each inventory contains one database, one login, one deletedDirectory, three process and three queue records. Pair cleanup was accepted by those receipts; both recorded runtime directories are absent and the current SQL control parent has zero children. Inventory `deletionAuthority:false` is non-authorizing evidence, not permission for additional cleanup. Cutover allocation receipt/root are absent; workload/recovery roots and final independent disposition are absent. Prepared worktrees/artifacts, new authorities and receipts remain retained. The overall run is `FailedRetained` after `PairPassed`; do not label the accepted pair cleanup as Quarantined. No manual cleanup, historical-resource inspection/adoption or ownership transfer occurred.

Environment: Windows 11 Home x64 build 26300, SDK `8.0.427`, SQL `14.0.2140.2`, IIS Express `10.0.26013.1000`, Chromium `156.0.8078.4`, Edge `157.0.4341.46`; Node/npm above. Workload sample-floor/percentile evidence, observed RPO/RTO, final independent disposition and CandidateVerified are absent. A reviewed cutover correction plus new explicit Owner authorization is required before another fresh candidate/root/approval chain. Ordinary resend OFF, full IIS/unperformed Narrator NOT RUN, staging NOT ACCEPTED, production NO-GO. Task 6 and B05/F04 remain incomplete.

[Backend attempt15 evidence](https://github.com/chung6a8m/MyDmsVn/blob/codex/web6-b05-operations/docs/evidence/web6/20261110-b05b-paired-candidate.md#task-6-attempt15-browser-pair-pass-and-cutover-build-authority-failure) identifies the local evidence update, not a claimed push or merge.

## Task 6 attempt14 candidate-mismatch observation failure and quarantine

The Owner authorized one fresh attempt after independently reviewed one-effect response/commit correction. Candidate `web6-20261110-37528a15` used backend `a5f264dd5ca3108a3be50fd8bf60c5d82dcc01af` / tree `e2c243894c385c579f4596a262400fb7105f9842` and frontend `0dc8a2ff0d88218af9bc156298d971fd3e60e715` / tree `3c9cf852e12b3dc6c6cd01c4f25912284ba8a82d`. The revised helper must observe the successful completed response of the exact mutation Request before verifyOneEffect, with exactly one dispatch. Reviewed 50/65/35/170/480-second budgets remain.

Before new roots/approval, four read-only Edge observations at `13:36:37.0762219Z`–`13:37:07.2100765Z` (30.1338546 seconds) matched identity/version `157.0.4341.46`/SHA-256 `3e2c8557b5ca4d78868d3089346146ceab94f198ce3d58526ce8f6c8d4b4167c`. All 2,337 tool files/572 directories passed independent identity/hash/current-owner protected ACL/no-link checks: Node `22.14.0`, npm `11.6.0`, tree `c55ed76c2333bcb335b2327f639195464c2ed7685b329da812f02c85bed29529`. A bounded query independently reverified approved effective master/server. No custom lock/copy/updater change, installation or global mutation occurred.

Fresh roots, new four-field `web6-cutover` SQL approval, Owner authority and request used Windows PowerShell/net48 protected create-new publication. Exact current-user-only protected ACL/schema/digest/master binding passed; eight-hour expiry `2026-11-10T21:37:23Z`. No old protected payload/resource was inspected, copied, reused or adopted. Authorize once exited 0; prepare once ran `13:37:37.9584709Z`–`13:40:21.5773439Z`, exit 0 `PIN_MATCHED`. Independent checks confirmed ordinary null candidate ID/OFF, exact candidate marker, ten-file full dist/wwwroot equality, clean detached pins and zero pre-run live allocation.

| Attempt14 record | SHA-256 |
|---|---|
| Release/net48 bootstrap | `edb039e62c4ee9ead11612dc1daa56a356dce65bcfc748b10ab7f8f1a8e12e54` |
| New SQL approval | `2a3e98fc47c271a5f43d6d9a07078bebd8fa36fe094e814aba3221b123ac2b8e` |
| Owner authority / request | `2241e9ba65d65bac003e47fe0798e6c736b9498a5d15d054684c329cd7e65ef7` / `69a946658d76f123b8729118433532ab8c0d1c08637176f682cef14d73c99a3d` |
| Prepared / terminal receipt | `fac7d517d26fd5feca7049c6dc7b476c3d8072f92593ff4a2d9d4a7aadbe2d20` / `e36421c41c20a18a206badb6e08b1b0385b653e41500def7ed0e0b0da2fb32a1` |
| Ordinary dist / manifest | `5c7908157609e24760dcab5da26b170f5194f1918f2343f80aa164aab0ef59ab` / `796d86094b6cfd29efa1d99aac49bd9fd10bb80c73b71d0164d853e74485ef53` |
| Candidate dist / manifest | `8f2ae915068411067fb661a751c493efd25c6143581383c073210c72889f843c` / `2911851f2b1da038908429526679318ae610201ee89a4c20e678d808f46235cb` |
| Current / old backend publish | `d7ac1100f39bed99c5dd581fc73f0ed1d890aa428d1e2e03d38ecf771075759c` / `955a62da249f11813d77f88b395df6ff02e67fb86e8855edb1cbb0cae115a81f` |
| Cutover build authority | `b2531c9ed65a10b29ff26191bdcee510cd94629744677e982394e71ad5b47429` |
| Chromium wrapper TRX / selector DLL | `41c8d560f4c1c454ddde5921fe8f2edc11ab9e3e11dcc2e9da3683aa4d7522ee` / `8d97593b940324813ff8922138254563837651ddeccfcdc35c0575880a81673d` |

Run began `13:40:22.3475904Z`, **0.770 seconds** after prepare, and ended `13:42:26.5325218Z`, exit 5 `FailedRetained`; run ID `run-a67f00cc0d6c451baaab15f867d52fa0`. Sole Chromium selector: `13:40:42.1835679Z`–`13:42:26.5069515Z`, wrapper duration 91.287 seconds, child exit 1, `NonzeroExit`, `processTreeDrained:true`, `requiresDispositionProof:true`. No external termination occurred.

| Required selector | Discovered / executed / passed / failed / skipped | Result |
|---|---:|---|
| Chromium pair | 1 / 1 / 0 / 1 / 0 | FAIL / FailedRetained |
| Edge pair | 0 / 0 / 0 / 0 / 0 | NOT RUN |
| Cutover | 0 / 0 / 0 / 0 / 0 | NOT RUN |
| Workload | 0 / 0 / 0 / 0 / 0 | NOT RUN / NOT MEASURED |
| Recovery | 0 / 0 / 0 / 0 / 0 | NOT RUN / NOT MEASURED |

Nested Chromium selected three tests/one worker: **2 passed, 1 failed, 0 did not run**, displayed duration `54.5s`, plus one reporter error outside a test. Six-operation explicit consent and committed-response loss passed. The first case exercises the revised response/commit observer. The third case failed `WEB6 boundary=candidateMismatchOn action=prepare HTTP/auth/recovery contract` at `web6-manual-resend-live.spec.ts:263:79` / `web6-boundary-observer.ts:69:19`, after a 5,000-ms predicate window. Exact sanitized state and observer trace:

~~~json
{"contextStatus":null,"eligibilityStatus":null,"refreshStatus":null,"loginVisible":false,"recoveryVisible":true,"resendEnabled":false,"confirmationVisible":false,"additionalMutations":0}
{"phase":"poll","events":["attached","control-start","control-done","trigger-start","trigger-done","poll","request:trigger:context"],"omittedEvents":0}
~~~

The predicate requires context 200, no eligibility/refresh response, recovery visible and resend enabled for this boundary. A trigger context request was observed; no correlated response was observed before predicate failure. Null statuses do not establish no request, a server outcome or root cause. No additional mutation or confirmation was observed. The third-case 401/503, grant, two-tab exact-response/one-effect, IME and reload/offline tail were not reached. No one-effect failure diagnostic, socket-control failure diagnostic or SqlException appears. No source patch, wait/status relaxation, retry or post-failure SQL query occurred.

Candidate records are `Chromium=Failed` and `Cleanup=Quarantined`. One original SQL database/runtime login/control root, host-runtime/config/browser log, candidate manifest/audit/dispositions and prepared artifacts remain retained. Allocation receipt `c7e20bf7931b6a21466b00f2aa416e09df41e514efebdf825a805e9e4d32eec0` binds control digest `d2a8766a2a73f5cb59bfb7ccb38c2544a6422548a60ce693b7f069e96825d325`. Later live roots/native success envelopes are absent. Process drain is not accepted SQL/artifact cleanup or final independent disposition. No manual cleanup, historical-resource inspection/adoption or ownership transfer occurred.

Environment: Windows 11 Home x64 build 26300, SDK `8.0.427`, SQL `14.0.2140.2`, IIS Express `10.0.26013.1000`, Chromium `156.0.8078.4`, Edge `157.0.4341.46`; Node/npm above. Workload samples/percentiles, RPO/RTO, Task4 acceptance and CandidateVerified are absent. A reviewed boundary correction and new explicit Owner authorization are required before any fresh candidate/root/approval chain. Ordinary resend OFF, full IIS/unperformed Narrator NOT RUN, staging NOT ACCEPTED, production NO-GO. Task 6 and B05/F04 remain incomplete.

[Backend attempt14 evidence](https://github.com/chung6a8m/MyDmsVn/blob/codex/web6-b05-operations/docs/evidence/web6/20261110-b05b-paired-candidate.md#task-6-attempt14-candidate-mismatch-observation-failure-and-quarantine) identifies the local evidence update, not a claimed push or merge.

## Task 6 attempt13 committed-identity verification failure and quarantine

The Owner authorized one fresh attempt after independently reviewed eligibility-unavailable HTTP503 correction. Candidate `web6-20261110-85909668` used backend `9823bb4f78f81f5b725c23e94f75aa4e7a8a4702` / tree `c16b1d1c998c23088fe595caa1cf7e11a4bda9ee` and frontend `9a1a2ba17414fabadace5edfb16e85ade6ecffbc` / tree `9c7568e580e78076e39497f8a8a362a2f006b3c3`. Historical action `eligibility500` requires trigger-request-correlated HTTP503 / `Operation.Unavailable`, protected UNKNOWN/resend candidate and zero additional mutation. Reviewed 50/170/480-second budgets remain.

Before new roots/approval, four read-only Edge observations at `12:50:08.6896244Z`–`12:50:38.8196954Z` (30.130071 seconds) matched identity/version `157.0.4341.46`/SHA-256 `3e2c8557b5ca4d78868d3089346146ceab94f198ce3d58526ce8f6c8d4b4167c`. All 2,337 tool files/572 directories passed independent identity/hash/current-owner protected ACL/no-link checks: Node `22.14.0`, npm `11.6.0`, tree `c55ed76c2333bcb335b2327f639195464c2ed7685b329da812f02c85bed29529`. A bounded query independently reverified approved effective master/server. No custom lock/copy/updater change, installation or global mutation occurred.

Fresh roots, new four-field `web6-cutover` SQL approval, Owner authority and request used Windows PowerShell/net48 protected create-new publication. Exact current-user-only protected ACL/schema/digest/master binding passed; eight-hour expiry `2026-11-10T20:50:58Z`. No old protected payload/resource was inspected, copied, reused or adopted. Authorize once exited 0; prepare once ran `12:51:15.2878979Z`–`12:53:57.4554080Z`, exit 0 `PIN_MATCHED`. Independent checks confirmed ordinary null candidate ID/OFF, exact candidate marker, ten-file full dist/wwwroot equality, clean detached pins and zero pre-run live allocation.

| Attempt13 record | SHA-256 |
|---|---|
| Release/net48 bootstrap | `5982981a74a2570cb99a27d06513d41e6d0b98195bb5cabcd6321d88245146d1` |
| New SQL approval | `0e8429b16d4f179158c2d7ac6fd0f88ce61c6a0b2cb8ea8f36842f12f115505b` |
| Owner authority / request | `64bef34dc5b1264bab00093f100f0d09349a8d883d8bc194143c468264f5be4b` / `952eaf95b3187eed616df2d092cec329e45a655ca6ed70e5b8bf8d40f14adc59` |
| Prepared / terminal receipt | `7accfe43981c680123a05ed0e554be8163f2bf1965cfc8c19e7a9882eb6d5ca2` / `c9a5fd3c176ed318d52f502c4fbd605f3c008919a0ca3eb616d11a881ee349fe` |
| Ordinary dist / manifest | `5c7908157609e24760dcab5da26b170f5194f1918f2343f80aa164aab0ef59ab` / `796d86094b6cfd29efa1d99aac49bd9fd10bb80c73b71d0164d853e74485ef53` |
| Candidate dist / manifest | `94a6d7257a9fd9e40e701938a1cbdd569d1d79f06b3f82515ed8597d2d593945` / `9f146a4ac8834f0a1e5d4326b07004ee05becf7cf64b35cc6ebf36a8bbb5ac31` |
| Current / old backend publish | `117602c35e7f3aabefddaad62aa3d462624f018d58ed2531cdbe17c950b0524c` / `c450dc51091269914a5601aecf9453e834164ce3709c0eb9de0289387e420039` |
| Cutover build authority | `0aa224b30054d5a17fb5ed220659d164f2ce52d51edd62d48e20c453e3ad7772` |
| Chromium wrapper TRX / selector DLL | `bca8335624acd312e66ab44f0507d4be42f9fe99512c9285123c49b83a8ddf32` / `2ff0ea946b49fa145ed19489973a4db3f3107b66aa2368fb574a2f18b55c9896` |

Run began `12:53:58.2630867Z`, **0.808 seconds** after prepare, and ended `12:56:10.1054295Z`, exit 5 `FailedRetained`; run ID `run-a83c9de4089d4badaf5d5b8dc613f61f`. Sole Chromium selector: `12:54:18.2381468Z`–`12:56:10.0755858Z`, wrapper duration 99.526 seconds, child exit 1, `NonzeroExit`, `processTreeDrained:true`, `requiresDispositionProof:true`. No external termination occurred.

| Required selector | Discovered / executed / passed / failed / skipped | Result |
|---|---:|---|
| Chromium pair | 1 / 1 / 0 / 1 / 0 | FAIL / FailedRetained |
| Edge pair | 0 / 0 / 0 / 0 / 0 | NOT RUN |
| Cutover | 0 / 0 / 0 / 0 / 0 | NOT RUN |
| Workload | 0 / 0 / 0 / 0 / 0 | NOT RUN / NOT MEASURED |
| Recovery | 0 / 0 / 0 / 0 / 0 | NOT RUN / NOT MEASURED |

Nested Chromium selected three tests/one worker: **2 passed, 1 failed, 0 did not run**, displayed duration `1.1m`, plus one reporter error outside a test. Six-operation explicit consent and committed-response loss passed. The third case failed in candidate control with this exact allowlisted diagnostic, no optional code:

~~~json
{"action":"verifyOneEffect","terminal":"eof","phase":"response-header","elapsedMs":10,"category":"incomplete-response"}
~~~

The current wrapper TRX records `InvalidDataException` with `Candidate committed identity is missing or duplicated.` and the drain aggregate `Recovery fixture drain failed.`; no `SqlException` appears. For this action, `WebRecoveryPilotControl.cs:188–190` rejects a missing expected operation, a different operation kind, or journal count other than one before the business-effect oracle. Current evidence does not distinguish those three conditions. The EOF itself does not prove a timeout, a duplicate effect or absence of a committed operation.

Source flow reaches this `verifyOneEffect` after the boundary loop (including trigger-correlated HTTP503), grant checks, two visible consent dialogs, IME suppression and one counted consent dispatch across the two pages. Those earlier steps returning is a control-flow inference, not full native pair acceptance or proof of a completed mutation response/commit. The request counter alone does not establish commit completion. Later reload/offline tail did not complete. No assertion/status relaxation, source patch, retry or post-failure SQL query occurred.

Candidate records are `Chromium=Failed` and `Cleanup=Quarantined`. One original SQL database/runtime login/control root, host-runtime/config/browser log, candidate manifest/audit/dispositions and prepared artifacts remain retained. Allocation receipt `b376e6bf46e1e5e22a0989ef5dc529825e02ff4b95f919184b7312096aba30ae` binds control digest `1580e9d22eb75340f3836a71647744e209894920ddc2fe5c63a89ac6d0ef928e`. Later live roots/native success envelopes are absent. Process drain is not accepted SQL/artifact cleanup or final independent disposition. No manual cleanup, historical-resource inspection/adoption or ownership transfer occurred.

Environment: Windows 11 Home x64 build 26300, SDK `8.0.427`, SQL `14.0.2140.2`, IIS Express `10.0.26013.1000`, Chromium `156.0.8078.4`, Edge `157.0.4341.46`; Node/npm above. Workload samples/percentiles, RPO/RTO, Task4 acceptance and CandidateVerified are absent. A reviewed boundary correction and new explicit Owner authorization are required before any fresh candidate/root/approval chain. Ordinary resend OFF, full IIS/unperformed Narrator NOT RUN, staging NOT ACCEPTED, production NO-GO. Task 6 and B05/F04 remain incomplete.

[Backend attempt13 evidence](https://github.com/chung6a8m/MyDmsVn/blob/codex/web6-b05-operations/docs/evidence/web6/20261110-b05b-paired-candidate.md#task-6-attempt13-committed-identity-verification-failure-and-quarantine) identifies the local evidence update, not a claimed push or merge.

## Task 6 attempt12 correlated eligibility status mismatch

The Owner authorized one fresh attempt after reviewed request-correlated eligibility observer correction. Candidate `web6-20261110-3fff3d2f` used backend `0711d0b2fcd44b86fef48cc9dae5dadfc0a7089d` / tree `dc1fff8c5462c9a5aa4131b86f296429d75da192` and frontend `4a6541c419b1293a04c57d67bc6faaf1254ba391` / tree `296cae43cea74136b97fee38ffe4e08a20dddea2`. Decision evidence is correlated by trigger-request identity; control/pre-setup/unobserved responses cannot decide PASS. Reviewed 50/170/480-second budgets remain.

Before new roots/approval, four read-only Edge observations over 30.1228947 seconds matched identity/version `157.0.4341.46`/SHA-256 `3e2c8557b5ca4d78868d3089346146ceab94f198ce3d58526ce8f6c8d4b4167c`. All 2,337 tool files/572 directories passed independent identity/hash/current-owner protected ACL/no-link checks, Node `22.14.0` and npm `11.6.0`. A bounded query independently reverified approved effective master/server. No custom lock/copy/updater change, installation or global mutation occurred.

Fresh roots, four-field `web6-cutover` SQL approval, Owner authority and request used Windows PowerShell/net48 protected create-new publication. Exact current-user-only ACL/schema/digest/master binding and eight-hour expiry `2026-11-10T20:21:00Z` passed. No old protected payload/resource was inspected, copied, reused or adopted. Authorize once exited 0. Prepare once (`12:21:15.6025874Z`–`12:23:53.3579636Z`) passed `PIN_MATCHED`; ordinary null candidate ID/OFF, exact candidate marker, ten-file full dist/wwwroot equality, clean detached pins and no pre-run live allocation were independently verified.

| Artifact or receipt | SHA-256 |
|---|---|
| Ordinary dist / manifest | `5c7908157609e24760dcab5da26b170f5194f1918f2343f80aa164aab0ef59ab` / `796d86094b6cfd29efa1d99aac49bd9fd10bb80c73b71d0164d853e74485ef53` |
| Candidate dist / manifest | `fdd540c464c9e4a80a18a69319fc785db4251ff79d205944638d2052b2ed1dde` / `b1b1af29d29758d46bb3d0e0645f3442e4f065416d41508b3a6a9478d72f74f0` |
| Current backend publish | `31362a3290a13d528987e337cdc9412814b7c9e50f2ea0e83aa282345924d124` |
| Prepared / terminal receipt | `c33ae71822620a90fa247c62505178293a24427486ad8df27b47c233f6a72bd4` / `806abca4f404fa70267ba2dd8ee88c9cad3dacd787eb4c21d4909c6bc3a5470c` |
| Chromium wrapper TRX | `e0a88f516653b24de29a3977c11af55f87f9859e9305f858e8c603b49ea074ab` |

Run began `12:23:54.1787260Z`, 0.821 seconds after prepare, and ended `12:26:07.6925591Z`, exit 5 `FailedRetained`. IIS Express/Chromium launched; no external termination occurred.

| Live gate | Discovered / executed / passed / failed / skipped | Disposition |
|---|---:|---|
| Chromium pair | 1 / 1 / 0 / 1 / 0 | FAIL / FailedRetained |
| Edge pair | 0 / 0 / 0 / 0 / 0 | NOT RUN |
| Cutover | 0 / 0 / 0 / 0 / 0 | NOT RUN |
| Workload | 0 / 0 / 0 / 0 / 0 | NOT RUN / NOT MEASURED |
| Recovery | 0 / 0 / 0 / 0 / 0 | NOT RUN / NOT MEASURED |

Nested Chromium selected three tests/one worker: **2 passed, 1 failed, 0 did not run**, displayed duration `1.1m`, plus one reporter error outside a test. Six-operation explicit consent and committed-response loss passed. Third case failed `WEB6 boundary=eligibility500 action=prepare HTTP/auth/recovery contract` at spec `260:79` / observer `69:19` after a 5,000-ms predicate window. Exact sanitized state and trace:

~~~json
{"contextStatus":200,"eligibilityStatus":503,"refreshStatus":null,"loginVisible":false,"recoveryVisible":true,"resendEnabled":true,"confirmationVisible":false,"additionalMutations":0}
{"phase":"poll","events":["attached","control-start","control-done","trigger-start","trigger-done","poll","request:trigger:context","response:trigger:context:200","request:trigger:eligibility","response:trigger:eligibility:503"],"omittedEvents":0}
~~~

The eligibility response is 503 while the predicate requires 500. Both decision responses are correlated to trigger requests; no control/unobserved traffic supplied them. No extra mutation or confirmation was observed. Reaching this later serial step implies prior 401 assertion/re-login/protected-draft restoration completed; this is a source-flow inference, not full pair acceptance. Remaining grant/two-tab checks did not complete. No socket-failure diagnostic or SQL oracle exception appears; no status broadening, source patch or live rerun occurred.

Terminal `processTreeDrained:true` still requires disposition proof; records are `Chromium=Failed` and `Cleanup=Quarantined`. One original SQL database/runtime login/control root, host-runtime/browser log and all candidate/prepared evidence remain retained. Later live roots/native success envelopes are absent. No post-failure SQL query, manual cleanup, retry or historical-resource inspection/adoption occurred. Environment: Windows 11 Home x64 build 26300, SDK `8.0.427`, SQL `14.0.2140.2`, IIS Express `10.0.26013.1000`, Chromium `156.0.8078.4`, Edge `157.0.4341.46`.

No workload samples/percentiles, RPO/RTO, Task4 acceptance, final independent disposition or CandidateVerified exists. A reviewed boundary correction plus new explicit Owner authorization is required before a fresh attempt. [Backend attempt12 evidence](https://github.com/chung6a8m/MyDmsVn/blob/codex/web6-b05-operations/docs/evidence/web6/20261110-b05b-paired-candidate.md#task-6-attempt12-correlated-eligibility-status-mismatch-and-quarantine) records ownership hashes; this link identifies a local update, not a claimed push/merge. Ordinary resend OFF, full IIS/unperformed Narrator NOT RUN, staging NOT ACCEPTED, production NO-GO. Task 6 and F04 remain incomplete.

## Task 6 attempt11 named auth-boundary failure

The Owner authorized one fresh attempt after reviewed eligibility/auth/recovery UI-boundary correction. Candidate `web6-20261110-dcc4ff39` used backend `87d756de1e2c8567b6ddfac052b418790d6454c5` / tree `abbed9668f1774e93d90fe90f93d228383e915db` and frontend `7ab16026ca2cf963ef378a843c609fa5a4b69cd0` / tree `39d1393a75115a24ba3f06b276f1c14c9fe0fb77`. The reviewed case names boundaries, expects 401 sign-out/clearing, explicitly reauthenticates/restores the protected draft, then continues 500 without replay. Existing 170-second mismatch header/480-second third-case budgets remain.

Before new roots/approval, four read-only Edge observations over 30.1394061 seconds matched identity/version `157.0.4341.46`/SHA-256 `3e2c8557b5ca4d78868d3089346146ceab94f198ce3d58526ce8f6c8d4b4167c`. All 2,337 tool files/572 directories passed independent identity/hash/current-owner protected ACL/no-link checks, Node `22.14.0` and npm `11.6.0`. A bounded query independently reverified designated effective master/server. No custom lock/copy/updater change, installation or global mutation occurred.

Fresh roots, independent four-field `web6-cutover` SQL approval, Owner authority and request used Windows PowerShell/net48 protected create-new publication. Exact current-user-only ACL/schema/digest/master binding and eight-hour expiry `2026-11-10T19:42:57Z` passed. No old protected payload/resource was inspected, copied, reused or adopted. Authorize once exited 0. Prepare once (`11:43:12.2027816Z`–`11:45:55.7717753Z`) passed `PIN_MATCHED`; ordinary null candidate ID/OFF, exact candidate marker, ten-file full dist/wwwroot equality, clean detached pins and no pre-run live allocation were independently verified.

| Artifact or receipt | SHA-256 |
|---|---|
| Ordinary dist / manifest | `5c7908157609e24760dcab5da26b170f5194f1918f2343f80aa164aab0ef59ab` / `796d86094b6cfd29efa1d99aac49bd9fd10bb80c73b71d0164d853e74485ef53` |
| Candidate dist / manifest | `a340c4194b9d1bc347a9ff6a3d4589bb0535f9a8f6443d42f39a24a1fc78b297` / `684884b8cc740e5cf557cf50ec2ab7e3d3f252d40403d2a46148eeff27e3e85c` |
| Current backend publish | `9e806f84c17dd6c322f901ae283d24f563838b61194dc75d69a51dce1bc1f83c` |
| Prepared / terminal receipt | `333786b44c6c82331ae9531076bcfe458a4465610f607b2f04f755e279ad16d2` / `cf358502bfc840352d7a53537672c76592e2f518071b7a15bc44add0d82dcdab` |
| Chromium wrapper TRX | `8d6695d3209cf493e7c6429fbbd404473828d691ab78c58ae611b1e7936798f0` |

Run began `11:45:56.6101557Z`, 0.838 seconds after prepare, and ended `11:48:06.8382364Z`, exit 5 `FailedRetained`. IIS Express/Chromium launched; no external termination occurred.

| Live gate | Discovered / executed / passed / failed / skipped | Disposition |
|---|---:|---|
| Chromium pair | 1 / 1 / 0 / 1 / 0 | FAIL / FailedRetained |
| Edge pair | 0 / 0 / 0 / 0 / 0 | NOT RUN |
| Cutover | 0 / 0 / 0 / 0 / 0 | NOT RUN |
| Workload | 0 / 0 / 0 / 0 / 0 | NOT RUN / NOT MEASURED |
| Recovery | 0 / 0 / 0 / 0 / 0 | NOT RUN / NOT MEASURED |

Nested Chromium selected three tests/one worker: **2 passed, 1 failed, 0 did not run**, 59.5 seconds, plus one reporter error outside a test. Six-operation explicit consent and committed-response loss passed. Third case failed `WEB6 boundary=eligibility401 action=prepare HTTP/auth/recovery contract` at spec `274:97`, step `247:5`, after the 5,000-ms predicate window. Exact sanitized state:

~~~json
{"contextStatus":null,"eligibilityStatus":null,"refreshStatus":null,"loginVisible":false,"recoveryVisible":true,"resendEnabled":false,"confirmationVisible":false,"additionalMutations":0}
~~~

No matching response statuses were observed at the assertion; nulls do not prove absence of requests. Observed UI had not reached the required signed-out state. No additional root cause is established. Explicit re-login/restore/500 continuation and remaining two-tab checks did not complete. No socket-failure diagnostic or SQL oracle exception appears. No timeout/source change or live rerun was made.

Terminal `processTreeDrained:true` still requires disposition proof; records are `Chromium=Failed` and `Cleanup=Quarantined`. One original SQL database/runtime login/control root, host-runtime/browser log and all candidate/prepared evidence remain retained. Later live roots/native success envelopes are absent. No post-failure SQL query, manual cleanup, retry or historical-resource inspection/adoption occurred. Environment: Windows 11 Home x64 build 26300, SDK `8.0.427`, SQL `14.0.2140.2`, IIS Express `10.0.26013.1000`, Chromium `156.0.8078.4`, Edge `157.0.4341.46`.

No workload samples/percentiles, RPO/RTO, Task4 acceptance, final independent disposition or CandidateVerified exists. A reviewed boundary correction plus new explicit Owner authorization is required before a fresh attempt. [Backend attempt11 evidence](https://github.com/chung6a8m/MyDmsVn/blob/codex/web6-b05-operations/docs/evidence/web6/20261110-b05b-paired-candidate.md#task-6-attempt11-named-auth-boundary-failure-and-retained-quarantine) records ownership hashes; this link identifies a local update, not a claimed push/merge. Ordinary resend OFF, full IIS/unperformed Narrator NOT RUN, staging NOT ACCEPTED, production NO-GO. Task 6 and F04 remain incomplete.

## Task 6 attempt10 boundary assertion failure

The Owner authorized one fresh attempt after independent review of mismatch response budgets. Candidate `web6-20261110-dd12de6d` used backend `aa59990db966c450378c1a5981190174258ef9c8` / tree `255f2fed1068173da75b3294b23387603be50b63` and frontend `b91aba84b8e42b8aac78bd113c732ad9c5bff715` / tree `5daba3195ca055246f751bd7919ccc970c29b800`. Reviewed mismatch headers have a 170,000-ms absolute budget; body/ordinary candidate calls retain 10,000 ms and third browser case has 480,000 ms. No command retry was added.

Before new root/approval issuance, four read-only Edge observations over 30.1269084 seconds matched identity/version `157.0.4341.46`/SHA-256 `3e2c8557b5ca4d78868d3089346146ceab94f198ce3d58526ce8f6c8d4b4167c`. All 2,337 tool files/572 directories passed independent identity/hash/current-owner protected ACL/no-link verification, Node `22.14.0` and npm `11.6.0`. A bounded query independently reverified designated effective master/server. No custom lock/copy/updater change, installation or global mutation occurred.

Fresh private roots, independent four-field `web6-cutover` SQL approval, Owner authority and request used Windows PowerShell/net48 protected create-new publication. Exact current-user-only ACL/schema/digest/master binding and eight-hour expiry `2026-11-10T19:08:26Z` passed. No old protected payload/resource was inspected, copied, reused or adopted. Authorize once exited 0. Prepare once (`11:08:44.7369553Z`–`11:11:19.8098887Z`) passed `PIN_MATCHED`; ordinary null candidate ID/OFF, exact candidate marker, complete ten-file dist/wwwroot equality, clean detached pins and no pre-run live allocation were independently verified.

| Artifact or receipt | SHA-256 |
|---|---|
| Ordinary dist / manifest | `5c7908157609e24760dcab5da26b170f5194f1918f2343f80aa164aab0ef59ab` / `796d86094b6cfd29efa1d99aac49bd9fd10bb80c73b71d0164d853e74485ef53` |
| Candidate dist / manifest | `dc4e693818fdc5bd96a8923cd13c363179b4999dbbe6e2a71415a849c73241a9` / `f83f82b44ca0860cab915d62fa203761713192c1a7d0f71fddb7ec3ff470958b` |
| Current backend publish | `61728c3566a9e738ceb050763ed7c56eeb8e3d4fff8c454e02a8917691e4bf16` |
| Prepared / terminal receipt | `b27cce07365b1e7f1a2885436f3e3a6acebb5faa0b1f22e692d6035371c33cd4` / `c1425096003bbde5610ebf1ce1c86736830b837bc875744b68c79459f71928fd` |
| Chromium wrapper TRX | `145326507aef32df94e65575380aa81128f5c91eb39514a643e6bc7078c86bf5` |

Run started `11:11:20.4204078Z`, 0.611 seconds after prepare, and ended `11:13:29.6614655Z`, exit 5 `FailedRetained`. IIS Express/Chromium launched. No external termination occurred; the test assertion failed within its reviewed budget.

| Live gate | Discovered / executed / passed / failed / skipped | Disposition |
|---|---:|---|
| Chromium pair | 1 / 1 / 0 / 1 / 0 | FAIL / FailedRetained |
| Edge pair | 0 / 0 / 0 / 0 / 0 | NOT RUN |
| Cutover | 0 / 0 / 0 / 0 / 0 | NOT RUN |
| Workload | 0 / 0 / 0 / 0 / 0 | NOT RUN / NOT MEASURED |
| Recovery | 0 / 0 / 0 / 0 / 0 | NOT RUN / NOT MEASURED |

Nested Chromium selected three tests/one worker: **2 passed, 1 failed, 0 did not run**, displayed duration `1.1m`, plus one reporter error outside a test. Six-operation explicit consent and committed-response loss passed. Third two-tab/candidate/grant/HTTP case failed at spec `238:73`: `expect(firstResend).toBeEnabled()`, timeout 5,000 ms, `element(s) not found`. This follows a completed candidate-control call, button click and awaited operations response in the shared `candidateMismatchOn / eligibility401 / eligibility500` loop.

The current snapshot shows login button/password control, with recovery dialog/resend button absent. Current audit has 11 entries and ends in `WebAuthRefresh / Authentication / Denied`. Exact loop iteration/HTTP response status is not identified by this evidence. No socket-failure diagnostic or SQL oracle exception appears. No additional root cause or full boundary acceptance is inferred.

Terminal `processTreeDrained:true` still requires disposition proof; records are `Chromium=Failed` and `Cleanup=Quarantined`. One SQL database/runtime login/control root, host-runtime/browser log and all candidate/prepared evidence remain retained. Later live roots/native success envelopes are absent. No post-failure SQL query, manual cleanup, source patch, retry or historical-resource inspection/adoption occurred. Environment: Windows 11 Home x64 build 26300, SDK `8.0.427`, SQL `14.0.2140.2`, IIS Express `10.0.26013.1000`, Chromium `156.0.8078.4`, Edge `157.0.4341.46`.

No workload samples/percentiles, RPO/RTO, Task4 acceptance, final independent disposition or CandidateVerified exists. A reviewed boundary correction plus new explicit Owner authorization is required before another fresh attempt. [Backend attempt10 evidence](https://github.com/chung6a8m/MyDmsVn/blob/codex/web6-b05-operations/docs/evidence/web6/20261110-b05b-paired-candidate.md#task-6-attempt10-boundary-assertion-failure-and-retained-quarantine) records ownership hashes; this link identifies a local update, not a claimed push/merge. Ordinary resend OFF, full IIS/unperformed Narrator NOT RUN, staging NOT ACCEPTED, production NO-GO. Task 6 and F04 remain incomplete.

## Task 6 attempt09 diagnosed control timeout

After review of sanitized socket diagnostics and new explicit Owner authorization, candidate `web6-20261110-69528e92` used backend `9665dfd6aafab3ccaca1aed3f928067b87e25373` / tree `c80f07727b1e1a51fb1a8de3e84b93b1e5d3c47d` and frontend `a8afa96dd81e3a282c6351fd6d1786d331a6479d` / tree `ad030e4fdc0ec777a90d94da283c51bf67c6d24f`. The diagnostic adds allowlisted failure fields while retaining timeout and dispatch behavior.

Before new root/approval issuance, four read-only Edge observations over 30.1097743 seconds matched identity/version `157.0.4341.46`/SHA-256 `3e2c8557b5ca4d78868d3089346146ceab94f198ce3d58526ce8f6c8d4b4167c`. All 2,337 tool files/572 directories passed independent identity/hash/current-owner protected ACL/no-link verification, Node `22.14.0` and npm `11.6.0`. A fresh bounded query independently reverified the designated effective master/server. No custom lock/copy/updater change, installation or global mutation occurred.

Fresh roots, independent four-field `web6-cutover` SQL approval, Owner authority and request were created using Windows PowerShell/net48 protected create-new publication. Exact current-user-only ACL/schema/digest/master binding and eight-hour expiry `2026-11-10T18:40:52Z` passed. No old protected payload/resource was read, copied, reused or adopted. Authorize once exited 0. Prepare once (`10:41:10.1382081Z`–`10:43:51.3024088Z`) passed `PIN_MATCHED`; independent checks confirmed ordinary null candidate ID/OFF, exact candidate marker, ten-file full dist/wwwroot equality, clean detached pins and no pre-run live allocation.

| Artifact or receipt | SHA-256 |
|---|---|
| Ordinary dist / manifest | `5c7908157609e24760dcab5da26b170f5194f1918f2343f80aa164aab0ef59ab` / `796d86094b6cfd29efa1d99aac49bd9fd10bb80c73b71d0164d853e74485ef53` |
| Candidate dist / manifest | `0e61d45cedd2b6d6197e48b010f9d0332965429915e50db951e2f43c999dd6ac` / `67e352483b8d28da387ed199b5de9f9cfeb37d78ff1fb2fd4e4c0d0725f7b17f` |
| Current backend publish | `e649fb97bf820a74747b0b9961ed0240d112eee4ebd920e307a5a8786e3fda7d` |
| Prepared / terminal receipt | `34d18b61ba52767b5816673b297ac4042bf843c30d00b581ebb92a46a437f235` / `27d59e9907e7ef32272e2f7cbb8d2b4a3580deb4cf818353846ebfb454948b90` |
| Chromium wrapper TRX | `91c1f53b9e812574a63513254f8dea1d4fec5b503cd62d90c359c08174dd6350` |

Run started `10:43:52.1153062Z`, 0.813 seconds after prepare, and ended `10:45:44.4858991Z`, exit 5 `FailedRetained`. IIS Express and Chromium launched.

| Live gate | Discovered / executed / passed / failed / skipped | Disposition |
|---|---:|---|
| Chromium pair | 1 / 1 / 0 / 1 / 0 | FAIL / FailedRetained |
| Edge pair | 0 / 0 / 0 / 0 / 0 | NOT RUN |
| Cutover | 0 / 0 / 0 / 0 / 0 | NOT RUN |
| Workload | 0 / 0 / 0 / 0 / 0 | NOT RUN / NOT MEASURED |
| Recovery | 0 / 0 / 0 / 0 / 0 | NOT RUN / NOT MEASURED |

Nested Chromium selected three tests/one worker: **2 passed, 1 failed, 0 did not run**, 36.8 seconds; reporter also recorded one error outside a test. The six-operation explicit-consent and committed-response-loss tests passed. The third two-tab/candidate/grant/HTTP case failed with this exact sanitized diagnostic; no optional code field was present:

~~~json
{"action":"candidateMismatchOn","terminal":"timeout","phase":"response-header","elapsedMs":10000,"category":"socket-timeout"}
~~~

This is a client inactivity timeout in response-header phase for `candidateMismatchOn`. Backend restart failure/completion is not established. Current TRX contains no SQL oracle exception. No further cause or full boundary PASS is inferred; the existing ten-second timeout was not changed and no command was retried.

Terminal `processTreeDrained:true` still requires disposition proof; records are `Chromium=Failed` and `Cleanup=Quarantined`. One SQL database/runtime login/control root, host-runtime/browser log and candidate/prepared evidence remain retained. Later live roots/native success envelopes are absent. No post-failure SQL query, manual cleanup, source fix, retry or historical-resource inspection/adoption occurred. Environment: Windows 11 Home x64 build 26300, SDK `8.0.427`, SQL `14.0.2140.2`, IIS Express `10.0.26013.1000`, Chromium `156.0.8078.4`, Edge `157.0.4341.46`.

No workload samples/percentiles, RPO/RTO, Task4 acceptance, final independent disposition or CandidateVerified exists. A reviewed control-boundary correction and new explicit Owner authorization are required before another fresh attempt. [Backend attempt09 evidence](https://github.com/chung6a8m/MyDmsVn/blob/codex/web6-b05-operations/docs/evidence/web6/20261110-b05b-paired-candidate.md#task-6-attempt09-diagnosed-control-timeout-and-retained-quarantine) records ownership hashes; this link identifies a local update, not a claimed push/merge. Ordinary resend OFF, full IIS/unperformed Narrator NOT RUN, staging NOT ACCEPTED, production NO-GO. Task 6 and F04 remain incomplete.

## Task 6 attempt08 partial Chromium results

After complete backend oracle identifier review and new explicit Owner authorization, candidate `web6-20261110-8599b4e1` pinned backend `6988a81af82e8b625b6a8806eccb1186653ffc51` / tree `19a6d0af541c263c554fee3f3b6bd193f87fee9c` and frontend source `13179f56a3381275c0652f6edaf29258f18927f2` / tree `f493e5911494a3eb4361397e3c65c72ae37b87e9`. Evidence head `1477a3981ae50fe838897723811c068f9cdfbb15` did not retarget the source. Four read-only Edge observations over 30.2615712 seconds matched identity/version `157.0.4341.46`/SHA-256 `3e2c8557b5ca4d78868d3089346146ceab94f198ce3d58526ce8f6c8d4b4167c`. Full existing Node/npm identity/hash/protected ACL/no-link checks covered 2,337 files/572 directories before root creation. No lock/copy/updater change, installation or global mutation was introduced.

A fresh bounded effective-master query preceded new private roots and independent four-field `web6-cutover` SQL approval. Windows PowerShell/net48 protected create-new publication, exact current-user-only ACL/schema/digest/server binding and eight-hour expiry `2026-11-10T18:01:27Z` passed. Old protected payloads and SQL/runtime resources were not read, copied, reused or adopted. Authorize once exited 0. Prepare once (`10:01:49.5610960Z`–`10:05:50.7430489Z`) passed `PIN_MATCHED`; independent checks confirmed ordinary null candidate ID/OFF, exact candidate marker, all ten dist/wwwroot files equal, clean detached pins and no pre-run live allocation.

| Artifact or receipt | SHA-256 |
|---|---|
| Ordinary dist / manifest | `5c7908157609e24760dcab5da26b170f5194f1918f2343f80aa164aab0ef59ab` / `796d86094b6cfd29efa1d99aac49bd9fd10bb80c73b71d0164d853e74485ef53` |
| Candidate dist / manifest | `10e7b0f6a7fd3b67e177d1aad3cb1f0a440c915d8ab86ad1620a45ec089c1810` / `f0766d264a4f2dd2cb5eee559f82b6a04414cbdb3ef334f4f780b4ae485d311f` |
| Current backend publish | `d05d5d4a883682652224381afbcee2f9f9d3fd86c371838e4828de487967883e` |
| Prepared / terminal receipt | `cf9efc189f94b5312e1213ee8513166e6b808257e5dbb7dc103e7001c8d614df` / `59be45ab81cc586cc26fe9f7d5c27b537a34bc2d5cfb20b05fc53c5ed71a9a45` |
| Chromium wrapper TRX | `2fae55db35e77ede055a413fd65d01f2eb95d253a0280dde3c1594c329b65a54` |

Run began `10:05:51.9539903Z`, 1.211 seconds after prepare, and ended `10:08:20.6681532Z`, exit 5 `FailedRetained`. IIS Express and Chromium launched. Exact .NET wrapper counts and later gates:

| Live gate | Discovered / executed / passed / failed / skipped | Disposition |
|---|---:|---|
| Chromium pair | 1 / 1 / 0 / 1 / 0 | FAIL / FailedRetained |
| Edge pair | 0 / 0 / 0 / 0 / 0 | NOT RUN |
| Cutover | 0 / 0 / 0 / 0 / 0 | NOT RUN |
| Workload | 0 / 0 / 0 / 0 / 0 | NOT RUN / NOT MEASURED |
| Recovery | 0 / 0 / 0 / 0 / 0 | NOT RUN / NOT MEASURED |

Nested Playwright selected three tests using one worker: **2 passed, 1 failed, 0 did not run**, 50.5 seconds; the reporter also recorded one error outside a test. The six-operation explicit-consent test and committed-response-loss test passed. The third two-tab/candidate/grant/HTTP test failed with `Owned WEB6 candidate control failed` at `Socket.fail`, spec line 62. Current TRX contains no SQL oracle exception. Partial nested results do not establish pair acceptance.

The shared failure callback handles timeout, socket error and EOF. The retained log identifies neither the event nor the control action. Source inspection shows a 10-second socket inactivity timeout while candidate-mismatch control can restart IIS Express with 10/20/45-second waits; switch timeout is only a hypothesis. Trace/video/screenshots were disabled. No action-specific diagnosis or full boundary PASS is claimed.

Terminal `processTreeDrained:true` still requires disposition proof; candidate records are `Chromium=Failed` and `Cleanup=Quarantined`. One SQL database/runtime login/control root, host-runtime/browser log and candidate/prepared evidence remain retained. Later live roots/native success envelopes are absent. No post-failure SQL query, manual cleanup, source fix, retry or historical-resource adoption occurred. Environment: Windows 11 Home x64 build 26300, SDK `8.0.427`, Node `22.14.0`, npm `11.6.0`, SQL `14.0.2140.2`, IIS Express `10.0.26013.1000`, Chromium `156.0.8078.4`, Edge `157.0.4341.46`.

No workload samples/percentiles, RPO/RTO, Task4 acceptance, final independent disposition or CandidateVerified exists. A reviewed control-boundary correction and new explicit Owner authorization are required before another fresh attempt. [Backend attempt08 evidence](https://github.com/chung6a8m/MyDmsVn/blob/codex/web6-b05-operations/docs/evidence/web6/20261110-b05b-paired-candidate.md#task-6-attempt08-partial-chromium-results-and-retained-quarantine) records ownership hashes; the link identifies a local update, not a claimed push/merge. Ordinary resend OFF, full IIS/unperformed Narrator NOT RUN, staging NOT ACCEPTED, production NO-GO. F04 and Task 6 remain incomplete.

## Task 6 attempt07 SQL oracle syntax failure

After review of the backend Sales header correction and new explicit Owner authorization, candidate `web6-20261110-dc006b02` pinned backend `0e090643e2d9de01bcbd98ae5dcfd08174b29216` / tree `94f931671c9829e8ffd21de209cfcbc8e385863a` and frontend `13179f56a3381275c0652f6edaf29258f18927f2` / tree `f493e5911494a3eb4361397e3c65c72ae37b87e9`. Evidence head `e5d0e51` did not retarget frontend source. Four read-only Edge observations over 30.12075 seconds matched file identity/version `157.0.4341.46`/SHA-256 `3e2c8557b5ca4d78868d3089346146ceab94f198ce3d58526ce8f6c8d4b4167c`; full Node/npm identity/hash/ACL/no-link checks covered 2,337 files/572 directories before root creation. No Edge lock/copy/updater change, installation or global mutation was introduced.

A new private root, independent four-field `web6-cutover` SQL approval, Owner authority and request were created with Windows PowerShell/net48 protected create-new publication. Exact ACL/schema/digest/effective-master binding passed; eight-hour expiry `2026-11-10T17:33:55Z`. Old protected payloads/SQL/runtime resources were not read, copied or adopted. Authorize once exited 0. Prepare once (`09:34:15.9965825Z`–`09:38:14.6366892Z`) passed `PIN_MATCHED`, ordinary null candidate ID/OFF, exact candidate marker and complete ten-file dist/wwwroot equality. SQL parent and live roots were empty/absent before run.

| Artifact or receipt | SHA-256 |
|---|---|
| Ordinary dist / manifest | `5c7908157609e24760dcab5da26b170f5194f1918f2343f80aa164aab0ef59ab` / `796d86094b6cfd29efa1d99aac49bd9fd10bb80c73b71d0164d853e74485ef53` |
| Candidate dist / manifest | `04b188b19d5a08da6a285462026d39afae37b3dea33b33f3a00b859ec126a49b` / `59401842df3caae60bcffa7c232c2efcb8b60d104f838a495965ecaee090fd69` |
| Current backend publish | `571d260988cafeddd970411118287c41eba7e9a432e823dcf6d97b2caf87dc2c` |
| Prepared / terminal receipt | `33d4e18dad8fb7e41a61e8cd9cec3bf0d994a39e2cd1cac1e38db987fa6f4dcd` / `c879eb79433a040230027eeeda2c8596ab4ff33a9830a8390fe5d7d14e70851d` |
| Chromium wrapper TRX | `7588786a4256faa148610e2e622adb7be92f77ae6d8fae34fed0d2040dc0c909` |

The single run began `09:38:15.8173560Z`, 1.181 seconds after prepare, and ended `09:39:55.2807593Z`, exit 5 `FailedRetained`. IIS Express/Chromium launched. The exact .NET wrapper result and later gates are:

| Live gate | Discovered / executed / passed / failed / skipped | Disposition |
|---|---:|---|
| Chromium pair | 1 / 1 / 0 / 1 / 0 | FAIL / FailedRetained |
| Edge pair | 0 / 0 / 0 / 0 / 0 | NOT RUN |
| Cutover | 0 / 0 / 0 / 0 / 0 | NOT RUN |
| Workload | 0 / 0 / 0 / 0 / 0 | NOT RUN / NOT MEASURED |
| Recovery | 0 / 0 / 0 / 0 / 0 | NOT RUN / NOT MEASURED |

Nested Chromium Playwright selected three tests using one worker: **0 passed, 1 failed, 2 did not run**. The first six-operation case reported `Owned WEB6 candidate control failed`; backend control drain surfaced `Incorrect syntax near the keyword 'LineNo'` from `Web6CandidateOracle.VerifyResultProjection:313`. Sales and Receipt line queries use unquoted `LineNo` in projection/order clauses, while migration declares `[LineNo]`. The reviewed `SaleNo AS SaleNumber` header correction is present; this separate syntax defect remains unfixed. Full six-command/SQL projection verification did not complete; retained SQL may contain committed test effects.

Terminal `processTreeDrained:true` still requires disposition proof; candidate records are `Chromium=Failed`, `Cleanup=Quarantined`. One owned SQL database/runtime login/control root, host-runtime/browser log, candidate and prepared evidence remain retained. No post-failure SQL query, manual cleanup, source fix, retry or historical-resource adoption occurred. Prepared environment: Windows 11 Home x64 build 26300, SDK `8.0.427`, Node `22.14.0`, npm `11.6.0`, SQL `14.0.2140.2`, IIS Express `10.0.26013.1000`, Chromium `156.0.8078.4`, Edge `157.0.4341.46`.

There are no workload samples/percentiles, RPO/RTO, Task4 acceptance, final independent disposition or CandidateVerified. A reviewed oracle SQL correction plus new explicit Owner authorization is required before another fresh attempt. [Backend attempt07 evidence](https://github.com/chung6a8m/MyDmsVn/blob/codex/web6-b05-operations/docs/evidence/web6/20261110-b05b-paired-candidate.md#task-6-attempt07-sql-syntax-failure-and-retained-quarantine) records exact ownership hashes; this link identifies a local update, not a claimed push/merge. Ordinary resend OFF, full IIS/unperformed Narrator NOT RUN, staging NOT ACCEPTED, production NO-GO. F04 and Task 6 remain incomplete.

## Task 6 attempt06 Chromium control failure

The Owner authorized one new attempt after four read-only Edge observations over 30.057 seconds, before any new authority/root/approval. All observations matched version `157.0.4341.46` and SHA-256 `3e2c8557b5ca4d78868d3089346146ceab94f198ce3d58526ce8f6c8d4b4167c`; no custom locking, copying, installation or updater-policy change was used. Candidate `web6-20261110-2f863589` pinned backend source `914b2196d41999f6f465ae076e4fcbe4ef524a87` / tree `62632251fb124f85769edde70fd7dd8e688f1051` and frontend source `13179f56a3381275c0652f6edaf29258f18927f2` / tree `f493e5911494a3eb4361397e3c65c72ae37b87e9`. Evidence-only heads `10b86e0` / `5fe3687` did not retarget the candidate.

New SQL approval, Owner authority, request and roots were created using existing Windows PowerShell and the repository protected create-new writer. Exact `web6-cutover` schema/current-user ACL and fresh effective-master binding passed; expiry `2026-11-10T16:34:31Z` was eight hours. Old request/approval/receipt payloads and SQL/runtime resources were not read or reused. The separately located private Node `22.14.0` / npm `11.6.0` tree passed complete 2,337-file/572-directory hash/identity/ACL/no-link revalidation.

Authorize and prepare each ran once and exited 0. Prepare at `08:35:39.5417017Z`–`08:38:22.7524325Z` returned `PIN_MATCHED`; ordinary candidate ID remained null/OFF and all ten dist files matched the complete published wwwroot. SQL parent was empty/live roots absent before run. The single run started 0.888 seconds later, at `08:38:23.6408738Z`, and ended `08:39:42.2459671Z`, exit 5 `FailedRetained`.

| Artifact or receipt | SHA-256 |
|---|---|
| Ordinary dist / manifest | `5c7908157609e24760dcab5da26b170f5194f1918f2343f80aa164aab0ef59ab` / `796d86094b6cfd29efa1d99aac49bd9fd10bb80c73b71d0164d853e74485ef53` |
| Candidate dist / manifest | `ba2b3f9eeef21f37f84835d5d5044a7c68b5c5680a1eb3e44cd89d321bd5c088` / `74bc0bb59e0c8fd26694b66cc7ee238a075456cf62d46b7a51d138ff865b795e` |
| Current backend publish | `29c8a620f5443c6fecbfca9f099be28dfd98de533ac3453a84bdaa250cb30ba0` |
| Prepared / terminal receipt | `0b953a41bbbcf2e6be81e7b0f78ab92edf3c251f8b203a40f66ca6d9782b0850` / `cdb76de3ec813e5106512f2872e46e5e85c1538117a4eb0de3599ee4a57bbe0b` |
| Chromium wrapper TRX | `fe88167ea57a72171888c96c5bb11ec304d70c8c494486956e710983f98a61c5` |

| Live gate | Discovered / executed / passed / failed / skipped | Disposition |
|---|---:|---|
| Chromium pair | 1 / 1 / 0 / 1 / 0 | FAIL / FailedRetained |
| Edge pair | 0 / 0 / 0 / 0 / 0 | NOT RUN |
| Cutover | 0 / 0 / 0 / 0 / 0 | NOT RUN |
| Workload | 0 / 0 / 0 / 0 / 0 | NOT RUN / NOT MEASURED |
| Recovery | 0 / 0 / 0 / 0 / 0 | NOT RUN / NOT MEASURED |

IIS Express and Chromium launched. Nested Playwright selected three tests using one worker: **0 passed, 1 failed, 2 did not run**, distinct from the single .NET wrapper result. The first six-operation case failed `Owned WEB6 candidate control failed`; backend control drain surfaced `Invalid column name 'SaleNumber'` from `Web6CandidateOracle.VerifyResultProjection`. Its SQL query names `SaleNumber` directly, while the checked-in migration/mapping uses `SaleNo`. The source mismatch is diagnosed but not repaired in this evidence task. Six-command completion and full physical SQL projection are unverified; retained SQL may contain committed test writes.

The terminal receipt reports process-tree drain and requires disposition proof; candidate records are `Chromium=Failed`, `Cleanup=Quarantined`. One newly allocated SQL database/runtime login, SQL control root, host-runtime/browser log and candidate/prepared evidence remain retained under the private receipt. No manual cleanup, SQL post-failure query, retry or historical-resource adoption occurred; no accepted final disposition exists. Prepared environment: Windows 11 Home x64 build 26300, SDK `8.0.427`, SQL `14.0.2140.2`, IIS Express `10.0.26013.1000`, Chromium `156.0.8078.4`, Edge `157.0.4341.46`.

All later gates are NOT RUN. There are no workload class samples/percentiles, observed RPO/RTO, Task4 acceptance or CandidateVerified. A future attempt requires a reviewed source correction and new explicit Owner authorization with a fresh candidate/root/SQL approval chain. [Backend attempt06 evidence](https://github.com/chung6a8m/MyDmsVn/blob/codex/web6-b05-operations/docs/evidence/web6/20261110-b05b-paired-candidate.md#task-6-attempt06-chromium-failure-and-retained-quarantine) contains the exact ownership/disposition hashes; this branch link identifies the local update, not a claimed push/merge. Ordinary resend OFF; full IIS/unperformed Narrator NOT RUN, staging NOT ACCEPTED, production NO-GO. F04 and Task 6 remain incomplete.

## Task 6 attempt05 prepared candidate and tool-pin refusal

New explicit Owner authorization selected candidate `web6-20261110-300ef832` after the backend source-admission correction. Executable source pins: backend `914b2196d41999f6f465ae076e4fcbe4ef524a87` / tree `62632251fb124f85769edde70fd7dd8e688f1051`, frontend `13179f56a3381275c0652f6edaf29258f18927f2` / tree `f493e5911494a3eb4361397e3c65c72ae37b87e9`. The controller explicitly distinguished frontend evidence head `cdae4f43cea5a06ea15b5b119622888dbc1faac6` from that exact executable pin; prepare created fresh clean detached worktrees and no pin guard changed.

Fresh roots, SQL approval, Owner authority and request were created. The SQL approval was independently bound to the designated effective master/server, with exact four-field `web6-cutover` schema, current-user-only protected ACL and eight-hour expiry `2026-11-10T16:14:46Z`; no previous approval/payload was copied or reused. The approved existing private Node `22.14.0` / npm `11.6.0` tree was independently revalidated across 2,337 files/572 directories for hashes, identity, ACL and no links. An issuance-only PowerShell 7/net48 ACL-API failure is retained separately; the controller approved a new root using existing Windows PowerShell before any authorize/prepare/run. No source/global/browser configuration change occurred.

Authorize ran once, exit 0. Prepare ran once, `08:15:31.8016884Z`–`08:18:21.2920865Z`, exit 0, `PIN_MATCHED`. Ordinary artifact has null candidate ID and remains OFF. All ten candidate dist files independently match the complete published wwwroot. Before run, the SQL parent was empty and all live roots absent.

| Artifact or receipt | SHA-256 |
|---|---|
| Ordinary dist / manifest | `5c7908157609e24760dcab5da26b170f5194f1918f2343f80aa164aab0ef59ab` / `796d86094b6cfd29efa1d99aac49bd9fd10bb80c73b71d0164d853e74485ef53` |
| Candidate dist / manifest | `bc8efce84e631b52fb4eace9bf42ee8f47414b1577b5cbf4f1926d6d55e190a9` / `ea0dfa8bb3b1385aae5ae8c96355b16277012bb5ea6722030bb0a873314224d2` |
| Current backend publish | `69a337871d09b214cfec188173b38b164ace51b570d3f0c666e0b340e7f5abc0` |
| Prepared receipt | `25323e16d014875c8b8e8617749028c05a6d407153f4c7d98fbd184b57b1d042` |
| BlockedNoAllocation receipt | `5066422846b7aff633a0cac7093a564816745d689ab2e872d4ad94aacb991844` |

The single run ended exit 4 at `08:18:40.9365692Z`, less than one second after invocation. Read-only diagnosis found seven of eight tool hashes matching but installed Edge changed from prepared `157.0.4341.42` / SHA-256 `d258e512aa24947cfbef0c0033d8c3cd56ecb40f7b2ad59802fa75c4e4f3324d` to observed `157.0.4341.46` / `3e2c8557b5ca4d78868d3089346146ceab94f198ce3d58526ce8f6c8d4b4167c`. The preselector tool-pin check refused this change. The agent did not update Edge; the responsible external actor was not established. Other prepared inputs: Windows 11 Home x64 build 26300, SDK `8.0.427`, SQL `14.0.2140.2`, IIS Express `10.0.26013.1000`, Chromium `156.0.8078.4`.

| Live gate | Discovered / executed / passed / failed / skipped | Disposition |
|---|---:|---|
| Chromium pair | 0 / 0 / 0 / 0 / 0 | NOT RUN |
| Edge pair | 0 / 0 / 0 / 0 / 0 | NOT RUN |
| Cutover | 0 / 0 / 0 / 0 / 0 | NOT RUN |
| Workload | 0 / 0 / 0 / 0 / 0 | NOT RUN / NOT MEASURED |
| Recovery | 0 / 0 / 0 / 0 / 0 | NOT RUN / NOT MEASURED |

The terminal receipt has no selector/TRX. No new SQL database/login, host-runtime, IIS queue/process or browser context was allocated; SQL parent and evidence directory remain empty and live roots absent. Authorities, prepared worktrees/artifacts and receipts are retained. No run retry, receipt alteration, cleanup or adoption of historical resources occurred; attempt04 SQL/host-runtime remains untouched. There are no workload class samples/percentiles, observed RPO/RTO, Task4 acceptance, final independent disposition or CandidateVerified. A future attempt needs new explicit Owner authorization and a fresh approval/candidate/root chain with independently revalidated inputs. See [backend attempt05 evidence](https://github.com/chung6a8m/MyDmsVn/blob/codex/web6-b05-operations/docs/evidence/web6/20261110-b05b-paired-candidate.md#task-6-attempt05-prepared-then-blockednoallocation); the branch link identifies the pending local documentation update, not a claimed push/merge. Ordinary resend OFF; full IIS/unperformed Narrator NOT RUN, staging NOT ACCEPTED, production NO-GO. F04 and Task 6 remain incomplete.

Fresh pure verification at frontend evidence head `cdae4f4`: `npm.cmd run typecheck` PASS; `npm.cmd run test:unit` **81 files / 1,558 tests** PASS, zero failures. Backend `914b2196` reported Application **363**, HttpHost **635**, bootstrap plus source-admission **240** passing tests with zero failed/skipped and SQL variables removed from test children. These results provide no live pair/workload/recovery acceptance.

## Task 6 attempt04 prepared candidate and retained failure

Candidate `web6-20261110-182d4285` pinned frontend `13179f56a3381275c0652f6edaf29258f18927f2` (tree `f493e5911494a3eb4361397e3c65c72ae37b87e9`) and backend `18672300d642eef7944fbd540a42b3654783ba5b` (tree `f6a790770454112a27692220d359aef5e6e483c4`). These reviewed changes resolved the earlier held-parent hard-link publication error by streaming canonical UTF-8 manifest bytes to the backend's protected create-new writer. Prior attempts and artifacts were preserved unchanged.

The fresh Owner authority/request and revalidated independent protected SQL approval used new attempt04 roots. Existing private Node `22.14.0` / npm `11.6.0` copies were fully revalidated (2,337 files, tool-tree SHA-256 `c55ed76c2333bcb335b2327f639195464c2ed7685b329da812f02c85bed29529`); no install/global mutation or legacy-approval alteration occurred. Environment: Windows 11 Home x64 build 26300, backend SDK `8.0.427`, IIS Express `10.0.26013.1000`, SQL `14.0.2140.2`; prepared browser binaries Chromium `156.0.8078.4`, Edge `157.0.4341.42`.

Authorize exited 0. Prepare ran once and exited 0, `PREPARED / PIN_MATCHED`, at `2026-11-10T07:34:39Z`. Ordinary marker had `candidateId:null` (OFF); candidate marker exactly matched the ID above. Every one of the ten candidate dist files matched the complete published `wwwroot` file set. This is artifact/preparation proof, not browser acceptance.

| Artifact/receipt | SHA-256 |
|---|---|
| Prepared | `0a7376b0175c9e5fc1fa0fac254a9edeb2c3ca7b3293e83089ad4d9579e28c93` |
| Ordinary dist / manifest | `5c7908157609e24760dcab5da26b170f5194f1918f2343f80aa164aab0ef59ab` / `796d86094b6cfd29efa1d99aac49bd9fd10bb80c73b71d0164d853e74485ef53` |
| Candidate dist / manifest | `6efbddbe9391ade739710512e19423e6117e2183d99360f50641026dd0d7c9bf` / `bba31a3da72df6932133bd282dca9508330422bd13d896631a7a794dac4e71c5` |
| Backend current publish | `c7b2ba4ea6fbe186f97a834c0edb8d02d25fcdf216f07dd61216ba0b95b3491d` |
| FailedRetained terminal receipt | `07b1fa91391a2177aa6dfd81fa54df928b0f19cd1fea12ce5e7e2376f859c8a7` |
| Chromium selector TRX | `54bdb2ebe299cb65d36101046a92508292748af5c63b2dc772ee13a8154f4eae` |

The orchestrator ran exactly once (`07:35:43Z`–`07:36:27Z`) and exited 5. Its first Chromium .NET selector discovered/executed 1 row: **0 passed / 1 failed / 0 skipped**. `FileNotFoundException: CleanArchitecture.sln` occurred after owned database/runtime-login setup and host configuration, before IIS/browser launch; the backend repository uses `MyDmsVn.sln`. Native Chromium/IndexedDB cases were NOT RUN. Edge, cutover, workload and recovery each had 0 discovered/executed/pass/fail/skip because orchestration stopped; none is PASS.

One owned SQL database, one runtime login, private SQL control and host-runtime configuration are retained with original allocation evidence. Read-only identity/token observation confirmed that exact retained allocation; it supplied no deletion authority. The terminal receipt says `processTreeDrained=true` and `requiresDispositionProof=true`; no cleanup, retry, accepted Task4 receipt, final independent disposition or CandidateVerified is claimed. There are no workload samples, percentiles or recovery RPO/RTO.

Attempt01's legacy-authority refusal, attempt02's adjacent-npm mismatch and attempt03's held-parent publication failure remain historical retained attempts; later preparation success does not erase them. A further live attempt requires a reviewed backend source fix and **new explicit Owner authorization**, then fresh roots/authority/request. Ordinary resend remains OFF; the candidate artifact was not admitted as a pilot. Full IIS/unperformed Narrator remain NOT RUN within bounded exceptions; staging NOT ACCEPTED, production NO-GO. See backend [attempt04 evidence](https://github.com/chung6a8m/MyDmsVn/blob/codex/web6-b05-operations/docs/evidence/web6/20261110-b05b-paired-candidate.md#task-6-attempt04-prepared-then-failedretained) and [runbook](https://github.com/chung6a8m/MyDmsVn/blob/codex/web6-b05-operations/docs/development/WEB6_CANDIDATE_RUNBOOK.md#attempt04-terminal-boundary). These branch links identify the pending documentation update; no push or merge is claimed.

Fresh requested pure checks after the attempt: frontend `13179f5` typecheck PASS and unit **81 files / 1,558 tests PASS**, zero failures. Backend `1867230` Application **363/363**, HttpHost **635/635** and four bootstrap Security classes **227/227** passed with zero failures/skips and SQL configuration removed from those test children. These source checks are separate from native browser/SQL acceptance. No live selector was rerun.

## Task 6 controlled bootstrap checkpoint

**Attempt01 history; the latest disposition is attempt21 above.**

Frontend source `5f7c0051497e8631925b68127ff556d2d066cd5c`, tree `158c5ec562b8bf66e7be3ea8db41cbae32b7e5c2`, was clean and detached. Paired backend source `9351942bd7c144f0f221b2cc4c78577c5f4d92f4`, tree `270455fa95a309fe705248665f8739d13c030c59`, supplied the new bootstrap. Candidate `web6-20261110-25a1cf46` / `attempt01` ran at `2026-11-10T05:01:14Z` under explicit nonproduction drill authority. Authorize passed (exit 0); prepare refused (exit 4, `BLOCKED_PREFLIGHT`) before artifact preparation or any live selector.

The designated legacy SQL approval had an unprotected inherited DACL, including modification rights for another principal; its schema also differs from the required WEB6 approval. Its original bytes and ACL were kept unchanged. No copy, ACL repair, derived authority or replacement was created. The backend's read-only diagnostic confirmed `protected-sql-approval-read` refusal after authority/request/tool/certificate binding. A separately issued protected SQL approval is required under the backend runbook before a new attempt. Existing historical quarantines and failed-attempt resources were untouched.

Protected Owner authority SHA-256: `628f0795fc78212697f293a08d45bd5ffd07b6531cc597504da083a05ff49085`. Strict request SHA-256: `66fb71c14d5842173afdefe64b6c4f0a3d5d9eb7d449064927acb3e8fe6f7bfa`. Private attempt summary SHA-256: `d30cfc8cfb72d498585d511c78a188f5e55d73f6d30ea492f6ea9e0ef8281080`. Private identifiers, credentials and raw logs are not committed.

| Fresh frontend gate at the source pin | Result |
|---|---|
| `npm.cmd run typecheck` | PASS |
| `npm.cmd run test:unit` | 81 files / 1,552 tests passed, 0 failed |
| Candidate/ordinary artifact preparation for this attempt | NOT RUN; no new dist/publish hashes or fresh ordinary-artifact OFF proof |
| Live Chromium pair | 0 discovered/executed/passed/failed/skipped; NOT RUN |
| Live Edge pair | 0 discovered/executed/passed/failed/skipped; NOT RUN |
| Live cutover / workload / recovery | Each 0 discovered/executed/passed/failed/skipped; NOT RUN |

Node `22.14.0`, npm `11.6.0`, Windows 11 Home x64 build 26300. Backend fresh pure gates passed Application 363/363, HttpHost 635/635 and bootstrap-focused Security 218/218, each zero failed/skipped, with SQL configuration removed from those test children. These counts are separate from browser tests and provide no SQL/IndexedDB-native acceptance.

The task root was never created and the new SQL control parent remained empty. No live SQL/IIS/browser allocation, physical business oracle, workload sample, RPO/RTO measurement, Prepared receipt or CandidateVerified receipt exists for this attempt. New private authority/request/diagnostic records and empty parent directories were retained. No roadmap status advances; Task 6 remains open. Ordinary resend remains OFF in source and no candidate artifact was admitted. Full IIS/unperformed Narrator remain NOT RUN within their bounded exceptions; staging NOT ACCEPTED, production NO-GO. See the backend [candidate runbook](https://github.com/chung6a8m/MyDmsVn/blob/codex/web6-b05-operations/docs/development/WEB6_CANDIDATE_RUNBOOK.md#7-controlled-bootstrap-and-protected-sql-approval) and [paired evidence](https://github.com/chung6a8m/MyDmsVn/blob/codex/web6-b05-operations/docs/evidence/web6/20261110-b05b-paired-candidate.md#task-6-controlled-bootstrap-attempt) for the exact remediation contract. The branch links identify the pending documentation update; no push or merge is claimed here.

## Frontend gates at `9eb7d37`

Windows, Node `22.14.0`, npm `11.6.0`, Playwright `1.64.1`. Commands ran serially in the isolated frontend worktree.

| Gate | Result |
|---|---|
| `npm.cmd ci` | PASS; 419 packages added, 420 audited; 6 advisories retained (2 low, 4 moderate), no package mutation. |
| `npm.cmd run typecheck` | PASS. |
| `npm.cmd run test:unit` | PASS; 80 files, 1,517 tests, 0 failed. |
| Ordinary `npm.cmd run build` | PASS; 2,579 modules; ordinary resend OFF. Existing chunk warning: main JS 2,419.79 kB / 680.28 kB gzip. |
| Ordinary production Playwright, one worker | PASS; 2 discovered/executed/passed, 0 failed/skipped/retried. These are artifact-isolation/default-OFF tests with controlled browser routes, not the live pilot pack. |
| Ordinary `dist` deterministic tree digest | `b2422fdce8d0b8645a3f6213952ce2b4c6bff288c0c8a217ed655b70be93ce88`. This is not a candidate-enabled artifact hash. |

No scenario-row count is added to the browser-test count. The three cutover specs and three manual-resend specs were statically discovered during implementation, but were not executed against the backend candidate and therefore are not PASS evidence.

## Backend-linked quality disposition

- Backend workload code requires all six mutation classes and four supporting classes, bounded attempts toward 1,000 observations/class, p50/p95/p99, error/timeout/CPU/RAM/SQL lock/session/journal measurements, PR #95 re-admission and no retry. The exact selector was BLOCKED before allocation, so `F6-LOAD-01` is **NOT RUN / NOT MEASURED** and no percentile, throughput, capacity or SLA statement exists.
- Backend recovery code implements a real source-host interruption, protected backup into a distinct owned restore, epoch/principal rotation, Task2/PR #95 admission, stale 409 zero-effect checks, authenticated HTTP Sales Create/Update/Post and a full physical oracle. The exact selector lacked the accepted Task4 receipt and complete candidate inputs, so `F6-REC-01` is **BLOCKED / NOT RUN** and no RPO/RTO value is claimed.
- Backend verification retained failed attempts and owned resources when cleanup certainty was absent, including two fresh SQL runs from an initial permission-preflight defect. Later fresh green tests do not erase or authorize cleanup of those retained runs.
- A full backend Security project PASS is not claimed: an earlier overlapping destructive-suite attempt was aborted and later scoped affected gates were used. Frontend regression PASS cannot replace backend SQL/IIS/browser acceptance.

Ordinary manual resend remains OFF. Pilot enablement requires a separately accepted live pair and explicit Owner decision. Staging remains NOT ACCEPTED; production remains NO-GO / DEFERRED.
