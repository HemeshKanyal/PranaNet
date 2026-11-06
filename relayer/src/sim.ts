// Shapes the verifier may publish for its simulated neighbour devices (TEAM.md Reading / Device /
// Flag shapes with simulated: true). Strict checks so the endpoint can't be used to inject
// readings for real devices.
import { type Address, isAddress } from "viem";
import type { Reading } from "./message.ts";

export const SIM_ENS_SUFFIX = ".sim.prananet.eth";
const GEOHASH_RE = /^[0-9b-hjkmnp-z]{6}$/;
const isInt = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const isSimEns = (v: unknown): v is string => typeof v === "string" && /^[a-z0-9-]{1,63}\.sim\.prananet\.eth$/.test(v);

export interface SimDeviceView {
  device: Address;
  ens: string;
  geohash: string;
  status: "active" | "flagged" | "slashed";
  stake_wei: "0";
  baseline_mv: number;
  last_reading: Reading | null;
  simulated: true;
}

export function parseSimReading(x: unknown): Reading | null {
  const o = x as Record<string, unknown>;
  if (!o || o.simulated !== true || !isSimEns(o.ens)) return null;
  if (typeof o.device !== "string" || !isAddress(o.device, { strict: false })) return null;
  if (typeof o.geohash !== "string" || !GEOHASH_RE.test(o.geohash)) return null;
  if (!isInt(o.epoch, 1_600_000_000, 4_000_000_000) || !isInt(o.nonce, 1, Number.MAX_SAFE_INTEGER)) return null;
  if (!isInt(o.pm25_x10, 0, 100_000) || !isInt(o.pm10_x10, 0, 100_000)) return null;
  if (!isInt(o.temp_x10, -1000, 1000) || !isInt(o.hum_x10, 0, 1000)) return null;
  return {
    device: o.device.toLowerCase() as Address,
    ens: o.ens,
    geohash: o.geohash,
    epoch: o.epoch as number,
    pm25_x10: o.pm25_x10 as number,
    pm10_x10: o.pm10_x10 as number,
    temp_x10: o.temp_x10 as number,
    hum_x10: o.hum_x10 as number,
    nonce: o.nonce as number,
    signature: "0x",
    simulated: true,
  };
}

export function parseSimDevice(x: unknown): SimDeviceView | null {
  const o = x as Record<string, unknown>;
  if (!o || o.simulated !== true || !isSimEns(o.ens)) return null;
  if (typeof o.device !== "string" || !isAddress(o.device, { strict: false })) return null;
  if (typeof o.geohash !== "string" || !GEOHASH_RE.test(o.geohash)) return null;
  if (o.status !== "active" && o.status !== "flagged" && o.status !== "slashed") return null;
  return {
    device: o.device.toLowerCase() as Address,
    ens: o.ens,
    geohash: o.geohash,
    status: o.status,
    stake_wei: "0",
    baseline_mv: Number.isInteger(o.baseline_mv) ? (o.baseline_mv as number) : 0,
    last_reading: null,
    simulated: true,
  };
}

export function parseSimFlag(x: unknown) {
  const o = x as Record<string, unknown>;
  if (!o || !isSimEns(o.ens) || typeof o.device !== "string" || !isAddress(o.device, { strict: false })) return null;
  if (o.reason !== "neighbour_outlier" && o.reason !== "station_outlier") return null;
  if (!isInt(o.epoch, 1_600_000_000, 4_000_000_000) || !isInt(o.value_x10, 0, 100_000) || !isInt(o.median_x10, 0, 100_000)) return null;
  return {
    device: o.device.toLowerCase() as Address,
    ens: o.ens,
    epoch: o.epoch as number,
    reason: o.reason,
    value_x10: o.value_x10 as number,
    median_x10: o.median_x10 as number,
  };
}
