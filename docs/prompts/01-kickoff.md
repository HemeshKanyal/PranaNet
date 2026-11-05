# Prompt 01: kick-off (Thu 21:00)

Given to Claude Code in ~/Workspace/PranaNet at hacking start.

---

Read docs/SPEC.md first. It is the source of truth for this project. We are at ETHGlobal Mumbai; hacking started at 21:00 and the first milestone is due by midnight: Foundry tests pass for the Registry and Readings contracts, and the firmware prints sensor values on serial.

Rules for the whole session:
- Commit small and often with clear messages, one logical change per commit. Push after each commit.
- Never commit secrets. Wi-Fi credentials and device private keys go in firmware/secrets.h, .env files go uncommitted; commit *.example versions only.
- Check every library API against its current docs before using it; don't guess signatures.
- After each task, append a line to docs/AI-USAGE.md: files touched, what you did, what I directed.

Tasks, in order:

1. Set up git: `git init`, branch main, remote https://github.com/HemeshKanyal/PranaNet.git. Write a .gitignore covering node_modules, .env*, firmware/secrets.h, Foundry out/ and cache/, broadcast/ files with private data, .DS_Store, build output. Add an MIT LICENSE (copyright Hemesh Kanyal 2026). Commit docs/ (SPEC.md and prompts/) as the first commit, then push.

2. Create the folder layout from SPEC.md with a short README.md (one-line pitch, layout, "Reused vs new" stub saying the hardware was assembled and tested before the event). Create docs/AI-USAGE.md and arkiv/friction.md with headers. Commit.

3. In contracts/, `forge init` (no git submodule conflicts with the root repo) and write:
   - Registry: device registration by a backend role (registerDevice with device address, owner, label, geohash, nullifier hash), max 3 devices per nullifier, active flag, owner lookup. Leave ENS integration behind a clear interface we fill in during M3.
   - Readings: submitEpoch(reading struct, signature) that rebuilds the message exactly as in SPEC.md, applies EIP-191, ecrecovers, requires a registered active device and a strictly increasing nonce, and emits ReadingAccepted.
   - Foundry tests: valid reading accepted; wrong key rejected; replayed nonce rejected; inactive device rejected; 4th device for one nullifier rejected; wrong chainId/contract in the message rejected.
   Commit contracts and tests separately. Run `forge test` and show me the results.

4. In firmware/, write the Arduino sketch (prananet.ino) with `#define DEVICE 1` or `2` and the pins from SPEC.md. Read the Sharp sensor with the 280 µs timing, average 100 samples, measure the clean-air baseline over the first ~10 s after boot, and read the DHT22 on device 1. Print one status line per second. No signing or networking yet. Include secrets.example.h. Use arduino-cli to compile for device 2 (FQBN esp32:esp32:esp32s3, CDC On Boot disabled, COM port /dev/ttyACM0) and upload; show me 20 s of serial output. Commit.

Stop after task 4 and summarise what's done and what's next (task 5 will be secp256k1 signing on the ESP32).
