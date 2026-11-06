// Verifier GET /cells/:geohash (TEAM.md "Verifier output"): the cross-checked cell value and the
// nearest official reference station (OpenAQ). CORS is open, so the browser calls it directly.
export const VERIFIER_URL = process.env.NEXT_PUBLIC_VERIFIER_URL?.replace(/\/$/, "") || "";

export interface VerifierCell {
  geohash: string;
  epoch: number;
  pm25_x10: number | null;
  pm10_x10: number | null;
  devices_used: number;
  devices_flagged: number;
  station: { name: string; pm25_x10: number | null } | null;
}

export async function getCell(geohash: string, timeoutMs = 12000): Promise<VerifierCell | null> {
  if (!VERIFIER_URL) return null;
  try {
    const res = await fetch(`${VERIFIER_URL}/cells/${encodeURIComponent(geohash)}`, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    return res.ok ? ((await res.json()) as VerifierCell) : null;
  } catch {
    return null;
  }
}

/** "Bandra Kurla Complex, Mumbai - MPCB" → { place: "Bandra Kurla Complex", city: "Mumbai", operator: "MPCB" } */
export function parseStationName(name: string) {
  const [main, operator] = name.split(/\s+-\s+/);
  const parts = main.split(",").map((s) => s.trim());
  return { place: parts[0], city: parts.length > 1 ? parts[parts.length - 1] : null, operator: operator ?? null };
}
