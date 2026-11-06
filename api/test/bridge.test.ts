import assert from "node:assert/strict";
import { test } from "node:test";
import { mirrorTxId, verifiedAmount, weiFor } from "../src/bridge.ts";

test("mirror node transaction id format", () => {
  assert.equal(mirrorTxId("0.0.5001@1700000000.000000123"), "0.0.5001-1700000000-000000123");
});

test("conversion at the published rate", () => {
  assert.equal(weiFor(10_000_000n, 100_000_000_000_000n), 10_000_000_000_000n); // 0.1 HBAR -> 0.00001 ETH
});

test("only successful transfers to PAY_TO count", async () => {
  const fake = (async () =>
    Response.json({ transactions: [{ result: "SUCCESS", transfers: [{ account: "0.0.777", amount: 10000000 }, { account: "0.0.888", amount: -10000000 }] }] })) as unknown as typeof fetch;
  assert.equal(await verifiedAmount("0.0.888@1.2", "0.0.777", fake), 10_000_000n);
  assert.equal(await verifiedAmount("0.0.888@1.2", "0.0.999", fake), 0n);
  const failed = (async () => Response.json({ transactions: [{ result: "INSUFFICIENT_PAYER_BALANCE", transfers: [] }] })) as unknown as typeof fetch;
  assert.equal(await verifiedAmount("0.0.888@1.2", "0.0.777", failed), 0n);
});

test("revenue = successful credits to PAY_TO from the mirror node, with pagination", async () => {
  const { incomingPayments } = await import("../src/bridge.ts");
  const pages: Record<string, unknown> = {
    first: { transactions: [
      { transaction_id: "0.0.9185802-1793964241-290186009", result: "SUCCESS", transfers: [{ account: "0.0.777", amount: 10000000 }, { account: "0.0.888", amount: -10000000 }] },
      { transaction_id: "0.0.777-1793960000-000000001", result: "SUCCESS", transfers: [{ account: "0.0.777", amount: -2000000000 }, { account: "0.0.999", amount: 2000000000 }] },
      { transaction_id: "0.0.2-1793950000-000000001", result: "SUCCESS", transfers: [{ account: "0.0.777", amount: 100000000000 }, { account: "0.0.2", amount: -100000000000 }] }, // faucet top-up: not revenue
    ], links: { next: "/api/v1/transactions?page=2" } },
    second: { transactions: [
      { transaction_id: "0.0.9185802-1793964343-612274191", result: "SUCCESS", transfers: [{ account: "0.0.777", amount: 10000000 }, { account: "0.0.888", amount: -10000000 }] },
    ], links: { next: null } },
  };
  const fake = (async (url: string) => Response.json(url.includes("page=2") ? pages.second : pages.first)) as unknown as typeof fetch;
  const got = await incomingPayments("0.0.777", fake, "0.0.9185802");
  assert.deepEqual(got.map((p) => [p.transaction, p.tinybar, p.payer]), [
    ["0.0.9185802@1793964241.290186009", 10000000n, "0.0.888"],
    ["0.0.9185802@1793964343.612274191", 10000000n, "0.0.888"],
  ]);
});
