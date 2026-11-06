import { beforeEach, describe, expect, it } from "vitest";
import type { Address, Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { MemoryStore } from "../src/arkiv.ts";
import type { ChainReads, DeviceState } from "../src/chain.ts";
import { handleReading, type IntakeDeps } from "../src/intake.ts";
import { type Reading, readingMessage } from "../src/message.ts";

const CHAIN_ID = 11155111;
const CONTRACT = "0x5FbDB2315678afecb367f032d93F642f64180aa3" as Address;

const deviceAcct = privateKeyToAccount(generatePrivateKey());
const otherAcct = privateKeyToAccount(generatePrivateKey());
const DEVICE = deviceAcct.address.toLowerCase() as Address;

class FakeChain implements ChainReads {
  devices = new Map<string, DeviceState & { nonce: bigint }>();
  add(addr: Address, active = true) {
    this.devices.set(addr.toLowerCase(), {
      device: addr.toLowerCase() as Address,
      owner: "0x000000000000000000000000000000000000dEaD",
      label: "andheri-01",
      geohash: "te7ud2",
      ens: "andheri-01.prananet.eth",
      active,
      slashed: false,
      consecutiveFlags: 0,
      stakeWei: 0n,
      nonce: 0n,
    });
  }
  async isActive(d: Address) {
    return this.devices.get(d.toLowerCase())?.active ?? false;
  }
  async lastNonce(d: Address) {
    return this.devices.get(d.toLowerCase())?.nonce ?? 0n;
  }
  async getDevice(d: Address) {
    return this.devices.get(d.toLowerCase()) ?? null;
  }
}

async function signed(
  acct = deviceAcct,
  over: Partial<Reading> = {},
  opts: { chainId?: number; contract?: Address } = {},
): Promise<Reading> {
  const base = {
    device: acct.address.toLowerCase() as Address,
    epoch: 1762360200,
    pm25_x10: 423,
    pm10_x10: 423,
    temp_x10: 291,
    hum_x10: 640,
    nonce: 1,
    ...over,
  };
  const signature = await acct.signMessage({
    message: { raw: readingMessage(base, opts.chainId ?? CHAIN_ID, opts.contract ?? CONTRACT) },
  });
  return { ens: "spoofed.eth", geohash: "tdr1v9", signature, simulated: false, ...base };
}

let chain: FakeChain;
let store: MemoryStore;
let submitted: Reading[];
let broadcasts: unknown[];
let deps: IntakeDeps;

beforeEach(() => {
  chain = new FakeChain();
  chain.add(deviceAcct.address);
  store = new MemoryStore();
  submitted = [];
  broadcasts = [];
  const pending = new Map<string, number>();
  deps = {
    chainId: CHAIN_ID,
    readingsContract: CONTRACT,
    chain,
    store,
    submitter: {
      pendingNonce: (d) => pending.get(d.toLowerCase()) ?? 0,
      submit: async (r) => {
        pending.set(r.device, r.nonce);
        submitted.push(r);
        return { ok: true, tx: "0x01" as Hex };
      },
    },
    broadcast: (m) => broadcasts.push(m),
  };
});

describe("POST /readings intake", () => {
  it("accepts a valid reading, uses on-chain metadata, writes Arkiv, queues tx, broadcasts", async () => {
    const out = await handleReading(await signed(), deps);
    expect(out.status).toBe(202);
    expect(out.body).toMatchObject({ ok: true, nonce: 1, ens: "andheri-01.prananet.eth" });
    await new Promise((r) => setTimeout(r, 0));
    expect(store.readingsList).toHaveLength(1);
    expect(store.readingsList[0]).toMatchObject({ ens: "andheri-01.prananet.eth", geohash: "te7ud2", device: DEVICE });
    expect(submitted).toHaveLength(1);
    expect(broadcasts).toEqual([{ type: "reading", data: store.readingsList[0] }]);
  });

  it("rejects a bad signature (value changed after signing)", async () => {
    const r = await signed();
    const out = await handleReading({ ...r, pm25_x10: 100 }, deps);
    expect(out.status).toBe(401);
    expect(out.body.error).toBe("bad_signature");
    expect(submitted).toHaveLength(0);
    expect(store.readingsList).toHaveLength(0);
  });

  it("rejects a reading signed by another key for a registered device (wrong device)", async () => {
    const r = await signed(otherAcct, { device: DEVICE });
    const out = await handleReading(r, deps);
    expect(out.status).toBe(401);
    expect(out.body).toMatchObject({ error: "bad_signature", recovered: otherAcct.address.toLowerCase() });
  });

  it("rejects a validly signed reading from an unregistered key", async () => {
    const out = await handleReading(await signed(otherAcct), deps);
    expect(out.status).toBe(403);
    expect(out.body.error).toBe("unknown_device");
  });

  it("rejects an inactive (slashed) device", async () => {
    chain.devices.get(DEVICE)!.active = false;
    const out = await handleReading(await signed(), deps);
    expect(out.status).toBe(403);
    expect(out.body.error).toBe("inactive_device");
  });

  it("rejects a replayed nonce (already on-chain)", async () => {
    chain.devices.get(DEVICE)!.nonce = 5n;
    const out = await handleReading(await signed(deviceAcct, { nonce: 5 }), deps);
    expect(out.status).toBe(409);
    expect(out.body).toMatchObject({ error: "stale_nonce", last_nonce: 5 });
  });

  it("rejects a replay of a reading still in the tx queue", async () => {
    const r = await signed(deviceAcct, { nonce: 7 });
    expect((await handleReading(r, deps)).status).toBe(202);
    const again = await handleReading(r, deps);
    expect(again.status).toBe(409);
    expect(submitted).toHaveLength(1);
  });

  it("rejects nonce 0", async () => {
    const out = await handleReading(await signed(deviceAcct, { nonce: 0 }), deps);
    expect(out.status).toBe(409);
  });

  it("rejects a signature made for another chain or contract", async () => {
    const a = await handleReading(await signed(deviceAcct, {}, { chainId: 1 }), deps);
    const b = await handleReading(
      await signed(deviceAcct, {}, { contract: "0x0000000000000000000000000000000000000001" }),
      deps,
    );
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
  });

  it("rejects malformed bodies with the offending field", async () => {
    const r = await signed();
    expect((await handleReading({ ...r, geohash: "bad" }, deps)).body).toMatchObject({ error: "invalid_shape", field: "geohash" });
    expect((await handleReading({ ...r, signature: "0x1234" }, deps)).body).toMatchObject({ field: "signature" });
    expect((await handleReading({ ...r, pm25_x10: -1 }, deps)).body).toMatchObject({ field: "pm25_x10" });
    expect((await handleReading(null, deps)).status).toBe(400);
  });

  it("rejects a high-s (malleated) signature", async () => {
    const r = await signed();
    const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
    const s = BigInt("0x" + r.signature.slice(66, 130));
    const v = parseInt(r.signature.slice(130), 16);
    const highS = (N - s).toString(16).padStart(64, "0");
    const flipped = (v === 27 ? 28 : 27).toString(16);
    const out = await handleReading({ ...r, signature: `${r.signature.slice(0, 66)}${highS}${flipped}` }, deps);
    expect(out.status).toBe(400);
  });
});
