// HTTP routes (TEAM.md "Relayer endpoints") on top of the chain index, Arkiv store and tx queue.
import { type IncomingMessage, type ServerResponse, createServer } from "node:http";
import type { Address } from "viem";
import type { FlagRecord, Store } from "./arkiv.ts";
import { type ChainIndex, type DeviceState, statusOf } from "./chain.ts";
import type { Config } from "./config.ts";
import { type IntakeDeps, handleReading } from "./intake.ts";
import { LiveHub } from "./live.ts";
import { log } from "./log.ts";
import type { Reading } from "./message.ts";
import type { Submitter } from "./txqueue.ts";

export interface AppDeps {
  cfg: Config;
  chain: ChainIndex;
  store: Store;
  submitter: Submitter;
  register?: (body: unknown) => Promise<{ status: number; body: unknown }>;
}

const REASONS: Record<number, string> = { 1: "neighbour_outlier", 2: "station_outlier" };

export function originAllowed(patterns: string[], origin: string | undefined): boolean {
  if (!origin) return true; // non-browser clients (devices, curl, Next.js server)
  return patterns.some((p) => {
    if (p === "*") return true;
    if (!p.includes("*")) return p === origin;
    const re = new RegExp("^" + p.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[a-z0-9-]+") + "$");
    return re.test(origin);
  });
}

export function createApp(deps: AppDeps) {
  const { cfg, chain, store, submitter } = deps;
  const live = new LiveHub();
  const lastReading = new Map<string, Reading>();
  const allow = (o: string | undefined) => originAllowed(cfg.corsOrigins, o);
  let syncing = true;

  // ------------------------------------------------------------ device view
  const deviceView = (d: DeviceState) => ({
    device: d.device,
    ens: d.ens,
    geohash: d.geohash,
    status: statusOf(d),
    stake_wei: d.stakeWei.toString(),
    baseline_mv: 0,
    last_reading: lastReading.get(d.device) ?? null,
    simulated: false,
  });

  async function fillLastReading(d: DeviceState) {
    if (lastReading.has(d.device)) return;
    try {
      const [r] = await store.readings(d.ens, 0, Math.floor(Date.now() / 1000) + 3600, 1);
      if (r) lastReading.set(d.device, r);
    } catch (e) {
      log("arkiv", "read failed:", (e as Error).message.split("\n")[0]);
    }
  }

  // ------------------------------------------------- Arkiv device sync (debounced)
  const pendingDevice = new Map<string, NodeJS.Timeout>();
  function syncDevice(d: DeviceState) {
    if (syncing) return;
    clearTimeout(pendingDevice.get(d.device));
    pendingDevice.set(
      d.device,
      setTimeout(() => {
        pendingDevice.delete(d.device);
        store
          .putDevice({
            device: d.device,
            ens: d.ens,
            geohash: d.geohash,
            status: statusOf(d),
            owner: d.owner,
            label: d.label,
            stake_wei: d.stakeWei.toString(),
            baseline_mv: 0,
            simulated: false,
          })
          .catch((e) => log("arkiv", `device write failed ${d.ens}:`, (e as Error).message.split("\n")[0]));
      }, 2000),
    );
  }

  // ------------------------------------------------------ flags and slashes
  async function enrichFlag(device: Address, epoch: number): Promise<{ value_x10: number; median_x10: number }> {
    if (cfg.verifierUrl) {
      try {
        const res = await fetch(`${cfg.verifierUrl.replace(/\/$/, "")}/flags`, { signal: AbortSignal.timeout(3000) });
        const flags = (await res.json()) as { device: string; epoch: number; value_x10: number; median_x10: number }[];
        const mine = flags.filter((f) => f.device.toLowerCase() === device);
        mine.sort((a, b) => Math.abs(a.epoch - epoch) - Math.abs(b.epoch - epoch));
        if (mine[0]) return { value_x10: mine[0].value_x10, median_x10: mine[0].median_x10 };
      } catch {
        /* verifier optional */
      }
    }
    return { value_x10: lastReading.get(device)?.pm25_x10 ?? 0, median_x10: 0 };
  }

  const backlogFlags: FlagRecord[] = [];
  // Flag enrichment is async; run chain events through one promise chain so WS order matches
  // on-chain order (flag, flag, flag, slash).
  let events: Promise<void> = Promise.resolve();
  const inOrder = (fn: () => Promise<void> | void) => {
    events = events.then(fn).catch((e) => log("chain", "event handler failed:", (e as Error).message));
  };
  chain.onFlag = (e) => inOrder(async () => {
    const d = chain.devices.get(e.device);
    const ens = d?.ens ?? e.device;
    const extra = await enrichFlag(e.device, e.epoch);
    const flag = { device: e.device, ens, epoch: e.epoch, reason: REASONS[e.reason] ?? `reason_${e.reason}`, ...extra };
    const rec: FlagRecord = { ...flag, tx: e.tx };
    if (syncing) {
      backlogFlags.push(rec);
      return;
    }
    log("chain", `flag ${ens} epoch=${e.epoch} streak=${e.consecutiveFlags} tx=${e.tx}`);
    live.broadcast({ type: "flag", data: flag });
    store.putFlag(rec).catch((err) => log("arkiv", "flag write failed:", (err as Error).message.split("\n")[0]));
  });
  chain.onSlash = (e) => inOrder(() => {
    if (syncing) return;
    const ens = chain.devices.get(e.device)?.ens ?? e.device;
    log("chain", `SLASH ${ens} tx=${e.tx}`);
    live.broadcast({ type: "slash", data: { device: e.device, ens, tx: e.tx } });
  });
  chain.onDeviceChange = syncDevice;

  /** After the initial event replay: write device entities and any flags Arkiv is missing. */
  async function finishSync() {
    await events;
    syncing = false;
    for (const d of chain.devices.values()) {
      syncDevice(d);
      void fillLastReading(d);
    }
    const byEns = new Map<string, FlagRecord[]>();
    for (const f of backlogFlags) byEns.set(f.ens, [...(byEns.get(f.ens) ?? []), f]);
    for (const [ens, flags] of byEns) {
      try {
        const have = new Set((await store.flags(ens)).map((f) => f.tx.toLowerCase()));
        for (const f of flags) if (!have.has(f.tx.toLowerCase())) await store.putFlag(f);
      } catch (e) {
        log("arkiv", "flag backfill failed:", (e as Error).message.split("\n")[0]);
      }
    }
    log("relayer", `synced: ${chain.devices.size} device(s)`);
  }

  // -------------------------------------------------------------- intake
  const intakeDeps: IntakeDeps = {
    chainId: cfg.chainId,
    readingsContract: cfg.readings,
    chain,
    store,
    submitter,
    broadcast: (m) => live.broadcast(m),
    onAccepted: (r) => lastReading.set(r.device, r),
  };

  // --------------------------------------------------------------- http
  function send(res: ServerResponse, req: IncomingMessage, status: number, body: unknown) {
    const origin = req.headers.origin;
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (origin && allow(origin)) {
      headers["access-control-allow-origin"] = origin;
      headers["vary"] = "Origin";
    }
    res.writeHead(status, headers);
    res.end(JSON.stringify(body, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
  }

  async function readBody(req: IncomingMessage): Promise<unknown> {
    let size = 0;
    const chunks: Buffer[] = [];
    for await (const c of req) {
      size += (c as Buffer).length;
      if (size > 64 * 1024) throw new Error("body_too_large");
      chunks.push(c as Buffer);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    try {
      if (req.method === "OPTIONS") {
        const origin = req.headers.origin;
        res.writeHead(allow(origin) ? 204 : 403, {
          ...(origin && allow(origin) ? { "access-control-allow-origin": origin, vary: "Origin" } : {}),
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "content-type",
          "access-control-max-age": "86400",
        });
        return res.end();
      }

      if (req.method === "GET" && url.pathname === "/health") {
        return send(res, req, 200, {
          ok: true,
          chainId: cfg.chainId,
          relayer: submitter.address,
          arkivWriter: store.writer,
          contracts: { registry: cfg.registry, readings: cfg.readings, stake: cfg.stake, rewardPool: cfg.rewardPool },
          devices: chain.devices.size,
          syncing,
        });
      }

      if (req.method === "POST" && url.pathname === "/readings") {
        let body: unknown;
        try {
          body = await readBody(req);
        } catch (e) {
          return send(res, req, 400, { ok: false, error: (e as Error).message === "body_too_large" ? "body_too_large" : "invalid_json" });
        }
        const out = await handleReading(body, intakeDeps);
        if (out.status !== 202) log("intake", `rejected ${out.status} ${JSON.stringify(out.body)}`);
        return send(res, req, out.status, out.body);
      }

      if (req.method === "POST" && url.pathname === "/register") {
        if (!deps.register) return send(res, req, 503, { ok: false, error: "register_unavailable" });
        let body: unknown;
        try {
          body = await readBody(req);
        } catch {
          return send(res, req, 400, { ok: false, error: "invalid_json" });
        }
        const out = await deps.register(body);
        return send(res, req, out.status, out.body);
      }

      if (req.method === "GET" && parts[0] === "devices") {
        if (parts.length === 1) {
          const list = [...chain.devices.values()];
          await Promise.all(list.map(fillLastReading));
          return send(res, req, 200, list.map(deviceView));
        }
        const d = chain.byEns(parts[1].toLowerCase());
        if (!d) return send(res, req, 404, { ok: false, error: "unknown_device" });
        const now = Math.floor(Date.now() / 1000) + 3600;
        if (parts.length === 2) {
          const readings = await store.readings(d.ens, 0, now, 200);
          if (readings[0] && !lastReading.has(d.device)) lastReading.set(d.device, readings[0]);
          return send(res, req, 200, { ...deviceView(d), readings });
        }
        if (parts.length === 3 && parts[2] === "readings") {
          const from = Number(url.searchParams.get("from") ?? 0);
          const to = Number(url.searchParams.get("to") ?? now);
          if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to < from)
            return send(res, req, 400, { ok: false, error: "bad_range" });
          return send(res, req, 200, await store.readings(d.ens, Math.floor(from), Math.floor(to), 1000));
        }
      }

      send(res, req, 404, { ok: false, error: "not_found" });
    } catch (e) {
      log("http", `${req.method} ${url.pathname} failed:`, (e as Error).message.split("\n")[0]);
      send(res, req, 500, { ok: false, error: "internal_error" });
    }
  });

  live.attach(server, allow);
  return { server, live, finishSync, lastReading };
}
