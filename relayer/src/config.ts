// Relayer configuration from relayer/.env (see .env.example). Contract addresses default to
// contracts/deployments/sepolia.json so a fresh deploy needs no copy-paste.
import { existsSync, readFileSync } from "node:fs";
import { loadEnvFile } from "node:process";
import type { Address, Hex } from "viem";

const envPath = new URL("../.env", import.meta.url);
if (existsSync(envPath)) loadEnvFile(envPath);

const deploymentsPath = new URL(
  `../../contracts/deployments/${process.env.DEPLOYMENT ?? "sepolia"}.json`,
  import.meta.url,
);
const deployment: Record<string, unknown> = existsSync(deploymentsPath)
  ? JSON.parse(readFileSync(deploymentsPath, "utf8"))
  : {};

function env(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v !== undefined && v !== "") return v;
  if (fallback !== undefined) return fallback;
  return "";
}

function addr(name: string, key: string): Address {
  return (env(name) || (deployment[key] as string) || "0x0000000000000000000000000000000000000000") as Address;
}

export const config = {
  port: Number(env("PORT", "8080")),
  rpcUrl: env("SEPOLIA_RPC_URL", "https://ethereum-sepolia-rpc.publicnode.com"),
  chainId: Number(env("CHAIN_ID", String(deployment.chainId ?? 11155111))),
  relayerKey: env("RELAYER_PRIVATE_KEY") as Hex | "",
  registry: addr("REGISTRY_ADDRESS", "Registry"),
  readings: addr("READINGS_ADDRESS", "Readings"),
  stake: addr("STAKE_ADDRESS", "Stake"),
  rewardPool: addr("REWARD_POOL_ADDRESS", "RewardPool"),
  namer: addr("NAMER_ADDRESS", "DeviceNamer"),
  deployBlock: BigInt(env("DEPLOY_BLOCK", String(deployment.deployBlock ?? 0))),
  pollMs: Number(env("POLL_MS", "6000")),
  // Alchemy's free tier rejects eth_getLogs over more than 10 blocks; paid RPCs can raise this.
  logChunkBlocks: BigInt(env("LOG_CHUNK_BLOCKS", "10")),
  ensParent: env("ENS_PARENT", "prananet.eth"),
  // Arkiv (Rabdi testnet). ARKIV_PRIVATE_KEY defaults to the relayer key.
  arkivAccessKey: env("ARKIV_ACCESS_KEY"),
  arkivKey: (env("ARKIV_PRIVATE_KEY") || env("RELAYER_PRIVATE_KEY")) as Hex | "",
  arkivEnabled: env("ARKIV_ENABLED", "true") !== "false",
  // Optional: Siddhartha's verifier, used only to enrich flag entities with value/median.
  verifierUrl: env("VERIFIER_URL"),
  // Shared secret for the verifier's POST /sim/readings and POST /flags (simulated devices only).
  simToken: env("SIM_TOKEN"),
  corsOrigins: env("CORS_ORIGINS", "http://localhost:3000,https://*.vercel.app")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  // World ID (Part 4)
  worldAppId: env("WORLD_APP_ID"),
  worldAction: env("WORLD_ACTION", "register-device"),
  worldRpId: env("WORLD_RP_ID"),
  worldSigningKey: env("WORLD_SIGNING_KEY") as Hex | "",
  // Owner recorded for devices registered through POST /register (stakes and claims rewards).
  // TEAM.md's register body has no owner field, so it is the operator wallet; default: relayer.
  deviceOwner: env("DEVICE_OWNER", (deployment.admin as string) ?? ""),
  // Dev only: allow POST /register without a World ID proof (never in production).
  allowDevRegister: env("ALLOW_DEV_REGISTER", "false") === "true",
};

export type Config = typeof config;
