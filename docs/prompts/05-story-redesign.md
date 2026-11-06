# Prompt 05: story site visual redesign (Sat 00:30)

Given to Claude Code in ~/Workspace/PranaNet. Hemesh rated the current story 3/10: full-bleed paintings that zoom in and out and cross-fade on scroll look cheap. Keep every piece of logic and data (live hero, evidence wall, tamper demo, try-to-cheat panel, slash replay, Arkiv feed, who pays, map, /run-a-node). Change the **visual design and layout only**. Time-box: about 90 minutes, then deploy.

## New assets (already in the repo)

`web/public/story/` contains transparent cut-outs made from Arpan's scenes:
- `watcher-standing`, `watcher-shrug`, `watcher-seated`, `watcher-pointing`, `watcher-gasmask`, `watcher-with-builder`, each as `-900.webp` (desktop) and `-480.webp` (mobile)
- `prop-peacock.webp` (framed peacock painting), `prop-pot.webp` (folk pot)

Stop using the full-scene backgrounds (`bg/*.webp`) on the story page entirely.

## Direction: "editorial folk"

Reference: Hemesh's own risklens.hemeshkanyal.com, a dark, editorial "notebook" with numbered sections (I, II, III…), one composed visual per section and restrained colour. Combine that with the folk art.

- **Ground:** dark warm ink `#15110C` with a very subtle paper-grain overlay (inline SVG noise, about 4% opacity). Text cream `#F3E3BE`, muted text `#BFA98A`, accents saffron `#F2A12E` and vermilion `#C8341E`, olive `#6B6A2A` for "honest" states.
- **Type:** keep Rozha One (headings) and Mukta (body). Chapter markers as Roman numerals: "I · It's happened before". Generous line height and whitespace, max text width about 60ch.
- **Section index:** like RiskLens, a contents list under the hero (I–IX, clickable), and on desktop a slim sticky side index that highlights the current chapter.
- **Dividers:** a thin folk-border rule between chapters (SVG scallop/dot band in saffron at about 40% opacity), not image strips.

## The stage: cut-out characters breaking out of arches

Each chapter is a two-column editorial layout (alternating sides): text on one side, a **stage** on the other.
- The stage is a **mihrab-shaped arch** (pointed folk arch, SVG/CSS `clip-path`) filled with that chapter's mood colour (flat colour plus a faint repeating folk motif drawn in SVG), with a thin cream outline.
- The **cut-out Watcher stands in front of the arch and breaks out of it**: feet below the arch's base line, hood above its top edge, with a soft ground shadow (ellipse) under the feet. That overlap is what makes it read as a cut-out with depth.
- Props are placed sparingly: the peacock painting hangs beside the arch in chapters I and IX, the pot sits at the arch's base in chapters II and VIII.
- Pose per chapter: hero = standing (or whichever pose matches the live AQI mood), I = pointing, II = shrug, III = seated, IV = standing, V = gas mask, IX = with builder.
- Mobile: the stage goes above the text and is smaller (480 px assets); the character still overlaps the arch edges.

## Motion (transform and opacity only; respect `prefers-reduced-motion`)

- **No background zoom and no cross-fades.** Delete the sticky scene background and Ken Burns code.
- On entering view: the arch fades and scales up slightly (0.96 → 1); the character **rises in** (translateY 40px → 0, opacity 0 → 1, about 600 ms, ease-out) about 120 ms after the arch; text lines stagger in.
- Gentle parallax while scrolling: character moves about 8% faster than the arch (small, transform only), so they separate a little.
- Chapter IX: the Watcher and the builder **walk in from the left** to the centre once.
- Hero logo eye: the pupil **follows the cursor** (clamped), and the eye blinks occasionally.

## Hover and interaction

- **Character:** subtle 3D tilt towards the cursor (±6°), lifts 6 px with a deeper shadow, and a small speech label appears by the mask showing the mood (e.g. "Poor · AQI 201–300"). Touch devices: tap toggles the label.
- **Evidence cards (I):** styled as paper clippings on the dark ground (cream card, slight ±1° rotation, small tape strip at the top). On hover they straighten, lift and show "Read the source →". Use our own wording only (as now), never images of articles.
- **Trick tiles (II):** on hover/tap each tile flips or expands to show how PranaNet catches it, e.g. "Spray water → reads far lower than neighbours → flagged", "Switch it off → the gap is recorded publicly; neighbours keep the map alive", "Stuff it with cotton → reads low → flagged", "Move it somewhere clean → its location cell is public on ENS", "Drop the data → missing epochs are visible on-chain".
- **Buttons and links:** saffron underline that sweeps in on hover; primary button fills from vermilion to saffron.
- **Eyes everywhere** (node map, slash replay): blink on hover; flagged eyes pulse red once.
- Visible focus styles for keyboard users on every interactive element.

## Keep, but restyle to the new ground

Chapters III (tamper demo), IV (try to cheat), V (slash replay), VI (Arkiv feed), VII (who pays), VIII (map) keep their logic. Put each interactive module in a cream "ledger card" (cream paper, ink text, folk-dot border) sitting on the dark ground, so the data reads like a notebook page. Hero live chip and all AQI colours stay.

## Fixes still outstanding from last round

- Evidence wall tags: Hunan → **"official notice"**; Diwali 163 hours → **"news report"**.
- `/live` dashboard: use the new header (dark, logo eye, same nav), and change the headline to "<area>'s air right now, signed and cross-checked" (area from data). Its body can stay light.

## Done means

- `npm run build` and lint pass; first load of `/` under 1 MB on a phone.
- Checked in headless Chrome at 390 and 1440 px against the live relayer: every chapter, plus hover states captured where possible. No layout shift above 0.05. No horizontal scroll.
- Replace the screenshots in `docs/screenshots/` with new ones.
- Deploy a **Vercel preview** first (`vercel` without `--prod`), give Hemesh the preview URL to approve, and only after he says yes run `vercel --prod` and merge to main.
