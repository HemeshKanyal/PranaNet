"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { LOCALITIES } from "@/lib/area";
import { txUrl, ensUrl, REGISTRY_CONTRACT, CONTRACTS_ARE_MOCK } from "@/lib/chain";
import { encode, isGeohash } from "@/lib/geohash";
import { short } from "@/lib/format";
import type { RegisterResponse } from "@/lib/types";

const WorldIdButton = dynamic(() => import("./WorldIdButton"), { ssr: false });

const ERRORS: Record<string, string> = {
  max_devices: "This World ID already has 3 devices registered. The cap is one human, three devices.",
  bad_device: "Device address must be a 0x address with 40 hex characters.",
  bad_label: "Label must be 3–32 characters: lowercase letters, digits and hyphens.",
  bad_geohash: "Geohash must be 6 characters.",
  missing_proof: "Verify with World ID first.",
  relayer_unreachable: "The relayer didn't answer. Try again in a moment.",
};

export function RegisterForm() {
  const [device, setDevice] = useState("");
  const [label, setLabel] = useState("");
  const [geohash, setGeohash] = useState("");
  const [proof, setProof] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<RegisterResponse | null>(null);

  const dev = device.trim().toLowerCase();
  const devOk = /^0x[0-9a-f]{40}$/.test(dev);
  const labelOk = /^[a-z0-9-]{3,32}$/.test(label);
  const geoOk = isGeohash(geohash);
  const detailsOk = devOk && labelOk && geoOk;

  const submit = async () => {
    setBusy(true);
    setRes(null);
    try {
      const r = await fetch("/api/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idkit: proof, device: dev, label, geohash }),
      });
      setRes((await r.json()) as RegisterResponse);
    } catch {
      setRes({ ok: false, error: "relayer_unreachable" });
    } finally {
      setBusy(false);
    }
  };

  const input = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink";
  const step = (n: number, done: boolean) => (
    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${done ? "bg-chain text-white" : "bg-line text-muted"}`}>
      {done ? "✓" : n}
    </span>
  );

  if (res?.ok) {
    return (
      <div className="card p-6">
        <div className="text-xs font-semibold uppercase tracking-wide text-chain">Registered</div>
        <h2 className="mt-1 text-xl font-semibold">{res.ens}</h2>
        <p className="mt-2 text-sm text-muted">
          The Registry recorded your device and minted its ENS subname with geohash <span className="font-mono">{geohash}</span>.
          Flash the device key into the firmware and its signed readings will appear on the map.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <a href={txUrl(res.tx)} target="_blank" rel="noreferrer" className="rounded-lg border border-chain/40 px-3 py-2 font-mono text-chain">tx {res.tx.slice(0, 12)}… ↗</a>
          <a href={ensUrl(res.ens)} target="_blank" rel="noreferrer" className="rounded-lg border border-chain/40 px-3 py-2 text-chain">View on ENS ↗</a>
          <Link href="/devices" className="rounded-lg bg-ink px-3 py-2 font-medium text-white">See all devices</Link>
        </div>
        {CONTRACTS_ARE_MOCK && <p className="mt-3 text-xs text-amber-700">Mock response: no transaction was sent.</p>}
      </div>
    );
  }

  return (
    <div className="card divide-y divide-line">
      {/* 1. details */}
      <div className="flex gap-4 p-5">
        {step(1, detailsOk)}
        <div className="flex-1 space-y-4">
          <h2 className="font-semibold">Device details</h2>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Device address (the key on the ESP32, not your wallet)</span>
            <input className={`${input} font-mono`} value={device} onChange={(e) => setDevice(e.target.value)} placeholder="0x…" spellCheck={false} />
            {device && !devOk && <span className="mt-1 block text-xs text-red-700">{ERRORS.bad_device}</span>}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Name</span>
            <div className="flex items-center">
              <input className={`${input} rounded-r-none`} value={label} onChange={(e) => setLabel(e.target.value.toLowerCase())} placeholder="colaba-02" spellCheck={false} />
              <span className="rounded-r-lg border border-l-0 border-line bg-bg px-3 py-2 text-sm text-muted">.prananet.eth</span>
            </div>
            {label && !labelOk && <span className="mt-1 block text-xs text-red-700">{ERRORS.bad_label}</span>}
          </label>
          <div className="text-sm">
            <span className="mb-1 block text-muted">Location cell (6-character geohash, about 1.2 × 0.6 km). Only this cell is published.</span>
            <div className="flex flex-wrap gap-2">
              <input className={`${input} w-32 font-mono`} value={geohash} onChange={(e) => setGeohash(e.target.value.toLowerCase().slice(0, 6))} placeholder="te7u3q" spellCheck={false} />
              <select
                className={`${input} w-auto`}
                value=""
                onChange={(e) => {
                  const l = LOCALITIES.find((x) => x.name === e.target.value);
                  if (l) setGeohash(encode(l.lat, l.lon, 6));
                }}
                aria-label="Pick a locality"
              >
                <option value="">or pick a locality…</option>
                {LOCALITIES.map((l) => <option key={l.name} value={l.name}>{l.name}</option>)}
              </select>
            </div>
            {geohash && !geoOk && <span className="mt-1 block text-xs text-red-700">{ERRORS.bad_geohash}</span>}
          </div>
        </div>
      </div>

      {/* 2. World ID */}
      <div className="flex gap-4 p-5">
        {step(2, !!proof)}
        <div className="flex-1">
          <h2 className="font-semibold">Prove you&apos;re a unique human</h2>
          <p className="mt-1 text-sm text-muted">
            World ID gives a nullifier, not your identity. The contract allows at most 3 devices per nullifier, so one person
            can&apos;t flood an area with fake sensors. The proof is bound to this device address.
          </p>
          <div className="mt-3">
            {proof ? (
              <div className="flex items-center gap-3 text-sm">
                <span className="rounded-full bg-chain-soft px-3 py-1 font-medium text-chain">✓ Proof ready</span>
                <button type="button" onClick={() => setProof(null)} className="text-xs text-muted underline">redo</button>
              </div>
            ) : (
              <WorldIdButton signal={dev} disabled={!detailsOk} onProof={setProof} />
            )}
          </div>
        </div>
      </div>

      {/* 3. submit */}
      <div className="flex gap-4 p-5">
        {step(3, false)}
        <div className="flex-1">
          <h2 className="font-semibold">Register on-chain</h2>
          <p className="mt-1 text-sm text-muted">
            The relayer checks the proof server-side, then calls <code className="font-mono text-xs">Registry.registerDevice()</code> on{" "}
            <span className="font-mono text-xs">{short(REGISTRY_CONTRACT)}</span> and creates the ENS subname.
          </p>
          <button
            type="button"
            onClick={submit}
            disabled={!detailsOk || !proof || busy}
            className="mt-3 rounded-lg bg-chain px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {busy ? "Registering…" : "Register device"}
          </button>
          {res && !res.ok && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{ERRORS[res.error] ?? `Registration failed: ${res.error}`}</p>}
          {CONTRACTS_ARE_MOCK && <p className="mt-2 text-xs text-muted">Mock mode tip: a name containing &quot;fourth&quot; returns the max_devices error.</p>}
        </div>
      </div>
    </div>
  );
}
