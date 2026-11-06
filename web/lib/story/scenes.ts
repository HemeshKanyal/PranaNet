// The Watcher's scenes (public/bg/<scene>-{800,1600}.webp) and the story palette.
import type { AqiCategory } from "../aqi";

export type Scene = "good" | "satisfactory" | "moderate" | "poor" | "very-poor" | "severe";

export const SCENE_OF: Record<AqiCategory, Scene> = {
  Good: "good",
  Satisfactory: "satisfactory",
  Moderate: "moderate",
  Poor: "poor",
  "Very Poor": "very-poor",
  Severe: "severe",
};

/** next/image loader: two pre-sized WebPs per scene; the width query keeps next/image's srcset honest. */
export const sceneLoader = ({ src, width }: { src: string; width: number }) =>
  `${src}-${width <= 828 ? 800 : 1600}.webp?w=${width}`;

export const sceneSrc = (s: Scene) => `/bg/${s}`;

export const PALETTE = {
  vermilion: "#C8341E",
  saffron: "#F2A12E",
  maroon: "#5A1A12",
  olive: "#6B6A2A",
  leaf: "#6E8B3D",
  cream: "#F3E3BE",
  ink: "#2A1A12",
} as const;
