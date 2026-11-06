// Autonomous buyer for PranaNet air-quality data. No human approval in the loop:
//   1. discover: GET <API_URL>/.well-known/x402 -> the paid resource and what it accepts
//   2. request:  GET /api/aqi?geohash=… -> HTTP 402 + PAYMENT-REQUIRED
//   3. decide:   budget check (hard cap on total spend this run + per-payment cap)
//   4. pay:      @x402/fetch signs a Hedera HBAR transfer, retries with PAYMENT-SIGNATURE; the
//                x402.org facilitator settles it on hedera:testnet
//   5. record:   print the data and the HashScan link; append the purchase to an HCS topic
//
//   npm start                 one purchase for GEOHASH
//   npm start -- --times 3    several purchases (stops at the budget)
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { AccountId, Client, PrivateKey, TopicMessageSubmitTransaction } from "@hiero-ledger/sdk";
import { decodePaymentResponseHeader, wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { createClientHederaSigner } from "@x402/hedera";
import { ExactHederaScheme } from "@x402/hedera/exact/client";
import { Budget } from "./budget.ts";

const envUrl = new URL("../.env", import.meta.url);
if (existsSync(envUrl)) loadEnvFile(envUrl);
const env = (k: string, d = "") => process.env[k] || d;

const API_URL = env("API_URL", "http://localhost:8082").replace(/\/$/, "");
const GEOHASH = env("GEOHASH", "te7ud2");
const ACCOUNT = env("AGENT_ACCOUNT_ID");
const KEY = env("AGENT_PRIVATE_KEY");
const TOPIC = env("HCS_TOPIC_ID");
const times = Number(process.argv[process.argv.indexOf("--times") + 1] || 1) || 1;
if (!ACCOUNT || !KEY) {
  console.error("AGENT_ACCOUNT_ID / AGENT_PRIVATE_KEY missing: run `npm run setup` first");
  process.exit(1);
}

// Budget: hard cap for this run and per payment, in tinybars (1 HBAR = 1e8).
const budget = new Budget(BigInt(env("BUDGET_TINYBAR", "50000000")), BigInt(env("MAX_PER_CALL_TINYBAR", "20000000")));

// 1. discovery
const disco = (await (await fetch(`${API_URL}/.well-known/x402`)).json()) as { resources: { resource: string; description: string }[] };
const resource = disco.resources.find((r) => r.resource.includes("/api/aqi"));
if (!resource) throw new Error("API does not advertise /api/aqi");
console.log(`discovered: ${resource.resource}\n  ${resource.description}`);
const url = `${API_URL}/api/aqi?geohash=${GEOHASH}`;

let lastPayTo = "";
// 2-4. x402 client for hedera:testnet with spend controls and the budget hook
const signer = createClientHederaSigner(ACCOUNT, PrivateKey.fromStringECDSA(KEY), { network: "hedera:testnet" });
const client = new x402Client()
  .register("hedera:testnet", new ExactHederaScheme(signer))
  .setSpendControls({ maxAmountPerPayment: false, allowedAssets: [{ network: "hedera:testnet", asset: "0.0.0", maxAmountPerPayment: budget.perCall.toString() }] })
  .onBeforePaymentCreation(async ({ selectedRequirements: req }) => {
    lastPayTo = req.payTo;
    const verdict = budget.check(req.asset, req.amount);
    console.log(`  402: pay ${req.amount} tinybar (${Number(req.amount) / 1e8} HBAR) to ${req.payTo} on ${req.network} -> ${verdict.ok ? "approved by budget" : `REFUSED: ${verdict.reason}`}`);
    return verdict.ok ? undefined : { abort: true, reason: verdict.reason };
  });
const pay = wrapFetchWithPayment(fetch, client);

const hcs = TOPIC ? Client.forTestnet().setOperator(AccountId.fromString(ACCOUNT), PrivateKey.fromStringECDSA(KEY)) : null;

for (let i = 0; i < times; i++) {
  let res: Response;
  try {
    res = await pay(url);
  } catch (e) {
    console.log(`stopped: ${(e as Error).message}`);
    break;
  }
  if (!res.ok) {
    console.log(`api answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
    break;
  }
  const cell = (await res.json()) as { geohash: string; epoch: number; pm25_x10: number; pm10_x10: number; devices_used: number; devices_flagged: number; station: { name: string; pm25_x10: number } | null };
  const header = res.headers.get("PAYMENT-RESPONSE");
  const settle = header ? decodePaymentResponseHeader(header) : null;
  const amount = BigInt(settle?.amount ?? budget.lastAmount ?? 0);
  budget.spend(amount);
  const link = settle?.transaction ? `https://hashscan.io/testnet/transaction/${settle.transaction}` : "(no settlement header)";
  console.log(
    `cell ${cell.geohash} @ ${new Date(cell.epoch * 1000).toISOString()}: PM2.5 ${(cell.pm25_x10 / 10).toFixed(1)} µg/m³, PM10 ${(cell.pm10_x10 / 10).toFixed(1)} µg/m³ ` +
      `from ${cell.devices_used} devices (${cell.devices_flagged} flagged), station ${cell.station ? `${cell.station.name} ${(cell.station.pm25_x10 / 10).toFixed(1)}` : "none"}`,
  );
  console.log(`  paid: ${link}`);
  console.log(`  budget: spent ${budget.spent} / ${budget.cap} tinybar`);

  // 5. HCS log of the purchase
  if (hcs) {
    const msg = JSON.stringify({ kind: "prananet.purchase", resource: url, geohash: cell.geohash, epoch: cell.epoch, pm25_x10: cell.pm25_x10, amount_tinybar: amount.toString(), payer: ACCOUNT, payTo: lastPayTo, network: "hedera:testnet", tx: settle?.transaction ?? null, at: new Date().toISOString() });
    const rx = await (await new TopicMessageSubmitTransaction().setTopicId(TOPIC).setMessage(msg).execute(hcs)).getReceipt(hcs);
    console.log(`  logged to HCS topic ${TOPIC} seq #${rx.topicSequenceNumber}: https://hashscan.io/testnet/topic/${TOPIC}`);
  }
}
hcs?.close();
