// POST /register: World ID proof → Registry.registerDevice (which names the device on ENSv2).
//
// Body (TEAM.md): { idkit: <IDKit result, unchanged>, device, label, geohash }
// Reply:          { ok: true, ens, tx } | { ok: false, error, detail? }
//
// 1. Shape checks (device address, label = ENS label, 6-char geohash).
// 2. The proof must be for our action and bound to this device: the web passes the device
//    address as the IDKit signal, so every response's signal_hash must equal
//    hashSignal(device) = keccak256(20 address bytes) >> 8. A proof can't be replayed for
//    another device.
// 3. Forward the IDKit result unchanged to https://developer.world.org/api/v4/verify/{rp_id}
//    (docs.world.org/api-reference/developer-portal/verify). The portal answers success for a
//    repeat nullifier ("nullifier reuse"), so the per-human cap lives in the Registry:
//    devicesPerNullifier[nullifier] < 3.
// 4. Pre-check the cap and duplicates on-chain, then simulate + send registerDevice from the
//    relayer (backend role) through the tx queue.
import {
  type Address,
  type Hash,
  BaseError,
  ContractFunctionRevertedError,
  getAddress,
  hexToBigInt,
  isAddress,
  keccak256,
  stringToHex,
  toFunctionSelector,
} from "viem";
import { registryAbi } from "./abi.ts";
import type { PublicClient } from "./chain.ts";
import type { Config } from "./config.ts";
import { log } from "./log.ts";

export const MAX_DEVICES_PER_HUMAN = 3n;
const LABEL_RE = /^[a-z0-9-]{1,63}$/;
const GEOHASH_RE = /^[0-9b-hjkmnp-z]{6}$/;

export type RegisterReply = { status: number; body: Record<string, unknown> };

/** World ID hash_to_field: keccak256(bytes) >> 8 (docs.world.org/world-id/idkit/signatures). */
export function hashToField(bytes: `0x${string}`): `0x${string}` {
  const h = hexToBigInt(keccak256(bytes)) >> 8n;
  return `0x${h.toString(16).padStart(64, "0")}`;
}

/** IDKit's hashSignal for a 0x-hex signal hashes the raw bytes, so case does not matter. */
export function signalHashOf(device: Address): `0x${string}` {
  return hashToField(device.toLowerCase() as `0x${string}`);
}

export interface RegisterDeps {
  cfg: Pick<Config, "worldRpId" | "worldAction" | "registry" | "ensParent" | "allowDevRegister">;
  /** fetch for the World ID verify call (injected in tests) */
  fetch: typeof fetch;
  /** reads */
  devicesPerNullifier(nullifier: bigint): Promise<bigint>;
  isRegistered(device: Address): Promise<boolean>;
  /** simulate + send registerDevice; resolves with the mined tx or a revert name */
  sendRegister(device: Address, owner: Address, label: string, geohash: string, nullifier: bigint): Promise<{ ok: boolean; tx?: Hash; error?: string }>;
  owner: Address;
}

const fail = (status: number, error: string, detail?: unknown): RegisterReply => ({
  status,
  body: detail === undefined ? { ok: false, error } : { ok: false, error, detail },
});

const REVERT_TO_ERROR: Record<string, [number, string]> = {
  DeviceLimitReached: [409, "max_devices"],
  AlreadyRegistered: [409, "already_registered"],
  LabelAlreadyRegistered: [409, "label_taken"],
  LabelAlreadyReserved: [409, "label_taken"],
  BadLabel: [400, "invalid_label"],
  InvalidGeohash: [400, "invalid_geohash"],
};

