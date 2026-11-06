# M3: World ID registration + ENSv2 subnames (Fri 6 Nov ~17:50 IST)

Flow: web /register (IDKit 4 widget, staging) → World ID Simulator (identity 0x18310f83) →
relayer POST /register on Render → POST developer.world.org/api/v4/verify/{rp_id} →
Registry.registerDevice → DeviceNamer → `<label>.prananet.eth` in the prananet.eth UserRegistry.
Recording: `prananet_worldid_register_and_4th_rejected.gif` (downloaded by the browser).

| # | Device | Result |
|---|---|---|
| 1 | bkc-01 `0x4379c30a…55c0` (device 1, DHT22) | registered, World ID `reused=false`, tx 0xe5d6f0ce… |
| 2 | bkc-02 `0x0b715555…13b2` (device 2) | registered, same human (`reused=true`) |
| 3 | bkc-test-01 `0x98ed98d0…a94d` (test key, no hardware) | registered, tx [0x4dd5d208…](https://sepolia.etherscan.io/tx/0x4dd5d208d0cda8b07ad3293bc7f7ed66cbed4130eecf8bf57066e7d9de633d1c) |
| 4 | bkc-test-02 `0xe128b619…ad23` | **rejected**: `max_devices` ("This World ID already has 3 devices registered") |

- World ID returned success for every repeat proof (`reused=true`, "Proof verified successfully (nullifier reuse)"), so the per-human cap is enforced by `Registry.devicesPerNullifier` (= 3 on-chain for this nullifier).
- ENS through the ENSv2 UniversalResolver on Sepolia: `bkc-01.prananet.eth` → addr `0x4379C30a…55C0`, text `geohash` = `te7u6n`; `bkc-02.prananet.eth` → `0x0B715555…13B2`, `te7u6n`.
- Stake: 0.01 ETH each on bkc-01 ([tx](https://sepolia.etherscan.io/tx/0x4d39bf8a45f36a24b8b827d6c4da88fbece650ebd5d69677307cc47ad949139c)) and bkc-02 ([tx](https://sepolia.etherscan.io/tx/0x333ed90d80011639ddcf6f32223a6641f1e142294bd43de80426be3b441a1514)).
