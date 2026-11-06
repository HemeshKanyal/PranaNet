import { createHash } from "node:crypto";
import type { Device, Reading } from "./types.ts";

// Simulated neighbour devices. Always labelled: simulated: true, ens *.sim.prananet.eth, no
// signature. Addresses are derived from the label so they are stable across restarts.
//
// Realistic Mumbai values: each device sits at a fixed offset from the area level (the nearest
// reference station's PM2.5 when known, else ~48 µg/m³, a typical November level), wanders
// slowly (AR(1) drift) and has per-epoch sensor noise. PM10 ≈ 1.8 × PM2.5 (Mumbai ratio ~0.55),
// temperature ~29 °C and humidity ~64 % with small noise.

export interface SimDevice {
  label: string;
  geohash: string;
  base_pm25_x10: number;
  spike: boolean; // incense mode: reads ~6x high so the cross-check flags it
  nonce: number;
  drift: number; // slow multiplicative wander around 1.0
}

export const SIM_ENS_SUFFIX = ".sim.prananet.eth";
/** Reference level the default offsets were written against (base 450 = this device reads at 1.0×). */
const REFERENCE_BASE = 450;

export function simAddress(label: string): string {
  return "0x" + createHash("sha256").update(`prananet-sim:${label}`).digest("hex").slice(0, 40);
}

// Device 2's cell (te7ud2, Kalina/Santacruz E) and its neighbouring cells.
export const DEFAULT_SIMS: Omit<SimDevice, "nonce" | "spike" | "drift">[] = [
  { label: "andheri-sim-01", geohash: "te7ud2", base_pm25_x10: 430 },
  { label: "andheri-sim-02", geohash: "te7ud2", base_pm25_x10: 410 },
  { label: "andheri-sim-03", geohash: "te7ud3", base_pm25_x10: 450 },
  { label: "andheri-sim-04", geohash: "te7ud0", base_pm25_x10: 400 },
  { label: "andheri-sim-05", geohash: "te7ud8", base_pm25_x10: 470 },
];

export class Simulator {
  readonly devices: SimDevice[];
  private rand: () => number;

  constructor(sims = DEFAULT_SIMS, rand: () => number = Math.random) {
    this.devices = sims.map((s) => ({ ...s, nonce: 0, spike: false, drift: 1 }));
    this.rand = rand;
  }

  find(ensOrLabel: string): SimDevice | undefined {
    const label = ensOrLabel.replace(SIM_ENS_SUFFIX, "");
    return this.devices.find((d) => d.label === label);
  }

  /**
   * One reading per simulated device for this epoch. With `areaPm25X10` (station value), each
   * device reads areaPm25 × (its base / 450) instead of its fixed base.
   */
  tick(epoch: number, areaPm25X10?: number): Reading[] {
    return this.devices.map((d) => {
      d.nonce += 1;
      d.drift = Math.min(1.15, Math.max(0.85, 1 + (d.drift - 1) * 0.9 + (this.rand() - 0.5) * 0.04));
      const level = areaPm25X10 ? (areaPm25X10 * d.base_pm25_x10) / REFERENCE_BASE : d.base_pm25_x10;
      const noise = 1 + (this.rand() - 0.5) * 0.12; // ±6 % per epoch
      const pm25 = Math.max(0, Math.round(level * d.drift * noise * (d.spike ? 6 : 1)));
      return {
        device: simAddress(d.label),
        ens: d.label + SIM_ENS_SUFFIX,
        geohash: d.geohash,
        epoch,
        pm25_x10: pm25,
        pm10_x10: Math.round(pm25 * (1.75 + this.rand() * 0.2)),
        temp_x10: 290 + Math.round((this.rand() - 0.5) * 20),
        hum_x10: 640 + Math.round((this.rand() - 0.5) * 60),
        nonce: d.nonce,
        signature: "0x",
        simulated: true,
      };
    });
  }

  asDevice(d: SimDevice, last: Reading | null, status: Device["status"]): Device {
    return {
      device: simAddress(d.label),
      ens: d.label + SIM_ENS_SUFFIX,
      geohash: d.geohash,
      status,
      stake_wei: "0",
      baseline_mv: 0,
      last_reading: last,
      simulated: true,
    };
  }
}
