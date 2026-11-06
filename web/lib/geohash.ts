// Minimal geohash encode/decode (base32, no a/i/l/o). Devices publish only a 6-char cell.
const B32 = "0123456789bcdefghjkmnpqrstuvwxyz";

export interface Cell {
  lat: number;
  lon: number;
  /** [south, west, north, east] */
  bounds: [number, number, number, number];
}

export function decode(hash: string): Cell {
  let even = true;
  let lat: [number, number] = [-90, 90];
  let lon: [number, number] = [-180, 180];
  for (const c of hash.toLowerCase()) {
    const n = B32.indexOf(c);
    if (n < 0) throw new Error(`bad geohash: ${hash}`);
    for (let bit = 4; bit >= 0; bit--) {
      const on = (n >> bit) & 1;
      const r = even ? lon : lat;
      const mid = (r[0] + r[1]) / 2;
      if (on) r[0] = mid;
      else r[1] = mid;
      even = !even;
    }
  }
  return { lat: (lat[0] + lat[1]) / 2, lon: (lon[0] + lon[1]) / 2, bounds: [lat[0], lon[0], lat[1], lon[1]] };
}

export function encode(lat: number, lon: number, precision = 6): string {
  let even = true;
  let la: [number, number] = [-90, 90];
  let lo: [number, number] = [-180, 180];
  let out = "";
  let bits = 0;
  let n = 0;
  while (out.length < precision) {
    const r = even ? lo : la;
    const v = even ? lon : lat;
    const mid = (r[0] + r[1]) / 2;
    n <<= 1;
    if (v >= mid) {
      n |= 1;
      r[0] = mid;
    } else r[1] = mid;
    even = !even;
    if (++bits === 5) {
      out += B32[n];
      bits = 0;
      n = 0;
    }
  }
  return out;
}

export const isGeohash = (s: string) => /^[0-9b-hjkmnp-z]{6}$/.test(s);

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
