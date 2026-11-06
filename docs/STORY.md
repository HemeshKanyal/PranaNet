# PranaNet story site: design

**What the site must say in one breath:** air-quality readings are easy to fake, and it keeps happening, from Xi'an to Delhi. PranaNet makes them hard to fake by letting anyone run an honest node, paying for honest work, and punishing cheating. It's a global problem; Mumbai is just where we start.

The dashboard answers "what is the air like right now?". The story answers "why should anyone believe it?". Arpan's folk-art scenes belong in the story, not behind the dashboard.

## Positioning

- **Origin:** Delhi, winter 2025. People's home sensors kept showing far worse air than the official numbers, while officials were accused of spraying water around monitoring stations. (Hemesh's own experience; tell it in first person on the site.)
- **Problem:** global. Whoever is being measured often controls the meter.
- **Answer:** a democracy of honest nodes. Anyone can run one, one human gets one voice (World ID, max 3 nodes), every reading is signed at the source, neighbours and official stations cross-check each other, honest work earns, cheating loses stake.
- **Beachhead:** Mumbai, because dust monitoring is already legally required at construction sites there, so there are paying customers on day one. Delhi NCR next, then any city.
- **Not partisan.** The site never takes a side. Delhi allegations are presented as allegations, with the government's response alongside. China's cases (convictions) show this isn't about one country or one party. Line to use: *"It doesn't matter who holds power. The people being measured shouldn't be the only ones holding the meter."*

## Evidence wall (chapter 1)

