import { buildCell, crossCheck } from "./crosscheck.ts";
import { Simulator } from "./sim.ts";
import type { Cell, Device, Flag, Reading, Station } from "./types.ts";

// Contract slashes on the third consecutive flag; mirror it so cells drop the device.
export const SLASH_AFTER = 3;

export class Verifier {
  readonly sim: Simulator;
  stations: Map<string, Station>;
  epoch = 0;
  readings: Reading[] = [];
  flags: Flag[] = []; // all flags, newest last
  lastFlags: Flag[] = []; // flags from the latest epoch
  streak = new Map<string, number>();
  slashed = new Set<string>();

  constructor(sim: Simulator, stations: Map<string, Station>) {
    this.sim = sim;
    this.stations = stations;
  }

  /** Run one epoch: collect readings, cross-check, update streaks. */
  runEpoch(epoch: number, external: Reading[] = [], areaPm25X10?: number): Flag[] {
    this.epoch = epoch;
    // Slashed devices stay in readings (so cells count them as flagged) but are not judged again.
    this.readings = [...this.sim.tick(epoch, areaPm25X10), ...external];
    const active = this.readings.filter((r) => !this.slashed.has(r.device));
    const flags = crossCheck(active, epoch, this.stations);
    const flagged = new Set(flags.map((f) => f.device));
    for (const r of active) {
      const n = flagged.has(r.device) ? (this.streak.get(r.device) ?? 0) + 1 : 0;
      this.streak.set(r.device, n);
      if (n >= SLASH_AFTER) this.slashed.add(r.device);
    }
    this.lastFlags = flags;
    this.flags.push(...flags);
    if (this.flags.length > 1000) this.flags.splice(0, this.flags.length - 1000);
    return flags;
  }

  cell(geohash: string): Cell {
    return buildCell(geohash, this.readings, this.lastFlags, this.epoch, this.stations.get(geohash) ?? null, this.slashed);
  }

  status(device: string): Device["status"] {
    if (this.slashed.has(device)) return "slashed";
    return (this.streak.get(device) ?? 0) > 0 ? "flagged" : "active";
  }

  simDevices(): Device[] {
    return this.sim.devices.map((d) => {
      const dev = this.sim.asDevice(d, null, "active");
      const last = this.readings.find((r) => r.device === dev.device) ?? null;
      return { ...dev, last_reading: last, status: this.status(dev.device) };
    });
  }
}
