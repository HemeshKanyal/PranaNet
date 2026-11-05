// Generates web/mocks/*.json in the exact shapes from docs/TEAM.md.
// Deterministic (seeded), so re-running gives the same files.
// Usage: node scripts/gen-mocks.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "mocks");

// Small seeded PRNG (mulberry32) so output is stable.
let seed = 0x5eed;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const hex = (n) => Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join("");

// Mock signature: 65 bytes r ‖ s ‖ v. Not a real signature.
const fakeSig = () => `0x${hex(128)}${rand() < 0.5 ? "1b" : "1c"}`;

const EPOCH_END = 1762360200; // matches the example epoch in TEAM.md
const STEP = 60; // one reading per minute
const N = 200; // GET /devices/:ens returns the latest 200

// Geohashes in Mumbai (te7u… prefix). Neighbouring cells for the cross-check story.
const DEVICES = [
  { device: "0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be", ens: "andheri-01.prananet.eth", geohash: "te7ud2", status: "active", simulated: false, baseline_mv: 212, pm25: 420, temp: true },
  { device: "0x8b3192f5ef7c4f9a1b2e4d6c8a0b2d4f6e8a0c12", ens: "andheri-02.prananet.eth", geohash: "te7ud3", status: "active", simulated: false, baseline_mv: 187, pm25: 445, temp: false }, // device 2 sends temp/hum = 0
  { device: "0x1c4e9a7b5d3f2e8c6a4b2d0f8e6c4a2b0d8f6e41", ens: "sim-andheri-03.prananet.eth", geohash: "te7ud8", status: "active", simulated: true, baseline_mv: 200, pm25: 400, temp: true },
  { device: "0x9d2f4b6a8c0e2d4f6a8b0c2e4d6f8a0b2c4e6d73", ens: "sim-andheri-04.prananet.eth", geohash: "te7ud9", status: "flagged", simulated: true, baseline_mv: 205, pm25: 430, temp: true, spike: "flag" },
  { device: "0x2a6c8e0b4d6f8a2c4e6b8d0f2a4c6e8b0d2f4a95", ens: "sim-bandra-01.prananet.eth", geohash: "te7u9x", status: "slashed", simulated: true, baseline_mv: 195, pm25: 380, temp: true, spike: "slash" },
];

const STAKE = { active: "10000000000000000", flagged: "10000000000000000", slashed: "0" };

function readingsFor(d) {
  const out = [];
  for (let i = 0; i < N; i++) {
    const epoch = EPOCH_END - (N - 1 - i) * STEP;
    // Slow drift + noise around the device's typical level.
    let pm25 = Math.round(d.pm25 + 60 * Math.sin(i / 25) + (rand() - 0.5) * 40);
    // Incense test: the last few readings spike far above neighbours.
    const spikeLen = d.spike === "slash" ? 3 : d.spike === "flag" ? 2 : 0;
    if (i >= N - spikeLen) pm25 = 2400 + Math.round(rand() * 100);
    const pm10 = Math.round(pm25 * (1.4 + rand() * 0.15));
    out.push({
      device: d.device,
      ens: d.ens,
      geohash: d.geohash,
      epoch,
      pm25_x10: Math.max(0, pm25),
      pm10_x10: Math.max(0, pm10),
      temp_x10: d.temp ? Math.round(290 + 15 * Math.sin(i / 60) + (rand() - 0.5) * 6) : 0,
      hum_x10: d.temp ? Math.round(640 + 40 * Math.cos(i / 70) + (rand() - 0.5) * 10) : 0,
      nonce: i + 1,
      signature: fakeSig(),
      simulated: d.simulated,
    });
  }
  return out;
}

const details = DEVICES.map((d) => {
  const readings = readingsFor(d);
  return {
    device: d.device,
    ens: d.ens,
    geohash: d.geohash,
    status: d.status,
    stake_wei: STAKE[d.status],
    baseline_mv: d.baseline_mv,
    last_reading: readings[readings.length - 1],
    simulated: d.simulated,
    readings,
  };
});

// Flags for the spiking devices: compare to median of the other active devices at that epoch.
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};
const flags = [];
const slashes = [];
for (const det of details) {
  const src = DEVICES.find((d) => d.device === det.device);
  if (!src.spike) continue;
  const spikeLen = src.spike === "slash" ? 3 : 2;
  for (const r of det.readings.slice(-spikeLen)) {
    const others = details
      .filter((o) => o.device !== det.device && o.status === "active")
      .map((o) => o.readings.find((x) => x.epoch === r.epoch).pm25_x10);
    flags.push({ device: det.device, ens: det.ens, epoch: r.epoch, reason: "neighbour_outlier", value_x10: r.pm25_x10, median_x10: median(others) });
  }
  if (src.spike === "slash") slashes.push({ device: det.device, ens: det.ens, tx: `0x${hex(64)}` });
}

const devices = details.map((d) => {
  const rest = { ...d };
  delete rest.readings;
  return rest;
});

// A short replay script for WS /live: the next minute of readings, then flag/slash events.
const live = [];
const NEXT = EPOCH_END + STEP;
for (const det of details.filter((d) => d.status !== "slashed")) {
  const last = det.last_reading;
  live.push({ type: "reading", data: { ...last, epoch: NEXT, nonce: last.nonce + 1, pm25_x10: last.pm25_x10 + 7, signature: fakeSig() } });
}
for (const f of flags.slice(-3)) live.push({ type: "flag", data: f });
for (const s of slashes) live.push({ type: "slash", data: s });

const register = {
  ok: { ok: true, ens: "colaba-01.prananet.eth", tx: `0x${hex(64)}` },
  max_devices: { ok: false, error: "max_devices" },
};

mkdirSync(join(OUT, "devices"), { recursive: true });
const write = (name, data) => writeFileSync(join(OUT, name), JSON.stringify(data, null, 2) + "\n");
write("devices.json", devices);
for (const det of details) write(join("devices", `${det.ens}.json`), det);
write("flags.json", flags);
write("live.json", live);
write("register.json", register);
console.log(`wrote ${details.length} devices, ${flags.length} flags, ${live.length} live messages to ${OUT}`);
