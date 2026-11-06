// Read PranaNet data straight from Arkiv (Rabdi testnet), no relayer involved:
//   npx tsx scripts/arkiv-query.ts [geohash=te7u6n] [limit=10]
// Latest readings in a geohash cell, written by the PranaNet relayer wallet only (anyone can write
// entities shaped like ours, so `ownedBy` is what makes the result trustworthy), with flags.
// Works without an access key (public endpoint, rate limited); set ARKIV_ACCESS_KEY to use yours.
import { createPublicClient } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { desc, eq } from "@arkiv-network/sdk/query";
import { http } from "viem";
import { FlagEntity, ReadingEntity } from "../src/arkiv.ts";

const WRITER = "0x3a1F21F1c6f05eFA35BB7178274b41C8873CCa67"; // relayer = Arkiv writer
const geohash = process.argv[2] ?? "te7u6n";
const limit = Number(process.argv[3] ?? 10);
const client = createPublicClient({ chain: rabdi({ accessKey: process.env.ARKIV_ACCESS_KEY ?? "" }), transport: http() });

const { entities } = await client.select().from(ReadingEntity).where(eq("geohash", geohash)).ownedBy(WRITER).orderBy(desc("epoch")).limit(limit).fetch();
console.log(`latest ${entities.length} readings in ${geohash} (writer ${WRITER}):`);
for (const e of entities)
  console.log(
    `  ${new Date(Number(e.epoch.value) * 1000).toISOString()} ${String(e.ens.value).padEnd(34)} PM2.5 ${(Number(e.pm25_x10.value) / 10).toFixed(1).padStart(6)} µg/m³` +
      `${e.simulated.value ? "  (simulated)" : `  nonce ${e.nonce.value}  sig ${String(e.signature.value).slice(0, 12)}…`}  https://rabdi.explorer.arkiv.network/entity/${e.$key}`,
  );
const flags = await client.select().from(FlagEntity).where(eq("reason", "neighbour_outlier")).ownedBy(WRITER).orderBy(desc("epoch")).limit(5).fetch();
console.log(`latest neighbour-outlier flags:`);
for (const f of flags.entities) console.log(`  ${f.ens.value} epoch ${f.epoch.value}: ${Number(f.value_x10.value) / 10} vs median ${Number(f.median_x10.value) / 10} µg/m³ tx ${f.tx.value || "(simulated device)"}`);
