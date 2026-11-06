// Generates web/mocks/*.json in the exact shapes from docs/TEAM.md.
// Deterministic (seeded), so re-running gives the same files.
// Usage: node scripts/gen-mocks.mjs
//
// Readings are REALLY signed (SPEC.md encoding + EIP-191) so the dashboard's off-chain
// signature check works on mock data. The device keys are PUBLIC throwaway keys derived
// from the strings below: they are not secrets, are never funded, and must never be
// registered on any chain.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { encodePacked, keccak256, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "mocks");
const LOCALITIES = JSON.parse(readFileSync(join(ROOT, "lib", "localities.json"), "utf8"));

// Mock chain values. Real ones arrive via NEXT_PUBLIC_* env vars once contracts are deployed.
const CHAIN = {
  chainId: 11155111,
  readingsContract: "0x0000000000000000000000000000000000c0ffee",
  registryContract: "0x000000000000000000000000000000000000ba5e",
};

// Seeded PRNG (mulberry32).
let seed = 0x5eed;
function rand() {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const hex = (n) => Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join("");

const B32 = "0123456789bcdefghjkmnpqrstuvwxyz";
function geohash(lat, lon, precision = 6) {
  let even = true, la = [-90, 90], lo = [-180, 180], out = "", bits = 0, n = 0;
  while (out.length < precision) {
    const r = even ? lo : la, v = even ? lon : lat, mid = (r[0] + r[1]) / 2;
    n <<= 1;
    if (v >= mid) { n |= 1; r[0] = mid; } else r[1] = mid;
    even = !even;
    if (++bits === 5) { out += B32[n]; bits = 0; n = 0; }
  }
  return out;
}

const EPOCH_END = 1762360200; // last history reading; matches the example epoch in TEAM.md
const STEP = 60; // one reading per minute
const N = 200; // GET /devices/:ens returns the latest 200
const LIVE_MINUTES = 20; // WS /live replay length

// level = typical PM2.5 in µg/m³ ×10. scenario: "flag-then-slash" (2 flags in history, 3rd + slash in live),
// "slashed" (slashed 1 h ago, no readings since).
const SPECS = [
  { label: "andheri-01", loc: "Andheri", simulated: false, level: 520, temp: true, off: [0.002, -0.003] },
  { label: "andheri-02", loc: "Andheri", simulated: false, level: 560, temp: false, off: [-0.012, 0.009] }, // device 2: temp/hum = 0
  { label: "sim-andheri-03", loc: "Andheri", level: 540, off: [0.01, 0.012] },
  { label: "sim-bandra-01", loc: "Bandra", level: 480, scenario: "flag-then-slash", off: [0.003, 0.004] },
  { label: "sim-bandra-02", loc: "Bandra", level: 470, off: [-0.008, 0.006] },
  { label: "sim-powai-01", loc: "Powai", level: 430, off: [0, 0] },
  { label: "sim-colaba-01", loc: "Colaba", level: 360, off: [0, 0] },
  { label: "sim-dadar-01", loc: "Dadar", level: 610, off: [0, 0] },
  { label: "sim-kurla-01", loc: "Kurla", level: 820, scenario: "slashed", off: [0, 0] },
  { label: "sim-kurla-02", loc: "Kurla", level: 790, off: [0.008, -0.01] },
  { label: "sim-worli-01", loc: "Worli", level: 450, off: [0, 0] },
  { label: "sim-chembur-01", loc: "Chembur", level: 930, off: [0, 0] },
  { label: "sim-borivali-01", loc: "Borivali", level: 410, off: [0, 0] },
  { label: "sim-malad-01", loc: "Malad", level: 500, off: [0, 0] },
  { label: "sim-thane-01", loc: "Thane", level: 640, off: [0, 0] },
  { label: "sim-vashi-01", loc: "Vashi", level: 700, off: [0, 0] },
];

const devices = SPECS.map((s, i) => {
  const loc = LOCALITIES.find((l) => l.name === s.loc);
  const account = privateKeyToAccount(keccak256(toHex(`prananet-mock-device:${s.label}`)));
  return {
    ...s,
    idx: i,
    account,
    device: account.address.toLowerCase(),
    ens: `${s.label}.prananet.eth`,
    geohash: geohash(loc.lat + s.off[0], loc.lon + s.off[1]),
    simulated: s.simulated ?? true,
    temp: s.temp ?? true,
    baseline_mv: 160 + Math.round(rand() * 120),
  };
});

const spike = () => 2350 + Math.round(rand() * 150); // incense: ~240 µg/m³

function values(d, minute) {
  // Shared city-wide drift (same for all devices at a given minute) + per-device noise.
  const city = 1 + 0.18 * Math.sin(minute / 40) + 0.06 * Math.sin(minute / 7);
  const pm25 = Math.max(20, Math.round(d.level * city + (rand() - 0.5) * 60));
  return {
    pm25_x10: pm25,
    pm10_x10: Math.round(pm25 * (1.45 + rand() * 0.2)),
    temp_x10: d.temp ? Math.round(292 + 12 * Math.sin(minute / 90) + (rand() - 0.5) * 6) : 0,
    hum_x10: d.temp ? Math.round(650 + 40 * Math.cos(minute / 80) + (rand() - 0.5) * 10) : 0,
  };
}

async function sign(d, epoch, nonce, v) {
  const message = keccak256(
    encodePacked(
      ["address", "uint256", "uint256", "uint256", "int256", "uint256", "uint256", "uint256", "address"],
      [d.device, BigInt(epoch), BigInt(v.pm25_x10), BigInt(v.pm10_x10), BigInt(v.temp_x10), BigInt(v.hum_x10), BigInt(nonce), BigInt(CHAIN.chainId), CHAIN.readingsContract],
    ),
  );
  const signature = await d.account.signMessage({ message: { raw: message } });
  return { device: d.device, ens: d.ens, geohash: d.geohash, epoch, ...v, nonce, signature, simulated: d.simulated };
}

// History: minute index m runs 0..N-1, epoch = EPOCH_END - (N-1-m)*STEP. Live: m = N..N+LIVE_MINUTES-1.
const epochAt = (m) => EPOCH_END + (m - (N - 1)) * STEP;
const history = new Map();
const live = new Map();
for (const d of devices) {
  const h = [];
  const l = [];
  const last = d.scenario === "slashed" ? N - 61 : N - 1; // slashed device stopped an hour ago
  for (let m = 0; m <= last; m++) {
    let v = values(d, m);
    if (d.scenario === "slashed" && m > last - 3) v = { ...v, pm25_x10: spike(), pm10_x10: spike() + 900 };
    if (d.scenario === "flag-then-slash" && m > N - 3) v = { ...v, pm25_x10: spike(), pm10_x10: spike() + 900 };
    h.push(await sign(d, epochAt(m), m + 1, v));
  }
  if (d.scenario !== "slashed") {
    const liveCount = d.scenario === "flag-then-slash" ? 1 : LIVE_MINUTES; // its 3rd spike, then slashed
    for (let m = N; m < N + liveCount; m++) {
      let v = values(d, m);
      if (d.scenario === "flag-then-slash") v = { ...v, pm25_x10: spike(), pm10_x10: spike() + 900 };
      l.push(await sign(d, epochAt(m), m + 1, v));
    }
  }
  history.set(d.device, h);
  live.set(d.device, l);
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const k = s.length >> 1;
  return s.length % 2 ? s[k] : Math.round((s[k - 1] + s[k]) / 2);
};
// Neighbour median at an epoch = median PM2.5 of all other devices reporting at that epoch
// (a stand-in for the verifier's cell + neighbouring-cells rule).
function neighbourMedian(device, epoch, pool) {
  const vals = [];
  for (const [addr, rs] of pool) if (addr !== device) { const r = rs.find((x) => x.epoch === epoch); if (r) vals.push(r.pm25_x10); }
  return median(vals);
}
const flagFor = (r, pool) => ({ device: r.device, ens: r.ens, epoch: r.epoch, reason: "neighbour_outlier", value_x10: r.pm25_x10, median_x10: neighbourMedian(r.device, r.epoch, pool) });

const flags = [];
for (const d of devices) {
  if (d.scenario === "slashed") flags.push(...history.get(d.device).slice(-3).map((r) => flagFor(r, history)));
  if (d.scenario === "flag-then-slash") flags.push(...history.get(d.device).slice(-2).map((r) => flagFor(r, history)));
}
flags.sort((a, b) => a.epoch - b.epoch);

const STAKE = "10000000000000000"; // 0.01 ETH
const status = (d) => (d.scenario === "slashed" ? "slashed" : d.scenario === "flag-then-slash" ? "flagged" : "active");
const details = devices.map((d) => {
  const readings = history.get(d.device);
  return {
    device: d.device,
    ens: d.ens,
    geohash: d.geohash,
    status: status(d),
    stake_wei: status(d) === "slashed" ? "0" : STAKE,
    baseline_mv: d.baseline_mv,
    last_reading: readings[readings.length - 1],
    simulated: d.simulated,
    readings,
  };
});

// WS /live replay: readings interleaved by epoch; the flag + slash land right after the spike.
const liveMsgs = [];
for (let m = N; m < N + LIVE_MINUTES; m++) {
  for (const d of devices) {
    const r = live.get(d.device).find((x) => x.epoch === epochAt(m));
    if (!r) continue;
    liveMsgs.push({ type: "reading", data: r });
    if (d.scenario === "flag-then-slash") {
      liveMsgs.push({ type: "flag", data: flagFor(r, live) });
      liveMsgs.push({ type: "slash", data: { device: d.device, ens: d.ens, tx: `0x${hex(64)}` } });
    }
  }
}
// Move the flag/slash a few messages later so the demo shows the spike first.
const fi = liveMsgs.findIndex((x) => x.type === "flag");
const evts = liveMsgs.splice(fi, 2);
liveMsgs.splice(fi + 6, 0, ...evts);

const register = {
  ok: { ok: true, ens: "colaba-02.prananet.eth", tx: `0x${hex(64)}` },
  max_devices: { ok: false, error: "max_devices" },
};

rmSync(join(OUT, "devices"), { recursive: true, force: true });
mkdirSync(join(OUT, "devices"), { recursive: true });
const write = (name, data) => writeFileSync(join(OUT, name), JSON.stringify(data, null, 2) + "\n");
write("chain.json", CHAIN);
write("devices.json", details.map((d) => { const rest = { ...d }; delete rest.readings; return rest; }));
for (const det of details) write(join("devices", `${det.ens}.json`), det);
write("flags.json", flags);
write("live.json", liveMsgs);
write("register.json", register);
console.log(`wrote ${details.length} devices, ${flags.length} flags, ${liveMsgs.length} live messages to ${OUT}`);
console.log(devices.map((d) => `${d.label.padEnd(16)} ${d.geohash}`).join("\n"));
