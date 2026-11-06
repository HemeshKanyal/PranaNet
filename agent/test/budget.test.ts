import assert from "node:assert/strict";
import { test } from "node:test";
import { Budget } from "../src/budget.ts";

test("hard cap: approves until the total would exceed the cap", () => {
  const b = new Budget(25_000_000n, 20_000_000n);
  assert.deepEqual(b.check("0.0.0", "10000000"), { ok: true });
  b.spend(10_000_000n);
  assert.deepEqual(b.check("0.0.0", "10000000"), { ok: true });
  b.spend(10_000_000n);
  const third = b.check("0.0.0", "10000000");
  assert.equal(third.ok, false);
  assert.equal(b.spent, 20_000_000n);
});

test("per-call cap and asset allowlist", () => {
  const b = new Budget(1_000_000_000n, 20_000_000n);
  assert.equal(b.check("0.0.0", "20000001").ok, false);
  assert.equal(b.check("0.0.429274", "1").ok, false);
  assert.equal(b.check("0.0.0", "0").ok, false);
});

test("reservations stop two in-flight payments from overshooting", () => {
  const b = new Budget(15_000_000n, 10_000_000n);
  assert.equal(b.check("0.0.0", "10000000").ok, true);
  assert.equal(b.check("0.0.0", "10000000").ok, false);
});
