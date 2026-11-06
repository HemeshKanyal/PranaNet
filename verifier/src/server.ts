// Verifier service on :8081. Every EPOCH_SECONDS (GRACE_SECONDS after a window closes) it judges
// the window that just ended: real readings from the relayer + simulated neighbours, SPEC
// cross-check, Registry.flag / clearFlags on Sepolia, simulated readings/flags back through the
// relayer. Serves GET /cells/:geohash (TEAM.md "Verifier output") for the x402 API.
import { createServer, type ServerResponse } from "node:http";
import { RegistryClient } from "./chain.ts";
import { config } from "./config.ts";
import { epochToJudge, runVerifierEpoch } from "./loop.ts";
import { RelayerClient } from "./relayer.ts";
import { Simulator, simsAround } from "./sim.ts";
import { OpenAQStations, loadMockStations } from "./stations.ts";
import { Verifier } from "./verifier.ts";

const GEOHASH_RE = /^[0-9b-hjkmnp-z]{6}$/;
const log = (m: string) => console.log(`${new Date().toISOString().slice(11, 19)} ${m}`);

const live = config.openaqKey !== "mock" && config.openaqKey !== "";
const openaq = live ? new OpenAQStations(config.openaqKey, config.openaqRadiusM) : null;
const verifier = new Verifier(new Simulator(simsAround(config.simCells[0], config.simArea)), openaq ? new Map() : loadMockStations());
const relayer = config.relayerUrl !== "mock" && config.simToken ? new RelayerClient(config.relayerUrl, config.simToken) : undefined;
const registry = config.verifierKey && config.registry ? new RegistryClient(config) : undefined;

async function refreshStations() {
  if (!openaq) return;
  await openaq.refresh(config.simCells);
  verifier.stations = openaq.asMap();
}

let lastJudged = 0;
async function tick() {
  const epoch = epochToJudge(Math.floor(Date.now() / 1000), config.epochSeconds, config.graceSeconds);
  if (epoch <= lastJudged) return;
  lastJudged = epoch;
  const area = verifier.stations.get(config.simCells[0])?.pm25_x10;
  const rep = await runVerifierEpoch(epoch, { verifier, relayer, registry, areaPm25X10: () => area ?? config.simDefaultPm25X10, log });
  log(`epoch ${epoch}: ${rep.real.length} real + ${verifier.readings.length - rep.real.length} simulated readings, ${rep.flags.length} flag(s)`);
}

function schedule() {
  const now = Date.now() / 1000;
  const next = (Math.floor((now - config.graceSeconds) / config.epochSeconds) + 1) * config.epochSeconds + config.graceSeconds;
  setTimeout(() => {
    tick().catch((e) => log(`epoch failed: ${(e as Error).message}`)).finally(schedule);
  }, Math.max(1000, (next - now) * 1000));
}

function send(res: ServerResponse, code: number, body: unknown) {
  res.writeHead(code, { "content-type": "application/json", "access-control-allow-origin": "*" });
  res.end(JSON.stringify(body));
}

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean);

  if (req.method === "GET" && url.pathname === "/health")
    return send(res, 200, {
      ok: true,
      epoch: verifier.epoch,
      relayer: relayer ? config.relayerUrl : "mock",
      verifier: registry?.address ?? null,
      registry: config.registry || null,
      stations: openaq ? Object.fromEntries(openaq.byCell) : "mock",
      stationError: openaq?.lastError || undefined,
    });

  // GET /cells/:geohash -> verifier cell object (TEAM.md "Verifier output")
  if (req.method === "GET" && parts[0] === "cells" && parts.length === 2) {
    const gh = parts[1].toLowerCase();
    if (!GEOHASH_RE.test(gh)) return send(res, 400, { error: "bad_geohash" });
    return send(res, 200, verifier.cell(gh));
  }

  if (req.method === "GET" && url.pathname === "/flags") return send(res, 200, verifier.flags);
  if (req.method === "GET" && url.pathname === "/sim/devices") return send(res, 200, verifier.simDevices());

  // POST /sim/:ens/spike?on=1|0 -> demo: make a simulated device read high (incense)
  if (req.method === "POST" && parts[0] === "sim" && parts[2] === "spike") {
    const d = verifier.sim.find(parts[1]);
    if (!d) return send(res, 404, { error: "unknown_sim_device" });
    d.spike = url.searchParams.get("on") !== "0";
    return send(res, 200, { label: d.label, spike: d.spike });
  }

  send(res, 404, { error: "not_found" });
}).listen(config.port, async () => {
  log(`verifier on :${config.port}, epoch ${config.epochSeconds}s (+${config.graceSeconds}s grace), relayer=${relayer ? config.relayerUrl : "mock"}`);
  if (registry) log(`verifier wallet ${registry.address} on Registry ${config.registry}: isVerifier=${await registry.isVerifier().catch(() => "?")}`);
  else log("no VERIFIER_PRIVATE_KEY/REGISTRY_ADDRESS: flags are only logged");
  await refreshStations();
  setInterval(() => void refreshStations(), 10 * 60 * 1000);
  void tick();
  schedule();
});
