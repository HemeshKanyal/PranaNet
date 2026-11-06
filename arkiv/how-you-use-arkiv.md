# How PranaNet uses Arkiv

```
ESP32 ──signed reading──▶ relayer ──createEntity(prananet.reading, 3 d)──▶ Arkiv (Rabdi)
                              │  └─submitEpoch──▶ Sepolia (ReadingAccepted)
                              ├─createEntity / patchEntity(prananet.device, 180 d) on register, stake, slash
                              ├─createEntity(prananet.flag, 30 d) on Registry DeviceFlagged (value/median from verifier)
verifier ─POST /sim/readings, /flags─▶ relayer ─▶ Arkiv (simulated: true, *.sim.prananet.eth)
web (Next.js) ──select().from(...).where(...).ownedBy(relayer)──▶ Arkiv   (no PranaNet server in the read path)
```

## Writes (relayer, `relayer/src/arkiv.ts`)

- **One wallet writes everything**: the relayer key (`0x3a1F…CCa67`), funded with tGLM; RPC via an access key from hub.arkiv.network (the public endpoint is rate limited).
- Schemas with `defineSchema` + typed columns; indexed columns are the ones we query on. The signature is a `bytes()` column (`str` is capped at 128 bytes).
- Readings: `walletClient.createEntity(ReadingEntity, values, { expiration: ExpirationTime.fromDays(3) })` right after intake accepts a reading. The Arkiv write is not on the critical path: a failure is logged and the Sepolia submission still happens.
- Devices: created on `DeviceRegistered`, `patchEntity({ set: { status, stake_wei, baseline_mv } })` on later events (debounced 2 s).
- Flags: written when the chain index sees `DeviceFlagged`; after a restart the relayer backfills flags Arkiv is missing (deduplicated by tx hash).
- Simulated neighbours: the verifier posts them to the relayer with a shared token; they are stored with `simulated: true` and an `*.sim.prananet.eth` name so they can never be confused with signed data.

## Reads

- **Dashboard** (`web/lib/arkiv.ts`): device pages, the "raw data on Arkiv" record view (entity key, writer, expiry, the exact query, and an in-browser `ecrecover` of the stored signature), flag history. Every query has `.ownedBy(writer)`; the writer address comes from the relayer's `/health`.
- **Relayer**: `GET /devices/:ens/readings?from=&to=` and the last reading per device read from Arkiv (paged, limit 100).
- **Anyone**: `cd relayer && npx tsx scripts/arkiv-query.ts te7u6n`. Latest readings and flags for a cell straight from Rabdi, no PranaNet server involved.

## Numbers from the event

- 2 real devices + 5 simulated neighbours → ~7 reading entities a minute.
- tGLM spend, measured: 0.0602 tGLM over the first 322 writes ≈ **0.00019 tGLM per write**, i.e. ~1.9 tGLM/day at 7 writes/minute. The 2 tGLM from the faucet lasts about a day; a long-running deployment needs a top-up or fewer simulated writes.
- Example entities: reading [0x5f826e8d…](https://rabdi.explorer.arkiv.network/entity/0x5f826e8df8d7d1ae76faecbdffddab07dd3de0db71d94c89aa3bef46985a8fcd), and the bkc-02 flags (see `docs/evidence/m4-slash.md`).
