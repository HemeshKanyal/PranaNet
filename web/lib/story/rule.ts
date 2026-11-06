// SPEC "Cross-check rule", same numbers as verifier/src/crosscheck.ts: flagged if a reading is
// more than 50% AND more than 25 µg/m³ away from the median of its neighbours.
export const REL = 0.5;
export const ABS_UG = 25;

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const k = s.length >> 1;
  return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2;
}

export const isOutlier = (value: number, ref: number) => {
  const d = Math.abs(value - ref);
  return d > REL * ref && d > ABS_UG;
};

/** Allowed band around a median: [lo, hi] where a reading is not flagged. */
export const band = (m: number) => {
  const w = Math.max(REL * m, ABS_UG);
  return [Math.max(0, m - w), m + w] as const;
};
