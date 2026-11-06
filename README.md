# PranaNet

Air-quality data that holds up in a dispute: ESP32 sensors sign every reading, neighbours and official stations cross-check it, and cheaters lose stake.

Built at ETHGlobal Mumbai 2026 (Building from Scratch track). Full spec: [docs/SPEC.md](docs/SPEC.md).

## Layout

```
contracts/   Foundry: Registry, Readings, Stake, RewardPool
firmware/    ESP32 (Arduino), one sketch with a DEVICE switch
relayer/     Node + TypeScript: device intake, Arkiv writes, batching, tx sender
verifier/    cross-check job, OpenAQ fetch, simulated devices
api/         x402-protected data API on Hedera
agent/       script that discovers the API and pays
web/         Next.js dashboard (map, device pages, register flow)
arkiv/       schema, friction log, Arkiv write-ups
docs/        SPEC.md, AI-USAGE.md, DEBRIEFS.md, prompts/
```

## Live (Sepolia + Arkiv Rabdi)

| What | Link |
|---|---|
| Registry | [0x99c68cFB…99b5](https://sepolia.etherscan.io/address/0x99c68cFB7E9cD6D095162DEfe8f18c6219A499b5#code) (verified) |
| Readings | [0x0107bC2B…ef4e](https://sepolia.etherscan.io/address/0x0107bC2Bb71166bC08E0d7f9a7Ef9839E140ef4e#code) (verified) |
| Stake | [0x005bc4AF…fe19](https://sepolia.etherscan.io/address/0x005bc4AF27eE94E8ae5425F097645d3b2457fe19#code) (verified) |
| RewardPool | [0x68cfEcd8…7d02](https://sepolia.etherscan.io/address/0x68cfEcd8c613A5E5DBcFeF6041dE8ad182F07d02#code) (verified) |
| prananet.eth (ENSv2) | [register tx](https://sepolia.etherscan.io/tx/0x1e1df385c7d64a5837626a9855d701d1cf4ba8c16869afb146cebd9e0f14213e), subname registry [0xb6C47798…8b63](https://sepolia.etherscan.io/address/0xb6C4779845D6d0875DC6F7BCF7C656990D1A8b63), resolver [0x5d05e294…9dF3](https://sepolia.etherscan.io/address/0x5d05e294e7bee7CC8c86d05732CEB2FCE8789dF3) |
| Relayer wallet (Sepolia tx sender **and** Arkiv writer) | [Sepolia](https://sepolia.etherscan.io/address/0x3a1F21F1c6f05eFA35BB7178274b41C8873CCa67) · [Arkiv](https://rabdi.explorer.arkiv.network/address/0x3a1F21F1c6f05eFA35BB7178274b41C8873CCa67) |
| Device 2 (ESP32-S3) `andheri-01.prananet.eth` | key generated on the device: `0xab29ec5df28b9fbc4804ab4d5f4ecae4833c4e32` |
| M1: a real device-2 reading on Sepolia | [submitEpoch nonce 20 → ReadingAccepted](https://sepolia.etherscan.io/tx/0xc8148daac8a630c55c8257220ec33b55f3b5172bc8295a80266a487db39b5c94) |
| M1: the same reading on Arkiv | [entity 0x5f826e8d…](https://rabdi.explorer.arkiv.network/entity/0x5f826e8df8d7d1ae76faecbdffddab07dd3de0db71d94c89aa3bef46985a8fcd) ([tx](https://rabdi.explorer.arkiv.network/tx/0x919df86f10142bdeef7e710e16799a16c8e0e805ecb3692b7b56e2a8a5d02b7d)) |
| Forged reading rejected on-chain | [reverted with InvalidSignature](https://sepolia.etherscan.io/tx/0x258afb1976c2169dedd227210b74024dc3cb7d1a21c3968141592cd432088c50) (relayer also answered 401 `bad_signature`) |
| Device signing self-test vs viem | [docs/evidence/device2-selftest.md](docs/evidence/device2-selftest.md) |

## Reused vs new

**Reused (before the event):**
- Hardware: both sensor devices (ESP32 DevKit + DHT22, ESP32-S3; Sharp GP2Y1014AU0F dust sensors with voltage dividers) were assembled and tested before hacking started. No firmware or software was carried over.

**Libraries and starter kits:**
- [Foundry](https://getfoundry.sh) + forge-std 1.17.0 (contracts, tests)
- Arduino-ESP32 core 3.3.12, Adafruit DHT sensor library 1.4.7 (firmware)

**New (written during the event):** everything else in this repo.

## AI use

See [docs/AI-USAGE.md](docs/AI-USAGE.md); prompts are saved in [docs/prompts/](docs/prompts/).

## License

MIT, see [LICENSE](LICENSE).
