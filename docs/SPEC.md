# PranaNet: Build Spec

ETHGlobal Mumbai 2026 · Building from Scratch track · hacking 5 Nov 21:00 → 7 Nov 09:00 IST

**One line:** air-quality data that holds up in a dispute. ESP32 sensors sign every reading, neighbours and official stations cross-check it, and cheaters lose stake. Devices carry ENSv2 names, operators are verified humans through World ID, raw readings live openly on Arkiv, and AI agents buy verified data over x402 on Hedera.

Check every library API against current docs before using it. Nothing in this spec is a promise about an API's exact shape.

## Repo layout

```
contracts/   Foundry: Registry, Readings, Stake, RewardPool
firmware/    ESP32 (Arduino), one sketch with a DEVICE switch
relayer/     Node + TypeScript: device intake, Arkiv writes, batching, tx sender
verifier/    cross-check job, OpenAQ fetch, simulated devices
api/         x402-protected data API on Hedera
agent/       script that discovers the API and pays
web/         Next.js dashboard (map, device pages, register flow)
arkiv/       schema.md, friction.md, reach.md, why-arkiv.md, how-you-use-arkiv.md
docs/        SPEC.md, AI-USAGE.md, DEBRIEFS.md, prompts/
```

## Hardware (assembled and tested before the event)

| | Device 1 | Device 2 |
|---|---|---|
| Board | ESP32 DevKit 30-pin (CP2102) | ESP32-S3-N16R8 (two USB-C; built for the CH343 COM port, CDC On Boot disabled) |
| Sharp LED control (active LOW) | GPIO 25 | GPIO 6 |
| Sharp Vo via divider (ADC1) | GPIO 34 | GPIO 4 |
| DHT22 data | GPIO 4 | none |
| Divider | 10k top, 22k bottom → ×1.45 | 10k top, 22k bottom → ×1.45 |

Sensor: Sharp GP2Y1014AU0F (PM proxy, not a calibrated PM2.5 counter). Sampling: pulse the LED LOW, read at 280 µs, LED HIGH, 10 ms period; average ~100 samples. Clean-air output differs per unit (device 2 measured ~0.16–0.28 V), so **measure the baseline at boot** and report dust as the rise above it. Wi-Fi on does not affect ADC1 readings (tested).

Location: no GPS. Each device has a 6-character geohash (~1.2 × 0.6 km) set at registration.

**Secrets never enter the repo:** Wi-Fi credentials and the device private key live in `firmware/secrets.h` (gitignored); commit `secrets.example.h` only.

## Signed reading format

```
message = keccak256(abi.encodePacked(
  device, epoch, pm25_x10, pm10_x10, temp_x10, hum_x10,
  nonce, chainId, readingsContract))
signature = EIP-191 personal_sign(message) with the device key
```

Integers ×10, no floats on-chain. `chainId` and the contract address stop cross-chain replay; the nonce must strictly increase. Device 2 sends temp/hum as 0.

## Contracts (Sepolia)

| Function | Behaviour |
|---|---|
| `registerDevice(device, owner, label, geohash)` | Backend-only, after a valid World ID proof. Creates the ENSv2 subname with a geohash record. Max 3 devices per human (nullifier). |
| `stake()` / `unstake()` | Operator deposits a small stake per device. |
| `submitEpoch(reading, sig)` | ecrecover; device registered and active; nonce increasing; emits `ReadingAccepted`. |
| `flag(device, epoch, reason)` | Verifier role. Three consecutive flags trigger `slash`. |
| `slash(device)` | Stake → reward pool, device inactive, ENS subname revoked. |
| `fundPool()` / `claimRewards()` | Revenue funds the pool; operators claim for accepted, unflagged epochs. |

## Arkiv entities

| Entity | Queried by | Expires |
|---|---|---|
| `reading`: ENS name, epoch, values, signature | geohash, device, time range, PM above X | ~3 days |
| `device`: ENS name, geohash, status, baseline | geohash, status | while registered |
| `flag`: device, epoch, reason, neighbour median | device, time | ~30 days |

At least one dashboard view reads from Arkiv. README lists the writer wallet and one runnable query. Keep `arkiv/friction.md` updated while building (25% of Arkiv's score).

## Relayer and API

| Endpoint | Purpose |
|---|---|
| `POST /readings` | Verify signature off-chain, write to Arkiv, queue epoch summary for Sepolia. |
| `GET /devices`, `GET /devices/:name` | Status, ENS name, stake, recent readings. |
| `WS /live` | Push readings and flags to the map. |
| `POST /register` | Verify IDKit proof server-side, then call `registerDevice`. |
| `GET /api/aqi?geohash=` | x402-protected, settled on Hedera testnet. Cross-checked, baseline-corrected readings for a cell, flagged devices removed. |

The relayer is untrusted: it only pays gas, and any change to a value breaks the signature.

## Cross-check rule

Each epoch, compare a device with the median of devices in its cell and neighbouring cells (real plus clearly labelled simulated ones). Flag if it differs by more than 50% **and** more than 25 µg/m³. Compare with the nearest OpenAQ reference station using a looser threshold.

## Scope

| Feature | Priority |
|---|---|
| One device signing → relayer → Sepolia, verified by ecrecover | Must |
| Raw readings on Arkiv, read by the dashboard | Must |
| Live dashboard with map and chart, deployed to Vercel | Must |
| Fake-key reading rejected | Must |
| World ID registration with a 3-device cap | Must |
| ENSv2 subname per device with geohash, revoked on slash | Must |
| Neighbour cross-check, flagging and slashing | Must |
| Second real device | Nice |
| x402 data API and paying agent on Hedera | Nice |
| x402 revenue funds the pool; honest operator claims | Nice |
| HCS topic logging each agent purchase | Nice |
| Official station comparison | Nice |

## Milestones

| Block | Milestone |
|---|---|
| Thu 21:00 → 00:00 | Repo, SPEC, Registry + Readings contracts with Foundry tests; firmware reads sensors |
| Fri 00:00 → 04:00 | **M1:** first signed reading on Etherscan and the Arkiv explorer; fake key rejected |
| Fri 04:00 → 08:30 | Sleep |
| Fri 08:30 → 13:00 | **M2:** live Vercel dashboard shows the real device |
| Fri 13:00 → 17:00 | **M3:** World ID registration end to end; 4th device rejected; ENS subname created |
| Fri 17:00 → 21:00 | **M4:** incense → flagged → slashed → ENS revoked |
| Fri 21:00 → 01:00 | **M5:** agent buys a reading over x402 on Hedera (skip if M4 is late) |
| Sat 01:00 → 09:00 | Freeze, write-ups, video, submit by 08:00 |

If a milestone slips more than two hours, cut from the bottom of the scope table.

## Hackathon rules to respect

- Commit small and often; no large single commits.
- Record AI use in `docs/AI-USAGE.md` (which files, which tools, how they were directed) and save prompts in `docs/prompts/`.
- README has a "Reused vs new" section: list libraries and starter kits, and state the hardware was assembled before the event.
- No personal data on-chain; devices publish only a geohash cell.
