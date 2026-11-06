# PranaNet roadmap: from hackathon demo to a real network

**Where we are (Nov 2026, ETHGlobal Mumbai).** Two ESP32 boards with a Sharp GP2Y1014AU0F dust sensor sign every reading with a key in flash. A relayer stores raw readings on Arkiv and submits them to Sepolia. A single verifier cross-checks them against five *simulated* neighbours and the OpenAQ reference station at BKC, and slashes after three flags. Operators are World ID humans with ENS names, and AI agents pay per request over x402 on Hedera.

It works end to end, but it isn't yet something a builder, a regulator or a court would rely on. This plan covers what we still have to build to get there.

The model we're learning from is **WeatherXM**, a community weather network that already does much of this for weather. According to its docs and press:
- every data point is signed at the source by a secure element in the station;
- the station's GPS location is signed too, and a daily **Proof of Location** score (0–1) must clear a threshold before the station earns rewards;
- relocating a station resets that score for a penalty period;
- a separate **Quality of Data** score feeds into rewards;
- well-sited stations in rare locations earn more.

PranaNet should apply the same discipline to air quality. Air quality is harder than weather in one way: the people being measured have a direct incentive to cheat.

---

## Lessons from the hackathon that shape this plan

| What happened | What it taught us |
|---|---|
| `bkc-02b` was slashed while honest: a dirty baseline at boot turned clean air into three readings of 0.0 | Penalties must tell faults apart from fraud. A device fault should never cost the operator their stake. |
| The ESP32's key lives in flash and can be extracted with physical access | Production nodes need a secure element and secure boot. |
| The Sharp sensor is a PM proxy that needs a one-point calibration against a station | Real deployments need a laser PM sensor with per-unit calibration. |
| Cross-checks only "worked" because 5 of 7 neighbours were simulated | Judging needs a minimum density of *real* nodes from *different* operators. |
| The ENS revoke silently ran out of gas inside a try/catch | Use fixed gas budgets and alerting on every critical side effect. |
| The two boards couldn't share one phone hotspot | Use proper connectivity (Wi-Fi with fallback, LoRaWAN, cellular) and store-and-forward. |

---

## Phase 1: PranaNet Station v1, purpose-built hardware (≈ 3–4 months)

The goal is a station whose readings can be trusted *because of the hardware*, not only because of the neighbours.

### Sensing
- **PM:** a laser-scattering particle sensor (Sensirion SPS30 / SEN5x class, or Plantower PMS-class as a cost option). It gives real PM1 / PM2.5 / PM10 mass concentrations, not a proxy.
- **Temperature and humidity** (Sensirion SHT4x class), used for the humidity correction that optical PM sensors need in Mumbai's monsoon air.
- **Station Pro variant:** NO₂ and O₃ electrochemical cells (Alphasense class) for construction sites and traffic junctions.
- **Indoor variant:** CO₂ (SCD4x class) for schools and housing societies.

### Identity and integrity
- **A secure element holds the device key.** The key is generated inside the chip at the factory and can never leave it.
  - Option A: a secp256k1-capable element (e.g. NXP SE050), so `ecrecover` in `Readings.sol` keeps working unchanged.
  - Option B: a P-256 element (e.g. Microchip ATECC608), verified on-chain through the P-256 precompile (RIP-7212 on L2s, EIP-7951 on L1).
- **Manufacturer attestation.** At the factory each element's public key is signed by a PranaNet manufacturing key. `Registry` only accepts devices with a valid attestation, which closes the "flash a dev board and call it a station" hole.
- **Secure boot, flash encryption, signed OTA updates and anti-rollback** on an ESP32-S3-class MCU. Each reading carries the firmware hash, so a reading from unofficial firmware is visible.
- **Tamper evidence**, signed into each reading as device state rather than left to inference:
  - an enclosure-open switch;
  - an accelerometer to detect when the station is moved or shaken;
  - fan-speed and flow monitoring, so a blocked inlet (the cotton trick) shows up as a fault;
  - a baseline-drift check, so a sensor that has died is flagged as broken rather than as a cheat.

### Location
- A **GNSS module** sends a daily **signed location packet**.
- A WeatherXM-style **Proof of Location** score must clear a threshold before the station earns rewards.
  - Relocation resets the score for a penalty period.
  - The public location stays coarse (a 6-character geohash); the exact fix is only used to compute the score.
- Install check in the operator app: a photo of the mounting, height above ground, and distance to obvious sources (kitchen exhaust, generator). The photo goes to the operator's record, not on-chain.

