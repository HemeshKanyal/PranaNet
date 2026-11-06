# Sponsor debriefs

## World ID (4.0, IDKit 4.6, Developer Portal, staging simulator)

**What we built:** device registration gated by World ID. The web app (IDKit `IDKitRequestWidget`, `orbLegacy` preset, signal = the device address) gets an RP signature from its own server route; the relayer forwards the IDKit result unchanged to `POST https://developer.world.org/api/v4/verify/{rp_id}`, checks that every response's `signal_hash` equals `hashSignal(device)`, and calls `Registry.registerDevice(..., nullifier)`. The contract caps each nullifier at 3 devices. Evidence: `docs/evidence/m3-worldid-ens.md` (3 devices from one simulated human, the 4th rejected with `max_devices`).

**Time to first success:** ~2 h 45 min wall clock (15:00 → 17:46 IST, Fri 6 Nov), of which ~2 h was waiting on the signer-key mix-up below. Code for signing, verification and tests took ~40 min; the first simulator proof verified on the first try once the key matched.

### Friction

| # | What happened | Cost | How we got past it |
|---|---|---|---|
| 1 | "Register relying party" offers *Generate new key* or *Use existing key*. We had generated a signer locally, but the RP was registered with a portal-generated key, so the backend key derived to a different address than the portal's signer. Nothing in the flow flags the mismatch until a proof request is signed with the wrong key | ~2 h (blocked) | Compared `cast wallet address` of the env key with the signer shown in the portal; replaced the key |
| 2 | RP registration is **not available for staging apps** ("Staging apps cannot be migrated to World ID 4.0"), while simulator testing needs a **staging action**. That an app must be production while its action is staging was only clear from the portal's source | 20 min | Production app + `register-device` action in the staging environment |
| 3 | Docs say uniqueness proofs are "one-time per action", which suggested a second proof from the same human would be refused, breaking a "3 devices per human" design. In fact `/api/v4/verify` returns `success: true` with "Proof verified successfully (nullifier reuse)" | 20 min reading `developer-portal` source | Cap enforced on-chain by nullifier; confirmed live (`reused=true` on proofs 2–4) |
| 4 | Simulator: the default test identity is the same for everyone (#4, `0x18310f83`); the other four identities fail verification with `invalid_merkle_root` ("User appears to be unverified") for a few minutes after their first use, although the simulator shows the credential as valid | 15 min | Select each identity once ahead of time (`npm run demo-reset -- --warm`), retry after 2 min |
| 5 | Signal hashing: whether a `0x…` address signal is hashed as UTF-8 text or as bytes decides whether the backend's `signal_hash` check matches. Not stated in the reference | 10 min | Read `hashSignal` in `@worldcoin/idkit-core`: valid hex is hashed as raw bytes; verified against IDKit in a test |
| 6 | Simulator "Add identity" isn't clickable from an automated (headless) browser | 5 min | Use the five built-in test identities |

### Missing docs
- Nullifier-reuse semantics of `/api/v4/verify` (success + `nullifier_reuse`), and a recommended pattern for "at most N per human".
- Staging app vs staging action rules for RP registration, on the RP setup page.
- The simulator's test identities: which are verified, and the delay before a newly used identity's proofs verify.
- `hashSignal` rules (hex string → bytes) next to the `signal` parameter in the IDKit reference.

### Top improvement
**A per-action "max uses per human" setting** (e.g. 3), enforced by the verify endpoint and reported in its response (`uses: 2 of 3`). Today a capped action needs an on-chain or database counter keyed by nullifier, and the docs' "one-time per action" wording points developers away from the pattern that actually works.

### What worked well
- `/api/v4/verify` taking the IDKit result unchanged: no field mapping, and `environment` travels inside the result.
- RP signature spec with test vectors (we reproduced `hash_to_field` vectors in our tests).
- The simulator made the full flow (QR → approve → proof → backend verify → on-chain) testable in a minute without a phone.
