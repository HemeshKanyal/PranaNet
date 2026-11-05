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

## Reused vs new

**Reused (before the event):**
- Hardware: both sensor devices (ESP32 DevKit + DHT22, ESP32-S3; Sharp GP2Y1014AU0F dust sensors with voltage dividers) were assembled and tested before hacking started. No firmware or software was carried over.

**Libraries and starter kits:** _to be listed as they are added._

**New (written during the event):** everything else in this repo.

## AI use

See [docs/AI-USAGE.md](docs/AI-USAGE.md); prompts are saved in [docs/prompts/](docs/prompts/).

## License

MIT, see [LICENSE](LICENSE).
