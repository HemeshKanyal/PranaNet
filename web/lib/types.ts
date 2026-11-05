// Shapes from docs/TEAM.md ("Shared shapes"). Keep in sync with that file.
// Units: values are ×10 integers (pm25_x10: 423 → 42.3 µg/m³). Times are unix seconds.
// Device IDs are lowercase 0x addresses. Geohash is 6 characters.

export type Address = `0x${string}`;
export type Hex = `0x${string}`;

/** POST /readings body, also stored on Arkiv. */
export interface Reading {
  device: Address;
  ens: string;
  geohash: string;
  epoch: number;
  pm25_x10: number;
  pm10_x10: number;
  temp_x10: number;
  hum_x10: number;
  nonce: number;
  signature: Hex;
  simulated: boolean;
}

export type DeviceStatus = "active" | "flagged" | "slashed";

/** One item of GET /devices. */
export interface Device {
  device: Address;
  ens: string;
  geohash: string;
  status: DeviceStatus;
  /** Wei as a decimal string (can exceed Number.MAX_SAFE_INTEGER). */
  stake_wei: string;
  baseline_mv: number;
  last_reading: Reading | null;
  simulated: boolean;
}

/** GET /devices/:ens → one device object + latest 200 readings. */
export interface DeviceDetail extends Device {
  readings: Reading[];
}

export type FlagReason = "neighbour_outlier" | "station_outlier";

/** Flag (verifier → contract and Arkiv). */
export interface Flag {
  device: Address;
  ens: string;
  epoch: number;
  reason: FlagReason;
  value_x10: number;
  median_x10: number;
}

export interface SlashEvent {
  device: Address;
  ens: string;
  tx: Hex;
}

/** Messages on WS /live. */
export type LiveMessage =
  | { type: "reading"; data: Reading }
  | { type: "flag"; data: Flag }
  | { type: "slash"; data: SlashEvent };

/** POST /register body. `idkit` is the IDKit result object, passed through unchanged. */
export interface RegisterRequest {
  idkit: unknown;
  device: Address;
  label: string;
  geohash: string;
}

export type RegisterResponse =
  | { ok: true; ens: string; tx: Hex }
  | { ok: false; error: string };
