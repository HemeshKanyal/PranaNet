"use client";
// Live data for the story: the area with the most reporting real nodes (from GET /devices via
// LiveProvider), its stats, and the official station from the verifier.
import { useEffect, useMemo, useState } from "react";
import { useLive } from "@/components/LiveProvider";
import { aqiStyle } from "../aqi";
import { areaStats, deriveAreas, nodeCounts } from "../area";
import { getCell, parseStationName, type VerifierCell } from "../verifier";
import { SCENE_OF, type Scene } from "./scenes";

/** A reading older than this is shown as offline (half-closed eye). */
export const STALE_S = 5 * 60;

export function useStoryArea(initialCell: VerifierCell | null = null) {
  const { devices } = useLive();
  const area = useMemo(() => deriveAreas(devices)[0] ?? null, [devices]);
  const stats = area ? areaStats(devices, area) : null;
  const style = stats?.aqi != null ? aqiStyle(stats.aqi) : null;
  const counts = nodeCounts(area?.devices ?? []);
  // The cell the verifier judges: the one most of the area's real devices sit in.
  const cellHash = area?.devices.find((d) => !d.simulated)?.geohash ?? area?.devices[0]?.geohash ?? null;
  const cell = useCell(cellHash, initialCell);
  const station = cell?.station ? { ...parseStationName(cell.station.name), name: cell.station.name, pm25_x10: cell.station.pm25_x10 } : null;
  // Hero scene: today's category; with no data a neutral watchful scene, never a comforting one.
  const scene: Scene = style ? SCENE_OF[style.cat] : "poor";
  const placeName = area ? (station?.city ? `${area.name}, ${station.city}` : area.name) : null;
  return { devices, area, stats, style, counts, cell, station, scene, placeName, cellHash };
}

export function useCell(geohash: string | null, initial: VerifierCell | null = null): VerifierCell | null {
  const [cell, setCell] = useState<VerifierCell | null>(initial?.geohash === geohash ? initial : null);
  useEffect(() => {
    if (!geohash) return;
    let live = true;
    const load = () => getCell(geohash).then((c) => live && c && setCell(c));
    load();
    const t = setInterval(load, 60000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [geohash]);
  return cell;
}
