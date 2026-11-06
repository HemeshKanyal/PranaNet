"use client";
// Chapter 6: the latest readings read straight from Arkiv by this browser (public Rabdi RPC,
// filtered to the relayer's writer wallet), each verifiable here with viem.
import Link from "next/link";
import { useEffect, useState } from "react";
import type { BrowserRecord } from "@/lib/arkiv-browser";
import { arkivEntityUrl } from "@/lib/chain";
import { short, time, x10 } from "@/lib/format";
import { useInView } from "@/lib/story/hooks";
import { recordId, verifyReading, type Verdict } from "@/lib/verify";
import type { Address } from "@/lib/types";
import { Eye } from "./Eye";

export function CheckItYourself({ writer }: { writer: Address | null }) {
  const [ref, inView] = useInView<HTMLDivElement>("0px 0px 300px 0px");
  const [rows, setRows] = useState<BrowserRecord[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!inView) return;
    if (!writer) {
      setErr("no Arkiv writer configured (relayer unreachable)");
      return;
    }
    let live = true;
    (async () => {
      try {
        // Loaded only when this chapter is near: keeps the Arkiv SDK out of the first load.
        const { latestReadings } = await import("@/lib/arkiv-browser");
        const [real, sim] = await Promise.all([latestReadings(writer, 3, false), latestReadings(writer, 3, true)]);
        if (live) setRows([...real, ...sim]);
      } catch (e) {
        if (live) setErr((e as Error).message.split("\n")[0]);
      }
    })();
    return () => {
      live = false;
    };
  }, [inView, writer]);

  return (
    <div ref={ref}>
      <p className="max-w-3xl text-[1.05rem] leading-relaxed">
        These rows were just fetched by <b>your browser</b>, straight from Arkiv, not from our server. Only entities written by
        the relayer&apos;s wallet{writer && <> (<span className="font-mono text-sm">{short(writer)}</span>)</>} count. Press verify and
        your browser recovers each signer itself.
      </p>
      <div className="mt-5 min-h-[25rem] overflow-hidden rounded border-2 border-maroon/40 bg-[#fbf1da]">
        <div className="hidden grid-cols-[1.4fr_0.8fr_1fr_1.3fr] gap-3 border-b border-maroon/30 px-4 py-2 text-xs font-bold uppercase tracking-wider text-kohl/60 sm:grid">
          <span>Node</span><span>PM2.5</span><span>Signed at</span><span>Check</span>
        </div>
        {err ? (
          <p className="p-4 text-sm text-vermilion">Couldn&apos;t reach Arkiv from this browser: {err}</p>
        ) : !rows ? (
          [0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="m-3 h-12 animate-pulse rounded bg-maroon/10 motion-reduce:animate-none" />)
        ) : (
          <ul>
            {rows.map((r) => (
              <Row key={r.entityKey} rec={r} />
            ))}
          </ul>
        )}
      </div>
      <p className="mt-5 font-[family-name:var(--font-rozha)] text-2xl text-maroon">You don&apos;t have to trust us, or anyone.</p>
    </div>
  );
}

function Row({ rec }: { rec: BrowserRecord }) {
  const r = rec.reading;
  const [v, setV] = useState<Verdict | null>(null);
  return (
    <li className="grid grid-cols-2 items-center gap-x-3 gap-y-1 border-b border-maroon/15 px-4 py-2.5 text-sm last:border-0 sm:grid-cols-[1.4fr_0.8fr_1fr_1.3fr]">
      <span className="col-span-2 flex items-center gap-2 font-semibold sm:col-span-1">
        <Eye state={r.simulated ? "sim" : "open"} size={26} blink={false} />
        <span className="truncate">{r.ens.split(".")[0]}</span>
        {r.simulated && <span className="rounded bg-olive/15 px-1.5 text-[10px] font-semibold text-olive">simulated</span>}
      </span>
      <span className="font-mono">{x10(r.pm25_x10)} µg/m³</span>
      <span className="text-xs text-kohl/70">{time(r.epoch)}</span>
      <span className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-1">
        {v ? (
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${v.ok ? "bg-leaf/20 text-leaf" : "bg-vermilion/15 text-vermilion"}`} title={v.signer ?? ""}>
            {v.ok ? `✓ signer ${short(v.signer ?? "")}` : "✕ invalid"}
          </span>
        ) : (
          <button type="button" onClick={() => verifyReading(r).then(setV)} className="rounded-full border-2 border-kohl px-2.5 py-0.5 text-xs font-bold hover:bg-kohl hover:text-cream">
            verify signature
          </button>
        )}
        <a href={arkivEntityUrl(rec.entityKey)} target="_blank" rel="noreferrer" className="text-xs text-vermilion underline">
          Arkiv ↗
        </a>
        <Link href={`/records/${recordId(r)}`} className="text-xs underline">record</Link>
      </span>
    </li>
  );
}
