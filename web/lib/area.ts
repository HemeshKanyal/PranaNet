// Neighbourhood summaries computed in the browser from device last_readings.
// Only active devices count; flagged and slashed devices are excluded, as in the verifier.
//
// Areas come from the devices themselves (their ENS labels and geohash cells), so the dashboard
// follows wherever nodes exist. localities.json is only a gazetteer: names for the register form
// and for labelling a cell; it never decides what the dashboard shows.
import { aqi } from "./aqi";
import { decode, distanceKm } from "./geohash";
import localities from "./localities.json";
import type { Device } from "./types";

export interface Locality { name: string; lat: number; lon: number }
/** Gazetteer of named places (register form, labels). Not used to pick the dashboard default. */
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

/** Nearest gazetteer place, or null when none is within `maxKm`. */
export function nearestLocality(at: { lat: number; lon: number }, maxKm = RADIUS_KM): Locality | null {
  let best: Locality | null = null;
  for (const l of LOCALITIES) if (!best || distanceKm(l, at) < distanceKm(best, at)) best = l;
  return best && distanceKm(best, at) <= maxKm ? best : null;
}

/** Human label for a device's position: nearest named place, else its cell. */
export const placeLabel = (d: Pick<Device, "geohash">) => nearestLocality(devicePos(d))?.name ?? `cell ${d.geohash}`;

// ---------------------------------------------------------------- areas from devices

export interface Area extends Locality {
  /** short code from the operators' ENS labels, e.g. "BKC" from bkc-01 / bkc-sim-03 */
  code: string;
  /** devices within RADIUS_KM of the centre */
  devices: Device[];
  /** active real (non-simulated) devices that have reported */
  real: number;
  simulated: number;
}

/** "bkc-01.prananet.eth" / "bkc-sim-03.sim.prananet.eth" / "bkc-02b…" → "bkc". */
export function labelStem(ens: string): string {
  return ens.split(".")[0].replace(/-(sim|test)(?=-|$)/g, "").replace(/-\d+[a-z]?$/, "") || ens.split(".")[0];
}

const codeOf = (stem: string) => (stem.length <= 4 ? stem.toUpperCase() : stem[0].toUpperCase() + stem.slice(1));

/**
 * Group devices into areas. Seeds are real devices first (then simulated), each area takes every
 * device within RADIUS_KM of its seed's cell. Sorted: most reporting real devices first.
 */
export function deriveAreas(devices: Device[]): Area[] {
  const order = [...devices].sort((a, b) => Number(a.simulated) - Number(b.simulated) || Number(!a.last_reading) - Number(!b.last_reading));
  const taken = new Set<string>();
  const areas: Area[] = [];
  for (const seed of order) {
    if (taken.has(seed.device)) continue;
    const c = devicePos(seed);
    const members = devices.filter((d) => !taken.has(d.device) && distanceKm(devicePos(d), c) <= RADIUS_KM);
    members.forEach((d) => taken.add(d.device));
    // Name from the most common label stem, real devices' labels preferred.
    const stems = new Map<string, number>();
    for (const d of members) stems.set(labelStem(d.ens), (stems.get(labelStem(d.ens)) ?? 0) + (d.simulated ? 1 : 10));
    const stem = [...stems.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? seed.geohash;
    const code = codeOf(stem);
    areas.push({
      name: code,
      code,
      lat: c.lat,
      lon: c.lon,
      devices: members,
      ...nodeCounts(members),
    });
  }
  return areas.sort((a, b) => b.real - a.real || b.devices.length - a.devices.length);
}

/** Real devices that are active and have reported, vs simulated ones (labelled everywhere). */
export function nodeCounts(devices: Device[]) {
  const live = devices.filter((d) => d.status === "active" && d.last_reading);
  return { real: live.filter((d) => !d.simulated).length, simulated: live.filter((d) => d.simulated).length };
}
