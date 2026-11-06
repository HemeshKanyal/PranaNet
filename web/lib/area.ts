// Neighbourhood summaries computed in the browser from device last_readings.
// Only active devices count; flagged and slashed devices are excluded, as in the verifier.
import { aqi } from "./aqi";
import { decode, distanceKm } from "./geohash";
import localities from "./localities.json";
import type { Device } from "./types";

export interface Locality { name: string; lat: number; lon: number }
export const LOCALITIES = localities as Locality[];

export const RADIUS_KM = 3;

export interface AreaStats {
  aqi: number | null;
  pm25_x10: number | null;
  pm10_x10: number | null;
  used: Device[];
  excluded: Device[];
  latestEpoch: number | null;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const k = s.length >> 1;
  return s.length % 2 ? s[k] : Math.round((s[k - 1] + s[k]) / 2);
};

export function devicePos(d: Pick<Device, "geohash">) {
  return decode(d.geohash);
}

export function areaStats(devices: Device[], at: { lat: number; lon: number }, radiusKm = RADIUS_KM): AreaStats {
  const near = devices.filter((d) => d.last_reading && distanceKm(devicePos(d), at) <= radiusKm);
  const used = near.filter((d) => d.status === "active");
  const excluded = near.filter((d) => d.status !== "active");
  if (!used.length) return { aqi: null, pm25_x10: null, pm10_x10: null, used, excluded, latestEpoch: null };
  const pm25 = median(used.map((d) => d.last_reading!.pm25_x10));
  const pm10 = median(used.map((d) => d.last_reading!.pm10_x10));
  return {
    aqi: aqi(pm25, pm10),
    pm25_x10: pm25,
    pm10_x10: pm10,
    used,
    excluded,
    latestEpoch: Math.max(...used.map((d) => d.last_reading!.epoch)),
  };
}

export function nearestLocality(at: { lat: number; lon: number }): Locality {
  return LOCALITIES.reduce((best, l) => (distanceKm(l, at) < distanceKm(best, at) ? l : best));
}
