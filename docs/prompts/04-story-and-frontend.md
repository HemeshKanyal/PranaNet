# Prompt 04: device fixes, dashboard fixes, story site (Fri 22:15)

Given to Claude Code in ~/Workspace/PranaNet.

---

Three parts, in order. Commit small and push. I agreed with your frontend review. Arpan knows you're editing web/ tonight; work on a branch `story` and open a PR into main when each part is done, so he can review. Don't delete Arpan's components; move or reuse them.

## Part A: device fixes (before any video)

1. Firmware: the baseline may only move **down** (track the lowest voltage seen after boot), so dirty air at boot can't produce later zeros. While the sensor reads below its baseline, report the baseline value, never 0. Flash both boards (identify by `addr`), run selftest + verify-vector.
2. README demo script: keep the sensor clear whenever a board resets (plug-in, flashing, demo-reset).
3. `npm run demo-reset -- --warm`, then re-register device 2 as `bkc-02c`. Confirm readings flow and it's staked.

## Part B: dashboard fixes (web/)

Do items 1–13 from your review. Specifically:
- New WebP backgrounds are already in `web/public/bg/` (`<scene>-1600.webp` and `<scene>-800.webp`, `very-poor` with a hyphen). Use them via next/image with `sizes`, load only the current one, and delete the six PNGs.
- The dashboard is a dashboard: remove the full-screen illustrated hero there. Keep a small AQI-coloured accent at most. The illustrations move to the story site.
- Default area = where the real devices are (derive from `GET /devices` / ENS geohash records), add BKC, no hard-coded Andheri anywhere, neutral "no data" state, `aqiStyle` as the single source of category bands, bring back health advice and PM10, "2 real · 5 simulated", fix the session counter label, mobile header/fold/svh fixes, a text scrim for legibility, lighter blur.
- Move the dashboard from `/` to `/live`. Keep every other route.

## Part C: story site at `/`

Build exactly the design in `docs/STORY.md`. Read it fully first.
- New files only where possible: `app/page.tsx` (story), `components/story/*`, `lib/story/*`. Reuse the existing relayer client, Arkiv client and the in-browser signature verification from the records page; don't duplicate them.
- Live data, nothing hard-coded: hero scene and chip from the live BKC cell; chapter 3 uses a real `bkc-01` reading; chapter 4 uses the real device list plus the OpenAQ station value; chapter 7 reads Arkiv directly in the browser. Tx links for chapters 5 and 8 come from `docs/evidence/*.md` (put them in one `lib/story/evidence.ts`).
- Interactions: chapter 3 tamper demo (edit a value → signature fails, using viem in the browser), chapter 4 slider cross-check with the SPEC rule (50% and 25 µg/m³), chapter 5 scroll-driven flag → slash → ENS strike-through.
- Motion: CSS + IntersectionObserver (or `motion` if it's clearly simpler); sticky scene backgrounds that cross-fade, slow zoom, blinking SVG eyes. Respect `prefers-reduced-motion`. No layout shift.
- Fonts: Rozha One + Mukta via `next/font/google`. Palette and eye states from STORY.md.
- Mobile first: check at 390 px and 1440 px. Total transfer for `/` under 1.5 MB on first load.
- Check it: `npm run build` and lint pass; open it in Chrome against the live Render relayer, scroll every chapter on desktop and phone sizes, take screenshots into `docs/screenshots/` (we need them for the ETHGlobal form), and fix anything that looks off before you call it done.

Finish with: the Vercel-ready state (env vars list), the PR links, and the screenshots.
