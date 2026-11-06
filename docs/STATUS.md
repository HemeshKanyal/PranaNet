# Final status (Fri 6 Nov 2026, ~19:00 IST)

Tests at this commit: contracts **51/51** (incl. fork tests against live ENSv2 on Sepolia), relayer **32/32**, verifier **14/14**, api **4/4**, agent **3/3**.

## SPEC scope

| Scope item | Priority | Status | Proof |
|---|---|---|---|
| One device signing → relayer → Sepolia, verified by ecrecover | Must | **Done** | Device selftest byte-identical to viem on all three boards ([S3](evidence/device2-selftest.md), [classic ×2](evidence/classic-boards-selftest.md)); live `ReadingAccepted` ([v1](https://sepolia.etherscan.io/tx/0xc8148daac8a630c55c8257220ec33b55f3b5172bc8295a80266a487db39b5c94)); both boards posting to the Render relayer every minute; `Readings.t.sol`, `Vector.t.sol`, `test/vector.test.ts` |
| Raw readings on Arkiv, read by the dashboard | Must | **Done** | Every reading is a `prananet.reading` entity from writer `0x3a1F…CCa67`; web record view reads Arkiv and re-verifies the signature (checked in Chrome); `relayer/scripts/arkiv-query.ts` reads the same data directly |
| Live dashboard with map and chart, deployed to Vercel | Must | **Partial** | `web/` works against the live Render relayer (map, device list, device page with live chart, Arkiv record view, register flow — all checked in Chrome). **Not yet deployed to Vercel**: Arpan's step, env vars listed in the README |
| Fake-key reading rejected | Must | **Done** | `fake-reading` on Sepolia: relayer 401 `bad_signature` + [on-chain `InvalidSignature` revert](https://sepolia.etherscan.io/tx/0x258afb1976c2169dedd227210b74024dc3cb7d1a21c3968141592cd432088c50); intake tests |
| World ID registration with a 3-device cap | Must | **Done** | Simulator: bkc-01, bkc-02, bkc-test-01 from one human, 4th rejected `max_devices`; `devicesPerNullifier = 3` on-chain ([evidence](evidence/m3-worldid-ens.md), GIF); `register.test.ts` |
| ENSv2 subname per device with geohash, revoked on slash | Must | **Done, with a caveat** | Names resolve via UniversalResolverV2 (addr + `geohash` = `te7u6n`); DeviceNamer fork tests. In the live M4 slash the in-tx revoke ran out of gas (`NameRevokeFailed`, gas estimation under try/catch); fixed (verifier sends `flag()` with 1.2M gas), bkc-02 revoked with `ens-revoke.sh`, and a Sepolia-fork replay revokes inside the slash tx. The next live slash is the definitive check ([evidence](evidence/m4-slash.md)) |
| Neighbour cross-check, flagging and slashing | Must | **Done** | Live M4: tissue on device 2 → 3 `neighbour_outlier` flags → `DeviceSlashed`, 0.01 ETH stake → RewardPool, status `slashed` on the relayer + WS ([evidence](evidence/m4-slash.md)); `crosscheck.test.ts`, `loop.test.ts`, `RegistryFlag.t.sol` |
| Second real device | Nice | **Done** | Device 1 `bkc-01.prananet.eth` (DHT22: ~22 °C / 70 %) live alongside device 2 / bkc-02b |
| x402 data API and paying agent on Hedera | Nice | **Done** | 5 settled payments via the x402.org facilitator, e.g. [`0.0.9185802@1793964343.612274191`](https://hashscan.io/testnet/transaction/0.0.9185802@1793964343.612274191); budget cap refused a payment ([evidence](evidence/m5-x402-hedera.md)); API live at https://prananet-api.onrender.com |
| x402 revenue funds the pool; honest operator claims | Nice | **Done** | Bridge (mirror-node verified): [fundPool 0.00003 ETH](https://sepolia.etherscan.io/tx/0xf07a43f1c284ebaa4253857e877270553aca1bdcbfc41003b1f0e20f4818ba26) + [0.00002 ETH](https://sepolia.etherscan.io/tx/0xafd3678ec71e9075f65bde14a7076ce0e40ceb4d18559b89286a48d8fb7e8ac6); bkc-01 [claimed 0.00034 ETH](https://sepolia.etherscan.io/tx/0x8cf249fffd0d3c0738619ce9dfc23fb59b0091489a296581a3cfcba29fd5f55d); slashed bkc-02 [claim reverted](https://sepolia.etherscan.io/tx/0xafe8f405870515ca954410ad34f782667a76a781673d7cfc9609849e774cc580) |
| HCS topic logging each agent purchase | Nice | **Done** | [Topic 0.0.11338299](https://hashscan.io/testnet/topic/0.0.11338299), one message per purchase |
| Official station comparison | Nice | **Done** | OpenAQ v3, nearest reference monitor BKC MPCB 0.5 km from te7u6n, refreshed every 10 min and attached to every cell; looser station-outlier rule (test: "station outlier when there are too few peers"); used to calibrate both boards (`cal`) |

## Other deliverables

| Item | Status |
|---|---|
| Stable URLs through judging | **Done**: Render (relayer, verifier, api; free plan, kept awake). Free-plan instance hours are shared with the workspace's other services: fine for a day, upgrade to Starter for longer |
| Repeatable slash demo | **Done**: `newkey` firmware command + `npm run demo-reset` (tested once → bkc-02b) |
| Write-ups | **Done**: arkiv/{schema, why-arkiv, how-you-use-arkiv, reach, friction}.md, docs/DEBRIEFS.md (World ID), README |
| Arkiv tGLM runway | **Watch**: ~0.00019 tGLM/write, ~1.9 tGLM/day; 1.94 tGLM left at 18:30 → lasts into Saturday morning; top up from the faucet before judging to be safe |

## Known limitations (honest list)
- The Sharp sensor is a PM proxy; values are tied to the reference station with a one-point calibration at boot, not a lab calibration.
- World ID runs on staging (simulator); production needs a production action and real Orb users.
- The HBAR → Sepolia ETH bridge is an operator relay at a fixed published rate (inputs verifiable on the mirror node), not a trustless bridge.
- Venue geohash `te7u6n` assumes the Jio World Convention Centre, BKC.
