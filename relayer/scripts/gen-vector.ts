// One-off: produce the fixed test vector (test/vector.json) with viem. Uses Hardhat test key #0,
// a public, well-known key. Never use it for anything real.
import { writeFileSync } from "node:fs";
import { privateKeyToAccount } from "viem/accounts";
import { packReading, readingDigest, readingMessage } from "../src/message.ts";

const key = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const account = privateKeyToAccount(key);
const chainId = 11155111;
const contract = "0x5FbDB2315678afecb367f032d93F642f64180aa3" as const;
const reading = {
  device: account.address.toLowerCase() as `0x${string}`,
  epoch: 1762360200,
  pm25_x10: 423,
  pm10_x10: 610,
  temp_x10: -15,
  hum_x10: 640,
  nonce: 17,
};
const message = readingMessage(reading, chainId, contract);
const signature = await account.signMessage({ message: { raw: message } });
const vector = {
  note: "Fixed cross-implementation vector. Key is Hardhat test key #0 (public). Checked by contracts/test/Vector.t.sol, relayer/test/vector.test.ts, relayer/scripts/verify-vector.ts and the firmware 'selftest' command.",
  private_key: key,
  address: account.address,
  chain_id: chainId,
  readings_contract: contract,
  reading,
  packed: packReading(reading, chainId, contract),
  message,
  digest: readingDigest(reading, chainId, contract),
  signature,
};
writeFileSync(new URL("../test/vector.json", import.meta.url), JSON.stringify(vector, null, 2) + "\n");
console.log(JSON.stringify(vector, null, 2));
