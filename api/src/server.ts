// PranaNet paid data API (port 8082): GET /api/aqi?geohash=te7ud2 -> verifier cell object
// (TEAM.md "Paid API"), behind x402 v2 on hedera:testnet.
//
// x402 (docs.x402.org, @x402/* 2.30.0): an unpaid request gets HTTP 402 with a PAYMENT-REQUIRED
// header listing what to pay (scheme "exact", network hedera:testnet, asset 0.0.0 = HBAR in
// tinybars, payTo = PAY_TO). The client signs a Hedera transfer, retries with PAYMENT-SIGNATURE;
// the x402.org facilitator verifies it, pays the network fee (its feePayer account) and settles
// on Hedera; we return the data with a PAYMENT-RESPONSE header carrying the transaction id.
//
// Every settled payment is appended to data/revenue.jsonl; `npm run bridge` moves that revenue
// into RewardPool.fundPool() on Sepolia (see src/bridge.ts).
//
// Discovery: GET /.well-known/x402 lists the paid resources (what the agent reads first).
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactHederaScheme } from "@x402/hedera/exact/server";
import express from "express";
import { config } from "./config.ts";

const GEOHASH_RE = /^[0-9b-hjkmnp-z]{6}$/;
const mockCell = JSON.parse(readFileSync(new URL("../mocks/cell.json", import.meta.url), "utf8"));
const revenueLog = new URL("../data/revenue.jsonl", import.meta.url);
mkdirSync(new URL("../data/", import.meta.url), { recursive: true });

async function getCell(geohash: string): Promise<unknown> {
  if (config.verifierUrl === "mock") return { ...mockCell, geohash };
  const res = await fetch(`${config.verifierUrl}/cells/${geohash}`, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`verifier ${res.status}`);
  return res.json();
}

const app = express();
const route = "GET /api/aqi";
const accepts = {
  scheme: "exact",
  network: config.network,
  payTo: config.payTo,
  price: { amount: config.priceTinybar, asset: "0.0.0" },
  maxTimeoutSeconds: 120,
} as const;

app.get("/health", (_req, res) => res.json({ ok: true, x402: config.x402, network: config.network, payTo: config.payTo || null }));
app.get("/.well-known/x402", (_req, res) =>
  res.json({
    x402Version: 2,
    resources: [
      {
        resource: `${config.publicUrl}/api/aqi?geohash={geohash}`,
        method: "GET",
        description: "Verified PM2.5/PM10 for a 6-char geohash cell (median of cross-checked devices + nearest reference station)",
        accepts: config.x402 === "hedera" ? [{ ...accepts, price: undefined, amount: config.priceTinybar, asset: "0.0.0" }] : [],
        output: { geohash: "string", epoch: "unix seconds", pm25_x10: "int", pm10_x10: "int", devices_used: "int", devices_flagged: "int", station: "{ name, pm25_x10 } | null" },
      },
    ],
  }),
);

if (config.x402 === "hedera") {
  if (!config.payTo) throw new Error("PAY_TO (Hedera account id 0.0.x) is required when X402=hedera");
  const facilitator = new HTTPFacilitatorClient({ url: config.facilitatorUrl });
  const server = new x402ResourceServer(facilitator).register(config.network, new ExactHederaScheme());
  server.onAfterSettle(async (ctx) => {
    const r = ctx.result;
    if (!r.success) return;
    const line = {
      at: new Date().toISOString(),
      network: r.network,
      transaction: r.transaction,
      payer: r.payer,
      amount_tinybar: String(ctx.requirements.amount),
      payTo: ctx.requirements.payTo,
      resource: ctx.paymentPayload.resource?.url,
    };
    appendFileSync(revenueLog, JSON.stringify(line) + "\n");
    console.log(`[x402] settled ${line.amount_tinybar} tinybar from ${line.payer}: https://hashscan.io/testnet/transaction/${line.transaction}`);
  });
  app.use(
    paymentMiddleware(
      { [route]: { accepts: [accepts], description: "PranaNet verified air quality for one geohash cell", mimeType: "application/json" } },
      server,
    ),
  );
}

app.get("/api/aqi", async (req, res) => {
  const gh = String(req.query.geohash ?? "").toLowerCase();
  if (!GEOHASH_RE.test(gh)) return void res.status(400).json({ error: "bad_geohash" });
  try {
    res.json(await getCell(gh));
  } catch (e) {
    res.status(502).json({ error: "verifier_unavailable", detail: String(e) });
  }
});

app.listen(config.port, () =>
  console.log(`api on :${config.port}, verifier=${config.verifierUrl}, x402=${config.x402} ${config.network} price=${config.priceTinybar} tinybar payTo=${config.payTo || "-"}`),
);
