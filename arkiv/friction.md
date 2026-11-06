# Arkiv friction log

Everything that slowed us down while building on Arkiv, merged from `docs/ai-usage/hemesh.md`,
`docs/ai-usage/arpan.md` and `docs/ai-usage/siddhartha.md` (Siddhartha's verifier does not touch
Arkiv directly: no entries). Newest at the bottom.

| When (IST) | Who | Area | What happened | Workaround / fix | Severity |
|---|---|---|---|---|---|
| Fri 6 Nov ~09:50 | Hemesh | SDK / chain limits | Entity lifetime is capped at ~182 days (MAX_LIFETIME), so SPEC's device entity "expires while registered" can't be expressed directly | Device entities created with `fromDays(180)`; a registered device needs a periodic `extendEntity` (not needed within the event) | low |
| Fri 6 Nov ~09:50 | Hemesh | RPC / onboarding | Writes need tGLM, and the public RPC is heavily rate limited; a relayer writing every minute needs an access key from hub.arkiv.network | `ARKIV_ACCESS_KEY` in relayer/.env; faucet for tGLM | med |
| Fri 6 Nov | Arpan | query | `.limit(200)` fails: "limit 200 exceeds the node maximum of 100" | Limit 100 and page with `.offset()` (the relayer pages for 200-reading device views) | low |
| Fri 6 Nov | Arpan | query / docs | `$expiresAt` is a block number, not a timestamp | Convert with the query result's `blockNumber` and the 2 s block time | low |
| Fri 6 Nov | Arpan | SDK types | A helper that wraps `eq(...)` loses the literal column types, so `.where()` rejects it under a typed schema | Inline the expressions in each query | low |
| Fri 6 Nov ~16:05 | Hemesh | SDK / schema | First live writes failed: `str` values are capped at 128 UTF-8 bytes (MAX_STRING_BYTES) and a hex secp256k1 signature is 132. The error message was clear and suggested the fix | Signature stored as a `bytes()` column (reads back as 0x hex); changed in both relayer and web schemas | med (only found live; local tests used the in-memory store) |

**What worked well:** typed schemas with `.indexed()` caught shape mistakes at compile time; `ownedBy` made provenance a one-line filter; the explorer's `/entity/<key>` links made every record easy to show judges; error messages named the limit and the fix.

**Top improvement we'd ask for:** document the value limits (128-byte `str`, 100-row query limit, ~182-day lifetime) together on one page next to `defineSchema`. We hit each of them separately, at runtime.
