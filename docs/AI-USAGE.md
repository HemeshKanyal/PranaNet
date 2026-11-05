# AI usage log

Tool: Claude Code (Claude Opus 5.5) in the repo root. Prompts are saved verbatim in [prompts/](prompts/).
One line per task: date/time (IST) · files touched · what the AI did · what the human directed.

| When | Files | What the AI did | What the human directed |
|---|---|---|---|
| Thu 5 Nov ~21:10 | .gitignore, LICENSE, docs/ | git init on main, set remote, wrote .gitignore and MIT LICENSE, committed docs first, pushed | Prompt 01 task 1: repo setup, ignore list, license holder, commit order |
| Thu 5 Nov ~21:15 | README.md, docs/AI-USAGE.md, arkiv/friction.md, */.gitkeep | Created folder layout from SPEC, README with pitch/layout/Reused-vs-new stub, this log, Arkiv friction log | Prompt 01 task 2: layout, README contents, hardware-pre-built statement |
| Thu 5 Nov ~21:40 | .gitmodules, contracts/ (foundry.toml, src/Registry.sol, src/Readings.sol, src/interfaces/IDeviceNamer.sol, test/*.t.sol) | forge init with forge-std as a root-repo submodule; wrote Registry (backend role, 3-per-nullifier cap, active flag, ENS hook interface), Readings (SPEC message rebuild, EIP-191, low-s ecrecover, nonce), 19 Foundry tests, all passing. Chose concrete field types for the packed message (uint256/int256) | Prompt 01 task 3: contract behaviour, required test cases, separate commits |
| Thu 5 Nov ~22:00 | firmware/prananet/prananet.ino, firmware/prananet/secrets.example.h | Wrote sensor sketch (DEVICE switch, Sharp 280 µs timing, 100-sample average, 10 s boot baseline, DHT22 on device 1, 1 Hz status line); installed Adafruit DHT sensor library 1.4.7; compiled for device 2 (esp32s3, CDC On Boot disabled) and device 1. Upload not done: no board on /dev/ttyACM0 | Prompt 01 task 4: pins, timing, baseline, compile/upload target |
