# AI usage: Hemesh

Tool: Claude Code (Claude Opus 5.5), run in the repo root. Prompts saved verbatim in [../prompts/](../prompts/).
One line per task: when (IST) · files · what the AI did · what I directed.

| When | Files | What the AI did | What I directed |
|---|---|---|---|
| Thu 5 Nov ~21:10 | .gitignore, LICENSE, docs/ | git init on main, set remote, wrote .gitignore and MIT LICENSE, committed docs first, pushed | Prompt 01 task 1: repo setup, ignore list, license holder, commit order |
| Thu 5 Nov ~21:15 | README.md, docs/AI-USAGE.md, arkiv/friction.md, */.gitkeep | Created folder layout from SPEC, README with pitch/layout/Reused-vs-new stub, this log, Arkiv friction log | Prompt 01 task 2: layout, README contents, hardware-pre-built statement |
| Thu 5 Nov ~21:40 | .gitmodules, contracts/ (foundry.toml, src/Registry.sol, src/Readings.sol, src/interfaces/IDeviceNamer.sol, test/*.t.sol) | forge init with forge-std as a root-repo submodule; wrote Registry (backend role, 3-per-nullifier cap, active flag, ENS hook interface), Readings (SPEC message rebuild, EIP-191, low-s ecrecover, nonce), 19 Foundry tests, all passing. Chose concrete field types for the packed message (uint256/int256) | Prompt 01 task 3: contract behaviour, required test cases, separate commits |
| Thu 5 Nov ~22:00 | firmware/prananet/prananet.ino, firmware/prananet/secrets.example.h | Wrote sensor sketch (DEVICE switch, Sharp 280 µs timing, 100-sample average, 10 s boot baseline, DHT22 on device 1, 1 Hz status line); installed Adafruit DHT sensor library 1.4.7; compiled for device 2 (esp32s3, CDC On Boot disabled) and device 1. Upload not done: no board on /dev/ttyACM0 | Prompt 01 task 4: pins, timing, baseline, compile/upload target |
| Thu 5 Nov ~22:20 | docs/TEAM.md, contracts/src/Registry.sol, contracts/test/RegistryFlag.t.sol, docs/SPEC.md, docs/ai-usage/hemesh.md, docs/AI-USAGE.md | Committed TEAM.md; added verifier role, flag(address,uint256,uint8), clearFlags and slash-on-3rd-consecutive-flag (deactivate + ENS revoke) to Registry with 8 tests (27/27 pass); recorded 264-byte encoding table in SPEC; moved this log to a per-person file per TEAM.md | Follow-up prompt: commit TEAM.md, add flag with verifier role + tests, record encoding in SPEC, create this file, upload firmware to device 2 |
| Fri 6 Nov ~09:05 | docs/prompts/02-hemesh-build.md | Pulled main, fetched `web`/`verifier`, read their types and endpoints so relayer shapes match; saved prompt 02 | Prompt 02 ground rules |
| Fri 6 Nov ~09:20 | firmware/prananet/{keccak256,eth_sign}.{h,cpp}, prananet.ino, secrets.example.h | Chose the core's bundled mbedTLS 3.6 for secp256k1 (RFC 6979 det. signing, HW MPI on both chips) over vendoring trezor-crypto/micro-ecc (micro-ecc has no recovery id); wrote Keccak-256, recovery-id computation, low-s, 264-byte packing; NVS key from esp_random with bootloader entropy, persisted nonce, 60 s epochs, signed POST, serial `addr`/`selftest`/`status`. Compiles for both devices. Host-compiling downloaded mbedTLS source was blocked by the permission classifier, so on-device `selftest` is the cross-check | Prompt 02 part 1 |
| Fri 6 Nov ~09:25 | relayer/src/message.ts, scripts/{gen-vector,verify-vector}.ts, test/vector.*, contracts/test/Vector.t.sol | Fixed vector (Hardhat key #0) generated with viem, asserted identically in Foundry (on-chain submitEpoch at the vector's address/chain) and vitest | Prompt 02 part 1.4 |
| Fri 6 Nov ~09:40 | contracts/src/{Stake,RewardPool}.sol, interfaces/IStakeManager.sol, Registry.sol, Readings.sol, test/Economy.t.sol, script/Deploy.s.sol, deploy.sh, export-abi.sh, abi/*.json | Stake (min stake, unstake blocked during flag streak), slash → RewardPool, fixed reward per accepted unflagged epoch capped by balance; 44/44 Foundry tests; deploy script writing deployments/<net>.json, tested on anvil; ABIs exported | Prompt 02 part 2 |
| Fri 6 Nov ~10:00 | relayer/ (src/*, test/intake.test.ts, scripts/*, Dockerfile, .env.example) | Relayer on :8080: intake with off-chain ecrecover, nonce/active checks, Arkiv writes (reading/device/flag schemas), sequential tx queue with backoff, polling event indexer, WS /live in on-chain order, CORS allowlist; register-dev, sign-reading, fake-reading scripts; 14 vitest tests; full local run on anvil (accept, replay 409, fake 401 + contract InvalidSignature, 3 flags → slash on WS). Generated testnet deployer/relayer wallets straight into gitignored .env files | Prompt 02 part 3 |

## Friction

Arkiv friction notes (merged into [../../arkiv/friction.md](../../arkiv/friction.md) by Hemesh).

| When | What happened | Workaround |
|---|---|---|
| Fri 6 Nov ~09:50 | Entity lifetime is capped at ~182 days (MAX_LIFETIME), so SPEC's device entity "expires while registered" can't be expressed directly | Create with fromDays(180) and plan a periodic extendEntity; documented in arkiv/schema.md |
| Fri 6 Nov ~09:50 | Writes need tGLM and the public RPC is heavily rate limited; an access key from hub.arkiv.network is needed for a relayer writing every minute | Added ARKIV_ACCESS_KEY to relayer/.env.example |
