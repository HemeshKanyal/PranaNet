"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AqiChip } from "./Aqi";
import { useLive } from "./LiveProvider";
import { VerifyBadge } from "./VerifyBadge";
import { aqi } from "@/lib/aqi";
import { placeLabel } from "@/lib/area";
import { addressUrl } from "@/lib/chain";
import { eth, short, time, x10 } from "@/lib/format";
import type { DeviceStatus } from "@/lib/types";

export const STATUS_STYLE: Record<DeviceStatus, string> = {
  active: "bg-green-500/15 text-green-300",
  flagged: "bg-amber-400/15 text-amber-300",
  slashed: "bg-red-500/15 text-red-300",
};

type Filter = "all" | DeviceStatus | "real" | "simulated";

export function DevicesTable() {
  const { devices } = useLive();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const counts = useMemo(
    () => ({
      all: devices.length,
      active: devices.filter((d) => d.status === "active").length,
      flagged: devices.filter((d) => d.status === "flagged").length,
      slashed: devices.filter((d) => d.status === "slashed").length,
      real: devices.filter((d) => !d.simulated).length,
      simulated: devices.filter((d) => d.simulated).length,
    }),
    [devices],
  );

  const rows = devices
    .filter((d) => (filter === "all" ? true : filter === "real" ? !d.simulated : filter === "simulated" ? d.simulated : d.status === filter))
    .filter((d) => {
      const s = q.trim().toLowerCase();
      return !s || d.ens.includes(s) || d.device.includes(s) || d.geohash.startsWith(s) || placeLabel(d).toLowerCase().includes(s);
    });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(counts) as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 text-xs capitalize ${filter === f ? "border-ink bg-ink text-ground" : "border-line bg-surface hover:border-ink"}`}
          >
            {f} <span className="opacity-70">{counts[f]}</span>
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by name, address, cell, locality"
          aria-label="Filter devices"
          className="ml-auto w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-ink sm:w-72"
        />
      </div>
      <div className="card mt-4 overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Device (ENS · signer)</th>
              <th className="px-4 py-2 font-medium">Cell</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">AQI</th>
              <th className="px-4 py-2 font-medium">PM2.5 / PM10 µg/m³</th>
              <th className="px-4 py-2 font-medium">Stake</th>
              <th className="px-4 py-2 font-medium">Latest reading</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((d) => {
              const r = d.last_reading;
              return (
                <tr key={d.device} className="hover:bg-bg/60">
                  <td className="px-4 py-2.5">
                    <Link href={`/devices/${d.ens}`} className="font-medium hover:underline">{d.ens}</Link>
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <a href={addressUrl(d.device)} target="_blank" rel="noreferrer" className="font-mono text-chain hover:underline">{short(d.device)}</a>
                      {d.simulated && <span className="rounded bg-bg px-1 text-[10px]">simulated</span>}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="font-mono">{d.geohash}</span>
                    <div className="text-xs text-muted">{placeLabel(d)}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[d.status]}`}>{d.status}</span>
                  </td>
                  <td className="px-4 py-2.5">{r ? <AqiChip value={aqi(r.pm25_x10, r.pm10_x10)} /> : "—"}</td>
                  <td className="px-4 py-2.5 tabular-nums">{r ? `${x10(r.pm25_x10)} / ${x10(r.pm10_x10)}` : "—"}</td>
                  <td className="px-4 py-2.5 tabular-nums">{eth(d.stake_wei)} ETH</td>
                  <td className="px-4 py-2.5">
                    {r ? (
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-xs text-muted">{time(r.epoch)}</span>
                        <VerifyBadge reading={r} compact />
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">No devices match.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
