"use client";
// Re-runs the contract's signature check in the browser and shows the result.
import { useEffect, useState } from "react";
import { verifyReading, type Verdict } from "@/lib/verify";
import type { Reading } from "@/lib/types";

export function useVerdict(r: Reading | null | undefined) {
  const [v, setV] = useState<Verdict | null>(null);
  useEffect(() => {
    let live = true;
    setV(null);
    if (r) verifyReading(r).then((x) => live && setV(x));
    return () => {
      live = false;
    };
  }, [r]);
  return v;
}

export function VerifyBadge({ reading, compact = false }: { reading: Reading; compact?: boolean }) {
  const v = useVerdict(reading);
  const title = v
    ? v.ok
      ? `Signer recovered from the EIP-191 signature matches ${reading.device}`
      : `Recovered signer ${v.signer ?? "none"} does not match ${reading.device}`
    : "Checking signature…";
  const cls = !v
    ? "border-line text-muted"
    : v.ok
      ? "border-chain/30 bg-chain-soft text-chain"
      : "border-red-300 bg-red-50 text-red-700";
  return (
    <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      <svg aria-hidden viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
        {!v ? <circle cx="8" cy="8" r="5" strokeDasharray="4 3" /> : v.ok ? <path d="M3 8.5l3 3 7-7" /> : <path d="M4 4l8 8M12 4l-8 8" />}
      </svg>
      {!v ? "checking" : v.ok ? (compact ? "verified" : "signature verified") : "invalid signature"}
    </span>
  );
}
