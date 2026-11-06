# Reach: who could use this beyond the hackathon

**The problem in Mumbai.** Official continuous reference monitors (CPCB/MPCB) are expensive and sparse relative to a metro region of over 20 million people: our venue cell at Bandra Kurla Complex happens to have one 0.5 km away, but most neighbourhoods are kilometres from the nearest station. Low-cost sensors fill the gaps, but their numbers are easy to dispute: anyone can claim a reading, sensors drift, and a single bad unit (or someone gaming a dashboard) poisons a map.

**What PranaNet adds:** readings that are signed on the sensor, cross-checked against neighbours and the nearest reference station, backed by stake that is lost on repeated bad data, and stored publicly with their signatures on Arkiv so anyone can re-check a disputed reading without asking us.

| Who | What they get | Why Arkiv matters to them |
|---|---|---|
| Resident welfare associations, schools, clinics | A sensor on the balcony that earns small rewards and shows up on a public map | They can show the raw, signed data for their street, not a screenshot of an app |
| Journalists and researchers | Queryable minute data by cell and time, with provenance | `ownedBy` + signature per record: they can cite and re-verify without our cooperation |
| Municipal ward offices / pollution boards | A dense indicative layer between reference stations, with bad sensors removed automatically | Expiring raw data, permanent enforcement record on-chain |
| Data buyers and AI agents (health apps, logistics, insurers) | Pay-per-call cleaned cell data over x402 (HBAR), no account, budgeted agents | The paid answer can be traced back to Arkiv records and on-chain flags |

**Unit economics at the event:** a reading costs ~0.00019 tGLM to store on Arkiv (measured); a data call is priced at 0.1 HBAR and that revenue is bridged into the RewardPool that pays honest operators (≈0.00001 ETH per accepted epoch). A slashed operator's stake funds the honest ones.

**Next steps to real reach:** a calibrated PM2.5 sensor (the Sharp unit is a proxy), production World ID (real Orb humans, the same 3-devices cap), a stable ENS-named relayer, and opening `POST /register` to anyone with a World ID.
