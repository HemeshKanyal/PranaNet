import ngeohash from "ngeohash";
import type { Cell, Flag, Reading, Station } from "./types.ts";

// SPEC "Cross-check rule": flag if a device differs from the neighbour median
// by more than 50% AND more than 25 µg/m³ (250 in x10 units).
export const NEIGHBOUR_REL = 0.5;
export const NEIGHBOUR_ABS_X10 = 250;
// Looser threshold against the official station (SPEC leaves the value to us).
export const STATION_REL = 1.0;
export const STATION_ABS_X10 = 500;

export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

export function isOutlier(value: number, ref: number, rel: number, absX10: number): boolean {
  const diff = Math.abs(value - ref);
  return diff > rel * ref && diff > absX10;
}

/** The cell itself plus its 8 neighbours. */
export function cellAndNeighbours(geohash: string): Set<string> {
  return new Set([geohash, ...ngeohash.neighbors(geohash)]);
}

/** Keep only the latest reading per device. */
export function latestPerDevice(readings: Reading[]): Reading[] {
  const byDevice = new Map<string, Reading>();
  for (const r of readings) {
    const prev = byDevice.get(r.device);
    if (!prev || r.epoch > prev.epoch || (r.epoch === prev.epoch && r.nonce > prev.nonce)) {
      byDevice.set(r.device, r);
    }
  }
  return [...byDevice.values()];
}

/**
 * Cross-check one epoch. Each device is compared with the median of the
 * *other* devices in its cell and neighbouring cells, and with the station
 * for its cell when one is known. Needs at least 2 peers to judge.
 */
export function crossCheck(
  readings: Reading[],
  epoch: number,
  stations: Map<string, Station> = new Map(),
): Flag[] {
  const latest = latestPerDevice(readings);
  const flags: Flag[] = [];
  for (const r of latest) {
    const area = cellAndNeighbours(r.geohash);
    const peers = latest.filter((p) => p.device !== r.device && area.has(p.geohash));
    if (peers.length >= 2) {
      const m = median(peers.map((p) => p.pm25_x10));
      if (isOutlier(r.pm25_x10, m, NEIGHBOUR_REL, NEIGHBOUR_ABS_X10)) {
        flags.push({ device: r.device, ens: r.ens, epoch, reason: "neighbour_outlier", value_x10: r.pm25_x10, median_x10: m });
        continue;
      }
    }
    const st = stations.get(r.geohash);
    if (st && isOutlier(r.pm25_x10, st.pm25_x10, STATION_REL, STATION_ABS_X10)) {
      flags.push({ device: r.device, ens: r.ens, epoch, reason: "station_outlier", value_x10: r.pm25_x10, median_x10: st.pm25_x10 });
    }
  }
  return flags;
}

/** Verifier output for one cell: median of unflagged devices in that cell. */
export function buildCell(
  geohash: string,
  readings: Reading[],
  flags: Flag[],
  epoch: number,
  station: Station | null,
  excluded: Set<string> = new Set(),
): Cell {
  const inCell = latestPerDevice(readings).filter((r) => r.geohash === geohash);
  const flagged = new Set(flags.map((f) => f.device));
  const used = inCell.filter((r) => !flagged.has(r.device) && !excluded.has(r.device));
  return {
    geohash,
    epoch,
    pm25_x10: used.length ? median(used.map((r) => r.pm25_x10)) : 0,
    pm10_x10: used.length ? median(used.map((r) => r.pm10_x10)) : 0,
    devices_used: used.length,
    devices_flagged: inCell.filter((r) => flagged.has(r.device) || excluded.has(r.device)).length,
    station,
  };
}
