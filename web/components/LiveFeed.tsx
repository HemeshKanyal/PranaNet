"use client";
import Link from "next/link";
import { useLive, type LiveEvent } from "./LiveProvider";
import { VerifyBadge } from "./VerifyBadge";
import { txUrl } from "@/lib/chain";
import { time, x10 } from "@/lib/format";
import { recordId } from "@/lib/verify";

function Row({ e }: { e: LiveEvent }) {
  if (e.type === "reading") {
    const r = e.data;
    return (
      <li className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2">
        <span className="h-2 w-2 rounded-full bg-cyan-600" aria-hidden />
        <Link href={`/devices/${r.ens}`} className="font-medium hover:underline">{r.ens.replace(".prananet.eth", "")}</Link>
        <span className="tabular-nums text-muted">PM2.5 {x10(r.pm25_x10)} · PM10 {x10(r.pm10_x10)}</span>
        <span className="ml-auto flex items-center gap-2">
          <VerifyBadge reading={r} compact />
          <Link href={`/records/${recordId(r)}`} className="text-[11px] text-chain hover:underline">#{r.nonce}</Link>
        </span>
      </li>
    );
  }
  if (e.type === "flag") {
    const f = e.data;
    return (
      <li className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-amber-400/10 px-2 py-2">
        <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
        <span className="font-medium text-amber-300">Flagged {f.ens.replace(".prananet.eth", "")}</span>
        <span className="text-amber-300/80">
          {x10(f.value_x10)} vs neighbour median {x10(f.median_x10)} µg/m³ · {f.reason.replace("_", " ")}
        </span>
        <span className="ml-auto text-[11px] text-amber-300/70">Registry.flag() · {time(f.epoch)}</span>
      </li>
    );
  }
  const s = e.data;
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-red-500/10 px-2 py-2">
      <span className="h-2 w-2 rounded-full bg-red-600" aria-hidden />
      <span className="font-medium text-red-300">Slashed {s.ens}</span>
      <span className="text-red-300/80">3 consecutive flags · stake moved to reward pool · ENS revoked</span>
      <a href={txUrl(s.tx)} target="_blank" rel="noreferrer" className="ml-auto font-mono text-[11px] text-chain hover:underline">
        tx {s.tx.slice(0, 10)}… ↗
      </a>
    </li>
  );
}

export function LiveFeed({ filter, limit = 14 }: { filter?: (e: LiveEvent) => boolean; limit?: number }) {
  const { events, conn } = useLive();
  const shown = (filter ? events.filter(filter) : events).slice(0, limit);
  return (
    <div>
      {shown.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">{conn === "connecting" ? "Connecting to relayer…" : "Waiting for the next signed reading…"}</p>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {shown.map((e) => <Row key={e.id} e={e} />)}
        </ul>
      )}
    </div>
  );
}
