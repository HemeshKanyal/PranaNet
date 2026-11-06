import { describe, expect, it, vi } from "vitest";
import { type RegisterDeps, handleRegister, hashToField, signalHashOf } from "../src/register.ts";

const DEVICE = "0xab29ec5df28b9fbc4804ab4d5f4ecae4833c4e32";
const OWNER = "0x83a8aF16bB2bB6eDAb19100d81e901d3Bdb87B7d";
const NULLIFIER = "0x2bf8406809dcefb1486dadc96c0a897db9bab002053054cf64272db512c6fbd8";

function idkit(overrides: Record<string, unknown> = {}) {
  return {
    protocol_version: "4.0",
    nonce: "0x00abc",
    action: "register-device",
    environment: "staging",
    responses: [
      { identifier: "proof_of_human", issuer_schema_id: 1, nullifier: NULLIFIER, expires_at_min: 1, proof: ["0x1"], signal_hash: signalHashOf(DEVICE) },
    ],
    ...overrides,
  };
}

function deps(over: Partial<RegisterDeps> = {}, verify: Record<string, unknown> = { success: true, nullifier: NULLIFIER, environment: "staging", results: [] }, status = 200) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(verify), { status }));
  const sendRegister = vi.fn(async () => ({ ok: true, tx: "0xtx" as `0x${string}` }));
  const d: RegisterDeps = {
    cfg: { worldRpId: "rp_test", worldAction: "register-device", registry: "0x0000000000000000000000000000000000000001", ensParent: "prananet.eth", allowDevRegister: false },
    fetch: fetchMock as unknown as typeof fetch,
    owner: OWNER,
    devicesPerNullifier: async () => 0n,
    isRegistered: async () => false,
    sendRegister,
    ...over,
  };
  return { d, fetchMock, sendRegister: (over.sendRegister as typeof sendRegister) ?? sendRegister };
}

const body = (o: Record<string, unknown> = {}) => ({ idkit: idkit(), device: DEVICE, label: "andheri-01", geohash: "te7ud2", ...o });

describe("hashToField (World ID test vectors)", () => {
  it("matches docs.world.org vectors", () => {
    expect(hashToField("0x010203")).toBe("0x00f1885eda54b7a053318cd41e2093220dab15d65381b1157a3633a83bfd5c92");
    expect(hashToField("0x68656c6c6f")).toBe("0x001c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36dea");
  });
  it("signal hash ignores address case (hashed as 20 bytes, like IDKit hashSignal)", () => {
    expect(signalHashOf("0xAb29EC5dF28B9fBc4804AB4d5F4EcaE4833C4E32")).toBe(signalHashOf(DEVICE));
    expect(signalHashOf(DEVICE)).toBe("0x007390bf31bb23d716f1b643038173a4d2e7811addc6fd508597f9788456cae1");
  });
});

describe("POST /register", () => {
  it("verifies with World ID (result forwarded unchanged) and registers", async () => {
    const { d, fetchMock, sendRegister } = deps();
    const out = await handleRegister(body(), d);
    expect(out).toEqual({ status: 200, body: { ok: true, ens: "andheri-01.prananet.eth", tx: "0xtx", owner: OWNER } });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://developer.world.org/api/v4/verify/rp_test");
    expect(JSON.parse(init.body as string)).toEqual(idkit());
    expect(sendRegister).toHaveBeenCalledWith("0xAb29EC5dF28B9fBc4804AB4d5F4EcaE4833C4E32", OWNER, "andheri-01", "te7ud2", BigInt(NULLIFIER));
  });

  it("rejects a 4th device from the same human with max_devices (portal says nullifier reuse is fine)", async () => {
    const { d, sendRegister } = deps({ devicesPerNullifier: async () => 3n }, { success: true, nullifier: NULLIFIER, message: "Proof verified successfully (nullifier reuse)", results: [] });
    const out = await handleRegister(body(), d);
    expect(out).toEqual({ status: 409, body: { ok: false, error: "max_devices" } });
    expect(sendRegister).not.toHaveBeenCalled();
  });

  it("maps a DeviceLimitReached revert (race) to max_devices", async () => {
    const { d } = deps({ sendRegister: vi.fn(async () => ({ ok: false, error: "DeviceLimitReached" })) });
    expect((await handleRegister(body(), d)).body).toMatchObject({ ok: false, error: "max_devices" });
  });

  it("returns invalid_proof when World ID rejects the proof", async () => {
    const { d, sendRegister } = deps({}, { success: false, code: "all_verifications_failed", detail: "All proof verifications failed." }, 400);
    const out = await handleRegister(body(), d);
    expect(out.status).toBe(400);
    expect(out.body).toMatchObject({ ok: false, error: "invalid_proof", detail: { code: "all_verifications_failed" } });
    expect(sendRegister).not.toHaveBeenCalled();
  });

  it("refuses a proof bound to another device without calling World ID", async () => {
    const { d, fetchMock } = deps();
    const out = await handleRegister(body({ device: "0x000000000000000000000000000000000000dEaD" }), d);
    expect(out.body).toMatchObject({ error: "invalid_proof" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a proof for another action", async () => {
    const { d, fetchMock } = deps();
    expect((await handleRegister(body({ idkit: idkit({ action: "vote" }) }), d)).body).toMatchObject({ error: "invalid_proof" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates shapes", async () => {
    const { d } = deps();
    expect((await handleRegister(body({ device: "nope" }), d)).body).toMatchObject({ error: "invalid_device" });
    expect((await handleRegister(body({ label: "Andheri 01" }), d)).body).toMatchObject({ error: "invalid_label" });
    expect((await handleRegister(body({ geohash: "te7ua2" }), d)).body).toMatchObject({ error: "invalid_geohash" });
    expect((await handleRegister(body({ idkit: undefined }), d)).body).toMatchObject({ error: "missing_proof" });
  });

  it("already registered and label taken", async () => {
    expect((await handleRegister(body(), deps({ isRegistered: async () => true }).d)).body).toMatchObject({ error: "already_registered" });
    const taken = deps({ sendRegister: vi.fn(async () => ({ ok: false, error: "LabelAlreadyRegistered" })) }).d;
    expect(await handleRegister(body(), taken)).toMatchObject({ status: 409, body: { error: "label_taken" } });
  });

  it("rejects the web's mock proof unless ALLOW_DEV_REGISTER", async () => {
    const mock = { mock: true, action: "register-device", signal: DEVICE, nullifier: "0xmock" };
    const { d, fetchMock } = deps();
    expect((await handleRegister(body({ idkit: mock }), d)).body).toMatchObject({ error: "invalid_proof" });
    expect(fetchMock).not.toHaveBeenCalled();
    const dev = deps();
    dev.d.cfg = { ...dev.d.cfg, allowDevRegister: true };
    expect((await handleRegister(body({ idkit: mock }), dev.d)).status).toBe(200);
  });

  it("uses the optional owner when given, else the operator wallet", async () => {
    const human = "0x000000000000000000000000000000000000bEEF";
    const { d, sendRegister } = deps();
    const out = await handleRegister(body({ owner: human.toLowerCase() }), d);
    expect(out.body).toMatchObject({ ok: true, owner: human });
    expect(sendRegister).toHaveBeenCalledWith(expect.anything(), human, "andheri-01", "te7ud2", BigInt(NULLIFIER));
    expect((await handleRegister(body({ owner: "0x0000000000000000000000000000000000000000" }), d)).body).toMatchObject({ error: "invalid_owner" });
    expect((await handleRegister(body({ owner: "bob" }), d)).body).toMatchObject({ error: "invalid_owner" });
  });
});
