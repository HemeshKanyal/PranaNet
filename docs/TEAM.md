# Team split and interfaces

Three people, three folders, one contract between them (this file). Nobody edits another person's folder. If someone gets stuck, their folder can be picked up on any laptop without touching the others.

| Owner | Folders | Builds | Milestones |
|---|---|---|---|
| **Hemesh** | `firmware/`, `contracts/`, `relayer/`, `arkiv/`, `docs/`, root files | Signing on ESP32, contracts, relayer (intake, Arkiv writes, Sepolia tx, World ID server check, ENS) | M1, M3 backend, M4 contracts |
| **Arpan** (arpan2006hub) | `web/` only | Next.js dashboard on Vercel: map by geohash, device page, live chart, Arkiv-backed view, register page with IDKit widget | M2, M3 frontend |
| **Siddhartha** (siddhartha7419) | `verifier/`, `api/`, `agent/` | Simulated neighbour devices, OpenAQ fetch, cross-check and flagging, x402 data API on Hedera, paying agent | M4 logic, M5 |

## Git rules (no conflicts)

1. Each person works on their own branch: `web`, `verifier`, `firmware` etc. Never commit to `main` directly except Hemesh.
2. Only touch your own folders. Each folder has its own `package.json` and lockfile; there is no root package.json.
3. Open a pull request into `main` at least every 2–3 hours. Hemesh merges. Small commits, clear messages.
4. Don't edit `docs/SPEC.md`, `docs/TEAM.md`, `README.md` or `.gitignore`. Ask Hemesh.
5. AI-use log: each person writes their own file, `docs/ai-usage/<name>.md` (one line per task: files, tool, what you directed). No shared log file.
6. Arkiv friction notes: write them in `docs/ai-usage/<name>.md` under a "Friction" heading; Hemesh merges them into `arkiv/friction.md`.
7. Never commit keys or `.env`. Commit `.env.example`.

## Until the real thing exists, use mocks

Nobody waits for anybody. Build against the shapes below with mock data, then switch an env var.

- `web/` reads `NEXT_PUBLIC_RELAYER_URL`. Until the relayer is live, serve `web/mocks/*.json` with the exact shapes below.
- `verifier/` runs its own simulated devices and can work entirely from them; real devices arrive through `GET /devices/:name/readings` later.
- `api/` reads from the verifier's `GET /cells/:geohash`.

## Local ports

| Service | Port | Owner |
|---|---|---|
| relayer | 8080 | Hemesh |
| verifier | 8081 | Siddhartha |
| api (x402) | 8082 | Siddhartha |
| web | 3000 | Arpan |

## Shared shapes

Units: all values ×10 integers (`pm25_x10: 423` means 42.3 µg/m³). Times are unix seconds. Device IDs are lowercase 0x addresses. Geohash is 6 characters.

### Signed message (firmware ↔ contract, owned by Hemesh)

```
keccak256(abi.encodePacked(
  address device, uint256 epoch, uint256 pm25_x10, uint256 pm10_x10,
  int256 temp_x10, uint256 hum_x10, uint256 nonce,
  uint256 chainId, address readingsContract))   // 264 bytes
EIP-191 personal_sign over that hash. Nonce starts at 1, strictly increasing.
```

### Reading (POST /readings body, also stored on Arkiv)

```json
{
  "device": "0xabc…",
  "ens": "andheri-01.prananet.eth",
  "geohash": "te7ud2",
  "epoch": 1762360200,
  "pm25_x10": 423, "pm10_x10": 610,
  "temp_x10": 291, "hum_x10": 640,
  "nonce": 17,
  "signature": "0x…",
  "simulated": false
}
```

### Relayer endpoints (Hemesh)

| Endpoint | Response |
|---|---|
| `GET /devices` | `[{ device, ens, geohash, status: "active"\|"flagged"\|"slashed", stake_wei, baseline_mv, last_reading, simulated }]` |
| `GET /devices/:ens` | one device object + `readings: Reading[]` (latest 200) |
| `GET /devices/:ens/readings?from=&to=` | `Reading[]` |
| `WS /live` | messages `{ "type": "reading", "data": Reading }`, `{ "type": "flag", "data": Flag }`, `{ "type": "slash", "data": { device, ens, tx } }` |
| `POST /register` | body `{ idkit: <IDKit result object, passed through unchanged>, device, label, geohash }` → `{ ok, ens, tx }` or `{ ok: false, error }` (e.g. `"max_devices"`) |

### Flag (verifier → contract and Arkiv)

```json
{ "device": "0xabc…", "ens": "…", "epoch": 1762360200,
  "reason": "neighbour_outlier", "value_x10": 2410, "median_x10": 430 }
```

Verifier calls `Registry.flag(address device, uint256 epoch, uint8 reason)` with the verifier key (reason 1 = neighbour outlier, 2 = station outlier). Three consecutive flags slash on-chain. ABI comes from `contracts/out/` once Hemesh adds `flag`.

### Verifier output (Siddhartha)

`GET /cells/:geohash` → `{ geohash, epoch, pm25_x10, pm10_x10, devices_used, devices_flagged, station: { name, pm25_x10 } | null }`

### Paid API (Siddhartha)

`GET /api/aqi?geohash=te7ud2` behind x402 on `hedera:testnet`; returns the verifier cell object. Revenue address set by `PAY_TO` env.

## Fallback plan

- **web/ stalls:** Hemesh ships a single page reading `GET /devices` on Vercel. Map and chart are nice-to-have; the Arkiv view and live reading are the must.
- **verifier/ stalls:** Hemesh adds a simple median check in the relayer and simulated devices as a script; x402 (M5) gets cut.
- **Hemesh's laptop stalls:** the hardware runs from the S3 with its committed firmware; anyone can run `relayer/` with the `.env` values.
