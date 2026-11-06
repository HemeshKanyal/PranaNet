// Shapes copied from docs/TEAM.md ("Shared shapes"). Values are x10 integers, times are unix seconds.

export interface Reading {
  device: string; // lowercase 0x address
  ens: string;
  geohash: string; // 6 chars
  epoch: number;
  pm25_x10: number;
  pm10_x10: number;
  temp_x10: number;
  hum_x10: number;
  nonce: number;
  signature: string;
  simulated: boolean;
}

export type DeviceStatus = "active" | "flagged" | "slashed";

export interface Device {
  device: string;
  ens: string;
  geohash: string;
  status: DeviceStatus;
  stake_wei: string;
  baseline_mv: number;
  last_reading: Reading | null;
  simulated: boolean;
}

export type FlagReason = "neighbour_outlier" | "station_outlier";

// Registry.flag reason codes
export const REASON_CODE: Record<FlagReason, number> = {
  neighbour_outlier: 1,
  station_outlier: 2,
};

export interface Flag {
  device: string;
  ens: string;
  epoch: number;
  reason: FlagReason;
  value_x10: number;
  median_x10: number;
}

export interface Station {
  name: string;
  pm25_x10: number;
}

export interface Cell {
  geohash: string;
  epoch: number;
  pm25_x10: number;
  pm10_x10: number;
  devices_used: number;
  devices_flagged: number;
  station: Station | null;
}
