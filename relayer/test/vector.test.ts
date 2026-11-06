import { describe, expect, it } from "vitest";
import vector from "./vector.json" with { type: "json" };
import { packReading, readingDigest, readingMessage, recoverReadingSigner } from "../src/message.ts";

// Same constants as contracts/test/Vector.t.sol; the firmware `selftest` must print these too.
const FOUNDRY = {
  address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  message: "0xf920ce88124f7e4845796eb90f81329a74f4ae9753291650afba2a1bf3e09a9c",
  digest: "0x7e91e0a7eeaf999f31609c6496bbb71875af5668734189b88143fcc21a38dbc5",
  signature:
    "0x8bf0d72d56d07cd5a48285abc17b6362eb62f327463446840fa6e8fc989607af1628f6b9f14af9b7a2cb62d26cb1e234d4467455f2559e5114e851aa15b27a6a1b",
};

describe("fixed vector", () => {
  const r = vector.reading as Parameters<typeof readingMessage>[0];
  const c = vector.readings_contract as `0x${string}`;

  it("packs to 264 bytes", () => {
    expect((packReading(r, vector.chain_id, c).length - 2) / 2).toBe(264);
  });
  it("matches the Foundry constants", () => {
    expect(vector).toMatchObject(FOUNDRY);
    expect(readingMessage(r, vector.chain_id, c)).toBe(FOUNDRY.message);
    expect(readingDigest(r, vector.chain_id, c)).toBe(FOUNDRY.digest);
  });
  it("recovers the device address", async () => {
    expect(await recoverReadingSigner(r, FOUNDRY.signature as `0x${string}`, vector.chain_id, c)).toBe(FOUNDRY.address);
  });
});

import { parseReading } from "../src/message.ts";
import vec from "./vector.json" with { type: "json" };
describe("optional baseline_mv (unsigned)", () => {
  const body = { ...vec.reading, signature: vec.signature, ens: "x.prananet.eth", geohash: "te7ud2", simulated: false };
  it("is accepted, returned separately and not part of the reading", () => {
    const p = parseReading({ ...body, baseline_mv: 612 });
    expect(p.ok && p.baseline_mv).toBe(612);
    expect(p.ok && "baseline_mv" in p.reading).toBe(false);
  });
  it("is optional and validated", () => {
    expect(parseReading(body).ok).toBe(true);
    expect(parseReading({ ...body, baseline_mv: -1 }).ok).toBe(false);
    expect(parseReading({ ...body, baseline_mv: 1.5 }).ok).toBe(false);
  });
});
