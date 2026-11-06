"use client";
// Leaflet touches `window`, so the map is client-only.
import dynamic from "next/dynamic";

export const SensorMap = dynamic(() => import("./SensorMap"), {
  ssr: false,
  loading: () => <div className="flex h-[520px] items-center justify-center rounded-[14px] bg-line/50 text-sm text-muted">Loading map…</div>,
});
export type { FlyTarget } from "./SensorMap";
