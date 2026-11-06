"use client";
import Link from "next/link";
import { useMemo } from "react";
import { AqiChip } from "./Aqi";
import { useVerdict } from "./VerifyBadge";
import { aqi } from "@/lib/aqi";
import type { ArkivRecord } from "@/lib/arkiv";
import { addressUrl, arkivEntityUrl, CHAIN_ID, READINGS_CONTRACT, txUrl } from "@/lib/chain";
import { time, x10 } from "@/lib/format";
import { PACKED_FIELDS, packed, recordId } from "@/lib/verify";

function Step({ n, title, ok, children }: { n: number; title: string; ok: boolean | null; children: React.ReactNode }) {
  const mark = ok == null ? "…" : ok ? "✓" : "✕";
  const cls = ok == null ? "bg-line text-muted" : ok ? "bg-chain text-ground" : "bg-red-600 text-ground";
  return (
    <li className="relative pl-10">
      <span className={`absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${cls}`}>{mark}</span>
      <div className="text-xs font-medium uppercase tracking-wide text-muted">Step {n}</div>
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-2 text-sm">{children}</div>
    </li>
  );
}

export function RecordView({ rec }: { rec: ArkivRecord }) {
  const isMock = rec.mock;
  const r = rec.reading;
  const v = useVerdict(r);
  const hex = useMemo(() => packed(r), [r]);
  const slices = useMemo(() => {
    let off = 2;
    return PACKED_FIELDS.map(([name, type, bytes]) => {
      const s = `0x${hex.slice(off, off + bytes * 2)}`;
      off += bytes * 2;
      const value = name === "chainId" ? CHAIN_ID : name === "readingsContract" ? READINGS_CONTRACT : (r as unknown as Record<string, string | number>)[name];
      return { name, type, bytes, value, s };
    });
  }, [hex, r]);
  const sig = r.signature;
  const sigParts = { r: `0x${sig.slice(2, 66)}`, s: `0x${sig.slice(66, 130)}`, v: parseInt(sig.slice(130, 132), 16) };
  const expiresIn = rec.expiresAt - r.epoch;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link href={`/devices/${r.ens}`} className="text-muted hover:text-ink">← {r.ens}</Link>
        <div className="flex gap-2">
          {rec.prevNonce != null && <Link className="rounded border border-line px-2 py-1 hover:border-ink" href={`/records/${recordId({ device: r.device, nonce: rec.prevNonce })}`}>← #{rec.prevNonce}</Link>}
          {rec.nextNonce != null && <Link className="rounded border border-line px-2 py-1 hover:border-ink" href={`/records/${recordId({ device: r.device, nonce: rec.nextNonce })}`}>#{rec.nextNonce} →</Link>}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Reading #{r.nonce}</h1>
        <AqiChip value={aqi(r.pm25_x10, r.pm10_x10)} />
        {v && (
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${v.ok ? "bg-chain text-ground" : "bg-red-600 text-ground"}`}>
            {v.ok ? "✓ Authentic: signed by the registered device" : "✕ Signature does not match this device"}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">
        {r.ens} · cell <span className="font-mono">{r.geohash}</span> · {time(r.epoch)} IST{r.simulated ? " · simulated device" : ""}
      </p>

      <section className="mt-6 grid gap-3 sm:grid-cols-4">
        {[
          ["PM2.5", `${x10(r.pm25_x10)} µg/m³`],
          ["PM10", `${x10(r.pm10_x10)} µg/m³`],
          ["Temperature", r.temp_x10 || r.hum_x10 ? `${x10(r.temp_x10)} °C` : "not measured"],
          ["Humidity", r.temp_x10 || r.hum_x10 ? `${x10(r.hum_x10)} %` : "not measured"],
        ].map(([k, val]) => (
          <div key={k} className="card px-4 py-3">
            <div className="text-xs text-muted">{k}</div>
            <div className="text-lg font-semibold tabular-nums">{val}</div>
          </div>
        ))}
      </section>

      {/* Arkiv entity */}
      <section className="card mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-chain-soft/60 px-4 py-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-chain">Arkiv entity</h3>
          {isMock && <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-xs font-medium text-amber-300">mock until the Arkiv writer is live</span>}
          {!isMock && (
            <a className="ml-auto text-xs text-chain hover:underline" href={arkivEntityUrl(rec.entityKey)} target="_blank" rel="noreferrer">
              Open in Arkiv explorer ↗
            </a>
          )}
        </div>
        <dl className="grid gap-x-6 gap-y-3 p-4 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted">Entity key</dt>
            <dd className="break-all font-mono text-xs">{rec.entityKey}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Written by (relayer wallet)</dt>
            <dd className="break-all font-mono text-xs">{rec.owner}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Expires</dt>
            <dd>{time(rec.expiresAt)} IST <span className="text-muted">({Math.round(expiresIn / 86400)} days after the reading)</span></dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="mb-1 text-xs text-muted">Queryable attributes</dt>
            <dd className="flex flex-wrap gap-1.5">
              {Object.entries(rec.attributes).map(([k, val]) => (
                <span key={k} className="rounded-md bg-bg px-2 py-0.5 font-mono text-xs">{k} = {String(val)}</span>
              ))}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="mb-1 text-xs text-muted">Query that finds this record</dt>
            <dd><code className="block overflow-x-auto rounded-lg bg-ink px-3 py-2 font-mono text-xs text-ground">from(&quot;prananet.reading&quot;).where(device = {r.device} && nonce = {r.nonce}).ownedBy({rec.owner})</code></dd>
          </div>
        </dl>
      </section>

      {/* Verification walkthrough */}
      <section className="card mt-6 p-5">
        <h2 className="text-lg font-semibold">Check it yourself</h2>
        <p className="mt-1 text-sm text-muted">
          Your browser just repeated the check the Readings contract does on-chain. The relayer only pays gas: changing any value
          would break the signature.
        </p>
        <ol className="mt-5 space-y-7">
          <Step n={1} title="Rebuild the 264-byte message" ok={(hex.length - 2) / 2 === 264}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-xs">
                <thead className="text-muted">
                  <tr><th className="py-1 pr-3 font-medium">#</th><th className="pr-3 font-medium">Field</th><th className="pr-3 font-medium">Type</th><th className="pr-3 font-medium">Bytes</th><th className="pr-3 font-medium">Value</th><th className="font-medium">Packed hex</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {slices.map((f, i) => (
                    <tr key={f.name}>
                      <td className="py-1 pr-3 text-muted">{i + 1}</td>
                      <td className="pr-3 font-mono">{f.name}</td>
                      <td className="pr-3 font-mono text-muted">{f.type}</td>
                      <td className="pr-3 tabular-nums">{f.bytes}</td>
                      <td className="max-w-[160px] truncate pr-3 font-mono" title={String(f.value)}>{String(f.value)}</td>
                      <td className="max-w-[220px] truncate font-mono text-muted" title={f.s}>{f.s}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted">
              <code>abi.encodePacked</code>, no padding between fields. chainId and contract stop replay on other chains.
              Total: <b>{(hex.length - 2) / 2} bytes</b>.
            </p>
          </Step>
          <Step n={2} title="Hash it with keccak256" ok={v ? true : null}>
            <code className="block break-all rounded-lg bg-bg px-3 py-2 font-mono text-xs">{v?.hash ?? "…"}</code>
          </Step>
          <Step n={3} title="Recover the signer from the EIP-191 signature" ok={v ? v.signer != null : null}>
            <div className="grid gap-1 font-mono text-xs">
              <div className="break-all"><span className="text-muted">r </span>{sigParts.r}</div>
              <div className="break-all"><span className="text-muted">s </span>{sigParts.s}</div>
              <div><span className="text-muted">v </span>{sigParts.v}</div>
              <div className="mt-1 break-all"><span className="text-muted">recovered </span>{v?.signer ?? "…"}</div>
            </div>
          </Step>
          <Step n={4} title="Compare with the registered device key" ok={v ? v.ok : null}>
            <div className="font-mono text-xs">
              <span className="text-muted">registered </span>
              <a href={addressUrl(r.device)} target="_blank" rel="noreferrer" className="break-all text-chain hover:underline">{r.device}</a>
            </div>
            {v && <p className="mt-1 text-sm">{v.ok ? "Match. Only the holder of this device's key could have produced this reading." : "No match. The contract would reject this reading."}</p>}
          </Step>
          <Step n={5} title="Nonce strictly increases" ok={rec.prevNonce == null || rec.prevNonce < r.nonce}>
            Nonce <b>{r.nonce}</b>
            {rec.prevNonce != null ? <> follows #{rec.prevNonce}, so this reading can&apos;t be replayed.</> : <> is the first reading on record.</>}
          </Step>
          <Step n={6} title="Cross-checked against neighbours" ok={rec.flag ? false : true}>
            {rec.flag ? (
              <p className="text-amber-300">
                Flagged by the verifier: {x10(rec.flag.value_x10)} µg/m³
                {rec.flag.median_x10 > 0 && <> against a neighbour median of {x10(rec.flag.median_x10)} µg/m³</>} ({rec.flag.reason.replace("_", " ")}).
                The signature is genuine, but the value disagrees with its neighbours by more than 50% and 25 µg/m³.
                {rec.flag.tx && (
                  <> <a className="font-mono text-chain hover:underline" href={txUrl(rec.flag.tx)} target="_blank" rel="noreferrer">Flag tx ↗</a></>
                )}
              </p>
            ) : (
              <p>Not flagged. The value agrees with neighbouring devices within the verifier&apos;s threshold.</p>
            )}
          </Step>
        </ol>
      </section>

      <details className="card mt-6 p-4 text-sm">
        <summary className="cursor-pointer font-medium">Raw reading JSON</summary>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-bg p-3 font-mono text-xs">{JSON.stringify(r, null, 2)}</pre>
      </details>
    </main>
  );
}
