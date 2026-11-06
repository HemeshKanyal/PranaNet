# Prompt 02: Hemesh's full build (Fri 09:00)

Given to Claude Code in ~/Workspace/PranaNet. Covers everything Hemesh owns in docs/TEAM.md.

---

We're at ETHGlobal Mumbai. Submission is Sat 7 Nov 09:00 IST and we are behind: the relayer is empty and the ESP32 doesn't sign yet. Build all of my parts from docs/TEAM.md, in the order below, without skipping any. Work autonomously. After each part, print a short checkpoint (what works, links, test results) and carry straight on.

## Ground rules (whole session)

- First: `git pull` on main and fetch all branches. Read docs/SPEC.md, docs/TEAM.md, contracts/, firmware/, and skim the `web` and `verifier` branches so the relayer matches exactly what my teammates expect.
- My folders only: firmware/, contracts/, relayer/, arkiv/, docs/, root files. Never edit web/, verifier/, api/ or agent/.
- The shapes in docs/TEAM.md are a contract with my teammates. Don't change them. If one truly must change, stop and ask me first.
- Check every library API against its current docs before writing code (Arkiv SDK, ENSv2, World ID / IDKit, viem). Don't guess signatures. If a doc contradicts SPEC.md, follow the doc and tell me.
- Commit small and often, push to main after each commit. Log each task in docs/ai-usage/hemesh.md. Add any Arkiv friction to its Friction table as it happens.
- Secrets: never commit keys, .env or secrets.h. Commit .env.example / secrets.example.h with every variable listed and explained.
- Write tests for contracts and for the relayer's signature check. Run them before each commit.
- Stop and ask me ONLY when you need: a secret or testnet funds, a physical action (plugging in, pressing BOOT, incense), or a decision that changes TEAM.md. Batch your questions; tell me exactly what to paste or do.

## Part 1: ESP32 signing (firmware/)

1. Pick a secp256k1 + Keccak-256 implementation that compiles for esp32s3 and esp32 with arduino-cli (compare trezor-crypto, micro-ecc + a Keccak implementation, Web3E). Vendor it under firmware/prananet/ with its licence, or use a library installable by arduino-cli. Record the choice in README "Reused vs new".
2. Device key: on first boot, generate a private key with esp_random(), store it in NVS, and print the device address on every boot. Add a serial command to print the address again. The key never leaves the device except via that address.
3. Build the 264-byte message exactly as in SPEC.md (same field order and types as contracts/src/Readings.sol), apply EIP-191, sign, and produce a 65-byte r‖s‖v signature with low-s.
4. Prove it: a Node script relayer/scripts/verify-vector.ts that takes the JSON a device prints and recovers the address with viem, plus one fixed test vector checked identically in a Foundry test and in the Node script. All three must agree.
5. Epoch loop: 60 s epochs for the demo (configurable). Average the sensor over the epoch, subtract the boot baseline, convert to pm25_x10/pm10_x10 (same value for both, labelled PM proxy), temp/hum from DHT22 on device 1 and 0 on device 2, nonce persisted in NVS so it survives reboots. POST the TEAM.md Reading JSON to RELAYER_URL from secrets.h. Print a clear serial line per epoch: values, nonce, signature prefix, HTTP status.
6. Compile for both devices. Upload to device 2 (esp32:esp32:esp32s3, CDC On Boot disabled, FlashSize=16M, PSRAM=opi, port /dev/ttyACM0) and show 2 epochs of serial output. Ask me to plug in if no port is found.

## Part 2: Contracts to Sepolia (contracts/)

