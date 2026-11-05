import { createHash } from "node:crypto";
import type { Device, Reading } from "./types.ts";

// Simulated neighbour devices. Clearly labelled: simulated: true, empty signature.
// Addresses are derived from the label so they are stable across restarts.

export interface SimDevice {
  label: string;
  geohash: string;
  base_pm25_x10: number;
  spike: boolean; // incense mode: reads ~6x high so the cross-check flags it
  nonce: number;
}

export const SIM_ENS_SUFFIX = ".sim.prananet.eth";

export function simAddress(label: string): string {
  return "0x" + createHash("sha256").update(`prananet-sim:${label}`).digest("hex").slice(0, 40);
}

// Andheri (te7ud2) and its neighbouring cells.
export const DEFAULT_SIMS: Omit<SimDevice, "nonce" | "spike">[] = [
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
    this.devices = sims.map((s) => ({ ...s, nonce: 0, spike: false }));
    this.rand = rand;
  }

  find(ensOrLabel: string): SimDevice | undefined {
    const label = ensOrLabel.replace(SIM_ENS_SUFFIX, "");
    return this.devices.find((d) => d.label === label);
  }

  /** One reading per simulated device for this epoch. */
  tick(epoch: number): Reading[] {
    return this.devices.map((d) => {
      d.nonce += 1;
      const noise = 1 + (this.rand() - 0.5) * 0.2; // ±10%
      const pm25 = Math.round(d.base_pm25_x10 * noise * (d.spike ? 6 : 1));
      return {
        device: simAddress(d.label),
        ens: d.label + SIM_ENS_SUFFIX,
        geohash: d.geohash,
        epoch,
        pm25_x10: pm25,
        pm10_x10: Math.round(pm25 * 1.45),
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
