// DEV ONLY: register a device directly with the relayer's backend role, skipping World ID, so M1
// doesn't wait for M3. Uses a deterministic dev nullifier per owner (the 3-device cap still applies).
//
//   npm run register-dev -- --device 0xDEVICE --label andheri-01 --geohash te7ud2 [--owner 0xOWNER]
import { type Address, getAddress, keccak256, stringToHex } from "viem";
import { registryAbi } from "../src/abi.ts";
import { arg, config, etherscanTx, pub, relayerWallet } from "./_common.ts";

const device = arg("device");
const label = arg("label");
const geohash = arg("geohash", "te7ud2")!;
if (!device || !label) {
  console.error("usage: npm run register-dev -- --device 0x... --label name [--geohash te7ud2] [--owner 0x...]");
  process.exit(1);
}
const wallet = relayerWallet();
const owner = getAddress(arg("owner") ?? wallet.account.address) as Address;
const nullifier = BigInt(keccak256(stringToHex(`prananet-dev-nullifier:${owner.toLowerCase()}`)));

const { request } = await pub.simulateContract({
  account: wallet.account,
  address: config.registry,
  abi: registryAbi,
  functionName: "registerDevice",
  args: [getAddress(device), owner, label, geohash, nullifier],
});
const tx = await wallet.writeContract(request);
const receipt = await pub.waitForTransactionReceipt({ hash: tx });
console.log(`registered ${label}.${config.ensParent} device=${device} owner=${owner} status=${receipt.status}`);
console.log(etherscanTx(tx));
