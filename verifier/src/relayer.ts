// Talk to the relayer: real devices and their readings in, simulated readings and flags out.
import type { Device, Flag, Reading } from "./types.ts";

export class RelayerClient {
  constructor(
    private base: string,
    private token: string,
    private fetchFn: typeof fetch = fetch,
  ) {}

  private async get<T>(path: string): Promise<T> {
    const res = await this.fetchFn(this.base + path, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`relayer ${res.status} ${path}`);
    return (await res.json()) as T;
  }

  private async post(path: string, body: unknown) {
    const res = await this.fetchFn(this.base + path, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`relayer ${res.status} ${path}: ${(await res.text()).slice(0, 200)}`);
  }

  /** Real (non-simulated) devices that can still be judged. */
  async realDevices(): Promise<Device[]> {
    return (await this.get<Device[]>("/devices")).filter((d) => !d.simulated && d.status !== "slashed");
  }

  /** The device's reading for exactly this epoch, if it posted one. */
  async readingAt(ens: string, epoch: number): Promise<Reading | null> {
    const rs = await this.get<Reading[]>(`/devices/${encodeURIComponent(ens)}/readings?from=${epoch}&to=${epoch}`);
    return rs.find((r) => r.epoch === epoch) ?? null;
  }

  publishSims(readings: Reading[], devices: Device[]) {
    return this.post("/sim/readings", { readings, devices: devices.map((d) => ({ ...d, last_reading: null })) });
  }

  publishSimFlag(f: Flag) {
    return this.post("/flags", f);
  }
}
