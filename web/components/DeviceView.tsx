"use client";
import Link from "next/link";
import { AqiChip } from "./Aqi";
import { STATUS_STYLE } from "./DevicesTable";
import { LiveChart } from "./LiveChart";
import { LiveFeed } from "./LiveFeed";
import { useLive } from "./LiveProvider";
import { VerifyBadge } from "./VerifyBadge";
import { aqi } from "@/lib/aqi";
import { nearestLocality, devicePos } from "@/lib/area";
import { addressUrl, ensUrl, REGISTRY_CONTRACT } from "@/lib/chain";
import { eth, short, time, x10 } from "@/lib/format";
import { recordId } from "@/lib/verify";
import type { DeviceDetail } from "@/lib/types";

export function DeviceView({ initial }: { initial: DeviceDetail }) {
  const { devices, fresh, flags } = useLive();
  // Live status/stake override the server snapshot.
  const d = { ...initial, ...(devices.find((x) => x.device === initial.device) ?? {}) };
  const readings = [...initial.readings, ...(fresh[d.device] ?? []).filter((r) => r.nonce > (initial.readings.at(-1)?.nonce ?? 0))];
  const myFlags = flags.filter((f) => f.device === d.device);
  const r = readings.at(-1) ?? null;
  const latest = [...readings].reverse().slice(0, 25);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <Link href="/devices" className="text-sm text-muted hover:text-ink">← All devices</Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{d.ens}</h1>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[d.status]}`}>{d.status}</span>
        {d.simulated && <span className="rounded-full bg-bg px-2.5 py-0.5 text-xs text-muted">simulated</span>}
        {r && <AqiChip value={aqi(r.pm25_x10, r.pm10_x10)} size="lg" />}
      </div>
      <p className="mt-1 text-sm text-muted">
        {nearestLocality(devicePos(d))?.name ?? "Unnamed area"} · cell <span className="font-mono">{d.geohash}</span>
      </p>

      {d.status === "slashed" && (
        <div className="mt-4 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          This device was slashed after 3 consecutive neighbour-outlier flags. Its stake went to the reward pool and its ENS
          subname was revoked. Its readings are no longer accepted.
        </div>
      )}
      {d.status === "flagged" && (
        <div className="mt-4 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-300">
          Flagged {myFlags.length} time{myFlags.length === 1 ? "" : "s"} in a row. A third consecutive flag slashes its stake.
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="card p-4">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">Live readings</h2>
            {r && (
              <span className="text-sm tabular-nums">
                PM2.5 <b>{x10(r.pm25_x10)}</b> · PM10 <b>{x10(r.pm10_x10)}</b> µg/m³
                {r.temp_x10 || r.hum_x10 ? ` · ${x10(r.temp_x10)} °C · ${x10(r.hum_x10)}% RH` : ""}
              </span>
            )}
          </div>
          <LiveChart readings={readings.slice(-120)} flags={myFlags} height={300} />
        </section>

        {/* On-chain identity: everything here is checkable on Sepolia / ENS */}
        <aside className="card overflow-hidden">
          <div className="border-b border-line bg-chain-soft/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-chain">
            On-chain identity
          </div>
          <dl className="space-y-2.5 p-4 text-sm">
            <div>
              <dt className="text-xs text-muted">Signer address (device key)</dt>
              <dd><a href={addressUrl(d.device)} target="_blank" rel="noreferrer" className="break-all font-mono text-xs text-chain hover:underline">{d.device} ↗</a></dd>
            </div>
            <div>
              <dt className="text-xs text-muted">ENS name</dt>
              <dd>
                {d.status === "slashed" ? (
                  <span className="text-muted line-through">{d.ens}</span>
                ) : (
                  <a href={ensUrl(d.ens)} target="_blank" rel="noreferrer" className="text-chain hover:underline">{d.ens} ↗</a>
                )}
                <span className="ml-1 text-xs text-muted">geohash record: {d.geohash}</span>
              </dd>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><dt className="text-xs text-muted">Stake</dt><dd className="font-medium">{eth(d.stake_wei)} ETH</dd></div>
              <div><dt className="text-xs text-muted">Latest nonce</dt><dd className="font-mono">{r?.nonce ?? "—"}</dd></div>
              <div><dt className="text-xs text-muted">Sensor baseline</dt><dd>{d.baseline_mv} mV</dd></div>
              <div><dt className="text-xs text-muted">Flags</dt><dd>{myFlags.length}</dd></div>
            </div>
            <div>
              <dt className="text-xs text-muted">Registered in</dt>
              <dd><a href={addressUrl(REGISTRY_CONTRACT)} target="_blank" rel="noreferrer" className="font-mono text-xs text-chain hover:underline">Registry {short(REGISTRY_CONTRACT)} ↗</a></dd>
            </div>
            {r && (
              <div className="rounded-lg bg-bg p-2.5">
                <dt className="mb-1 text-xs text-muted">Latest reading</dt>
                <dd className="flex flex-wrap items-center gap-2">
                  <VerifyBadge reading={r} />
                  <Link href={`/records/${recordId(r)}`} className="text-xs text-chain hover:underline">Open Arkiv record →</Link>
                </dd>
              </div>
            )}
          </dl>
        </aside>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="card overflow-x-auto">
          <h2 className="px-4 pt-4 font-semibold">Latest signed readings</h2>
          <table className="mt-2 w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line text-xs text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Time (IST)</th>
                <th className="px-4 py-2 font-medium">PM2.5</th>
                <th className="px-4 py-2 font-medium">PM10</th>
                <th className="px-4 py-2 font-medium">Temp °C</th>
                <th className="px-4 py-2 font-medium">Hum %</th>
                <th className="px-4 py-2 font-medium">Signature</th>
                <th className="px-4 py-2 font-medium">Record</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {latest.map((x) => {
                const flagged = myFlags.some((f) => f.epoch === x.epoch);
                return (
                  <tr key={x.nonce} className={flagged ? "bg-amber-400/10" : ""}>
                    <td className="px-4 py-1.5">{time(x.epoch)}</td>
                    <td className="px-4 py-1.5 tabular-nums">{x10(x.pm25_x10)}{flagged && <span className="ml-1 text-xs font-medium text-amber-300">flagged</span>}</td>
                    <td className="px-4 py-1.5 tabular-nums">{x10(x.pm10_x10)}</td>
                    <td className="px-4 py-1.5 tabular-nums">{x10(x.temp_x10)}</td>
                    <td className="px-4 py-1.5 tabular-nums">{x10(x.hum_x10)}</td>
                    <td className="px-4 py-1.5"><VerifyBadge reading={x} compact /></td>
                    <td className="px-4 py-1.5"><Link href={`/records/${recordId(x)}`} className="font-mono text-xs text-chain hover:underline">#{x.nonce}</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
        <section className="card p-4">
          <h2 className="mb-2 font-semibold">Live events for this device</h2>
          <LiveFeed filter={(e) => e.data.device === d.device} limit={10} />
        </section>
      </div>
    </main>
  );
}
