# PranaNet

Air-quality data that holds up in a dispute: ESP32 sensors sign every reading, neighbours and official stations cross-check it, and cheaters lose stake.

Built at ETHGlobal Mumbai 2026 (Building from Scratch track). Full spec: [docs/SPEC.md](docs/SPEC.md) · team interfaces: [docs/TEAM.md](docs/TEAM.md) · final status: [docs/STATUS.md](docs/STATUS.md).

## Architecture

```
 ESP32 sensors (firmware/)                         World ID 4.0 (staging)      ENSv2 (Sepolia)
 key generated on-chip, signs                        │ proof                    <label>.prananet.eth
 keccak(264-byte reading) EIP-191                    ▼                          addr + geohash, revoked on slash
        │ POST /readings (HTTPS)        web/ register page ──POST /register──┐        ▲
        ▼                                                                   ▼        │
 ┌──────────────────────── relayer/ (Render) ─────────────────────────────────────────┐
 │ intake: ecrecover · registered? · active? · nonce  →  202                           │
 │   ├─ Arkiv (Rabdi): prananet.reading / device / flag entities (expiring)            │
 │   ├─ Sepolia: Readings.submitEpoch → ReadingAccepted   Registry.registerDevice ─────┘
 │   └─ WS /live, GET /devices…  ◀── web/ dashboard (map, device page, Arkiv record view)
 └──────────────▲──────────────────────────────────────────────────────────────────────┘
                │ readings in / simulated readings + flags out
 verifier/ (Render): neighbour median (SPEC rule) + OpenAQ station ──Registry.flag ×3──▶ slash:
                │ GET /cells/:geohash                     stake → RewardPool, device off, ENS revoked
 api/ (Render): GET /api/aqi  ── x402 on hedera:testnet (HBAR, x402.org facilitator)
                ▲ pays, budget cap                     │ revenue (mirror-node verified)
 agent/: discover → 402 → pay → HashScan → HCS log     └─ bridge → RewardPool.fundPool() → honest operators claimRewards()
```

## Live (Sepolia, Arkiv Rabdi, Hedera testnet, Render)

