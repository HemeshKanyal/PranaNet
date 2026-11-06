"use client";
// World ID step. Real mode: IDKit 4 widget (needs NEXT_PUBLIC_WLD_APP_ID + server rp_context).
// Mock mode: a clearly labelled simulated proof so the flow can be built and demoed.
import { IDKitRequestWidget, orbLegacy, type IDKitResult, type RpContext } from "@worldcoin/idkit";
import { useState } from "react";

const APP_ID = process.env.NEXT_PUBLIC_WLD_APP_ID as `app_${string}` | undefined;
const ACTION = process.env.NEXT_PUBLIC_WLD_ACTION || "register-device";
const ENV = (process.env.NEXT_PUBLIC_WLD_ENV || "staging") as "production" | "staging";
export const WORLD_ID_IS_MOCK = !APP_ID;

export default function WorldIdButton({ signal, disabled, onProof }: {
  /** bound into the proof so it can't be reused for another device */
  signal: string;
  disabled: boolean;
  onProof: (result: unknown) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rp, setRp] = useState<RpContext | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setErr("");
    if (WORLD_ID_IS_MOCK) {
      setBusy(true);
      await new Promise((r) => setTimeout(r, 700));
      onProof({ mock: true, action: ACTION, signal, nullifier: "0xmock-nullifier-for-demo", verification_level: "orb" });
      setBusy(false);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/rp-context", { cache: "no-store" });
      if (!res.ok) throw new Error("rp_context unavailable: set WLD_RP_ID and WLD_RP_SIGNING_KEY on the server");
      setRp((await res.json()) as RpContext);
      setOpen(true);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={start}
        disabled={disabled || busy}
        className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-ground disabled:opacity-40"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M3.5 12h17M12 3a13 13 0 0 1 0 18" />
        </svg>
        {busy ? "Opening…" : WORLD_ID_IS_MOCK ? "Simulate World ID proof" : "Verify with World ID"}
      </button>
      {WORLD_ID_IS_MOCK && <p className="mt-1 text-xs text-amber-300">Mock mode: NEXT_PUBLIC_WLD_APP_ID is not set, so no real proof is made.</p>}
      {err && <p className="mt-1 text-xs text-red-300">{err}</p>}
      {APP_ID && rp && (
        <IDKitRequestWidget
          open={open}
          onOpenChange={setOpen}
          app_id={APP_ID}
          action={ACTION}
          rp_context={rp}
          allow_legacy_proofs
          environment={ENV}
          preset={orbLegacy({ signal })}
          onSuccess={(result: IDKitResult) => onProof(result)}
          onError={(code) => setErr(`World ID error: ${code}`)}
        />
      )}
    </div>
  );
}