### Connectivity and power
- **Connectivity:** Wi-Fi as standard, with LoRaWAN or LTE-M/NB-IoT for construction sites and rooftops without Wi-Fi.
- **Store-and-forward:** a signed backlog in flash, so outages produce late readings rather than missing ones. The nonce already makes replays harmless.
- **Power:** 5 V mains as standard; a solar and battery kit for sites.

### Enclosure and calibration
- **Enclosure:** IP65, a radiation shield or louvred housing, and an inlet that is easy to clean.
- **Calibration:**
  - every production batch is co-located for days to weeks next to a reference-grade (BAM/FEM) monitor;
  - each unit gets a calibration certificate (offsets, humidity curve, batch, reference used), stored on Arkiv and linked from its ENS name;
  - stations are re-checked periodically by rotating a few units through CPCB/MPCB reference sites.

### Cost target
These are targets to validate with a manufacturing partner, not quotes:
- **Station v1:** a bill of materials of roughly US$90–130, aiming at under ₹10,000 retail.
- **Station Pro (gases):** more.
- **Hackathon kit:** stays at ~₹1,000 as a DIY "community node", clearly labelled lower tier.

### Exit criteria
- 20 v1 stations co-located at a reference site agree with it within the target error band across a monsoon and a winter week.
- None of the five trick scenarios goes undetected: water, switching off, cotton, relocation, dropped data.

---

## Phase 2: protocol hardening (in parallel with Phase 1)

### Fair judging
- **A Quality-of-Data score per reading** replaces the binary flag. Its inputs:
  - agreement with the neighbourhood median;
  - agreement with the reference station;
  - sensor health (fan, flow, drift);
  - the humidity regime;
  - uptime;
  - firmware status.
- **Rewards are weighted by** QoD × Proof of Location × coverage, so a station in an unmonitored ward earns more than the tenth one on the same street.
- **Graduated consequences instead of an instant slash:**
  1. a warning;
  2. reduced rewards;
  3. a review window in which the operator can submit evidence (a device-fault log, a photo);
  4. a slash only for *tampering evidence* or sustained, unexplained divergence.
  - Honest outages and device faults never cost stake. This is the `bkc-02b` lesson.
- **Minimum real density:** a node is judged only when it has, say, ≥ 3 real neighbours from ≥ 2 different operators, or a reference station within range. Simulated neighbours are removed entirely.
- **Collusion resistance:**
  - neighbours from the same operator get reduced weight;
  - correlated clusters, where every node of one operator drifts together, are detected;
  - reference stations act as anchors;
  - World ID (one human), stake and hardware attestation together set the cost of a fake crowd.

### Decentralising trust
- **Multiple independent verifiers.** Verdicts are posted optimistically with a bond and can be challenged. Alternatively, a threshold signature from a verifier set replaces the single verifier key.
- **Multiple relayers.** A device may post to any of them. Relayers are untrusted by design (the signature covers the values), so anyone can run one.
- **Verifier code and scoring parameters are public and versioned;** each verdict records the version it used.

### Chain and storage at scale
- **Move from Sepolia to an L2 mainnet** (Base / Optimism / Arbitrum class).
  - Instead of one transaction per reading, commit **one Merkle root per cell per epoch**.
  - A single reading can still be proven against the root, and the contract checks a sample of signatures, or all of them in a ZK or optimistic batch.
- **Storage:**
  - raw readings stay on Arkiv for fast queries;
  - a long-term archive (longer-lived Arkiv entities, or Filecoin/IPFS with the Merkle roots on-chain) keeps years of data auditable for compliance cases.
- **Security:**
  - contract audit before mainnet;
  - firmware and hardware penetration test;
  - a public bug bounty.

### Exit criteria
- 1,000 simulated-adversary runs: false-slash rate ≈ 0 for honest-but-faulty nodes, and every scripted tampering case caught.
- An external audit is closed.

---

## Phase 3: the product people pay for (≈ months 4–9)

Revenue funds the reward pool, so the network only lasts if the data sells.

