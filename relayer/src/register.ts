// POST /register (Part 4: World ID + ENS). Placeholder until implemented.
import type { ChainIndex, PublicClient } from "./chain.ts";
import type { Config } from "./config.ts";

export function makeRegister(_cfg: Config, _pub: PublicClient, _chain: ChainIndex) {
  return async (_body: unknown) => ({ status: 503, body: { ok: false, error: "register_not_configured" } });
}
