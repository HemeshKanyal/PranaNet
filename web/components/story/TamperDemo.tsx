"use client";
// Chapter 3: a real signed reading from a real node, verified in the browser with viem
// (lib/verify.ts, the same check Readings.sol runs). Edit the value and the check fails.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLive } from "@/components/LiveProvider";
import { time, x10, short } from "@/lib/format";
import { recordId, verifyReading, type Verdict } from "@/lib/verify";
import type { Reading } from "@/lib/types";
import { Eye } from "./Eye";

export function TamperDemo() {
  const { devices } = useLive();
  // The newest reading from a real, active device (bkc-01 today); a simulated one only as fallback.
  const source = useMemo(() => {
    const withR = devices.filter((d) => d.last_reading);
    const pick = (xs: typeof withR) => xs.sort((a, b) => b.last_reading!.epoch - a.last_reading!.epoch)[0];
    return pick(withR.filter((d) => !d.simulated && d.status === "active")) ?? pick(withR.filter((d) => d.status === "active")) ?? null;
  }, [devices]);
  const original = source?.last_reading ?? null;

  const [pm, setPm] = useState<string>("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);

  // New reading arrives (WS) → reset the demo to it, unless the visitor is mid-edit.
  const key = original ? `${original.device}:${original.nonce}` : "";
  useEffect(() => {
    if (!original) return;
    setPm(x10(original.pm25_x10));
    setVerdict(null);
    setChecked(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const edited: Reading | null = useMemo(() => {
    if (!original) return null;
    const v = Math.round(Number(pm) * 10);
    return Number.isFinite(v) && v >= 0 ? { ...original, pm25_x10: v } : original;
  }, [original, pm]);
  const tampered = !!original && !!edited && edited.pm25_x10 !== original.pm25_x10;

  // After the first click, re-check on every edit: the failure is instant.
  useEffect(() => {
    if (!checked || !edited) return;
    let live = true;
    verifyReading(edited).then((v) => live && setVerdict(v));
    return () => {
      live = false;
    };
  }, [checked, edited]);

  if (!original || !source || !edited) {
    return <p className="text-kohl/70">Waiting for a signed reading from a node…</p>;
  }

  const verify = async () => {
    setBusy(true);
    setVerdict(await verifyReading(edited));
    setChecked(true);
    setBusy(false);
  };

  const ok = verdict?.ok === true;
  return (
    <>
      <p>
        The latest reading from <b>{source.ens}</b>{source.simulated ? " (simulated)" : ", a real board at our venue"}, exactly as it
        was signed:
      </p>
      <div className="mt-4 overflow-hidden rounded border border-maroon/30 bg-[#fbf1da] font-mono text-sm sm:text-sm">
        <Row k="device" v={<span title={original.device}>{short(original.device)}</span>} />
        <Row k="time" v={time(original.epoch)} />
        <div className="flex items-center gap-2 border-b border-maroon/15 bg-saffron/25 px-3 py-1.5">
          <label htmlFor="pm-edit" className="w-20 shrink-0 text-kohl/70">PM2.5</label>
          <input
            id="pm-edit"
            inputMode="decimal"
            value={pm}
            onChange={(e) => setPm(e.target.value.replace(/[^0-9.]/g, "").slice(0, 6))}
            className="w-24 rounded border-2 border-maroon bg-cream px-2 py-0.5 font-bold text-kohl outline-none focus:border-vermilion"
            aria-describedby="pm-hint"
          />
          <span className="text-kohl/70">µg/m³</span>
          <span id="pm-hint" className="ml-auto hidden font-sans text-sm text-kohl/60 sm:inline">← try changing it</span>
        </div>
        <Row k="PM10" v={`${x10(original.pm10_x10)} µg/m³`} />
        <Row k="nonce" v={String(original.nonce)} />
        <Row k="signature" v={<span title={original.signature}>{original.signature.slice(0, 18)}…{original.signature.slice(-6)}</span>} last />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={verify}
          disabled={busy}
          className="rounded-full bg-kohl px-5 py-2 font-bold text-cream hover:bg-maroon disabled:opacity-60"
        >
          {checked ? "Verify again" : "Verify signature"}
        </button>
        {tampered && (
          <button type="button" onClick={() => setPm(x10(original.pm25_x10))} className="rounded-full border-2 border-kohl px-4 py-1.5 font-semibold">
            Put the real value back
          </button>
        )}
      </div>

      {/* Fixed-height result box: no layout shift when the verdict appears */}
      <div aria-live="polite" className={`mt-3 flex min-h-[5.5rem] items-center gap-3 rounded border-2 p-3 transition-colors ${!verdict ? "border-dashed border-maroon/30" : ok ? "border-leaf bg-leaf/15" : "border-vermilion bg-vermilion/10"}`}>
        <Eye size={48} state={!verdict ? "sim" : ok ? "open" : "flagged"} blink={!verdict} />
        <div className="min-w-0 text-[1.05rem] leading-snug">
          {!verdict ? (
            <span className="text-kohl/70">Press verify: your browser recovers the signer from the signature and the values (no server involved).</span>
          ) : ok ? (
            <>
              <b className="text-leaf">✓ Signed by {source.ens}.</b> Recovered <span className="font-mono">{short(verdict.signer ?? "")}</span>, the registered device.
            </>
          ) : (
            <>
              <b className="text-vermilion">✕ Signature check failed.</b> These values recover <span className="font-mono">{verdict.signer ? short(verdict.signer) : "no valid signer"}</span>, not {source.ens}. The contract would revert this reading.
            </>
          )}
        </div>
      </div>
      <p className="mt-4 text-base text-kohl/70">
        Full breakdown of the 264 signed bytes:{" "}
        <Link href={`/records/${recordId(original)}`} className="text-vermilion underline">open this record</Link>.
      </p>
    </>
  );
}

function Row({ k, v, last = false }: { k: string; v: React.ReactNode; last?: boolean }) {
  return (
    <div className={`flex gap-2 px-3 py-1.5 ${last ? "" : "border-b border-maroon/15"}`}>
      <span className="w-20 shrink-0 text-kohl/70">{k}</span>
      <span className="min-w-0 truncate">{v}</span>
    </div>
  );
}
