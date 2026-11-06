# Arkiv schema

Network: **Rabdi** testnet (chain id 7794095), SDK `@arkiv-network/sdk` 1.0.1.
Writer (the only wallet we trust): **`0x3a1F21F1c6f05eFA35BB7178274b41C8873CCa67`**, the relayer
([explorer](https://rabdi.explorer.arkiv.network/address/0x3a1F21F1c6f05eFA35BB7178274b41C8873CCa67)).
Every read filters with `.ownedBy(writer)`: anyone can write entities that look like ours.

Source of truth for the definitions: `relayer/src/arkiv.ts` (mirrored in `web/lib/arkiv.ts`).
Values follow docs/TEAM.md: physical values ×10 as integers, times in unix seconds.

## `prananet.reading`: one signed sensor reading per device per 60 s epoch

| Attribute | Type | Indexed | Notes |
|---|---|---|---|
| device | addr | ✓ | device key address (secp256k1, generated on the ESP32) |
| ens | str | ✓ | `<label>.prananet.eth` (from the Registry, never from the request) |
| geohash | str | ✓ | 6-char cell, e.g. `te7u6n` |
| epoch | u64 | ✓ | start of the 60 s window |
| pm25_x10, pm10_x10 | i32 | ✓ | µg/m³ ×10 |
| temp_x10, hum_x10 | i32 | | 0 on device 2 (no DHT22) |
| nonce | u64 | ✓ | strictly increasing per device |
| signature | **bytes** | | 65-byte EIP-191 signature over the 264-byte message (SPEC "Exact encoding"); `str` is capped at 128 bytes |
| simulated | bool | ✓ | `true` only for the verifier's labelled neighbour devices (`*.sim.prananet.eth`, signature empty) |

Expiry: **3 days** (`ExpirationTime.fromDays(3)`). Sepolia keeps the permanent `ReadingAccepted` event; Arkiv keeps the full queryable raw series for the dashboard and anyone re-verifying.

## `prananet.device`: current state of each registered device

| Attribute | Type | Indexed |
|---|---|---|
| device | addr | ✓ |
| ens, geohash, status (`active` / `flagged` / `slashed`) | str | ✓ |
| owner | addr | |
| label, stake_wei | str | |
| baseline_mv | i32 | |
| simulated | bool | ✓ |

Created on registration, **patched** (`patchEntity`) when status, stake or baseline change.
Expiry: **180 days**. SPEC wanted "while registered", but the chain caps an entity lifetime at
~182 days, so a registered device would need `extendEntity` before then (friction log).

## `prananet.flag`: one cross-check flag

| Attribute | Type | Indexed | Notes |
|---|---|---|---|
| device | addr | ✓ | |
| ens | str | ✓ | |
| epoch | u64 | ✓ | judged epoch |
| reason | str | ✓ | `neighbour_outlier` / `station_outlier` |
| value_x10, median_x10 | i32 | | the device's value and what it was compared with |
| tx | str | | Sepolia `Registry.flag` tx; empty for simulated devices (never on-chain) |

Expiry: **30 days**. Real-device flags are written by the relayer when it sees the `DeviceFlagged`
event (value/median from the verifier); simulated-device flags come through `POST /flags`.

## Queries we run

```ts
// dashboard / relayer: a device's readings in a time range, newest first (limit ≤ 100, page with offset)
client.select().from(ReadingEntity)
  .where(and(eq("ens", "bkc-01.prananet.eth"), between("epoch", u64(from), u64(to))))
  .ownedBy(WRITER).orderBy(desc("epoch")).limit(100).offset(0).fetch()

// latest readings in a cell (runnable: `cd relayer && npx tsx scripts/arkiv-query.ts te7u6n`)
client.select().from(ReadingEntity).where(eq("geohash", "te7u6n")).ownedBy(WRITER).orderBy(desc("epoch")).limit(10).fetch()

// one record by device + nonce (record page "query that finds this record")
client.select().from(ReadingEntity).where(and(eq("device", addr(d)), eq("nonce", u64(n)))).ownedBy(WRITER).fetch()
```
