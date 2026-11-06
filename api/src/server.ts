import { createServer, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";

// GET /api/aqi?geohash=te7ud2 -> verifier cell object (TEAM.md "Paid API").
// x402 on hedera:testnet is added behind X402=hedera; until then data is served free.

const PORT = Number(process.env.PORT ?? 8082);
const VERIFIER_URL = process.env.VERIFIER_URL ?? "http://localhost:8081";
const X402 = process.env.X402 ?? "off";
const GEOHASH_RE = /^[0-9b-hjkmnp-z]{6}$/;

const mockCell = JSON.parse(readFileSync(new URL("../mocks/cell.json", import.meta.url), "utf8"));

async function getCell(geohash: string): Promise<unknown> {
  if (VERIFIER_URL === "mock") return { ...mockCell, geohash };
  const res = await fetch(`${VERIFIER_URL}/cells/${geohash}`);
  if (!res.ok) throw new Error(`verifier ${res.status}`);
  return res.json();
}

function send(res: ServerResponse, code: number, body: unknown) {
  res.writeHead(code, { "content-type": "application/json", "access-control-allow-origin": "*" });
  res.end(JSON.stringify(body));
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (req.method === "GET" && url.pathname === "/health") return send(res, 200, { ok: true, x402: X402 });

  if (req.method === "GET" && url.pathname === "/api/aqi") {
    const gh = (url.searchParams.get("geohash") ?? "").toLowerCase();
    if (!GEOHASH_RE.test(gh)) return send(res, 400, { error: "bad_geohash" });
    if (X402 !== "off") return send(res, 501, { error: "x402_not_implemented" });
    try {
      return send(res, 200, await getCell(gh));
    } catch (e) {
      return send(res, 502, { error: "verifier_unavailable", detail: String(e) });
    }
  }

  send(res, 404, { error: "not_found" });
}).listen(PORT, () => console.log(`api on :${PORT}, verifier=${VERIFIER_URL}, x402=${X402}`));
