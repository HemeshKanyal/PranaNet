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
