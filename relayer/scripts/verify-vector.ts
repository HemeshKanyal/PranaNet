// Verify device output against the signed-message spec with viem.
//
//   npx tsx scripts/verify-vector.ts                    # check the fixed vector (test/vector.json)
//   npx tsx scripts/verify-vector.ts '<json>'           # a JSON line printed by the device
//   npx tsx scripts/verify-vector.ts - < serial.log     # every JSON line found on stdin
//
// Device lines are either the `selftest` output ({"selftest":true,...}) or a Reading
// (TEAM.md shape). Readings are checked against --chain-id / --contract, or CHAIN_ID /
// READINGS_ADDRESS from the environment.
import { readFileSync } from "node:fs";
import { type Address, type Hex, getAddress, isAddressEqual } from "viem";
import { packReading, readingDigest, readingMessage, recoverReadingSigner } from "../src/message.ts";

const vector = JSON.parse(readFileSync(new URL("../test/vector.json", import.meta.url), "utf8"));

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}
const chainId = Number(arg("--chain-id") ?? process.env.CHAIN_ID ?? vector.chain_id);
const contract = (arg("--contract") ?? process.env.READINGS_ADDRESS ?? vector.readings_contract) as Address;

let failures = 0;
function check(label: string, got: string, want: string) {
  const ok = got.toLowerCase() === want.toLowerCase();
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"} ${label}${ok ? "" : `\n     got  ${got}\n     want ${want}`}`);
}

async function checkVector() {
  console.log("== fixed vector (viem)");
  const r = vector.reading;
  check("packed", packReading(r, vector.chain_id, vector.readings_contract), vector.packed);
  check("message", readingMessage(r, vector.chain_id, vector.readings_contract), vector.message);
  check("digest", readingDigest(r, vector.chain_id, vector.readings_contract), vector.digest);
  const signer = await recoverReadingSigner(r, vector.signature, vector.chain_id, vector.readings_contract);
  check("recovered signer", signer, vector.address);
}

async function checkDeviceLine(o: Record<string, unknown>) {
  if (o.selftest) {
    console.log("== device selftest vs fixed vector");
    check("address", String(o.address), vector.address);
    check("message", String(o.message), vector.message);
    check("digest", String(o.digest), vector.digest);
    // RFC 6979 + low-s on both sides: the device signature should be byte-identical.
    check("signature (byte-identical to viem)", String(o.signature), vector.signature);
    const signer = await recoverReadingSigner(vector.reading, o.signature as Hex, vector.chain_id, vector.readings_contract);
    check("recovered signer", signer, vector.address);
    return;
  }
  console.log(`== device reading nonce=${o.nonce} (chainId ${chainId}, contract ${contract})`);
  const r = {
    device: getAddress(String(o.device)),
    epoch: Number(o.epoch),
    pm25_x10: Number(o.pm25_x10),
    pm10_x10: Number(o.pm10_x10),
    temp_x10: Number(o.temp_x10),
    hum_x10: Number(o.hum_x10),
    nonce: Number(o.nonce),
  };
  const signer = await recoverReadingSigner(r, o.signature as Hex, chainId, contract);
  const ok = isAddressEqual(signer, r.device);
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"} recovered ${signer} ${ok ? "==" : "!="} device ${r.device}`);
}

const input = process.argv[2];
if (!input || input.startsWith("--")) {
  await checkVector();
} else {
  const text = input === "-" ? readFileSync(0, "utf8") : input;
  const lines = text.split(/\r?\n/).map((l) => l.slice(l.indexOf("{"))).filter((l) => l.startsWith("{"));
  for (const line of lines) {
    try {
      await checkDeviceLine(JSON.parse(line));
    } catch (e) {
      failures++;
      console.log(`FAIL could not parse/verify: ${line.slice(0, 80)}… (${(e as Error).message})`);
    }
  }
  if (lines.length === 0) {
    console.log("no JSON lines found");
    failures++;
  }
}
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
