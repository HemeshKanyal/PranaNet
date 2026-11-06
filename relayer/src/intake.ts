// POST /readings: shape check -> off-chain ecrecover (same message as the contract) -> device
// registered + active -> nonce newer than on-chain and queued -> Arkiv write + Sepolia queue +
// WS broadcast. The relayer is untrusted: it can only refuse, never alter, a signed reading.
import { type Address, isAddressEqual } from "viem";
import type { Store } from "./arkiv.ts";
import type { ChainReads } from "./chain.ts";
import { log } from "./log.ts";
import { type Reading, parseReading, recoverReadingSigner } from "./message.ts";
import type { Submitter, TxResult } from "./txqueue.ts";

export interface IntakeDeps {
  chainId: number;
  readingsContract: Address;
  chain: ChainReads;
  store: Store;
  submitter: Pick<Submitter, "pendingNonce" | "submit">;
  broadcast: (msg: { type: "reading"; data: Reading }) => void;
  onAccepted?: (r: Reading) => void;
  onTx?: (r: Reading, res: TxResult) => void;
}

export interface IntakeResult {
  status: number;
  body: Record<string, unknown>;
}

const err = (status: number, error: string, extra: Record<string, unknown> = {}): IntakeResult => ({
  status,
  body: { ok: false, error, ...extra },
});

export async function handleReading(body: unknown, deps: IntakeDeps): Promise<IntakeResult> {
  const parsed = parseReading(body);
  if (!parsed.ok) return err(400, "invalid_shape", { field: parsed.error.field, detail: parsed.error.error });
  const r = parsed.reading;

  let signer: Address;
  try {
    signer = await recoverReadingSigner(r, r.signature, deps.chainId, deps.readingsContract);
  } catch {
    return err(401, "bad_signature");
  }
  if (!isAddressEqual(signer, r.device)) return err(401, "bad_signature", { recovered: signer.toLowerCase() });

  const device = await deps.chain.getDevice(r.device);
  if (!device) return err(403, "unknown_device");
  if (!(await deps.chain.isActive(r.device))) return err(403, "inactive_device");

  const onchain = await deps.chain.lastNonce(r.device);
  const last = Math.max(Number(onchain), deps.submitter.pendingNonce(r.device));
  if (r.nonce <= last) return err(409, "stale_nonce", { last_nonce: last });

  // Canonical metadata from the Registry (ens/geohash are not signed, so never trust the body).
  const reading: Reading = { ...r, ens: device.ens, geohash: device.geohash, simulated: false };

  deps.broadcast({ type: "reading", data: reading });
  deps.onAccepted?.(reading);
  deps.store.putReading(reading).catch((e) => log("arkiv", `write failed nonce=${r.nonce}:`, (e as Error).message));
  void deps.submitter.submit(reading).then((res) => deps.onTx?.(reading, res));

  return { status: 202, body: { ok: true, device: reading.device, ens: reading.ens, nonce: reading.nonce, queued: true } };
}
