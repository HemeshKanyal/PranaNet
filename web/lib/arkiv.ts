// Arkiv-backed data: reading and flag entities written by Hemesh's relayer on the Rabdi testnet.
// Schemas mirror relayer/src/arkiv.ts. Every query is filtered by the relayer's writer address
// (`ownedBy`), because anyone can write entities that look like ours.
// No writer known (no ARKIV_WRITER and no relayer /health) → mocks in the same shapes.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createPublicClient } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { and, asc, desc, eq, gt, gte, lt } from "@arkiv-network/sdk/query";
import { addr, u64 } from "@arkiv-network/sdk/schema";
import { http, keccak256, toHex } from "viem";
import { FlagEntity, ReadingEntity, readingFromEntity } from "./arkiv-schema";
import { getDevice, getDevices, RELAYER_URL } from "./relayer";
import type { Address, Flag, FlagReason, Hex, Reading } from "./types";

const BLOCK_TIME = 2; // seconds per Rabdi block; $expiresAt is a block number
const READING_TTL = 3 * 24 * 3600; // SPEC: readings live ~3 days
const MOCK_WRITER = "0x0000000000000000000000000000000000a4c1f0" as Address;

export interface ArkivFlag extends Flag {
  /** Sepolia tx of Registry.flag, when known */
  tx?: Hex;
}

export interface ArkivRecord {
  /** true when served from web/mocks instead of Arkiv */
  mock: boolean;
  entityKey: Hex;
  owner: Address;
  /** unix seconds when the entity expires on Arkiv */
  expiresAt: number;
  /** queryable (indexed) attributes stored on the entity */
  attributes: Record<string, string | number | boolean>;
  reading: Reading;
  flag: ArkivFlag | null;
  /** previous / next reading of the same device, for navigation */
  prevNonce: number | null;
  nextNonce: number | null;
}

// ---- client + writer

let writerPromise: Promise<Address | null> | null = null;
/** The relayer's Arkiv writer: ARKIV_WRITER, else the relayer's GET /health. Null = mock mode. */
export function arkivWriter(): Promise<Address | null> {
  writerPromise ??= (async () => {
    const env = process.env.ARKIV_WRITER?.trim().toLowerCase();
    if (env && /^0x[0-9a-f]{40}$/.test(env)) return env as Address;
    if (!RELAYER_URL) return null;
    try {
      const res = await fetch(`${RELAYER_URL}/health`, { cache: "no-store", signal: AbortSignal.timeout(4000) });
      const w = ((await res.json()) as { arkivWriter?: string | null }).arkivWriter?.toLowerCase();
      return w && /^0x[0-9a-f]{40}$/.test(w) ? (w as Address) : null;
    } catch {
      writerPromise = null; // retry on the next request
      return null;
    }
  })();
  return writerPromise;
}

let client: ReturnType<typeof createPublicClient> | null = null;
function arkiv() {
  // Empty access key = public endpoint (rate limited). Server-only env, never NEXT_PUBLIC_.
  client ??= createPublicClient({ chain: rabdi({ accessKey: process.env.ARKIV_ACCESS_KEY ?? "" }), transport: http() });
  return client;
}

const lower = (a: string) => a.toLowerCase() as Address;

// ---- flags

async function mockFlags(): Promise<ArkivFlag[]> {
  return JSON.parse(await readFile(join(process.cwd(), "mocks", "flags.json"), "utf8")) as ArkivFlag[];
}

/** Flags from the last 30 days (flag entities live 30 days), newest first. */
export async function getFlags(): Promise<ArkivFlag[]> {
  const writer = await arkivWriter();
  if (!writer) return mockFlags();
  try {
    const since = Math.floor(Date.now() / 1000) - 30 * 24 * 3600;
    const page = await arkiv()
      .select()
      .from(FlagEntity)
      .where(gte("epoch", u64(BigInt(since))))
      .ownedBy(writer)
      .orderBy(desc("epoch"))
      .limit(100) // node maximum per page
      .fetch();
    return page.entities.map((e) => ({
      device: lower(e.device.value),
      ens: e.ens.value,
      epoch: Number(e.epoch.value),
      reason: e.reason.value as FlagReason,
      value_x10: e.value_x10.value,
      median_x10: e.median_x10.value,
      tx: (e.tx.value || undefined) as Hex | undefined,
    }));
  } catch (err) {
    console.error("arkiv flags:", (err as Error).message.split("\n")[0]);
    return []; // the page still renders; live flags arrive over WS /live
  }
}

