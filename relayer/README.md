# relayer

Node 24 + TypeScript (run with tsx). Receives signed readings from the devices, checks them,
writes them to Arkiv and submits them to the `Readings` contract on Sepolia. Serves the
dashboard's REST + WebSocket API (shapes in [../docs/TEAM.md](../docs/TEAM.md)).

```
device ──POST /readings──▶ intake ── ecrecover, registered?, active?, nonce ──▶ 202
                              │
                              ├─▶ Arkiv (Rabdi): prananet.reading entity (3-day TTL)
                              └─▶ tx queue ─▶ Readings.submitEpoch (Sepolia) ─▶ ReadingAccepted
chain indexer (Registry + Stake events) ─▶ device state, flags, slashes ─▶ WS /live
```

## Run

```bash
cd relayer
cp .env.example .env      # fill in keys; every variable is explained in the file
npm ci
npm test                  # signature vector + intake tests
npm start                 # :8080
```

Contract addresses come from `../contracts/deployments/sepolia.json` (written by
`contracts/deploy.sh`); set `DEPLOYMENT=local-31337` to use an anvil deployment.

| Endpoint | |
|---|---|
| `GET /health` | relayer + Arkiv writer address, contracts, sync state |
| `POST /readings` | Reading (TEAM.md shape) → 202 `{ok}` / 400 `invalid_shape` / 401 `bad_signature` / 403 `unknown_device`, `inactive_device` / 409 `stale_nonce` |
| `GET /devices`, `/devices/:ens`, `/devices/:ens/readings?from=&to=` | device list, device + latest 200 readings, range |
| `WS /live` | `reading`, `flag`, `slash` messages in on-chain order |
| `POST /register` | `{ idkit, device, label, geohash }`: World ID proof checked with the Developer Portal → `registerDevice` + ENS subname (the RP signature for IDKit is made by web/app/api/rp-context) |
| `POST /flags` | verifier writes a Flag entity to Arkiv (needs `FLAG_WRITE_TOKEN`) |

## Public URL (Cloudflare quick tunnel)

The devices and the Vercel dashboard need HTTPS/WSS. A quick tunnel needs no account:

```bash
cloudflared tunnel --no-autoupdate --url http://localhost:8080
# prints https://<random-words>.trycloudflare.com
```

Use that URL for `RELAYER_URL` in `firmware/prananet/secrets.h` (append `/readings`) and for
`NEXT_PUBLIC_RELAYER_URL` in `web/`. WebSockets work through it (`wss://…/live`). The URL
changes every time cloudflared restarts, so keep it running; for a stable name use a named
tunnel (`cloudflared tunnel create`), which needs a Cloudflare account and a domain.

## Docker

Build from the repo root (the image needs `contracts/abi` and `contracts/deployments`):

```bash
docker build --network host -f relayer/Dockerfile -t prananet-relayer .
docker run --env-file relayer/.env -p 8080:8080 prananet-relayer
```

## Scripts

| | |
|---|---|
| `npm run register-dev -- --device 0x… --label andheri-01 --geohash te7ud2` | dev-only registration with the backend role, skipping World ID |
| `npm run fake-reading -- --device 0x… [--relayer URL] [--send-tx]` | forged reading: shows the relayer 401 and the contract `InvalidSignature` revert |
| `npm run sign-reading` | sign a reading with a test key (for curl testing) |
| `npm run verify-vector -- - < serial.log` | check device `selftest` / reading lines against viem |

## Notes from running it live

- Alchemy's free tier allows `eth_getLogs` over 10 blocks only (`LOG_CHUNK_BLOCKS`, default 10).
- Arkiv `str` attributes are capped at 128 bytes, so the signature is stored as `bytes`.
- Sepolia now charges ~207k gas for a value transfer to a never-used address; viem's gas
  estimation handles it, a hard-coded 21000 does not.
