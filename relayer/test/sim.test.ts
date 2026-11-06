import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { MemoryStore } from "../src/arkiv.ts";
import type { ChainIndex } from "../src/chain.ts";
import type { Config } from "../src/config.ts";

const TOKEN = "test-token";
const sim = {
  device: "0x1111111111111111111111111111111111111111",
  ens: "andheri-sim-01.sim.prananet.eth",
  geohash: "te7ud2",
  epoch: 1793958000,
  pm25_x10: 520,
  pm10_x10: 910,
  temp_x10: 295,
  hum_x10: 640,
  nonce: 3,
  signature: "0x",
  simulated: true,
};
const simDevice = { device: sim.device, ens: sim.ens, geohash: "te7ud2", status: "active", stake_wei: "0", baseline_mv: 0, last_reading: null, simulated: true };

let base = "";
const store = new MemoryStore();
let close: () => void;

beforeAll(async () => {
  const chain = { devices: new Map(), byEns: () => undefined } as unknown as ChainIndex;
  const cfg = { simToken: TOKEN, corsOrigins: [], chainId: 11155111 } as unknown as Config;
  const { server, finishSync } = createApp({ cfg, chain, store, submitter: { address: null, pendingNonce: () => 0, submit: async () => ({ ok: true }) } });
  await finishSync();
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
});
afterAll(() => close());

const post = (path: string, body: unknown, token = TOKEN) =>
  fetch(base + path, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(body) });

describe("simulated neighbours via the relayer", () => {
  it("rejects without the token", async () => {
    expect((await post("/sim/readings", { readings: [sim] }, "wrong")).status).toBe(401);
  });

  it("refuses readings that are not clearly simulated", async () => {
    expect((await post("/sim/readings", { readings: [{ ...sim, simulated: false }] })).status).toBe(400);
    expect((await post("/sim/readings", { readings: [{ ...sim, ens: "andheri-01.prananet.eth" }] })).status).toBe(400);
  });

  it("stores simulated readings and lists the device in GET /devices", async () => {
    const res = await post("/sim/readings", { readings: [sim], devices: [simDevice] });
    expect(res.status).toBe(202);
    await new Promise((r) => setTimeout(r, 20));
    expect(store.readingsList.at(-1)).toMatchObject({ ens: sim.ens, simulated: true, pm25_x10: 520 });
    const list = (await (await fetch(`${base}/devices`)).json()) as Array<Record<string, unknown>>;
    expect(list).toEqual([{ ...simDevice, last_reading: { ...sim } }]);
    const one = (await (await fetch(`${base}/devices/${sim.ens}`)).json()) as Record<string, unknown>;
    expect(one.simulated).toBe(true);
    expect((one.readings as unknown[]).length).toBe(1);
  });

  it("accepts flags only for simulated devices", async () => {
    const flag = { device: sim.device, ens: sim.ens, epoch: sim.epoch, reason: "neighbour_outlier", value_x10: 3100, median_x10: 480 };
    expect((await post("/flags", flag)).status).toBe(202);
    await new Promise((r) => setTimeout(r, 20));
    expect(store.flagsList.at(-1)).toMatchObject({ ens: sim.ens, tx: "" });
    expect((await post("/flags", { ...flag, ens: "andheri-01.prananet.eth" })).status).toBe(400);
  });
});
