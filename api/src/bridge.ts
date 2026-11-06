// Revenue relay: x402 income on Hedera -> RewardPool.fundPool() on Sepolia.
//
// There is no trustless HBAR -> Sepolia ETH bridge for testnets, so this is an operator relay
// with a published, checkable rule:
//   1. list every successful HBAR credit to PAY_TO (the dedicated revenue account) from the
//      Hedera mirror node: nothing is taken on trust from the API host
//   3. convert at a fixed testnet rate, HBAR_TO_WEI (default 1 HBAR = 0.0001 Sepolia ETH)
//   4. one fundPool{value} transaction per batch from the treasury wallet; record which Hedera
//      transactions it covered in data/bridged.json (each payment is bridged once)
//
//   npm run bridge            (TREASURY_PRIVATE_KEY, SEPOLIA_RPC_URL, REWARD_POOL_ADDRESS in api/.env)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { type Abi, type Address, createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import RewardPool from "../../contracts/abi/RewardPool.json" with { type: "json" };

const envUrl = new URL("../.env", import.meta.url);
if (existsSync(envUrl)) loadEnvFile(envUrl);
const env = (k: string, d = "") => process.env[k] || d;
const deploymentUrl = new URL(`../../contracts/deployments/${env("DEPLOYMENT", "sepolia")}.json`, import.meta.url);
const deployment = existsSync(deploymentUrl) ? JSON.parse(readFileSync(deploymentUrl, "utf8")) : {};

const MIRROR = env("HEDERA_MIRROR_URL", "https://testnet.mirrornode.hedera.com");
const HBAR_TO_WEI = BigInt(env("HBAR_TO_WEI", "100000000000000")); // 1e14 wei = 0.0001 ETH per HBAR
const PAY_TO = env("PAY_TO");
// x402 settlements are submitted (and fee-paid) by the facilitator: only those count as revenue,
// so faucet top-ups or other transfers into PAY_TO are never bridged.
const FEE_PAYER = env("FACILITATOR_FEE_PAYER", "0.0.9185802");
const pool = env("REWARD_POOL_ADDRESS", deployment.RewardPool) as Address;
const bridgedFile = new URL("../data/bridged.json", import.meta.url);

export interface RevenueLine {
  at: string;
  transaction: string;
  payer: string;
  amount_tinybar: string;
  payTo: string;
}

/** "0.0.123@1700000000.000000001" -> "0.0.123-1700000000-000000001" (mirror node format) */
export function mirrorTxId(id: string): string {
  const [acct, ts] = id.split("@");
  const [s, n] = ts.split(".");
  return `${acct}-${s}-${n}`;
}

/** Tinybars the mirror node says this transaction moved to `payTo` (0n if it failed). */
export async function verifiedAmount(txId: string, payTo: string, fetchFn: typeof fetch = fetch): Promise<bigint> {
  const res = await fetchFn(`${MIRROR}/api/v1/transactions/${mirrorTxId(txId)}`, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) return 0n;
  const body = (await res.json()) as { transactions: { result: string; transfers: { account: string; amount: number }[] }[] };
  const tx = body.transactions?.find((t) => t.result === "SUCCESS");
  if (!tx) return 0n;
  return BigInt(tx.transfers.filter((t) => t.account === payTo && t.amount > 0).reduce((a, t) => a + t.amount, 0));
}

export function weiFor(tinybar: bigint, rate = HBAR_TO_WEI): bigint {
  return (tinybar * rate) / 100_000_000n;
}

/** x402 payments into `payTo` (credits in transactions submitted by the facilitator), oldest first. */
export async function incomingPayments(payTo: string, fetchFn: typeof fetch = fetch, feePayer = FEE_PAYER): Promise<{ transaction: string; tinybar: bigint; payer: string }[]> {
  const out: { transaction: string; tinybar: bigint; payer: string }[] = [];
  let next: string | null = `/api/v1/transactions?account.id=${payTo}&transactiontype=cryptotransfer&result=success&order=asc&limit=100`;
  while (next) {
    const res = await fetchFn(`${MIRROR}${next}`, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`mirror ${res.status}`);
    const body = (await res.json()) as { transactions: { transaction_id: string; result: string; transfers: { account: string; amount: number }[] }[]; links?: { next: string | null } };
    for (const t of body.transactions) {
      const credit = t.transfers.filter((x) => x.account === payTo && x.amount > 0).reduce((a, x) => a + x.amount, 0);
      const payer = t.transfers.filter((x) => x.account !== payTo && x.amount < 0).sort((a, b) => a.amount - b.amount)[0]?.account ?? "";
      if (credit <= 0 || t.result !== "SUCCESS" || !t.transaction_id.startsWith(`${feePayer}-`)) continue;
      const [acct, sec, nanos] = t.transaction_id.split("-");
      out.push({ transaction: `${acct}@${sec}.${nanos}`, tinybar: BigInt(credit), payer });
    }
    next = body.links?.next ?? null;
  }
  return out;
}

async function main() {
  // Revenue = every successful HBAR credit to PAY_TO (a dedicated revenue account) on the mirror
  // node, so the bridge needs no access to the API host. The API's data/revenue.jsonl is kept as
  // a local audit log only.
  if (!PAY_TO) throw new Error("PAY_TO missing");
  const bridged: { batches: { sepoliaTx: string; wei: string; hedera: string[]; at: string }[] } = existsSync(bridgedFile)
    ? JSON.parse(readFileSync(bridgedFile, "utf8"))
    : { batches: [] };
  const done = new Set(bridged.batches.flatMap((b) => b.hedera));
  const todo = (await incomingPayments(PAY_TO)).filter((p) => !done.has(p.transaction));
  if (!todo.length) return console.log("nothing to bridge");
  let tinybar = 0n;
  for (const p of todo) {
    console.log(`ok   ${p.transaction}: ${p.tinybar} tinybar from ${p.payer}  https://hashscan.io/testnet/transaction/${p.transaction}`);
    tinybar += p.tinybar;
  }
  const covered = todo.map((p) => p.transaction);
  const wei = weiFor(tinybar);
  const account = privateKeyToAccount(env("TREASURY_PRIVATE_KEY") as `0x${string}`);
  const pub = createPublicClient({ chain: sepolia, transport: http(env("SEPOLIA_RPC_URL")) });
  const wallet = createWalletClient({ account, chain: sepolia, transport: http(env("SEPOLIA_RPC_URL")) });
  const { request } = await pub.simulateContract({ account, address: pool, abi: RewardPool as Abi, functionName: "fundPool", value: wei });
  const tx = await wallet.writeContract(request);
  const rx = await pub.waitForTransactionReceipt({ hash: tx });
  console.log(`fundPool{${wei} wei} for ${covered.length} payment(s), ${tinybar} tinybar at ${HBAR_TO_WEI} wei/HBAR: ${rx.status} https://sepolia.etherscan.io/tx/${tx}`);
  bridged.batches.push({ sepoliaTx: tx, wei: wei.toString(), hedera: covered, at: new Date().toISOString() });
  writeFileSync(bridgedFile, JSON.stringify(bridged, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
