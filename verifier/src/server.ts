import { createServer, type ServerResponse } from "node:http";
import { Simulator } from "./sim.ts";
import { loadStations } from "./stations.ts";
import { Verifier } from "./verifier.ts";

const PORT = Number(process.env.PORT ?? 8081);
const EPOCH_SECONDS = Number(process.env.EPOCH_SECONDS ?? 60);
const GEOHASH_RE = /^[0-9b-hjkmnp-z]{6}$/;

const verifier = new Verifier(new Simulator(), loadStations());

function tick() {
  const epoch = Math.floor(Date.now() / 1000);
  const flags = verifier.runEpoch(epoch);
  for (const f of flags) {
    // TODO: call Registry.flag(device, epoch, REASON_CODE[f.reason]) once the ABI is in contracts/out/
    console.log(`[flag] ${f.ens} ${f.reason} value=${f.value_x10} median=${f.median_x10}`);
  }
}
tick();
setInterval(tick, EPOCH_SECONDS * 1000);

function send(res: ServerResponse, code: number, body: unknown) {
  res.writeHead(code, { "content-type": "application/json", "access-control-allow-origin": "*" });
  res.end(JSON.stringify(body));
}

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean);

  if (req.method === "GET" && url.pathname === "/health") return send(res, 200, { ok: true, epoch: verifier.epoch });

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
}).listen(PORT, () => console.log(`verifier on :${PORT}, epoch ${EPOCH_SECONDS}s`));
