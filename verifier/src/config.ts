// Verifier configuration from verifier/.env (see .env.example).
import { existsSync, readFileSync } from "node:fs";
import { loadEnvFile } from "node:process";

const envPath = new URL("../.env", import.meta.url);
if (existsSync(envPath)) loadEnvFile(envPath);

const env = (k: string, d = "") => (process.env[k] !== undefined && process.env[k] !== "" ? process.env[k]! : d);

const deploymentPath = new URL(`../../contracts/deployments/${env("DEPLOYMENT", "sepolia")}.json`, import.meta.url);
const deployment: Record<string, unknown> = existsSync(deploymentPath) ? JSON.parse(readFileSync(deploymentPath, "utf8")) : {};

export const config = {
  port: Number(env("PORT", "8081")),
  epochSeconds: Number(env("EPOCH_SECONDS", "60")),
  /** Seconds after an epoch window closes before it is judged (devices post at the window end). */
  graceSeconds: Number(env("GRACE_SECONDS", "30")),
  /** "mock" = simulated devices only; otherwise the relayer base URL. */
  relayerUrl: env("RELAYER_URL", "mock").replace(/\/$/, ""),
  simToken: env("SIM_TOKEN"),
  openaqKey: env("OPENAQ_API_KEY", "mock"),
  /** Station search radius around each cell centre (OpenAQ allows up to 25 km). */
  openaqRadiusM: Number(env("OPENAQ_RADIUS_M", "25000")),
  /** Cells that get simulated neighbours (comma list); default: device 2's cell. */
  simCells: env("SIM_CELLS", "te7ud2").split(",").map((s) => s.trim()).filter(Boolean),
  /** Fallback PM2.5 (x10) for simulated devices when no station value is known: Mumbai, November. */
  simDefaultPm25X10: Number(env("SIM_DEFAULT_PM25_X10", "480")),
  rpcUrl: env("SEPOLIA_RPC_URL", "https://ethereum-sepolia-rpc.publicnode.com"),
  verifierKey: env("VERIFIER_PRIVATE_KEY") as `0x${string}` | "",
  registry: env("REGISTRY_ADDRESS", (deployment.Registry as string) ?? "") as `0x${string}` | "",
};

export type Config = typeof config;
