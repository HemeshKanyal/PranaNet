// India National AQI (CPCB) sub-indices for PM2.5 and PM10.
// CPCB defines these on 24-hour averages; we apply them to instant readings, so the
// number is indicative only (and the Sharp sensor is a PM proxy, not a reference counter).

export type AqiCategory = "Good" | "Satisfactory" | "Moderate" | "Poor" | "Very Poor" | "Severe";

interface Band { cat: AqiCategory; lo: number; hi: number; aLo: number; aHi: number }

const PM25: Band[] = [
  { cat: "Good", lo: 0, hi: 30, aLo: 0, aHi: 50 },
  { cat: "Satisfactory", lo: 30, hi: 60, aLo: 50, aHi: 100 },
  { cat: "Moderate", lo: 60, hi: 90, aLo: 100, aHi: 200 },
  { cat: "Poor", lo: 90, hi: 120, aLo: 200, aHi: 300 },
  { cat: "Very Poor", lo: 120, hi: 250, aLo: 300, aHi: 400 },
  { cat: "Severe", lo: 250, hi: 380, aLo: 400, aHi: 500 },
];
const PM10: Band[] = [
  { cat: "Good", lo: 0, hi: 50, aLo: 0, aHi: 50 },
  { cat: "Satisfactory", lo: 50, hi: 100, aLo: 50, aHi: 100 },
  { cat: "Moderate", lo: 100, hi: 250, aLo: 100, aHi: 200 },
  { cat: "Poor", lo: 250, hi: 350, aLo: 200, aHi: 300 },
  { cat: "Very Poor", lo: 350, hi: 430, aLo: 300, aHi: 400 },
  { cat: "Severe", lo: 430, hi: 510, aLo: 400, aHi: 500 },
];

function sub(bands: Band[], v: number) {
  const b = bands.find((x) => v <= x.hi) ?? bands[bands.length - 1];
  const a = b.aLo + ((Math.min(v, b.hi) - b.lo) * (b.aHi - b.aLo)) / (b.hi - b.lo);
  return Math.round(Math.min(500, Math.max(0, a)));
}

/** AQI from ×10 integers. */
export function aqi(pm25_x10: number, pm10_x10: number): number {
  return Math.max(sub(PM25, pm25_x10 / 10), sub(PM10, pm10_x10 / 10));
}

export interface AqiStyle { cat: AqiCategory; bg: string; fg: string; advice: string }

// CPCB's published category colours. Text colour chosen for contrast on each.
export const AQI_SCALE: (AqiStyle & { max: number })[] = [
  { max: 50, cat: "Good", bg: "#00b050", fg: "#ffffff", advice: "Minimal impact." },
  { max: 100, cat: "Satisfactory", bg: "#92d050", fg: "#1a2e05", advice: "Minor discomfort for sensitive people." },
  { max: 200, cat: "Moderate", bg: "#ffd500", fg: "#3a2e00", advice: "Discomfort for people with lung or heart disease, children and older adults." },
  { max: 300, cat: "Poor", bg: "#ff9900", fg: "#3a1f00", advice: "Breathing discomfort for most people on prolonged exposure." },
  { max: 400, cat: "Very Poor", bg: "#e8221b", fg: "#ffffff", advice: "Respiratory illness on prolonged exposure." },
  { max: 500, cat: "Severe", bg: "#9c0b10", fg: "#ffffff", advice: "Affects healthy people; serious impact on those with existing disease." },
];

export function aqiStyle(value: number): AqiStyle {
  return AQI_SCALE.find((s) => value <= s.max) ?? AQI_SCALE[AQI_SCALE.length - 1];
}

/** WHO 2021 24-hour PM2.5 guideline, µg/m³. */
export const WHO_PM25 = 15;
