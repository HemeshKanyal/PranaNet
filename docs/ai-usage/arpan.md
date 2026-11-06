# AI usage log: Arpan (web/)

Tool: Claude Code (Claude Opus 5.5) in the repo, working only in `web/` on branch `web`.
One line per task: date/time (IST) · files touched · what the AI did · what the human directed.

| When | Files | What the AI did | What the human directed |
|---|---|---|---|
| Fri 6 Nov | web/ (create-next-app 15.5.4 scaffold), web/.gitignore | Created `web` branch, scaffolded Next.js (TS, App Router, Tailwind), allowed `.env.example` past `.env*` ignore | Read SPEC/TEAM, work only in my folder on my branch, never commit keys or .env |
| Fri 6 Nov | web/lib/types.ts | TypeScript types for every shared shape in TEAM.md (Reading, Device, DeviceDetail, Flag, LiveMessage, Register req/res). Chose `stake_wei` as a decimal string (TEAM.md doesn't say) | Use the exact shapes from TEAM.md |
| Fri 6 Nov | web/scripts/gen-mocks.mjs, web/mocks/** | Seeded, deterministic mock generator: 5 devices (active/flagged/slashed, real + simulated) in Mumbai geohashes, 200 readings each, flags, `/live` replay, register ok/max_devices | Start with mock data |
| Fri 6 Nov | web/lib/relayer.ts, web/.env.example, web/next.config.ts | Data layer that serves mocks when `NEXT_PUBLIC_RELAYER_URL` is empty, otherwise calls the relayer; bundles mocks for Vercel | Mocks first, switch by env var (TEAM.md) |
| Fri 6 Nov | web/app/page.tsx, web/app/devices/[ens]/page.tsx, web/lib/format.ts | Device list and device page (tables). Fixed BigInt-literal build error, smoke-tested `/`, two device pages and a 404 against `next start` | Asked for a checklist and to stop at a runnable foundation; then "finish the unchecked items" |

| Fri 6 Nov | web/package.json | Installed leaflet, react-leaflet, viem, @worldcoin/idkit (got v4.6.0; read its .d.ts to learn the v4 API: IDKitRequestWidget + server-signed rp_context) | Build map, chart, register with IDKit |
| Fri 6 Nov | web/lib/{geohash,aqi,area,chain,verify}.ts, lib/localities.json | Geohash encode/decode, India CPCB AQI, locality medians, chain config, in-browser rebuild of the 264-byte message + EIP-191 recover | Blockchain verification visible throughout |
| Fri 6 Nov | web/scripts/gen-mocks.mjs, web/mocks/** | Regenerated mocks: 16 devices across 12 Mumbai localities, really signed with public throwaway keys, flag→slash scenario in the live replay | Use mock data as planned |
| Fri 6 Nov | web/components/{LiveProvider,VerifyBadge,SiteHeader}.tsx, app/layout.tsx, app/globals.css, lib/arkiv.ts | Live state (WS /live or mock replay), signature badge, header with always-on chain strip, theme, Arkiv module (mock until schema) | Same |
| Fri 6 Nov | web/components/{SensorMap,MapLoader,LiveChart,Aqi,LiveFeed,HomeDashboard}.tsx, app/page.tsx | `/`: locality search + Near me + chips, live area card (×WHO), stats, AQI-marker map with side panel, live feed, worst→best ranking. Chart palette checked with the dataviz validator | Page structure from user; inspiration: JanVayu (dashboard/search), PurpleAir (sensor map) |
| Fri 6 Nov | web/app/devices/**, components/{DevicesTable,DeviceView}.tsx, app/api/devices | `/devices` filters; `/devices/[deviceId]` (ENS or address) with live chart, on-chain identity, signed readings | Same |
| Fri 6 Nov | web/app/records/**, components/RecordView.tsx | `/records/[recordId]` Arkiv entity + 6-step "check it yourself" verification | Same |
| Fri 6 Nov | web/app/register, app/api/{register,rp-context}, components/{RegisterForm,WorldIdButton}.tsx, .env.example | 3-step register flow, IDKit 4 widget or simulated proof, rp_context signing route, register proxy | Same |
| Fri 6 Nov | web/app/about | Pipeline explainer, flag rule, privacy, stack, honest limits | Same |
| Fri 6 Nov | web/components/SensorMap.tsx, globals.css | Checked with headless Edge (scratchpad playwright-core): found CARTO tiles need an API key, switched to OSM; drove register + flag/slash replay end to end | Make sure it works |

## Friction

None with Arkiv yet (web/ is not reading Arkiv directly so far).
