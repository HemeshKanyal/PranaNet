// Off-chain re-check of a reading's signature, exactly as Readings.sol does it:
// keccak256(abi.encodePacked(device, epoch, pm25, pm10, temp, hum, nonce, chainId, readingsContract))
// (264 bytes), then EIP-191 personal_sign over that 32-byte hash. See docs/SPEC.md.
import { encodePacked, keccak256, recoverMessageAddress, type Hex } from "viem";
import { CHAIN_ID, READINGS_CONTRACT } from "./chain";
import type { Address, Reading } from "./types";

export const PACKED_FIELDS = [
  ["device", "address", 20],
  ["epoch", "uint256", 32],
  ["pm25_x10", "uint256", 32],
  ["pm10_x10", "uint256", 32],
  ["temp_x10", "int256", 32],
  ["hum_x10", "uint256", 32],
  ["nonce", "uint256", 32],
  ["chainId", "uint256", 32],
  ["readingsContract", "address", 20],
] as const;

export function packed(r: Reading, chainId = CHAIN_ID, contract: Address = READINGS_CONTRACT): Hex {
  return encodePacked(
    ["address", "uint256", "uint256", "uint256", "int256", "uint256", "uint256", "uint256", "address"],
    [r.device, BigInt(r.epoch), BigInt(r.pm25_x10), BigInt(r.pm10_x10), BigInt(r.temp_x10), BigInt(r.hum_x10), BigInt(r.nonce), BigInt(chainId), contract],
  );
}

export const messageHash = (r: Reading) => keccak256(packed(r));

export interface Verdict { ok: boolean; signer: Address | null; hash: Hex }

const cache = new Map<string, Promise<Verdict>>();

export function verifyReading(r: Reading): Promise<Verdict> {
  // Keyed by the signed message itself: an edited value must never hit a cached "verified".
  const hash = messageHash(r);
  const key = `${hash}:${r.signature}`;
  let v = cache.get(key);
  if (!v) {
    v = (async () => {
      try {
        const signer = (await recoverMessageAddress({ message: { raw: hash }, signature: r.signature })).toLowerCase() as Address;
        return { ok: signer === r.device.toLowerCase(), signer, hash };
      } catch {
        return { ok: false, signer: null, hash };
      }
    })();
    cache.set(key, v);
  }
  return v;
}

/** recordId used in /records/[recordId]: device address + nonce identifies one reading. */
export const recordId = (r: Pick<Reading, "device" | "nonce">) => `${r.device}-${r.nonce}`;
export function parseRecordId(id: string): { device: Address; nonce: number } | null {
  const m = /^(0x[0-9a-f]{40})-(\d+)$/.exec(id.toLowerCase());
  return m ? { device: m[1] as Address, nonce: Number(m[2]) } : null;
}
