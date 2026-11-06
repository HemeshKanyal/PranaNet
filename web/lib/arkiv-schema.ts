// Arkiv entity schemas and row mapping, shared by the server client (lib/arkiv.ts) and the
// browser read on the story page (lib/arkiv-browser.ts). No Node imports here.
// Keep in sync with relayer/src/arkiv.ts.
import { addr, bool, bytes, defineSchema, i32, str, u64 } from "@arkiv-network/sdk/schema";
import type { Address, Hex, Reading } from "./types";

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
  signature: bytes(), // matches relayer/src/arkiv.ts (str is capped at 128 bytes)
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

interface Field<T> { value: T }
/** A fetched prananet.reading entity (the subset of fields the mapper reads). */
export interface ReadingRow {
  device: Field<string>;
  ens: Field<string>;
  geohash: Field<string>;
  epoch: Field<bigint | number>;
  pm25_x10: Field<number>;
  pm10_x10: Field<number>;
  temp_x10: Field<number>;
  hum_x10: Field<number>;
  nonce: Field<bigint | number>;
  signature: Field<string>;
  simulated: Field<boolean>;
}

export function readingFromEntity(e: ReadingRow): Reading {
  return {
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
  };
}
