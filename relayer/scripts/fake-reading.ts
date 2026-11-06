// Sign a reading with a RANDOM key that claims to come from a registered device, then show it is
// rejected (1) by the relayer and (2) by the Readings contract when submitted directly.
//
//   npm run fake-reading -- --device 0xREGISTERED [--relayer URL] [--send-tx]
// --send-tx also broadcasts the bad submitEpoch with a fixed gas limit so the revert is visible
// on Etherscan (costs a little gas).
import { BaseError, ContractFunctionRevertedError, type Hex, getAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { readingsAbi } from "../src/abi.ts";
import { readingMessage } from "../src/message.ts";
import { arg, config, etherscanTx, pub, relayerUrl, relayerWallet } from "./_common.ts";

const device = arg("device");
if (!device) throw new Error("--device 0x<registered device> required");
const attacker = privateKeyToAccount(generatePrivateKey());
const r = {
  device: getAddress(device).toLowerCase() as Hex,
  epoch: Math.floor(Date.now() / 60000) * 60,
  pm25_x10: 50, // a suspiciously clean reading
  pm10_x10: 50,
  temp_x10: 0,
  hum_x10: 0,
  nonce: Math.floor(Date.now() / 1000),
};
const signature = await attacker.signMessage({ message: { raw: readingMessage(r, config.chainId, config.readings) } });
console.log(`attacker key ${attacker.address} signs a reading claiming device ${r.device}\n`);

// 1. Relayer
const res = await fetch(`${relayerUrl()}/readings`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ ...r, ens: "", geohash: "te7ud2", signature, simulated: false }),
});
console.log(`relayer: HTTP ${res.status} ${await res.text()}`);

// 2. Contract, bypassing the relayer
const wallet = relayerWallet();
const args = [{ ...r, device: getAddress(r.device), epoch: BigInt(r.epoch), pm25_x10: 50n, pm10_x10: 50n, temp_x10: 0n, hum_x10: 0n, nonce: BigInt(r.nonce) }, signature] as const;
try {
  await pub.simulateContract({ account: wallet.account, address: config.readings, abi: readingsAbi, functionName: "submitEpoch", args });
  console.log("contract: UNEXPECTEDLY ACCEPTED");
  process.exit(1);
} catch (e) {
  const rev = e instanceof BaseError ? e.walk((x) => x instanceof ContractFunctionRevertedError) : null;
  console.log(`contract: reverted with ${rev instanceof ContractFunctionRevertedError ? rev.data?.errorName : (e as Error).message.split("\n")[0]}`);
}
if (process.argv.includes("--send-tx")) {
  const tx = await wallet.writeContract({ address: config.readings, abi: readingsAbi, functionName: "submitEpoch", args, gas: 120_000n });
  const receipt = await pub.waitForTransactionReceipt({ hash: tx });
  console.log(`contract tx (expected failure): status=${receipt.status} ${etherscanTx(tx)}`);
}
