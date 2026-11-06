import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

const envPath = new URL("../.env", import.meta.url);
if (existsSync(envPath)) loadEnvFile(envPath);
const env = (k: string, d = "") => (process.env[k] !== undefined && process.env[k] !== "" ? process.env[k]! : d);

export const config = {
  port: Number(env("PORT", "8082")),
  /** Public base URL (tunnel) advertised in /.well-known/x402 */
  publicUrl: env("PUBLIC_URL", `http://localhost:${env("PORT", "8082")}`).replace(/\/$/, ""),
  verifierUrl: env("VERIFIER_URL", "http://localhost:8081").replace(/\/$/, ""),
  /** "hedera" = x402 on; "off" = free (local dev) */
  x402: env("X402", "hedera"),
  network: env("X402_NETWORK", "hedera:testnet") as `${string}:${string}`,
  facilitatorUrl: env("FACILITATOR_URL", "https://x402.org/facilitator"),
  /** Hedera account (0.0.x) that receives the payments */
  payTo: env("PAY_TO"),
  /** Price per call in tinybars (1 HBAR = 100,000,000). Default 0.1 HBAR. */
  priceTinybar: env("PRICE_TINYBAR", "10000000"),
};
