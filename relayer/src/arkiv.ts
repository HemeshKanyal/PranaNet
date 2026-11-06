// Arkiv (Rabdi testnet) storage for raw readings, devices and flags. Schemas are documented in
// arkiv/schema.md. Every read is filtered by our writer address (`ownedBy`), because anyone can
// write entities that look like ours.
import { ExpirationTime, createPublicClient, createWalletClient } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { and, between, desc, eq } from "@arkiv-network/sdk/query";
import { addr, bool, defineSchema, i32, str, u64 } from "@arkiv-network/sdk/schema";
import { type Address, type Hex, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Config } from "./config.ts";
import { log } from "./log.ts";
import type { Reading } from "./message.ts";

export const ReadingEntity = defineSchema("prananet.reading", {
  device: addr().indexed(),
  ens: str().indexed(),
  geohash: str().indexed(),
  epoch: u64().indexed(),
  pm25_x10: i32().indexed(),
  pm10_x10: i32().indexed(),
  temp_x10: i32(),
  hum_x10: i32(),
  nonce: u64().indexed(),
  signature: str(),
  simulated: bool().indexed(),
});

export const DeviceEntity = defineSchema("prananet.device", {
  device: addr().indexed(),
  ens: str().indexed(),
  geohash: str().indexed(),
  status: str().indexed(),
  owner: addr(),
  label: str(),
  stake_wei: str(),
  baseline_mv: i32(),
  simulated: bool().indexed(),
});

export const FlagEntity = defineSchema("prananet.flag", {
  device: addr().indexed(),
  ens: str().indexed(),
  epoch: u64().indexed(),
  reason: str().indexed(),
  value_x10: i32(),
  median_x10: i32(),
  tx: str(),
});

export const READING_TTL = ExpirationTime.fromDays(3);
export const FLAG_TTL = ExpirationTime.fromDays(30);
// "While registered": the chain caps a lifetime at ~182 days; status is patched on slash.
export const DEVICE_TTL = ExpirationTime.fromDays(180);

export interface DeviceRecord {
  device: Address;
  ens: string;
  geohash: string;
  status: string;
  owner: Address;
  label: string;
  stake_wei: string;
  baseline_mv: number;
  simulated: boolean;
}
export interface FlagRecord {
  device: Address;
  ens: string;
  epoch: number;
  reason: string;
  value_x10: number;
  median_x10: number;
  tx: string;
}

export interface Store {
  readonly writer: Address | null;
  putReading(r: Reading): Promise<{ entityKey: Hex; txHash: Hex } | null>;
  putDevice(d: DeviceRecord): Promise<void>;
  putFlag(f: FlagRecord): Promise<void>;
  readings(ens: string, from: number, to: number, limit: number): Promise<Reading[]>;
  flags(ens: string): Promise<FlagRecord[]>;
}

const i32clamp = (n: number) => Math.max(-2147483648, Math.min(2147483647, Math.round(n)));

export class ArkivStore implements Store {
  readonly writer: Address;
  private pub;
  private wallet;
  private deviceKeys = new Map<string, Hex>();

  constructor(cfg: Config) {
    const chain = rabdi({ accessKey: cfg.arkivAccessKey });
    const account = privateKeyToAccount(cfg.arkivKey as Hex);
    this.writer = account.address;
    this.pub = createPublicClient({ chain, transport: http() });
    this.wallet = createWalletClient({ chain, transport: http(), account });
  }

  explorerEntity(key: Hex) {
    return `https://rabdi.explorer.arkiv.network/entity/${key}`;
  }

  async putReading(r: Reading) {
    const res = await this.wallet.createEntity(
      ReadingEntity,
      {
        device: addr(r.device),
        ens: r.ens,
        geohash: r.geohash,
        epoch: u64(BigInt(r.epoch)),
        pm25_x10: i32(i32clamp(r.pm25_x10)),
        pm10_x10: i32(i32clamp(r.pm10_x10)),
        temp_x10: i32(i32clamp(r.temp_x10)),
        hum_x10: i32(i32clamp(r.hum_x10)),
        nonce: u64(BigInt(r.nonce)),
        signature: r.signature,
        simulated: r.simulated,
      },
      { expiration: READING_TTL },
    );
    log("arkiv", `reading ${r.ens} nonce=${r.nonce} entity=${res.entityKey} tx=${res.txHash}`);
    return res;
  }

