# Why Arkiv

PranaNet produces a reading per device per minute. Each reading has to be:

1. **Public and queryable** by cell, device, time range and status, because the dashboard, the verifier and anyone checking a dispute all ask questions like "all readings in te7u6n in the last hour" or "this device's reading with nonce 91".
2. **Attributable**: who wrote it must be checkable, because the value only matters if it really came through our pipeline (and, inside it, from the device key: the signature travels with the record).
3. **Cheap enough to write every minute** and **not kept forever**: raw minute data is useful for days, not years.

What we tried instead, and why it didn't fit:

| Option | Problem |
|---|---|
| Put every reading on Sepolia | ~60 tx/device/hour. We do submit each epoch (`ReadingAccepted` is the tamper-evident anchor), but events can't be queried by geohash or range without running an indexer, and we'd pay to keep data forever |
| Our own database behind the relayer | Then the dashboard trusts *us*. The whole point is that a reader can check data without trusting the operator |
| IPFS / file pinning | Content-addressed blobs, no attribute queries, and no expiry semantics; we'd still need an index |

Arkiv gives exactly the middle layer:

- **Typed, indexed attributes** (`geohash`, `epoch`, `device`, `nonce`, `simulated`, …) with real queries (`eq`, `between`, `orderBy`, paging), so the dashboard reads straight from Arkiv instead of from our API.
- **Ownership** (`ownedBy(writer)`) makes provenance a query filter: the web app only shows entities written by the PranaNet relayer wallet.
- **Expiry built in**: readings live 3 days, flags 30 days, device records 180 days. Old minute-data disappears without a cleanup job; the permanent record (who was flagged, slashed, paid) stays on Sepolia.
- **Signature next to the data**: each reading entity carries the device's EIP-191 signature, so the web app's record page re-runs the exact `ecrecover` the Readings contract does, in the browser, from Arkiv data alone.

Split of responsibilities: **Sepolia** = rules and money (registration, nonce, slashing, stake, rewards); **Arkiv** = the raw, queryable, expiring evidence those rules were applied to; **Hedera** = payment for the cleaned-up data (x402) and a public purchase log (HCS).
