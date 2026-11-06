import { readFileSync } from "node:fs";
import ngeohash from "ngeohash";
import type { Station } from "./types.ts";

// Nearest official reference station per cell, from OpenAQ v3 (docs.openaq.org/api):
//   GET https://api.openaq.org/v3/locations?coordinates=<lat>,<lon>&radius=<m>&parameters_id=2&monitor=true
//   GET https://api.openaq.org/v3/locations/{id}/latest            header X-API-Key
// parameters_id 2 = pm25 (µg/m³). `latest` returns one value per sensor (sensorsId), so we match it
// to the location's pm25 sensor. Values older than MAX_AGE are ignored (station offline).
// OPENAQ_API_KEY=mock reads mocks/station.json instead.

const API = "https://api.openaq.org/v3";
const PM25_PARAMETER_ID = 2;
const MAX_AGE_S = 3 * 3600;

export function loadMockStations(): Map<string, Station> {
  const url = new URL("../mocks/station.json", import.meta.url);
  const raw = JSON.parse(readFileSync(url, "utf8")) as Record<string, Station>;
  return new Map(Object.entries(raw));
}

/** Kept for the original tests and mock mode. */
export function loadStations(apiKey = process.env.OPENAQ_API_KEY ?? "mock"): Map<string, Station> {
  if (apiKey !== "mock" && apiKey !== "") console.warn("[stations] use OpenAQStations for live data; loading mocks");
  return loadMockStations();
}

export function distanceKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

interface OaqLocation {
  id: number;
  name: string;
  coordinates: { latitude: number; longitude: number };
  sensors?: { id: number; parameter?: { id?: number; name?: string } }[];
}

export interface StationReading extends Station {
  location_id: number;
  distance_km: number;
  datetime: string;
}

export class OpenAQStations {
  /** geohash -> nearest station with a fresh pm25 value */
  readonly byCell = new Map<string, StationReading>();
  lastError = "";

  constructor(
    private apiKey: string,
    private radiusM = 25000,
    private fetchFn: typeof fetch = fetch,
  ) {}

  private async get<T>(path: string): Promise<T> {
    const res = await this.fetchFn(`${API}${path}`, { headers: { "X-API-Key": this.apiKey, accept: "application/json" }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`OpenAQ ${res.status} ${path.split("?")[0]}: ${(await res.text()).slice(0, 200)}`);
    return (await res.json()) as T;
  }

  /** Nearest reference station with a recent pm25 value for this cell, or null. */
  async lookup(geohash: string, nowS = Math.floor(Date.now() / 1000)): Promise<StationReading | null> {
    const { latitude, longitude } = ngeohash.decode(geohash);
    const q = new URLSearchParams({
      coordinates: `${latitude.toFixed(4)},${longitude.toFixed(4)}`,
      radius: String(this.radiusM),
      parameters_id: String(PM25_PARAMETER_ID),
      monitor: "true",
      limit: "50",
    });
    const { results } = await this.get<{ results: OaqLocation[] }>(`/locations?${q}`);
    const ranked = results
      .map((l) => ({ l, d: distanceKm([latitude, longitude], [l.coordinates.latitude, l.coordinates.longitude]) }))
      .sort((a, b) => a.d - b.d);
    for (const { l, d } of ranked.slice(0, 5)) {
      const pm25 = (l.sensors ?? []).find((s) => s.parameter?.id === PM25_PARAMETER_ID || s.parameter?.name === "pm25");
      if (!pm25) continue;
      const latest = await this.get<{ results: { sensorsId: number; value: number; datetime: { utc: string } }[] }>(`/locations/${l.id}/latest`);
      const v = latest.results.find((r) => r.sensorsId === pm25.id);
      if (!v || !(v.value >= 0)) continue;
      if (nowS - Date.parse(v.datetime.utc) / 1000 > MAX_AGE_S) continue;
      return { name: l.name, pm25_x10: Math.round(v.value * 10), location_id: l.id, distance_km: Math.round(d * 10) / 10, datetime: v.datetime.utc };
    }
    return null;
  }

  /** Refresh the station for each cell; cells and their 8 neighbours share the centre cell's station. */
  async refresh(cells: string[]): Promise<void> {
    for (const cell of cells) {
      try {
        const st = await this.lookup(cell);
        for (const g of [cell, ...ngeohash.neighbors(cell)]) {
          if (st) this.byCell.set(g, st);
          else this.byCell.delete(g);
        }
        this.lastError = "";
        console.log(`[stations] ${cell}: ${st ? `${st.name} ${st.pm25_x10 / 10} µg/m³ (${st.distance_km} km, ${st.datetime})` : "no fresh reference station"}`);
      } catch (e) {
        this.lastError = (e as Error).message;
        console.warn(`[stations] ${cell}: ${this.lastError}`);
      }
    }
  }

  asMap(): Map<string, Station> {
    return new Map([...this.byCell].map(([g, s]) => [g, { name: s.name, pm25_x10: s.pm25_x10 }]));
  }
}
