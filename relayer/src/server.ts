// Entry point: `npm start` (port 8080 by default).
import { ArkivStore, MemoryStore, type Store } from "./arkiv.ts";
import { createApp } from "./app.ts";
import { ChainIndex, makePublicClient } from "./chain.ts";
import { config } from "./config.ts";
import { log } from "./log.ts";
import { makeRegister } from "./register.ts";
import { TxQueue } from "./txqueue.ts";

if (!config.relayerKey) {
  console.error("RELAYER_PRIVATE_KEY missing: copy relayer/.env.example to relayer/.env");
  process.exit(1);
}
if (/^0x0{40}$/.test(config.readings)) {
  console.error("Contract addresses missing: deploy (contracts/deploy.sh) or set REGISTRY_ADDRESS/READINGS_ADDRESS");
  process.exit(1);
}

const pub = makePublicClient(config);
const chain = new ChainIndex(pub, config);
const store: Store = config.arkivEnabled && config.arkivKey ? new ArkivStore(config) : new MemoryStore();
const queue = new TxQueue(pub, config);
const register = makeRegister(config, pub, queue);

const { server, finishSync } = createApp({ cfg: config, chain, store, submitter: queue, register });

log("relayer", `relayer wallet ${queue.address}`);
log("relayer", `arkiv writer ${store.writer ?? "(memory only)"}`);
log("relayer", `Registry ${config.registry} Readings ${config.readings} chainId ${config.chainId}`);

server.listen(config.port, () => log("relayer", `listening on :${config.port}`));
await chain.start(); // first poll replays history
await finishSync();