| Customer | Product | Notes |
|---|---|---|
| **Construction sites (beachhead, Mumbai)** | Compliance kit: stations + a dashboard + automatic monthly reports with every reading's signature and the cross-check | Dust monitoring at construction sites is already required in Mumbai, so there is an existing budget. Sell per site per month. Alerts when thresholds are crossed so the site can act before an inspector does. |
| **Regulators (MPCB, BMC, later CPCB/DPCC)** | Audit portal: any site's history, verifiable without trusting the site or us; tamper and outage reports | Pilot free with one ward; the pitch is "inspect without inspectors". |
| **Housing societies, schools** | Community node plan + public page for their building | Low price; they are also operators who earn. |
| **Apps, media, researchers** | API with subscriptions and per-call x402 for agents; bulk historical datasets with proofs | x402 already works; add fiat billing (Stripe/UPI) and API keys. |
| **Insurers, health researchers** | Exposure datasets by ward | Later; needs long history. |

### Operator experience
- A **mobile app**:
  - claim a station by QR code;
  - a guided install with the photo check;
  - live health and Quality-of-Data scores;
  - rewards, and "your station needs cleaning" notifications.
- **Payouts in fiat (UPI)** as well as on-chain, so operators don't need crypto.
- **Stake** can be sponsored by the customer or by a partner, so that honest operators aren't priced out.

### Business and compliance
- **Manufacturing:** a manufacturing partner, BIS and WPC certification for radios in India, warranty and RMA.
- **Certification:** apply for official performance certification of the sensor-based monitor.
- **Legal:** clear disclaimers on indicative vs. reference data.
- **Privacy:** no personal data on-chain; only coarse locations are public.
- **No token at launch.** Rewards come from revenue (as today). Reconsider only if a token solves a real coordination problem.

### Exit criteria
- 50 paid construction sites in Mumbai and one regulator pilot.
- 500 stations live, ≥ 80% of rewarded readings above the QoD threshold.

---

## Phase 4: scale (year 2)

- **Delhi NCR**, where this started: winter-season deployment around disputed monitoring stations, with neighbourhood groups as operators.
- **More cities:** any city with a dispute about its air. The dashboard already derives areas from whatever devices exist, with nothing city-specific hard-coded.
- **An open hardware spec:** third parties can build compatible stations if they pass PranaNet calibration and attestation, similar to how WeatherXM-style networks onboard other manufacturers' hardware.
- **Governance:** a community process for verifier parameters, reward weights and certified manufacturers.

---

## Software work list (current codebase → production)

**Firmware** (`firmware/`)
- Port to the v1 board (SPS30/SEN5x, SHT4x, GNSS, secure element).
- Secure boot, signed OTA, store-and-forward, and tamper and health telemetry in the signed payload.

**Contracts** (`contracts/`)
- Attestation registry for manufacturers and devices.
- Merkle-root epoch commits.
- Graduated penalties with a review window.
- QoD-weighted reward claims.
- P-256 support.
- Deployment to an L2.

**Relayer** (`relayer/`)
- Stateless, horizontally scalable.
- Multiple instances; batching into Merkle roots.
- Per-device rate limits; backpressure; observability.

**Verifier** (`verifier/`)
- QoD scoring and density rules; no simulated nodes.
- Humidity correction.
- Reference-station anchoring for every city.
- Optimistic posting with bonds.

**Web** (`web/`)
- Operator app (or PWA).
- Construction-site dashboard and PDF reports.
- Regulator audit portal.
- Public ward pages.
- Keep the live map and the "verify it yourself" record pages exactly as they are now.

**Data**
- Long-term archive with proofs.
- Public dataset releases.
- A methods page that documents every correction.

---

## Risks and open questions

- **Accuracy vs. cost:** low-cost optical PM sensors drift and over-read in high humidity. Calibration and the humidity model have to be good enough for a compliance setting, and we must be honest about where they aren't.
- **Regulatory acceptance:** will regulators accept sensor data as evidence, or only as a screening tool? Run the pilot to find out early.
- **Adversaries with physical access** can still move air around a station: fans, enclosures, a clean-air box. Density and tamper sensing raise the cost but can't make it zero.
- **Hardware is slow and capital-intensive.** Start with the DIY community node plus a small v1 batch and keep the protocol hardware-agnostic.
- **Key management at the factory** becomes the new root of trust. It needs its own HSM, audits and a revocation path.

*This document is a plan, not a commitment of dates. Sensor and component names are examples of classes we'll evaluate, and costs are targets to validate.*

Sources on WeatherXM: [Proof of Location](https://docs.weatherxm.com/project/proof-of-location) · [PoL in rewards](https://docs.weatherxm.com/rewards/proof-of-location) · [docs introduction](https://docs.weatherxm.com/introduction) · [The Block (sponsored), Feb 2024](https://www.theblock.co/post/277530/weatherxm-surpasses-1-5m-station-days-as-they-prepare-for-mainnet-rewards)
