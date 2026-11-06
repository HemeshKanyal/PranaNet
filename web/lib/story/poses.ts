// The hand-painted kit (public/story/<slug>-{480,900}.webp, from web/public/story/raw), trimmed.
// Sizes are the exported renditions, for width/height attributes (no layout shift).
import { AQI_SCALE, type AqiCategory } from "../aqi";

export const ART = {
  "folk-art-incense-holder-with-curling-smoke": { sm: [182, 480], lg: [342, 900] },
  "folk-art-table-with-floral-vessels": { sm: [480, 396], lg: [900, 742] },
  "folk-art-water-sprinkler-truck": { sm: [480, 221], lg: [900, 414] },
  "hand-painted-lotus-scallop-border": { sm: [480, 75], lg: [900, 140] },
  "hooded-watcher-pointing-forward": { sm: [211, 480], lg: [396, 900] },
  "indian-folk-art-lotus-pillar": { sm: [127, 480], lg: [238, 900] },
  "masked-watcher-in-ornate-cloak": { sm: [338, 480], lg: [634, 900] },
  "minimalist-black-teardrop-eye-icon": { sm: [480, 240], lg: [900, 450] },
  "ornate-indian-folk-art-arch-motif": { sm: [358, 480], lg: [671, 900] },
  "ornate-red-peacock-folk-painting": { sm: [399, 480], lg: [749, 900] },
  "smiley-watcher-folk-art-shrug": { sm: [237, 480], lg: [443, 900] },
  "smug-builder-in-charcoal-suit": { sm: [175, 480], lg: [327, 900] },
  "the-watcher-in-ornate-olive-cloak": { sm: [220, 480], lg: [412, 900] },
  "vintage-folk-art-aq-sensor": { sm: [362, 480], lg: [679, 900] },
  "watcher-and-builder-walking-together": { sm: [480, 464], lg: [900, 871] },
  "watcher-in-folk-art-chair-pose": { sm: [304, 480], lg: [571, 900] },
} as const satisfies Record<string, { sm: readonly [number, number]; lg: readonly [number, number] }>;

export type ArtName = keyof typeof ART;
export const artSrc = (a: ArtName, size: "480" | "900") => `/story/${a}-${size}.webp`;
export const TILE = "/story/folk-floral-orange-tile-pattern.webp";

export type Pose = "standing" | "shrug" | "seated" | "pointing" | "gasmask" | "with-builder" | "builder";

export const POSE_ART: Record<Pose, ArtName> = {
  standing: "the-watcher-in-ornate-olive-cloak",
  shrug: "smiley-watcher-folk-art-shrug",
  seated: "watcher-in-folk-art-chair-pose",
  pointing: "hooded-watcher-pointing-forward",
  gasmask: "masked-watcher-in-ornate-cloak",
  "with-builder": "watcher-and-builder-walking-together",
  builder: "smug-builder-in-charcoal-suit",
};

/** Pose that matches an AQI mood (hero). */
export const POSE_OF: Record<AqiCategory, Pose> = {
  Good: "standing",
  Satisfactory: "shrug",
  Moderate: "seated",
  Poor: "standing",
  "Very Poor": "pointing",
  Severe: "gasmask",
};

/** Wall colour behind the arch, one per mood (the paintings' wall colours, not the CPCB chip colours). */
export const MOOD_FILL: Record<AqiCategory, string> = {
  Good: "#6E8B3D",
  Satisfactory: "#97A33A",
  Moderate: "#E09A2C",
  Poor: "#D2702A",
  "Very Poor": "#B8301C",
  Severe: "#5A1A12",
};
export const NEUTRAL_FILL = "#3A2E22";

/** "Poor · AQI 201–300" */
export function moodLabel(cat: AqiCategory): string {
  const i = AQI_SCALE.findIndex((s) => s.cat === cat);
  const lo = i === 0 ? 0 : AQI_SCALE[i - 1].max + 1;
  return `${cat} · AQI ${lo}–${AQI_SCALE[i].max}`;
}
