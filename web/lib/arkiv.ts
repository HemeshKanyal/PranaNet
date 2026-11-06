// Arkiv-backed data (reading + flag entities, see SPEC.md "Arkiv entities").
// Until Hemesh publishes arkiv/schema.md and the writer wallet, this serves mocks in the same
// shapes. Swap the bodies of getFlags/getRecord for Arkiv SDK queries when ARKIV_RPC_URL is set.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { keccak256, toHex } from "viem";
import { getDevice, getDevices } from "./relayer";
import type { Address, Flag, Reading } from "./types";

export const ARKIV_IS_MOCK = !process.env.ARKIV_RPC_URL;
const MOCK_WRITER = "0x0000000000000000000000000000000000a4c1f0" as Address;
const READING_TTL = 3 * 24 * 3600; // ~3 days (SPEC)

export interface ArkivRecord {
  entityKey: `0x${string}`;
  owner: Address;
  /** unix seconds when the entity expires on Arkiv */
  expiresAt: number;
  /** queryable attributes the relayer writes alongside the payload */
  attributes: Record<string, string | number>;
  reading: Reading;
  flag: Flag | null;
  /** previous / next reading of the same device, for navigation */
  prevNonce: number | null;
  nextNonce: number | null;
}

export async function getFlags(): Promise<Flag[]> {
  if (!ARKIV_IS_MOCK) return []; // TODO: query flag entities by time once the schema lands
  return JSON.parse(await readFile(join(process.cwd(), "mocks", "flags.json"), "utf8")) as Flag[];
}

export async function getRecord(device: Address, nonce: number): Promise<ArkivRecord | null> {
  // TODO (real Arkiv): query type = "reading" && device = <device> && nonce = <nonce>.
  const dev = (await getDevices()).find((d) => d.device === device);
  if (!dev) return null;
  const detail = await getDevice(dev.ens);
  const i = detail?.readings.findIndex((r) => r.nonce === nonce) ?? -1;
  if (!detail || i < 0) return null;
  const reading = detail.readings[i];
  const flag = (await getFlags()).find((f) => f.device === device && f.epoch === reading.epoch) ?? null;
  return {
    entityKey: keccak256(toHex(`arkiv:${device}:${nonce}`)),
    owner: MOCK_WRITER,
    expiresAt: reading.epoch + READING_TTL,
    attributes: {
      type: "reading",
      device: reading.device,
      ens: reading.ens,
      geohash: reading.geohash,
      epoch: reading.epoch,
      nonce: reading.nonce,
      pm25_x10: reading.pm25_x10,
    },
    reading,
    flag,
    prevNonce: i > 0 ? detail.readings[i - 1].nonce : null,
    nextNonce: i < detail.readings.length - 1 ? detail.readings[i + 1].nonce : null,
  };
}
