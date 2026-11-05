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

## Friction

None with Arkiv yet (web/ is not reading Arkiv directly so far).
