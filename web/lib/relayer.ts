// Single entry point for relayer data. If NEXT_PUBLIC_RELAYER_URL is unset, serves
// web/mocks/*.json (same shapes as the relayer, see docs/TEAM.md). Server-side only.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Device, DeviceDetail, Reading, RegisterRequest, RegisterResponse } from "./types";

export const RELAYER_URL = process.env.NEXT_PUBLIC_RELAYER_URL?.replace(/\/$/, "") || "";
export const USING_MOCKS = RELAYER_URL === "";

const MOCKS = join(process.cwd(), "mocks");

async function mock<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(join(MOCKS, file), "utf8")) as T;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${RELAYER_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`relayer ${path}: ${res.status}`);
  return (await res.json()) as T;
}

/** The relayer returns newest first; the UI (charts, prev/next) expects oldest first. */
const byNonce = (rs: Reading[]) => [...rs].sort((a, b) => a.nonce - b.nonce);

// ENS names are used as file names / path segments; reject anything odd.
const ENS_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

export async function getDevices(): Promise<Device[]> {
  return USING_MOCKS ? mock<Device[]>("devices.json") : get<Device[]>("/devices");
}

export async function getDevice(ens: string): Promise<DeviceDetail | null> {
  if (!ENS_RE.test(ens)) return null;
  if (USING_MOCKS) {
    try {
      return await mock<DeviceDetail>(join("devices", `${ens}.json`));
    } catch {
      return null;
    }
  }
  const res = await fetch(`${RELAYER_URL}/devices/${encodeURIComponent(ens)}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`relayer /devices/${ens}: ${res.status}`);
  const d = (await res.json()) as DeviceDetail;
  return { ...d, readings: byNonce(d.readings) };
}

/** Accepts an ENS name or a 0x device address (the relayer itself is keyed by ENS). */
export async function resolveDevice(id: string): Promise<DeviceDetail | null> {
  const key = id.toLowerCase();
  if (/^0x[0-9a-f]{40}$/.test(key)) {
    const d = (await getDevices()).find((x) => x.device === key);
    return d ? getDevice(d.ens) : null;
  }
  return getDevice(key);
}

export async function getReadings(ens: string, from?: number, to?: number): Promise<Reading[]> {
  if (USING_MOCKS) {
    const d = await getDevice(ens);
    return (d?.readings ?? []).filter((r) => (from == null || r.epoch >= from) && (to == null || r.epoch <= to));
  }
  const q = new URLSearchParams();
  if (from != null) q.set("from", String(from));
  if (to != null) q.set("to", String(to));
  return byNonce(await get<Reading[]>(`/devices/${encodeURIComponent(ens)}/readings?${q}`));
}

export async function register(body: RegisterRequest): Promise<RegisterResponse> {
  if (USING_MOCKS) {
    const r = await mock<Record<string, RegisterResponse>>("register.json");
    return body.label.toLowerCase().includes("fourth") ? r.max_devices : r.ok;
  }
  const res = await fetch(`${RELAYER_URL}/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as RegisterResponse;
}