// ---- one reading record

export async function getRecord(device: Address, nonce: number): Promise<ArkivRecord | null> {
  const writer = await arkivWriter();
  return writer ? arkivRecord(writer, device, nonce) : mockRecord(device, nonce);
}

async function arkivRecord(writer: Address, device: Address, nonce: number): Promise<ArkivRecord | null> {
  const db = arkiv();
  const dev = eq("device", addr(device));
  const n = u64(BigInt(nonce));
  const [hit, prev, next] = await Promise.all([
    db.select().from(ReadingEntity).where(and(dev, eq("nonce", n))).ownedBy(writer).limit(1).fetch(),
    db.select({ nonce: true }).from(ReadingEntity).where(and(dev, lt("nonce", n))).ownedBy(writer).orderBy(desc("nonce")).limit(1).fetch(),
    db.select({ nonce: true }).from(ReadingEntity).where(and(dev, gt("nonce", n))).ownedBy(writer).orderBy(asc("nonce")).limit(1).fetch(),
  ]);
  const e = hit.entities[0];
  if (!e) return null;
  const reading = readingFromEntity(e);
  // $expiresAt is a block number; convert using the block the query was answered at.
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = e.$expiresAt != null && hit.blockNumber != null
    ? now + Number(BigInt(e.$expiresAt) - BigInt(hit.blockNumber)) * BLOCK_TIME
    : reading.epoch + READING_TTL;

  const flagPage = await db
    .select()
    .from(FlagEntity)
    .where(and(eq("device", addr(device)), eq("epoch", u64(BigInt(reading.epoch)))))
    .ownedBy(writer)
    .limit(1)
    .fetch()
    .catch(() => null);
  const f = flagPage?.entities[0];

  return {
    mock: false,
    entityKey: e.$key as Hex,
    owner: lower(e.$owner ?? writer),
    expiresAt,
    attributes: {
      device: reading.device,
      ens: reading.ens,
      geohash: reading.geohash,
      epoch: reading.epoch,
      nonce: reading.nonce,
      pm25_x10: reading.pm25_x10,
      pm10_x10: reading.pm10_x10,
      simulated: reading.simulated,
    },
    reading,
    flag: f
      ? {
          device: lower(f.device.value),
          ens: f.ens.value,
          epoch: Number(f.epoch.value),
          reason: f.reason.value as FlagReason,
          value_x10: f.value_x10.value,
          median_x10: f.median_x10.value,
          tx: (f.tx.value || undefined) as Hex | undefined,
        }
      : null,
    prevNonce: prev.entities[0] ? Number(prev.entities[0].nonce.value) : null,
    nextNonce: next.entities[0] ? Number(next.entities[0].nonce.value) : null,
  };
}

async function mockRecord(device: Address, nonce: number): Promise<ArkivRecord | null> {
  const dev = (await getDevices()).find((d) => d.device === device);
  if (!dev) return null;
  const detail = await getDevice(dev.ens);
  const i = detail?.readings.findIndex((r) => r.nonce === nonce) ?? -1;
  if (!detail || i < 0) return null;
  const reading = detail.readings[i];
  const flag = (await mockFlags()).find((f) => f.device === device && f.epoch === reading.epoch) ?? null;
  return {
    mock: true,
    entityKey: keccak256(toHex(`arkiv:${device}:${nonce}`)),
    owner: MOCK_WRITER,
    expiresAt: reading.epoch + READING_TTL,
    attributes: {
      device: reading.device,
      ens: reading.ens,
      geohash: reading.geohash,
      epoch: reading.epoch,
      nonce: reading.nonce,
      pm25_x10: reading.pm25_x10,
      pm10_x10: reading.pm10_x10,
      simulated: reading.simulated,
    },
    reading,
    flag,
    prevNonce: i > 0 ? detail.readings[i - 1].nonce : null,
    nextNonce: i < detail.readings.length - 1 ? detail.readings[i + 1].nonce : null,
  };
}