1. Finish the contracts: stake()/unstake() per device, slash moves the stake into a RewardPool contract, RewardPool fundPool() and claimRewards() for accepted, unflagged epochs (keep the accounting simple and tested), verifier role granted by admin. Keep all existing tests passing; add tests for stake, slash-to-pool and claim.
2. Deployment script (forge script) reading SEPOLIA_RPC_URL and DEPLOYER_PRIVATE_KEY from contracts/.env. Deploy, verify on Etherscan if ETHERSCAN_API_KEY is set, and write the addresses to contracts/deployments/sepolia.json.
3. Export ABIs to contracts/abi/*.json (committed) so the verifier and web can use them without building. Tell Siddhartha's side in the checkpoint which file and which address to use for flag().

## Part 3: Relayer (relayer/), milestone M1

Node + TypeScript, one service on port 8080, exactly the endpoints and shapes in docs/TEAM.md:

- `POST /readings`: validate the shape, recover the signer off-chain with viem using the same message as the contract, reject unknown/inactive devices and old nonces (read from the contracts), write the reading entity to Arkiv, queue `submitEpoch` to Sepolia, broadcast on `WS /live`. Return clear errors.
- Tx sender: one relayer wallet (RELAYER_PRIVATE_KEY), nonce-safe queue, retries with backoff, logs tx hashes.
- Arkiv (@arkiv-network/sdk, testnet): `reading` (~3 days expiry), `device` (while registered) and `flag` (~30 days) entities with queryable attributes from SPEC.md (geohash, device, epoch, PM). Also index contract events so `GET /devices*` returns status, stake and readings. Reads for `GET /devices/:ens/readings` must come from Arkiv.
- `GET /devices`, `GET /devices/:ens`, `GET /devices/:ens/readings?from=&to=`, `WS /live` (reading, flag and slash messages). Watch contract events for Flagged/Slashed and push them on WS.
- CORS open for the Vercel domain and localhost:3000.
- `relayer/scripts/fake-reading.ts`: signs a reading with a random key; show it rejected by the relayer AND by the contract when submitted directly.
- `relayer/scripts/register-dev.ts`: registers my real device directly through the backend role (dev only) so M1 doesn't wait for World ID.
- Tests (vitest): signature recovery matches the Foundry vector; bad signature, wrong device, replayed nonce rejected.

**M1 checkpoint:** device 2 reading → relayer → Arkiv entity + Sepolia `ReadingAccepted`. Put the Etherscan tx link, the Arkiv explorer link and the relayer wallet address in the README.

Then make the relayer reachable from the deployed dashboard: run it on my laptop behind a Cloudflare quick tunnel (cloudflared) with HTTPS and WSS, write the steps in relayer/README.md, and give me the public URL to send to Arpan for NEXT_PUBLIC_RELAYER_URL. Also add a Dockerfile so it can move to Render or Railway later.

## Part 4: World ID + ENSv2 (relayer/ + contracts/), milestone M3

1. `POST /register`: take the IDKit result exactly as the web sends it (check the `web` branch), verify the proof server-side with World's current verification API (WORLD_APP_ID, WORLD_ACTION in .env), never trust the client. Pass the nullifier to `registerDevice`. Map the 3-device cap to `{ ok: false, error: "max_devices" }` and a failed proof to `"invalid_proof"`.
2. ENSv2 on Sepolia: read the current ENSv2 docs (Permissioned Registry, UserRegistry, Enhanced Access Control). Implement IDeviceNamer so that registering a device creates `<label>.prananet.eth` (or the parent name I give you) with a `geohash` text record and the device address, and slashing revokes it. Owners may edit metadata only. If the parent name needs registering or funding, tell me exactly what to do. If ENSv2 on Sepolia can't do something we need, stop and give me options; do not fake it.
3. Tests for register → subname exists → slash → subname revoked.

**M3 checkpoint:** register a device end to end through `/register`; a 4th device from the same human is rejected; the ENS name resolves.

## Part 5: Slashing path (contracts/ + relayer/), milestone M4 support

- Grant the verifier role to the address Siddhartha gives (ask me for it).
- Confirm on Sepolia: three flags → slash → stake in pool → device inactive → ENS revoked → `slash` message on WS → `flag` entities on Arkiv.
- If the `verifier` branch has nothing working by 16:00, build the fallback from TEAM.md inside relayer/: simulated neighbour devices in the same geohash (labelled `simulated: true`), a median cross-check with the SPEC rule, and flagging. Tell me before you start it.

## Part 6: Arkiv write-ups (arkiv/) and README

- arkiv/schema.md (entities, attributes, expiry, example queries), why-arkiv.md, how-you-use-arkiv.md, reach.md, and friction.md merged from all three ai-usage files.
- README: setup for every part I own, architecture, the writer wallet, one runnable Arkiv query, Etherscan and Arkiv links, "Reused vs new" complete, AI use pointer.

## Part 7: Device 1

Compile and upload firmware DEVICE=1 to the 30-pin ESP32 (ask me to plug it in), register it with the dev script, and confirm its readings flow. If its sensor fails, report and move on.

## Finish

Print a final status table: each Must and Nice item from SPEC.md's scope with done / partial / not done and a link or test as proof.