| What | Link |
|---|---|
| Website (story + live dashboard) | https://prananet.hemeshkanyal.com (story) · [/live](https://prananet.hemeshkanyal.com/live) · [/roadmap](https://prananet.hemeshkanyal.com/roadmap) · also https://prananet-pi.vercel.app |
| Relayer (stable URL) | https://prananet-relayer.onrender.com (`/health`, `/devices`, `wss://…/live`) |
| Verifier | https://prananet-verifier.onrender.com/cells/te7u6n |
| Paid data API (x402) | https://prananet-api.onrender.com/api/aqi?geohash=te7u6n · discovery `/.well-known/x402` |
| Registry | [0x729aec8c…9Cae](https://sepolia.etherscan.io/address/0x729aec8cAA594804BD66cF4B21d113dF9DBD9Cae#code) (verified) |
| Readings | [0x9192Fc05…01d8](https://sepolia.etherscan.io/address/0x9192Fc053e1493EB2B7355192aa3F8e57AAE01d8#code) (verified) |
| Stake | [0x838736B3…E8E2](https://sepolia.etherscan.io/address/0x838736B31aA2D67e32055A9b3C835e550d05E8E2#code) (verified) |
| RewardPool | [0x61EEB7a5…D901](https://sepolia.etherscan.io/address/0x61EEB7a5fadD850D4986f4656d4a28CfE59Ed901#code) (verified) |
| DeviceNamer (ENSv2) | [0xC53836B1…94fA](https://sepolia.etherscan.io/address/0xC53836B17b85c6329976e673c1385dbB590794fA#code) (verified) |
| prananet.eth | [register tx](https://sepolia.etherscan.io/tx/0x1e1df385c7d64a5837626a9855d701d1cf4ba8c16869afb146cebd9e0f14213e) · subname registry [0xb6C47798…8b63](https://sepolia.etherscan.io/address/0xb6C4779845D6d0875DC6F7BCF7C656990D1A8b63) · resolver [0x5d05e294…9dF3](https://sepolia.etherscan.io/address/0x5d05e294e7bee7CC8c86d05732CEB2FCE8789dF3) |
| **Arkiv writer wallet** (= relayer, also the Sepolia tx sender) | [0x3a1F21F1…CCa67 on Arkiv](https://rabdi.explorer.arkiv.network/address/0x3a1F21F1c6f05eFA35BB7178274b41C8873CCa67) · [on Sepolia](https://sepolia.etherscan.io/address/0x3a1F21F1c6f05eFA35BB7178274b41C8873CCa67) |
| Devices | `bkc-01.prananet.eth` (device 1, DHT22) · `bkc-02.prananet.eth` (device 2, **slashed** in M4) → re-registered as `bkc-02b.prananet.eth` · cell `te7u6n` (Jio World Centre, BKC) |
| Hedera | API revenue [0.0.11336714](https://hashscan.io/testnet/account/0.0.11336714) · agent [0.0.11338297](https://hashscan.io/testnet/account/0.0.11338297) · HCS purchase log [topic 0.0.11338299](https://hashscan.io/testnet/topic/0.0.11338299) |
| Settled x402 payment (Hedera tx id) | [`0.0.9185802@1793964343.612274191`](https://hashscan.io/testnet/transaction/0.0.9185802@1793964343.612274191) |
| Revenue → pool | [fundPool on Sepolia](https://sepolia.etherscan.io/tx/0xf07a43f1c284ebaa4253857e877270553aca1bdcbfc41003b1f0e20f4818ba26) |

Roadmap to a real network: [docs/ROADMAP.md](docs/ROADMAP.md).

Milestone evidence: [M1 device signing](docs/evidence/device2-selftest.md) · [classic boards selftest](docs/evidence/classic-boards-selftest.md) · [M3 World ID + ENS](docs/evidence/m3-worldid-ens.md) · [M4 slash + claims](docs/evidence/m4-slash.md) · [M5 x402 on Hedera](docs/evidence/m5-x402-hedera.md). The first M1 run used the v1 contracts in `contracts/deployments/sepolia-v1.json` ([ReadingAccepted](https://sepolia.etherscan.io/tx/0xc8148daac8a630c55c8257220ec33b55f3b5172bc8295a80266a487db39b5c94), [forged reading reverted](https://sepolia.etherscan.io/tx/0x258afb1976c2169dedd227210b74024dc3cb7d1a21c3968141592cd432088c50)).

### Query Arkiv yourself (no PranaNet server involved)

```bash
cd relayer && npm ci && npx tsx scripts/arkiv-query.ts te7u6n 10
```
Latest readings in the venue cell, written by `0x3a1F…CCa67` only, with each record's signature and explorer link, plus the latest flags. Schemas: [arkiv/schema.md](arkiv/schema.md) · [why Arkiv](arkiv/why-arkiv.md) · [how we use it](arkiv/how-you-use-arkiv.md) · [reach](arkiv/reach.md) · [friction log](arkiv/friction.md).

## Payment flow (x402 on Hedera → reward pool)

1. Agent reads `GET /.well-known/x402`, then calls `GET /api/aqi?geohash=te7u6n` → **402** with `PAYMENT-REQUIRED`: scheme `exact`, network `hedera:testnet`, asset `0.0.0` (HBAR), amount 10,000,000 tinybar (0.1 HBAR), `payTo` 0.0.11336714, `feePayer` 0.0.9185802 (the x402.org facilitator).
2. The agent's budget hook checks the price against a per-call cap and a hard total cap for the run, then `@x402/fetch` signs a Hedera transfer and retries with `PAYMENT-SIGNATURE`. No human approves anything.
3. The facilitator verifies and settles on Hedera; the API returns the verifier's cell object with `PAYMENT-RESPONSE` (the Hedera transaction id → HashScan link).
4. The agent appends `{resource, geohash, pm25, amount, tx}` to the HCS topic.
5. `cd api && npm run bridge`: lists every x402 settlement into `PAY_TO` from the Hedera mirror node (only transactions submitted by the facilitator count), converts at a fixed published testnet rate (1 HBAR = 0.0001 Sepolia ETH) and calls `RewardPool.fundPool()` once per batch. It's an operator relay (no trustless testnet bridge exists), but every input is re-checkable on the mirror node and every batch is recorded.
6. Honest operators call `RewardPool.claimRewards(device)`: 0.00001 ETH per accepted, unflagged epoch. A slashed device can't claim (`DeviceNotActive`), and its stake is already in the pool.

## Setup

Prerequisites: Node 24, Foundry (`~/.foundry/bin/forge` 1.8+), arduino-cli with the ESP32 core 3.3.12, Python 3 + pyserial, Docker (optional). Every service has a `.env.example` listing each variable; copy it to `.env` (never committed).

**Contracts** (`contracts/`)
```bash
forge test                            # 51 tests incl. fork tests against live ENSv2 (set SEPOLIA_RPC_URL)
./deploy.sh                           # deploy + verify on Etherscan, writes deployments/sepolia.json, exports abi/
./script/ens-setup.sh                 # register prananet.eth (MockUSDC), subname registry + resolver
```
Sepolia now charges ~7× forge's simulated gas for contract creation; `deploy.sh` applies `GAS_ESTIMATE_MULTIPLIER` (900).

**Firmware** (`firmware/prananet/`): both boards are classic ESP32 DevKit 30-pin (`esp32:esp32:esp32`), D25 = Sharp LED, D34 = Vo via 10k/22k; device 1 adds a DHT22 on D4.
```bash
cp secrets.example.h secrets.h        # Wi-Fi, RELAYER_URL, READINGS_ADDRESS, labels/geohash
arduino-cli compile --fqbn esp32:esp32:esp32 --build-property "compiler.cpp.extra_flags=-DDEVICE=1" .
arduino-cli upload  --fqbn esp32:esp32:esp32 -p $(python3 ../tools/serial_cmd.py --find 1) .
```
Serial commands: `addr`, `selftest` (check with `cd relayer && npm run verify-vector -- - < log`), `status`, `cal <µg/m³>` (one-point calibration against the nearest reference station), `newkey` (fresh key for re-registering after a slash). Ports can swap between the two CP2102 boards: always identify by `addr`.

**Relayer** (`relayer/`): `npm ci && npm test && npm start` (:8080). Details, tunnel and Docker: [relayer/README.md](relayer/README.md).
**Verifier** (`verifier/`): `npm ci && npm test && npm start` (:8081). Needs `RELAYER_URL`, `SIM_TOKEN` (same as the relayer's), `OPENAQ_API_KEY`, `VERIFIER_PRIVATE_KEY` (holds the Registry verifier role).
**Paid API** (`api/`): `npm ci && npm test && npm start` (:8082). `PAY_TO` (Hedera account), `VERIFIER_URL`; `npm run bridge` needs `TREASURY_PRIVATE_KEY`.
**Agent** (`agent/`): `npm ci && npm run setup` once (creates the agent account + HCS topic from `HEDERA_OPERATOR_ID/KEY`, sets the API's `PAY_TO`), then `npm start -- --times 2`. Caps: `BUDGET_TINYBAR`, `MAX_PER_CALL_TINYBAR`.
**Web** (`web/`, Arpan): `npm ci && npm run dev`; env in `web/.env.example` (`NEXT_PUBLIC_RELAYER_URL=https://prananet-relayer.onrender.com`, contract addresses, World ID app/RP).
**Hosting**: relayer, verifier and api run on Render from their Dockerfiles (`docker build -f <svc>/Dockerfile .` from the repo root); the relayer pings the other two every 5 min (`KEEPALIVE_URLS`).

## Demo script (≈4 min)

> **Keep the sensor clear whenever a board resets**: plugging it in, flashing, opening the serial port (it resets a classic ESP32), and `demo-reset`. The board measures its clean-air baseline for the first 10 s after boot. Remove tissue and wait for smoke or incense to clear first. Since prompt 04 the baseline can only move down and readings never go below it (no false zeros), but a dirty boot still under-reports until the air clears.

1. **Map** (`web/` → home): two real devices at the venue cell `te7u6n` next to 5 clearly labelled simulated neighbours; cell value ≈ the BKC reference station (OpenAQ, 0.5 km).
2. **Signed data**: open `bkc-01.prananet.eth` → live chart; open a record → "raw data on Arkiv": entity, writer wallet, expiry, the query, and the signature re-verified in the browser. Show `npx tsx scripts/arkiv-query.ts te7u6n` returning the same data from Arkiv directly.
3. **Forged reading**: `npm run fake-reading -- --device <addr> --relayer https://prananet-relayer.onrender.com` → relayer 401 and an on-chain `InvalidSignature` revert.
4. **Register with World ID**: `/register` → Verify with World ID → simulator → `bkc-0Nx.prananet.eth` minted with geohash; a 4th device from the same human → "already has 3 devices".
5. **Cheat and get slashed**: tissue or incense on device 2 → 3 neighbour-outlier flags appear live (WS) → `DeviceSlashed`: stake to the pool, status `slashed`, ENS name cleared (`prananet.status = slashed`).
6. **Agent pays**: `cd agent && npm start` → 402 → pays 0.1 HBAR → data + HashScan link → HCS message.
7. **Money flows to the honest**: `cd api && npm run bridge` → `fundPool`; `claimRewards(bkc-01)` pays; `claimRewards(bkc-02)` reverts `DeviceNotActive`.
8. **Reset for the next take** (sensor clear, see above): `cd relayer && npm run demo-reset` (new key on the board, next label, another simulator human, staked). Run `npm run demo-reset -- --warm` once well before.

## Layout

```
contracts/   Foundry: Registry, Readings, Stake, RewardPool, DeviceNamer (ENSv2); deploy + ENS scripts
firmware/    ESP32 (Arduino), one sketch with a DEVICE switch; tools/serial_cmd.py
relayer/     Node + TypeScript: intake, Arkiv writes, Sepolia tx queue, chain index, WS, World ID register
verifier/    cross-check job, simulated neighbours, OpenAQ, Registry.flag/clearFlags, GET /cells/:geohash
api/         x402 data API on hedera:testnet + revenue bridge to RewardPool
agent/       autonomous paying agent with a budget cap and HCS purchase log
web/         Next.js dashboard (map, device pages, Arkiv record view, register flow) — Arpan
arkiv/       schema, write-ups, friction log
docs/        SPEC, TEAM, STATUS, DEBRIEFS, AI usage logs, prompts, evidence
```

## Reused vs new

**Reused (before the event):**
- Hardware: both sensor devices (ESP32 DevKit boards, Sharp GP2Y1014AU0F dust sensors with 10k/22k dividers, one DHT22) were assembled and tested before hacking started. No firmware or software was carried over. (Device 2 was originally an ESP32-S3; it was swapped for a second DevKit during the event.)

**Libraries, SDKs and services:**
- Contracts: [Foundry](https://getfoundry.sh) + forge-std 1.17.0; ENSv2 contracts on Sepolia (called, not copied: ABIs from the verified sources)
- Firmware: Arduino-ESP32 core 3.3.12 and its bundled **mbedTLS 3.6** (secp256k1, RFC 6979 deterministic ECDSA, hardware MPI); Adafruit DHT sensor library 1.4.7. Keccak-256, recovery-id computation, low-s normalisation and the 264-byte packing are new
- Node: viem 2.57.13, @arkiv-network/sdk 1.0.1, ws 8.22.0, ngeohash, @x402/core, express, fetch, hedera 2.30.0, express 5.3.0, @hiero-ledger/sdk 2.90.1, playwright-core 1.65.0 (demo reset only), tsx, vitest
- Web (Arpan): Next.js 15, @worldcoin/idkit 4.6, Leaflet / react-leaflet
- Services: World ID Developer Portal + simulator, x402.org facilitator, OpenAQ v3, Alchemy (Sepolia RPC), Arkiv hub (access key, faucet), Render, Cloudflare quick tunnel (early testing)
- Verifier/api/agent scaffolds were started by Siddhartha and finished by Hemesh (see AI usage logs)

**New (written during the event):** everything else in this repo.

## AI use

Claude Code wrote most of the code under our direction; every prompt is saved verbatim in [docs/prompts/](docs/prompts/), and each person's per-task log is in [docs/AI-USAGE.md](docs/AI-USAGE.md) → `docs/ai-usage/<name>.md`. Sponsor debriefs: [docs/DEBRIEFS.md](docs/DEBRIEFS.md).

## License

MIT, see [LICENSE](LICENSE).
