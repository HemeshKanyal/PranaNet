import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCell, crossCheck, isOutlier, median } from "../src/crosscheck.ts";
import { Simulator } from "../src/sim.ts";
import { SLASH_AFTER, Verifier } from "../src/verifier.ts";
import type { Reading } from "../src/types.ts";

const r = (device: string, geohash: string, pm25_x10: number): Reading => ({
  device, ens: `${device}.eth`, geohash, epoch: 1, pm25_x10, pm10_x10: pm25_x10, temp_x10: 0, hum_x10: 0,
  nonce: 1, signature: "0x", simulated: true,
});

test("median", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 3);
});

test("outlier needs both >50% and >25 µg/m³", () => {
  assert.equal(isOutlier(2410, 430, 0.5, 250), true);
  assert.equal(isOutlier(100, 40, 0.5, 250), false); // +150% but only 6 µg/m³
  assert.equal(isOutlier(4500, 4000, 0.5, 250), false); // +50 µg/m³ but only 12.5%
});

test("neighbour outlier is flagged, honest devices are not", () => {
  const rs = [r("a", "te7ud2", 430), r("b", "te7ud2", 410), r("c", "te7ud3", 450), r("x", "te7ud2", 2410)];
  const flags = crossCheck(rs, 1);
  assert.deepEqual(flags.map((f) => f.device), ["x"]);
  assert.equal(flags[0].reason, "neighbour_outlier");
  assert.equal(flags[0].median_x10, 430);
});

test("devices outside the neighbourhood are ignored", () => {
  const rs = [r("a", "te7ud2", 430), r("b", "zzzzzz", 4000), r("c", "zzzzzz", 4100)];
  assert.equal(crossCheck(rs, 1).length, 0);
});

test("station outlier when there are too few peers", () => {
  const flags = crossCheck([r("a", "te7ud2", 2000)], 1, new Map([["te7ud2", { name: "s", pm25_x10: 400 }]]));
  assert.equal(flags[0].reason, "station_outlier");
});

test("cell drops flagged devices", () => {
  const rs = [r("a", "te7ud2", 430), r("b", "te7ud2", 410), r("c", "te7ud3", 450), r("x", "te7ud2", 2410)];
  const cell = buildCell("te7ud2", rs, crossCheck(rs, 1), 1, null);
  assert.deepEqual(cell, { geohash: "te7ud2", epoch: 1, pm25_x10: 420, pm10_x10: 420, devices_used: 2, devices_flagged: 1, station: null });
});

test("three consecutive flags slash a simulated device", () => {
  const v = new Verifier(new Simulator(undefined, () => 0.5), new Map());
  const cheat = v.sim.devices[0];
  cheat.spike = true;
  for (let e = 1; e <= SLASH_AFTER; e++) v.runEpoch(e);
  const dev = v.simDevices().find((d) => d.ens.startsWith(cheat.label))!;
  assert.equal(dev.status, "slashed");
  v.runEpoch(SLASH_AFTER + 1);
  const cell = v.cell("te7ud2");
  assert.equal(cell.devices_used, 1);
  assert.equal(cell.devices_flagged, 1);
});