Headline cards, never screenshots or cut-outs of articles (those are someone else's copyrighted work). Each card = publication, date, **our own one-line summary**, link. Keep wording exactly this careful.

| Card | Our summary | Source |
|---|---|---|
| Xi'an, China, 2016 | Officials stuffed cotton into air monitors 28 times; seven were jailed in 2017 | [Caixin, 29 Jan 2018](https://www.caixinglobal.com/2018-01-29/court-papers-reveal-how-officials-faked-xian-air-pollution-readings-101204613.html) |
| Hunan, China, 2018 | Workers sprayed mist cannons near monitoring stations during smog, per a provincial notice | [Caixin, 2 Feb 2018](https://www.caixinglobal.com/2018-02-02/what-bad-air-hunan-officials-use-mist-cannons-to-fool-pollution-meters-101206784.html) |
| Delhi, Oct 2025 | After a water-sprinkler video at the Anand Vihar monitor, reporters found the ground still wet and the air still toxic | [Newslaundry, 27 Oct 2025](https://www.newslaundry.com/2025/10/27/ground-still-wet-air-stays-toxic-a-reality-check-at-anand-vihar-air-monitor-after-water-sprinkler-video) |
| Delhi, Diwali 2025 | 163 hours of peak-period AQI data were lost, against 34 hours the year before | [The Straits Times via The Star, 2 Dec 2025](https://www.thestar.com.my/aseanplus/aseanplus-news/2025/12/02/indias-capital-accused-of-tampering-with-air-quality-readings-to-make-pollution-look-less-dire) |
| Delhi, Nov 2025 | A reporter watched a sprinkler truck repeatedly spray around the Jahangirpuri station; officials called the charges politically motivated and said sprinkling is citywide | same |
| Supreme Court, 17 Nov 2025 | Asked the Delhi government to explain its AQI equipment and how accurate it is | [The Leaflet](https://theleaflet.in/amp/story/leaflet-reports/supreme-court-asks-delhi-government-to-detail-aqi-monitoring-equipment-and-its-accuracy) |
| Survey, Oct 2025 | 87% of residents in and around Delhi had little or no trust in official air data | Straits Times, as above |

Closing line under the wall: *Spray it, switch it off, stuff it with cotton: when one party owns the meter, the number is whatever they need it to be.*

## The character

A hooded figure in a **cloak covered in eyes**, with an emoji mask showing the air's mood. Call it **the Watcher**. The cloak is PranaNet in one picture: one eye can be fooled; a cloak of eyes watching each other can't. Every node on the site is drawn as an eye.

| Scene | Pose | Used for |
|---|---|---|
| live category | — | Hero: today's real air at our nodes |
| `very-poor` | pointing, angry | Ch 1: it's happened before (evidence wall) |
| `satisfactory` | shrugging | Ch 2: why tampering works |
| `moderate` | seated, calm gesture | Ch 3: signed at the source |
| `poor` | standing, watchful | Ch 4: a democracy of honest nodes |
| `severe` | gas mask, walking away | Ch 5: proof of honest work (the cheat gets slashed) |
| `good` | walking with a builder in a garden | Ending: nobody owns the truth |

## Visual language

- Palette from the art: vermilion `#C8341E`, saffron `#F2A12E`, maroon `#5A1A12`, olive `#6B6A2A`, leaf `#6E8B3D`, cream `#F3E3BE`, ink `#2A1A12`.
- Folk-art border bands as section dividers, drawn in SVG/CSS.
- Type: **Rozha One** (headings) + **Mukta** (body), Google Fonts.
- Nodes = eyes (SVG): open = honest, half-closed = offline, red = flagged, crossed out = slashed, dotted outline = simulated (always labelled), gold = official reference station.
- Motion: sticky scene backgrounds that cross-fade on scroll, slow zoom, blinking eyes. Respect `prefers-reduced-motion`.
- Images: `bg/<scene>-1600.webp` / `-800.webp` via `next/image`; only the current and next scene load.

## Chapters

**0. Hero (live).** Scene = live AQI category at our nodes. Headline: *The air doesn't lie. The readings can.* Sub: *PranaNet is a network of honest air sensors that anyone can run, check and get paid for.* Live chip: "Right now at BKC, Mumbai: AQI 63 · 2 real nodes, 5 simulated". Buttons: Run a node · See the live map.

**1. It's happened before** (`very-poor`). The evidence wall above, cards appearing one by one, plus Hemesh's Delhi story in two sentences.

**2. Why tampering works** (`satisfactory`). One meter, one owner. List the tricks as icons: spray water, switch it off, stuff it with cotton, move it somewhere clean, drop the data. *Every one of them works because nobody else is watching.*

**3. Signed at the source** (`moderate`). **Interactive:** a real reading from `bkc-01`, fetched live with its signature. "Verify" recovers the node's address in the browser (viem). Then edit the PM2.5 value: the check fails instantly. *Not even the server that carries the data can change it.*

**4. A democracy of honest nodes** (`poor`). Anyone can run a node: a home, a school, a housing society. **One human, one voice:** World ID proves you're a unique person without revealing who; each person can run at most 3 nodes, so nobody can fake a crowd. **Interactive "Try to cheat" panel** around the real node map (eyes, median line, official station in gold):
  - **Spray water** on one node → it reads far lower than its neighbours → flagged.
  - **Burn incense** next to it → reads far higher → flagged.
  - **Switch it off** → the eye closes, the neighbours keep the map alive, and the gap is recorded publicly.
  The rule shown on screen: flagged if more than 50% *and* more than 25 µg/m³ away from the neighbourhood median.

**5. Proof of honest work** (`severe`). Every signed reading that agrees with its neighbours is a unit of honest work and earns from the reward pool. Every node stakes a deposit. Three flags in a row and it's slashed. Scroll-driven sequence of the **real** run: smoke → 904 µg/m³ → flag, flag, flag (Etherscan links) → slashed → stake slides into the pool → `bkc-02.prananet.eth` struck through. *Cheaters pay the honest.*

**6. Check it yourself.** The latest readings, read **straight from Arkiv** in the browser, each with "verify signature" and an explorer link. *You don't have to trust us, or anyone.*

**7. Who pays for honest air.** Customers buy verified data, not raw readings: builders proving they're compliant, regulators auditing without inspectors, apps, researchers, and AI agents that pay per request over x402 on Hedera. Show the real agent payment (HashScan), the HCS log and `fundPool` → `claimRewards`. No token: rewards come from revenue.

**8. Start local, go global.** Animated map/globe: **BKC, Mumbai (live now)** → Mumbai's 3,166 construction sites, where monitoring is already mandatory → **Delhi NCR**, where this started → any city with a dispute about its air. Small print: China, Delhi and others show the problem is everywhere.

**9. Ending** (`good`). The Watcher and the builder walk together. *When anyone can run the meter, nobody can own the truth.* Buttons: **Run a node** · **Live map** · **GitHub** · **Docs**.

Footer: "Built at ETHGlobal Mumbai 2026 · ENS · World · Arkiv · Hedera · Sepolia", team names, honest notes (the hackathon sensor is a low-cost PM proxy; simulated neighbours are labelled; the ESP32 key can be extracted, so production uses a secure element).

## Pages

- `/` → the story.
- `/live` → the dashboard, world map that zooms to wherever nodes exist (nothing city-specific hard-coded).
- `/run-a-node` → the democracy page: parts list (~₹1,000: ESP32, Sharp GP2Y1014AU0F, 150 Ω, 220 µF, 10k + 22k, optional DHT22), wiring diagram, flash the firmware, register with World ID, stake, start earning. Link the GitHub firmware folder.
- `/devices`, `/records/…`, `/register`, `/about` unchanged.