export async function handleRegister(raw: unknown, deps: RegisterDeps): Promise<RegisterReply> {
  const b = (raw ?? {}) as Record<string, unknown>;
  if (typeof b.device !== "string" || !isAddress(b.device, { strict: false })) return fail(400, "invalid_device");
  if (typeof b.label !== "string" || !LABEL_RE.test(b.label)) return fail(400, "invalid_label");
  if (typeof b.geohash !== "string" || !GEOHASH_RE.test(b.geohash)) return fail(400, "invalid_geohash");
  const device = getAddress(b.device);
  const { label, geohash } = b;
  const idkit = b.idkit as Record<string, unknown> | undefined;
  if (!idkit || typeof idkit !== "object") return fail(400, "missing_proof");

  let nullifier: bigint;
  if (deps.cfg.allowDevRegister && idkit.mock === true) {
    // Dev only (ALLOW_DEV_REGISTER=true): the web's mock proof. Never enabled on a public relayer.
    nullifier = hexToBigInt(keccak256(stringToHex(`prananet-dev:${String(idkit.nullifier)}`)));
  } else {
    if (!deps.cfg.worldRpId) return fail(503, "world_id_not_configured");
    if (idkit.action !== deps.cfg.worldAction) return fail(400, "invalid_proof", "wrong action");
    const responses = Array.isArray(idkit.responses) ? (idkit.responses as Record<string, unknown>[]) : [];
    if (responses.length === 0) return fail(400, "invalid_proof", "no responses");
    const want = signalHashOf(device);
    for (const r of responses) {
      const got = typeof r.signal_hash === "string" ? BigInt(r.signal_hash) : -1n;
      if (got !== BigInt(want)) return fail(400, "invalid_proof", "proof is not bound to this device (signal mismatch)");
    }

    let res: Response;
    try {
      res = await deps.fetch(`https://developer.world.org/api/v4/verify/${deps.cfg.worldRpId}`, {
        method: "POST",
        headers: { "content-type": "application/json", "user-agent": "prananet-relayer" },
        body: JSON.stringify(idkit), // unchanged, as the docs require
      });
    } catch (e) {
      return fail(502, "world_id_unreachable", (e as Error).message);
    }
    const v = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || v.success !== true) {
      log("register", `World ID rejected ${device}: ${res.status} ${JSON.stringify(v).slice(0, 300)}`);
      return fail(400, "invalid_proof", { code: v.code, detail: v.detail });
    }
    if (typeof v.nullifier !== "string") return fail(400, "invalid_proof", "no nullifier in verify response");
    nullifier = BigInt(v.nullifier);
    log("register", `World ID ok ${device} env=${v.environment} reused=${v.message ? String(v.message).includes("reuse") : false}`);
  }

  if (await deps.isRegistered(device)) return fail(409, "already_registered");
  if ((await deps.devicesPerNullifier(nullifier)) >= MAX_DEVICES_PER_HUMAN) return fail(409, "max_devices");

  const out = await deps.sendRegister(device, deps.owner, label, geohash, nullifier);
  if (!out.ok) {
    const [status, error] = REVERT_TO_ERROR[out.error ?? ""] ?? [502, "register_failed"];
    return fail(status, error, out.error);
  }
  return { status: 200, body: { ok: true, ens: `${label}.${deps.cfg.ensParent}`, tx: out.tx } };
}

/** Wire handleRegister to the chain and the relayer's tx queue. */
export function makeRegister(
  cfg: Config,
  pub: PublicClient,
  queue: { exclusive<T>(fn: (wallet: any) => Promise<T>): Promise<T>; address: Address },
) {
  const owner = (cfg.deviceOwner || queue.address) as Address;
  const deps: RegisterDeps = {
    cfg,
    fetch,
    owner: getAddress(owner),
    devicesPerNullifier: (n) =>
      pub.readContract({ address: cfg.registry, abi: registryAbi, functionName: "devicesPerNullifier", args: [n] }) as Promise<bigint>,
    isRegistered: async (d) => {
      const dev = (await pub.readContract({ address: cfg.registry, abi: registryAbi, functionName: "getDevice", args: [d] })) as {
        owner: Address;
      };
      return dev.owner !== "0x0000000000000000000000000000000000000000";
    },
    sendRegister: (device, owner, label, geohash, nullifier) =>
      queue.exclusive(async (wallet) => {
        try {
          const { request } = await pub.simulateContract({
            account: wallet.account,
            address: cfg.registry,
            abi: registryAbi,
            functionName: "registerDevice",
            args: [device, owner, label, geohash, nullifier],
          });
          const tx: Hash = await wallet.writeContract(request);
          log("register", `registerDevice ${label} ${device} sent ${tx}`);
          const receipt = await pub.waitForTransactionReceipt({ hash: tx, timeout: 180_000 });
          return receipt.status === "success" ? { ok: true, tx } : { ok: false, tx, error: "reverted" };
        } catch (e) {
          const revert = e instanceof BaseError ? e.walk((x) => x instanceof ContractFunctionRevertedError) : null;
          if (revert instanceof ContractFunctionRevertedError) {
            // Errors from ENS contracts bubble up through DeviceNamer undecoded: match by selector.
            const name = revert.data?.errorName ?? selectorName(revert.raw) ?? revert.shortMessage;
            log("register", `registerDevice ${label} reverted: ${name}`);
            return { ok: false, error: name };
          }
          log("register", `registerDevice ${label} failed: ${(e as Error).message.split("\n")[0]}`);
          return { ok: false, error: "rpc_error" };
        }
      }),
  };
  return (body: unknown) => handleRegister(body, deps);
}

// ENSv2 PermissionedRegistry errors (from the verified source), surfaced as names.
const ENS_ERRORS: Record<string, string> = {
  [toFunctionSelector("LabelAlreadyRegistered(string)")]: "LabelAlreadyRegistered",
  [toFunctionSelector("LabelAlreadyReserved(string)")]: "LabelAlreadyReserved",
  [toFunctionSelector("BadLabel()")]: "BadLabel",
};
function selectorName(raw?: `0x${string}`) {
  return raw ? ENS_ERRORS[raw.slice(0, 10)] : undefined;
}