  private async deviceKey(device: Address): Promise<Hex | undefined> {
    const k = device.toLowerCase();
    if (this.deviceKeys.has(k)) return this.deviceKeys.get(k);
    const page = await this.pub
      .select({ $key: true })
      .from(DeviceEntity)
      .where(eq("device", addr(device)))
      .ownedBy(this.writer)
      .limit(1)
      .fetch();
    const key = page.entities[0]?.$key as Hex | undefined;
    if (key) this.deviceKeys.set(k, key);
    return key;
  }

  async putDevice(d: DeviceRecord) {
    const values = {
      device: addr(d.device),
      ens: d.ens,
      geohash: d.geohash,
      status: d.status,
      owner: addr(d.owner),
      label: d.label,
      stake_wei: d.stake_wei,
      baseline_mv: i32(i32clamp(d.baseline_mv)),
      simulated: d.simulated,
    };
    const key = await this.deviceKey(d.device);
    if (key) {
      await this.wallet.patchEntity(DeviceEntity, key, { set: values });
      log("arkiv", `device ${d.ens} patched status=${d.status}`);
    } else {
      const res = await this.wallet.createEntity(DeviceEntity, values, { expiration: DEVICE_TTL });
      this.deviceKeys.set(d.device.toLowerCase(), res.entityKey);
      log("arkiv", `device ${d.ens} created entity=${res.entityKey}`);
    }
  }

  async putFlag(f: FlagRecord) {
    const res = await this.wallet.createEntity(
      FlagEntity,
      {
        device: addr(f.device),
        ens: f.ens,
        epoch: u64(BigInt(f.epoch)),
        reason: f.reason,
        value_x10: i32(i32clamp(f.value_x10)),
        median_x10: i32(i32clamp(f.median_x10)),
        tx: f.tx,
      },
      { expiration: FLAG_TTL },
    );
    log("arkiv", `flag ${f.ens} epoch=${f.epoch} entity=${res.entityKey}`);
  }

  async readings(ens: string, from: number, to: number, limit: number): Promise<Reading[]> {
    const out: Reading[] = [];
    for (let offset = 0; out.length < limit; offset += 100) {
      const page = await this.pub
        .select()
        .from(ReadingEntity)
        .where(and(eq("ens", ens), between("epoch", u64(BigInt(from)), u64(BigInt(to)))))
        .ownedBy(this.writer)
        .orderBy(desc("epoch"))
        .limit(Math.min(100, limit - out.length))
        .offset(offset)
        .fetch();
      for (const e of page.entities) {
        out.push({
          device: e.device.value.toLowerCase() as Address,
          ens: e.ens.value,
          geohash: e.geohash.value,
          epoch: Number(e.epoch.value),
          pm25_x10: e.pm25_x10.value,
          pm10_x10: e.pm10_x10.value,
          temp_x10: e.temp_x10.value,
          hum_x10: e.hum_x10.value,
          nonce: Number(e.nonce.value),
          signature: e.signature.value as Hex,
          simulated: e.simulated.value,
        });
      }
      if (page.entities.length + (page.skipped ?? 0) < 100) break;
    }
    return out;
  }

  async flags(ens: string): Promise<FlagRecord[]> {
    const page = await this.pub
      .select()
      .from(FlagEntity)
      .where(eq("ens", ens))
      .ownedBy(this.writer)
      .orderBy(desc("epoch"))
      .limit(100)
      .fetch();
    return page.entities.map((e) => ({
      device: e.device.value.toLowerCase() as Address,
      ens: e.ens.value,
      epoch: Number(e.epoch.value),
      reason: e.reason.value,
      value_x10: e.value_x10.value,
      median_x10: e.median_x10.value,
      tx: e.tx.value,
    }));
  }
}

/** In-memory store for tests and ARKIV_ENABLED=false. */
export class MemoryStore implements Store {
  readonly writer = null;
  readonly readingsList: Reading[] = [];
  readonly devicesMap = new Map<string, DeviceRecord>();
  readonly flagsList: FlagRecord[] = [];
  async putReading(r: Reading) {
    this.readingsList.push(r);
    return null;
  }
  async putDevice(d: DeviceRecord) {
    this.devicesMap.set(d.device.toLowerCase(), d);
  }
  async putFlag(f: FlagRecord) {
    this.flagsList.push(f);
  }
  async readings(ens: string, from: number, to: number, limit: number) {
    return this.readingsList
      .filter((r) => r.ens === ens && r.epoch >= from && r.epoch <= to)
      .sort((a, b) => b.epoch - a.epoch)
      .slice(0, limit);
  }
  async flags(ens: string) {
    return this.flagsList.filter((f) => f.ens === ens).sort((a, b) => b.epoch - a.epoch);
  }
}
