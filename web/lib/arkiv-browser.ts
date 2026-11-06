// Read Arkiv straight from the visitor's browser (story page, "Check it yourself").
// Public Rabdi endpoint (CORS *, rate limited); the access key stays server-only.
// Only entities owned by the relayer's writer wallet count (resolved server-side by lib/arkiv.ts
// arkivWriter and passed in): anyone can write look-alikes.
import { createPublicClient } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { desc, eq } from "@arkiv-network/sdk/query";
import { bool } from "@arkiv-network/sdk/schema";
import { http } from "viem";
import { ReadingEntity, readingFromEntity } from "./arkiv-schema";
import type { Address, Hex, Reading } from "./types";

export interface BrowserRecord { reading: Reading; entityKey: Hex }

let client: ReturnType<typeof createPublicClient> | null = null;

/** Newest readings first; `simulated` filters real (false) or simulated (true) devices. */
export async function latestReadings(writer: Address, limit = 30, simulated?: boolean): Promise<BrowserRecord[]> {
  client ??= createPublicClient({ chain: rabdi({ accessKey: "" }), transport: http() });
  let q = client.select().from(ReadingEntity);
  if (simulated != null) q = q.where(eq("simulated", bool(simulated)));
  const page = await q.ownedBy(writer).orderBy(desc("epoch")).limit(limit).fetch();
  return page.entities.map((e) => ({ reading: readingFromEntity(e), entityKey: e.$key as Hex }));
}
