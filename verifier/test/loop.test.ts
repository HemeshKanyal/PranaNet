import assert from "node:assert/strict";
import { test } from "node:test";
import { epochToJudge, runVerifierEpoch } from "../src/loop.ts";
import { Simulator } from "../src/sim.ts";
import { OpenAQStations } from "../src/stations.ts";
import type { Device, Flag, Reading } from "../src/types.ts";
import { Verifier } from "../src/verifier.ts";

const REAL = "0xab29ec5df28b9fbc4804ab4d5f4ecae4833c4e32";
const realDevice: Device = { device: REAL, ens: "andheri-01.prananet.eth", geohash: "te7ud2", status: "active", stake_wei: "1000", baseline_mv: 0, last_reading: null, simulated: false };
const reading = (epoch: number, pm25_x10: number): Reading => ({
  device: REAL, ens: realDevice.ens, geohash: "te7ud2", epoch, pm25_x10, pm10_x10: pm25_x10, temp_x10: 0, hum_x10: 0, nonce: epoch, signature: "0xsig", simulated: false,
});

function harness(values: number[]) {
  let i = 0;
  const calls: string[] = [];
  const simFlags: Flag[] = [];
  let published = 0;
  let streak = 0;
  const relayer = {
    realDevices: async () => [realDevice],
    readingAt: async (_ens: string, epoch: number) => reading(epoch, values[i++]),
    publishSims: async () => void published++,
    publishSimFlag: async (f: Flag) => void simFlags.push(f),
  };
  const registry = {
    flag: async (d: `0x${string}`, e: number, reason: number) => (calls.push(`flag ${d} ${e} ${reason}`), streak++, { ok: true, tx: "0xf" }),
    clearFlags: async (d: `0x${string}`, e: number) => (calls.push(`clear ${d} ${e}`), (streak = 0), { ok: true, tx: "0xc" }),
    consecutiveFlags: async () => streak,
  };
  const verifier = new Verifier(new Simulator(undefined, () => 0.5), new Map());
  return { relayer, registry, verifier, calls, simFlags, published: () => published };
}

test("incense on the real device: three flags on-chain, honest epoch clears the streak", async () => {
  const h = harness([3100, 2900, 480, 3300, 3000, 3200]); // µg/m³ x10; neighbours ~43-47
  const deps = { verifier: h.verifier, relayer: h.relayer, registry: h.registry, areaPm25X10: () => 450 };
  for (let k = 0; k < 6; k++) await runVerifierEpoch(1_793_958_000 + 60 * k, deps);
  assert.deepEqual(h.calls, [
    `flag ${REAL} 1793958000 1`,
    `flag ${REAL} 1793958060 1`,
    `clear ${REAL} 1793958120`, // honest reading breaks the streak
    `flag ${REAL} 1793958180 1`,
    `flag ${REAL} 1793958240 1`,
    `flag ${REAL} 1793958300 1`, // third consecutive: Registry slashes
  ]);
  assert.equal(h.published(), 6);
});

test("a calibrated real device among realistic neighbours is never flagged", async () => {
  const h = harness([470, 455, 430, 498, 441]);
  const deps = { verifier: h.verifier, relayer: h.relayer, registry: h.registry, areaPm25X10: () => 450 };
  for (let k = 0; k < 5; k++) await runVerifierEpoch(1_793_958_000 + 60 * k, deps);
  assert.deepEqual(h.calls, []);
});

test("simulated devices: flags go to the relayer, never to the Registry", async () => {
  const h = harness([450, 450]);
  h.verifier.sim.find("andheri-sim-01")!.spike = true;
  await runVerifierEpoch(1_793_958_000, { verifier: h.verifier, relayer: h.relayer, registry: h.registry, areaPm25X10: () => 450 });
  assert.equal(h.calls.length, 0);
  assert.equal(h.simFlags.length, 1);
  assert.equal(h.simFlags[0].ens, "andheri-sim-01.sim.prananet.eth");
});

test("simulated values track the reference station (realistic Mumbai level)", () => {
  const sim = new Simulator(undefined, () => 0.5);
  const rs = sim.tick(1, 620);
  for (const r of rs) {
    assert.ok(r.pm25_x10 > 500 && r.pm25_x10 < 700, `${r.ens} ${r.pm25_x10}`);
    assert.ok(r.pm10_x10 > r.pm25_x10 * 1.7 && r.pm10_x10 < r.pm25_x10 * 2);
    assert.equal(r.simulated, true);
  }
});

test("epochToJudge picks the window that closed at least grace seconds ago", () => {
  assert.equal(epochToJudge(1_793_958_090, 60, 30), 1_793_958_000);
  assert.equal(epochToJudge(1_793_958_089, 60, 30), 1_793_957_940);
});

test("OpenAQ v3: nearest monitor with a fresh pm25 value", async () => {
  const now = Date.parse("2026-11-06T10:00:00Z") / 1000;
  const fake = (async (url: string) => {
    const u = new URL(url);
    if (u.pathname === "/v3/locations") {
      assert.equal(u.searchParams.get("parameters_id"), "2");
      assert.equal(u.searchParams.get("monitor"), "true");
      return Response.json({ results: [
        { id: 9, name: "Far - MPCB", coordinates: { latitude: 19.2, longitude: 72.9 }, sensors: [{ id: 90, parameter: { id: 2, name: "pm25" } }] },
        { id: 7, name: "Bandra Kurla Complex - MPCB", coordinates: { latitude: 19.065, longitude: 72.862 }, sensors: [{ id: 70, parameter: { id: 1, name: "pm10" } }, { id: 71, parameter: { id: 2, name: "pm25" } }] },
      ] });
    }
    if (u.pathname === "/v3/locations/7/latest")
      return Response.json({ results: [{ sensorsId: 70, value: 101, datetime: { utc: "2026-11-06T09:00:00Z" } }, { sensorsId: 71, value: 52.4, datetime: { utc: "2026-11-06T09:00:00Z" } }] });
    return new Response("nope", { status: 404 });
  }) as unknown as typeof fetch;
  const st = await new OpenAQStations("k", 25000, fake).lookup("te7ud2", now);
  assert.equal(st?.name, "Bandra Kurla Complex - MPCB");
  assert.equal(st?.pm25_x10, 524);
  assert.ok(st!.distance_km < 3);
});

test("simulated neighbours are placed around the configured cell", async () => {
  const { simsAround } = await import("../src/sim.ts");
  const sims = simsAround("te7u6n", "bkc");
  assert.equal(sims.filter((s) => s.geohash === "te7u6n").length, 2);
  assert.deepEqual(sims.map((s) => s.label), ["bkc-sim-01", "bkc-sim-02", "bkc-sim-03", "bkc-sim-04", "bkc-sim-05"]);
});
