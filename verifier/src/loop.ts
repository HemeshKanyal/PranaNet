// One verifier epoch, end to end:
//   1. pull each real device's reading for the epoch from the relayer
//   2. tick the simulated neighbours (anchored to the reference station when known)
//   3. cross-check (SPEC rule) → flags
//   4. real devices: Registry.flag on Sepolia for each flag, clearFlags when a previously
//      flagged device passes; the relayer turns the Registry events into Arkiv flag entities
//      (enriched from our GET /flags) and WS messages
//   5. simulated devices: readings and flags published through the relayer (Arkiv + WS)
import type { Address } from "viem";
import type { RegistryClient } from "./chain.ts";
import type { RelayerClient } from "./relayer.ts";
import { REASON_CODE, type Flag, type Reading } from "./types.ts";
import type { Verifier } from "./verifier.ts";

export interface EpochDeps {
  verifier: Verifier;
  relayer?: Pick<RelayerClient, "realDevices" | "readingAt" | "publishSims" | "publishSimFlag">;
  registry?: Pick<RegistryClient, "flag" | "clearFlags" | "consecutiveFlags">;
  /** PM2.5 (x10) of the reference station for the simulated cells, if known */
  areaPm25X10?: () => number | undefined;
  log?: (msg: string) => void;
}

export interface EpochReport {
  epoch: number;
  real: Reading[];
  flags: Flag[];
  chain: { device: string; action: "flag" | "clearFlags"; ok: boolean; tx?: string; error?: string }[];
}

export async function runVerifierEpoch(epoch: number, deps: EpochDeps): Promise<EpochReport> {
  const log = deps.log ?? (() => {});
  const real: Reading[] = [];
  if (deps.relayer) {
    try {
      for (const d of await deps.relayer.realDevices()) {
        const r = await deps.relayer.readingAt(d.ens, epoch).catch(() => null);
        if (r) real.push({ ...r, device: r.device.toLowerCase() });
      }
    } catch (e) {
      log(`relayer read failed: ${(e as Error).message}`);
    }
  }

  const flags = deps.verifier.runEpoch(epoch, real, deps.areaPm25X10?.());
  const flaggedSet = new Set(flags.map((f) => f.device));
  const report: EpochReport = { epoch, real, flags, chain: [] };

  for (const f of flags) {
    log(`[flag] ${f.ens} ${f.reason} value=${f.value_x10 / 10} median=${f.median_x10 / 10} µg/m³`);
    const isReal = real.some((r) => r.device === f.device);
    if (isReal && deps.registry) {
      const out = await deps.registry.flag(f.device as Address, epoch, REASON_CODE[f.reason]);
      report.chain.push({ device: f.device, action: "flag", ...out });
      log(`  Registry.flag ${f.ens} -> ${out.ok ? out.tx : out.error}`);
    } else if (!isReal && deps.relayer) {
      await deps.relayer.publishSimFlag(f).catch((e) => log(`sim flag publish failed: ${(e as Error).message}`));
    }
  }

  // A real device that was checked this epoch and passed breaks its on-chain streak.
  if (deps.registry) {
    for (const r of real) {
      if (flaggedSet.has(r.device)) continue;
      const streak = await deps.registry.consecutiveFlags(r.device as Address).catch(() => 0);
      if (streak > 0) {
        const out = await deps.registry.clearFlags(r.device as Address, epoch);
        report.chain.push({ device: r.device, action: "clearFlags", ...out });
        log(`  Registry.clearFlags ${r.ens} -> ${out.ok ? out.tx : out.error}`);
      }
    }
  }

  if (deps.relayer) {
    const sims = deps.verifier.readings.filter((r) => r.simulated);
    await deps.relayer.publishSims(sims, deps.verifier.simDevices()).catch((e) => log(`sim publish failed: ${(e as Error).message}`));
  }
  return report;
}

/** Start of the epoch window that closed `graceS` seconds ago or earlier. */
export function epochToJudge(nowS: number, epochS: number, graceS: number): number {
  return Math.floor((nowS - graceS) / epochS) * epochS - epochS;
}
