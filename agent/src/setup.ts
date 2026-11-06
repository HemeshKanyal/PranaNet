// One-time Hedera testnet setup, run with the operator account from portal.hedera.com:
//   npm run setup
// - creates the agent's own payer account (new ECDSA key, AGENT_INITIAL_HBAR from the operator)
// - creates the HCS topic the agent logs purchases to (submit key = agent key)
// and writes AGENT_ACCOUNT_ID / AGENT_PRIVATE_KEY / HCS_TOPIC_ID into agent/.env (never printed).
// The operator account itself is the API's revenue account (PAY_TO in api/.env).
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { AccountCreateTransaction, AccountId, Client, Hbar, PrivateKey, TopicCreateTransaction } from "@hiero-ledger/sdk";

const envUrl = new URL("../.env", import.meta.url);
if (existsSync(envUrl)) loadEnvFile(envUrl);
const { HEDERA_OPERATOR_ID, HEDERA_OPERATOR_KEY } = process.env;
if (!HEDERA_OPERATOR_ID || !HEDERA_OPERATOR_KEY) {
  console.error("Set HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY (ECDSA hex) in agent/.env");
  process.exit(1);
}

function setEnv(file: URL, kv: Record<string, string>) {
  let s = existsSync(file) ? readFileSync(file, "utf8") : "";
  for (const [k, v] of Object.entries(kv)) {
    const re = new RegExp(`^${k}=.*$`, "m");
    s = re.test(s) ? s.replace(re, `${k}=${v}`) : `${s.replace(/\n?$/, "\n")}${k}=${v}\n`;
  }
  writeFileSync(file, s);
  chmodSync(file, 0o600);
}

const client = Client.forTestnet().setOperator(AccountId.fromString(HEDERA_OPERATOR_ID), PrivateKey.fromStringECDSA(HEDERA_OPERATOR_KEY));
const updates: Record<string, string> = {};

let agentKey: PrivateKey;
if (process.env.AGENT_ACCOUNT_ID && process.env.AGENT_PRIVATE_KEY) {
  agentKey = PrivateKey.fromStringECDSA(process.env.AGENT_PRIVATE_KEY);
  console.log(`agent account exists: ${process.env.AGENT_ACCOUNT_ID}`);
} else {
  agentKey = PrivateKey.generateECDSA();
  const hbar = Number(process.env.AGENT_INITIAL_HBAR ?? 20);
  const rx = await (await new AccountCreateTransaction().setECDSAKeyWithAlias(agentKey).setInitialBalance(new Hbar(hbar)).execute(client)).getReceipt(client);
  updates.AGENT_ACCOUNT_ID = rx.accountId!.toString();
  updates.AGENT_PRIVATE_KEY = `0x${agentKey.toStringRaw()}`;
  console.log(`agent account created: ${updates.AGENT_ACCOUNT_ID} with ${hbar} HBAR  https://hashscan.io/testnet/account/${updates.AGENT_ACCOUNT_ID}`);
}

if (!process.env.HCS_TOPIC_ID) {
  const rx = await (
    await new TopicCreateTransaction().setTopicMemo("PranaNet agent purchases (x402 on hedera:testnet)").setSubmitKey(agentKey.publicKey).execute(client)
  ).getReceipt(client);
  updates.HCS_TOPIC_ID = rx.topicId!.toString();
  console.log(`HCS topic created: ${updates.HCS_TOPIC_ID}  https://hashscan.io/testnet/topic/${updates.HCS_TOPIC_ID}`);
}

if (Object.keys(updates).length) setEnv(envUrl, updates);
setEnv(new URL("../../api/.env", import.meta.url), { PAY_TO: HEDERA_OPERATOR_ID, X402: "hedera" });
console.log(`api/.env PAY_TO=${HEDERA_OPERATOR_ID}`);
client.close();
