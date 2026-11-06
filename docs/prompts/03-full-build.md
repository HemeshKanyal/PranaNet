# Prompt 03: full build, nothing cut (Fri 14:45)

Given to Claude Code in ~/Workspace/PranaNet. Continues prompt 02.

---

Env is ready: Sepolia RPC (Alchemy) in contracts/.env and relayer/.env, ARKIV_ACCESS_KEY in relayer/.env, a new Etherscan key in contracts/.env, Wi-Fi in firmware/prananet/secrets.h. Deployer and relayer each have 0.5 Sepolia ETH; the relayer has 2 tGLM. cloudflared 2026.10.7 is installed. Device 2 is plugged in. WORLD_APP_ID is app_3985a620e04bc80e905efbfba3a3093d.

Siddhartha is at Devcon, so I now own every folder, including verifier/, api/ and agent/. Update docs/TEAM.md to say so. Merge his `verifier` branch first and keep his work.

Build everything in SPEC.md's scope table: every Must, every Nice, and the HCS log. Nothing is cut. Work autonomously and in the order below, so that a working demo exists as early as possible and each step builds on a tested one. After each step, print a short checkpoint (what works, links, test results) and carry straight on. Stop only for a secret, funds, a physical action, or a decision that changes TEAM.md shapes, and batch those questions.

Same rules as prompt 02: check every API against current docs, commit small and push, tests before each commit, log in docs/ai-usage/hemesh.md, record Arkiv friction, never print or commit keys.

## Step 0: World ID signer (do this first, it unblocks me)

Read World ID 4.0's relying-party docs. Generate the RP signer key into relayer/.env as WORLD_SIGNING_KEY (never print it) and tell me only its **address**, plus exactly what to enter on developer.world.org → World ID Configuration → "Register relying party", and where the action `register-device` gets created. I'll paste WORLD_RP_ID into .env when the portal gives it.

## Step 1: rotate the relayer key

The old relayer key was exposed in a screenshot. Generate a new relayer wallet into relayer/.env, move all Sepolia ETH and tGLM from the old one to it, and tell me the new address.

## Step 2: device 2 signing

Upload, run `selftest`, and run verify-vector on the output. The signature must match viem byte for byte before anything else. Fix the firmware if it doesn't.

## Step 3: Sepolia

Deploy all contracts, verify them on Etherscan, register prananet.eth (mint the test USDC), write contracts/deployments/sepolia.json, and register device 2 with register-dev.

## Step 4: M1

Real reading from device 2 → relayer → Arkiv entity + Sepolia ReadingAccepted. Run fake-reading against Sepolia and show both rejections. Put the Etherscan, Arkiv explorer and wallet links in the README.

## Step 5: public relayer (M2 support)

Start a Cloudflare quick tunnel for the relayer (HTTPS + WSS) and give me the URL for Arpan's NEXT_PUBLIC_RELAYER_URL. Check the `web` branch/main against the live relayer: the device list, device page, live chart and the Arkiv-backed view must all show device 2. Report anything in web/ that doesn't match TEAM.md; fix it only if it's a one-line config issue, and tell me.

## Step 6: World ID + ENSv2 (M3)

Part 4 of prompt 02 in full: server-side World ID verification in POST /register, nullifier to registerDevice, `max_devices` and `invalid_proof` errors, ENSv2 subname with geohash text record and device address, revoked on slash. Test on the World ID simulator: register device 2 end to end, then show a 4th device from the same human rejected. If World refuses a second proof from the same human, stop and give me the options before changing anything. Check whether web/ has the IDKit widget wired to POST /register; if not, list exactly what's missing for Arpan.

## Step 7: verifier and slashing (M4)

Finish Siddhartha's verifier: verifier wallet in verifier/.env, grant it the verifier role on Sepolia, read readings from the relayer, run simulated neighbour devices in device 2's geohash (`simulated: true`, realistic Mumbai values with noise), apply the SPEC cross-check rule, call flag(), and write flag entities through the relayer. Add the OpenAQ comparison against the nearest Mumbai reference station with a looser threshold (ask me for the OpenAQ key). Serve GET /cells/:geohash on 8081. Prove M4 live: tissue or incense in device 2 → 3 flags → slashed → stake in pool → ENS revoked → visible on WS and the dashboard.

## Step 8: x402 data API and paying agent on Hedera (M5)

Read the current x402 docs and the Hedera x402 support (the official facilitator at x402.org/facilitator lists hedera:testnet; if @x402/hedera isn't on npm, build it from the x402 monorepo). Tell me which Hedera testnet account and keys you need, and I'll create them on portal.hedera.com.
- api/: GET /api/aqi?geohash= behind x402 on hedera:testnet, returning the verifier's cell object, PAY_TO from env, on port 8082. Tunnel it too.
- agent/: a script that discovers the endpoint, gets the 402, pays with no human approval, and prints the data plus the HashScan link. Add a spending budget with a hard cap.
- Revenue → reward pool: route the payment value into RewardPool.fundPool() on Sepolia (a relay step is fine; document how it bridges), and show an honest operator calling claimRewards() while the slashed device gets nothing.
- HCS: log each agent purchase to a Hedera Consensus Service topic and show it on HashScan.
- README: setup, architecture, payment flow, and a settled Hedera transaction ID.

## Step 9: device 1

Ask me to plug in the 30-pin ESP32 (wired per its diagram). Upload DEVICE=1, run selftest, register it, confirm its readings and DHT22 values flow, and that it appears as a second real device on the map.

## Step 10: write-ups

arkiv/schema.md, why-arkiv.md, how-you-use-arkiv.md, reach.md, friction.md (merged); docs/DEBRIEFS.md with the World ID debrief (time to first success, friction, missing docs, top improvement); README complete (setup for every part, architecture diagram, all links, Arkiv writer wallet and a runnable query, "Reused vs new", AI use pointer, demo script).

## Finish

Final status table: every scope item with done / partial / not done and a link or test as proof.
