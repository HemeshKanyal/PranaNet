// The Watcher's cut-outs (public/story/watcher-<pose>-{480,900}.webp) and each mood's arch colour.
import { AQI_SCALE, type AqiCategory } from "../aqi";

export type Pose = "standing" | "shrug" | "seated" | "pointing" | "gasmask" | "with-builder";

/** Intrinsic sizes of the two renditions, for width/height attributes (no layout shift). */
export const POSE_SIZE: Record<Pose, { sm: [number, number]; lg: [number, number] }> = {
  standing: { sm: [228, 480], lg: [411, 866] },
  shrug: { sm: [264, 480], lg: [477, 866] },
  seated: { sm: [316, 480], lg: [462, 701] },
  pointing: { sm: [236, 480], lg: [424, 863] },
  gasmask: { sm: [308, 480], lg: [529, 825] },
  "with-builder": { sm: [502, 480], lg: [623, 596] },
};

export const poseSrc = (p: Pose, size: "480" | "900") => `/story/watcher-${p}-${size}.webp`;

/** Pose that matches an AQI mood (hero). */
export const POSE_OF: Record<AqiCategory, Pose> = {
  Good: "standing",
  Satisfactory: "shrug",
  Moderate: "seated",
  Poor: "standing",
  "Very Poor": "pointing",
  Severe: "gasmask",
};

/** Arch fills: the folk paintings' wall colours, one per mood (not the CPCB chip colours). */
export const MOOD_FILL: Record<AqiCategory, { fill: string; motif: string }> = {
  Good: { fill: "#6E8B3D", motif: "#F3E3BE" },
  Satisfactory: { fill: "#97A33A", motif: "#F3E3BE" },
  Moderate: { fill: "#E09A2C", motif: "#5A1A12" },
  Poor: { fill: "#D2702A", motif: "#5A1A12" },
  "Very Poor": { fill: "#C8341E", motif: "#F2A12E" },
  Severe: { fill: "#5A1A12", motif: "#F2A12E" },
};
export const NEUTRAL_FILL = { fill: "#3A2E22", motif: "#BFA98A" };

/** "Poor · AQI 201–300" */
export function moodLabel(cat: AqiCategory): string {
  const i = AQI_SCALE.findIndex((s) => s.cat === cat);
  const lo = i === 0 ? 0 : AQI_SCALE[i - 1].max + 1;
  return `${cat} · AQI ${lo}–${AQI_SCALE[i].max}`;
}
