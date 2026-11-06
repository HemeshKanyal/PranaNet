// The signed reading message, identical to contracts/src/Readings.sol messageOf()/digestOf()
// and firmware/prananet/eth_sign.cpp eth_pack_reading(). See docs/SPEC.md "Exact encoding".
import {
  type Address,
  type Hex,
  encodePacked,
  getAddress,
  hashMessage,
  isAddress,
  isHex,
  keccak256,
  recoverMessageAddress,
} from "viem";

/** TEAM.md "Reading" (POST /readings body, also stored on Arkiv). */
export interface Reading {
  device: Address;
  ens: string;
  geohash: string;
  epoch: number;
  pm25_x10: number;
  pm10_x10: number;
  temp_x10: number;
  hum_x10: number;
  nonce: number;
  signature: Hex;
  simulated: boolean;
}

export type SignedFields = Pick<
  Reading,
  "device" | "epoch" | "pm25_x10" | "pm10_x10" | "temp_x10" | "hum_x10" | "nonce"
>;

/** Raw packed bytes (264). */
export function packReading(r: SignedFields, chainId: number | bigint, contract: Address): Hex {
  return encodePacked(
    ["address", "uint256", "uint256", "uint256", "int256", "uint256", "uint256", "uint256", "address"],
    [
      getAddress(r.device),
      BigInt(r.epoch),
      BigInt(r.pm25_x10),
      BigInt(r.pm10_x10),
      BigInt(r.temp_x10),
      BigInt(r.hum_x10),
      BigInt(r.nonce),
      BigInt(chainId),
      getAddress(contract),
    ],
  );
}

/** keccak256 of the packed bytes: what the device signs with personal_sign. */
export function readingMessage(r: SignedFields, chainId: number | bigint, contract: Address): Hex {
  return keccak256(packReading(r, chainId, contract));
}

/** EIP-191 digest that ecrecover sees on-chain. */
export function readingDigest(r: SignedFields, chainId: number | bigint, contract: Address): Hex {
  return hashMessage({ raw: readingMessage(r, chainId, contract) });
}

export async function recoverReadingSigner(
  r: SignedFields,
  signature: Hex,
  chainId: number | bigint,
  contract: Address,
): Promise<Address> {
  return recoverMessageAddress({ message: { raw: readingMessage(r, chainId, contract) }, signature });
}

const SECP256K1_HALF_N = 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0n;

export type ValidationError = { field: string; error: string };

const GEOHASH_RE = /^[0-9b-hjkmnp-z]{6}$/;
const U256_MAX = 2n ** 256n - 1n;

function isSafeUint(v: unknown): v is number {
  return typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
}

/** Shape check for a POST /readings body. Returns the normalised reading or an error. */
export function parseReading(body: unknown): { ok: true; reading: Reading } | { ok: false; error: ValidationError } {
  const fail = (field: string, error: string) => ({ ok: false as const, error: { field, error } });
  if (typeof body !== "object" || body === null) return fail("body", "expected a JSON object");
  const b = body as Record<string, unknown>;

  if (typeof b.device !== "string" || !isAddress(b.device, { strict: false })) return fail("device", "expected 0x address");
  if (typeof b.ens !== "string" || b.ens.length > 255) return fail("ens", "expected string");
  if (typeof b.geohash !== "string" || !GEOHASH_RE.test(b.geohash)) return fail("geohash", "expected 6-char geohash");
  for (const k of ["epoch", "pm25_x10", "pm10_x10", "hum_x10", "nonce"] as const) {
    if (!isSafeUint(b[k])) return fail(k, "expected non-negative integer");
  }
  if (typeof b.temp_x10 !== "number" || !Number.isSafeInteger(b.temp_x10)) return fail("temp_x10", "expected integer");
  if (typeof b.signature !== "string" || !isHex(b.signature) || b.signature.length !== 132)
    return fail("signature", "expected 65-byte 0x hex");
  const s = BigInt("0x" + b.signature.slice(66, 130));
  if (s > SECP256K1_HALF_N) return fail("signature", "high-s signature not accepted");
  if (b.simulated !== undefined && typeof b.simulated !== "boolean") return fail("simulated", "expected boolean");
  if (BigInt(b.nonce as number) > U256_MAX) return fail("nonce", "too large");

  return {
    ok: true,
    reading: {
      device: (b.device as string).toLowerCase() as Address,
      ens: b.ens,
      geohash: b.geohash,
      epoch: b.epoch as number,
      pm25_x10: b.pm25_x10 as number,
      pm10_x10: b.pm10_x10 as number,
      temp_x10: b.temp_x10,
      hum_x10: b.hum_x10 as number,
      nonce: b.nonce as number,
      signature: b.signature.toLowerCase() as Hex,
      simulated: b.simulated === true,
    },
  };
}
