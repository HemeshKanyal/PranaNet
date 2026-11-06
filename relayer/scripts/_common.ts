import { createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { makePublicClient } from "../src/chain.ts";
import { config } from "../src/config.ts";

export { config };
export const pub = makePublicClient(config);

export function relayerWallet() {
  if (!config.relayerKey) throw new Error("RELAYER_PRIVATE_KEY missing in relayer/.env");
  const account = privateKeyToAccount(config.relayerKey as Hex);
  return createWalletClient({ account, chain: pub.chain, transport: http(config.rpcUrl) });
}

export function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
}

export const relayerUrl = () => (arg("relayer") ?? process.env.RELAYER_URL ?? `http://localhost:${config.port}`).replace(/\/$/, "");
export const etherscanTx = (tx: string) =>
  config.chainId === 11155111 ? `https://sepolia.etherscan.io/tx/${tx}` : tx;
