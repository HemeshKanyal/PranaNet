"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AqiChip, AqiLegend } from "./Aqi";
import { LiveChart } from "./LiveChart";
import { LiveFeed } from "./LiveFeed";
import { useLive } from "./LiveProvider";
import { SensorMap, type FlyTarget } from "./MapLoader";
import { VerifyBadge } from "./VerifyBadge";
import { aqi, aqiStyle, WHO_PM25 } from "@/lib/aqi";
import { areaStats, devicePos, LOCALITIES, nearestLocality, RADIUS_KM, type Locality } from "@/lib/area";
import { ensUrl } from "@/lib/chain";
import { eth, time, x10 } from "@/lib/format";
import { isGeohash, decode } from "@/lib/geohash";
import { recordId } from "@/lib/verify";
import type { DeviceDetail, Reading } from "@/lib/types";

/* ---------- search ---------- */

function LocalitySearch({ onPick }: { onPick: (l: Locality) => void }) {
  const { devices } = useLive();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [geoErr, setGeoErr] = useState("");

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const locs = LOCALITIES.filter((l) => l.name.toLowerCase().includes(s)).map((l) => ({ label: l.name, hint: "locality", l }));
    const devs = devices
      .filter((d) => d.ens.includes(s) || d.geohash.startsWith(s))
      .map((d) => ({ label: d.ens, hint: `cell ${d.geohash}`, l: { name: d.ens, ...devicePos(d) } }));
    const cell = isGeohash(s) ? [{ label: s, hint: "geohash cell", l: { name: `cell ${s}`, ...decode(s) } }] : [];
    return [...locs, ...devs, ...cell].slice(0, 8);
  }, [q, devices]);

  const nearMe = () => {
    setGeoErr("");
    if (!navigator.geolocation) return setGeoErr("Location isn't available in this browser.");
    navigator.geolocation.getCurrentPosition(
      (p) => onPick({ name: `Near you (${nearestLocality({ lat: p.coords.latitude, lon: p.coords.longitude }).name})`, lat: p.coords.latitude, lon: p.coords.longitude }),
      () => setGeoErr("Couldn't get your location. Pick a locality instead."),
      { timeout: 8000 },
    );
  };

  return (
    <div>
      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => { if (e.key === "Enter" && matches[0]) { onPick(matches[0].l); setQ(""); setOpen(false); } }}
            placeholder="Search a locality, device or geohash: Bandra, andheri-01, te7u3q"
            aria-label="Search locality"
            className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm shadow-sm outline-none focus:border-ink"
          />
          {open && matches.length > 0 && (
            <ul className="absolute z-[60] mt-1 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
              {matches.map((m) => (
                <li key={m.hint + m.label}>
                  <button
                    type="button"
                    onMouseDown={() => { onPick(m.l); setQ(""); setOpen(false); }}
                    className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-bg"
                  >
                    <span>{m.label}</span>
                    <span className="text-xs text-muted">{m.hint}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button type="button" onClick={nearMe} className="rounded-xl border border-line bg-surface px-4 text-sm font-medium hover:border-ink">
          Near me
        </button>
      </div>
      {geoErr && <p className="mt-1 text-xs text-red-700">{geoErr}</p>}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {LOCALITIES.map((l) => (
          <button key={l.name} type="button" onClick={() => onPick(l)} className="rounded-full border border-line bg-surface px-3 py-1 text-xs hover:border-ink">
            {l.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- area card ---------- */

function AreaCard({ place }: { place: Locality }) {
  const { devices } = useLive();
  const st = areaStats(devices, place);
  const style = st.aqi != null ? aqiStyle(st.aqi) : null;
  const sample = st.used.map((d) => d.last_reading).find((r): r is Reading => !!r);
  return (
    <div className="card overflow-hidden">
      <div className="flex items-stretch">
        <div className="flex w-36 shrink-0 flex-col items-center justify-center p-4 text-center" style={{ background: style?.bg ?? "#e2e6e3", color: style?.fg ?? "#13201b" }}>
          <div className="text-[11px] font-medium uppercase tracking-wide opacity-80">AQI</div>
          <div className="text-5xl font-bold tabular-nums leading-none">{st.aqi ?? "–"}</div>
          <div className="mt-1 text-sm font-semibold">{style?.cat ?? "No data"}</div>
        </div>
        <div className="min-w-0 flex-1 p-4">
          <div className="text-xs text-muted">Live air in</div>
          <div className="truncate text-lg font-semibold">{place.name}</div>
          {st.pm25_x10 != null ? (
            <>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tabular-nums">{x10(st.pm25_x10)}</span>
                <span className="text-sm text-muted">µg/m³ PM2.5</span>
              </div>
              <div className="text-sm">
                <b>{(st.pm25_x10 / 10 / WHO_PM25).toFixed(1)}×</b> the WHO 24-hour guideline · PM10 {x10(st.pm10_x10!)} µg/m³
              </div>
              <p className="mt-1 text-xs text-muted">{style?.advice}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">No active devices within {RADIUS_KM} km yet. Register one.</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line bg-chain-soft/50 px-4 py-2 text-xs text-chain">
        <span>
          Median of <b>{st.used.length}</b> signed device{st.used.length === 1 ? "" : "s"} within {RADIUS_KM} km
        </span>
        {st.excluded.length > 0 && <span className="text-amber-800">{st.excluded.length} flagged/slashed excluded</span>}
        {sample && <VerifyBadge reading={sample} />}
        {st.latestEpoch && <span className="ml-auto text-muted">updated {time(st.latestEpoch)}</span>}
      </div>
    </div>
  );
}

/* ---------- stats ---------- */

function Stats() {
  const { devices, flags, events } = useLive();
  const active = devices.filter((d) => d.status === "active").length;
  const slashed = devices.filter((d) => d.status === "slashed").length;
  const staked = devices.reduce((a, d) => a + BigInt(d.stake_wei), BigInt(0));
  const signed = events.filter((e) => e.type === "reading").length;
  const tiles = [
    { label: "Active devices", value: active, sub: `${devices.length} registered` },
    { label: "Signed readings (this session)", value: signed, sub: "each re-verified in your browser" },
    { label: "Flags raised", value: flags.length, sub: "neighbour outliers" },
    { label: "Stake securing data", value: `${eth(staked.toString())} ETH`, sub: `${slashed} device${slashed === 1 ? "" : "s"} slashed` },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="card px-4 py-3">
          <div className="text-xs text-muted">{t.label}</div>
          <div className="text-2xl font-semibold tabular-nums">{t.value}</div>
          <div className="text-[11px] text-muted">{t.sub}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- selected device panel ---------- */

function DevicePanel({ address, onClose }: { address: string; onClose: () => void }) {
  const { devices, fresh, flags } = useLive();
  const d = devices.find((x) => x.device === address);
  const [hist, setHist] = useState<DeviceDetail | null>(null);
  useEffect(() => {
    let ok = true;
    setHist(null);
    const ens = devices.find((x) => x.device === address)?.ens;
    if (ens) fetch(`/api/devices/${ens}`).then((r) => (r.ok ? r.json() : null)).then((j) => ok && setHist(j));
    return () => { ok = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);
  if (!d) return null;
  const r = d.last_reading;
  const readings = [...(hist?.readings ?? []), ...(fresh[d.device] ?? [])].slice(-90);
  return (
    <div className="card flex h-full flex-col p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0">
          <a href={ensUrl(d.ens)} target="_blank" rel="noreferrer" className="block truncate font-semibold text-chain hover:underline">{d.ens}</a>
          <div className="text-xs text-muted">
            cell <span className="font-mono">{d.geohash}</span> · {d.simulated ? "simulated device" : "real device"}
          </div>
        </div>
        <button onClick={onClose} className="ml-auto rounded px-1.5 text-muted hover:bg-bg" aria-label="Close panel">✕</button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {r && <AqiChip value={aqi(r.pm25_x10, r.pm10_x10)} />}
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${d.status === "active" ? "bg-green-100 text-green-800" : d.status === "flagged" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}`}>
          {d.status}
        </span>
        {r && <VerifyBadge reading={r} />}
      </div>
      {r && (
        <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-muted">PM2.5</dt><dd className="tabular-nums">{x10(r.pm25_x10)} µg/m³</dd>
          <dt className="text-muted">PM10</dt><dd className="tabular-nums">{x10(r.pm10_x10)} µg/m³</dd>
          <dt className="text-muted">Stake</dt><dd>{eth(d.stake_wei)} ETH</dd>
          <dt className="text-muted">Nonce</dt><dd className="font-mono">{r.nonce}</dd>
        </dl>
      )}
      <div className="mt-3 flex-1">
        <LiveChart readings={readings} flags={flags.filter((f) => f.device === d.device)} height={190} compact />
      </div>
      <div className="mt-3 flex gap-2 text-sm">
        <Link href={`/devices/${d.ens}`} className="flex-1 rounded-lg bg-ink px-3 py-2 text-center font-medium text-white">Device page</Link>
        {r && <Link href={`/records/${recordId(r)}`} className="flex-1 rounded-lg border border-chain/40 px-3 py-2 text-center font-medium text-chain">Arkiv record</Link>}
      </div>
    </div>
  );
}

/* ---------- ranking ---------- */

function Ranking({ onPick }: { onPick: (l: Locality) => void }) {
  const { devices } = useLive();
  const rows = LOCALITIES.map((l) => ({ l, st: areaStats(devices, l) }))
    .filter((x) => x.st.aqi != null)
    .sort((a, b) => b.st.aqi! - a.st.aqi!);
  const max = Math.max(...rows.map((r) => r.st.aqi!), 1);
  return (
    <ol className="space-y-1.5 text-sm">
      {rows.map(({ l, st }, i) => {
        const s = aqiStyle(st.aqi!);
        return (
          <li key={l.name}>
            <button type="button" onClick={() => onPick(l)} className="group flex w-full items-center gap-3 text-left">
              <span className="w-4 text-right text-xs text-muted tabular-nums">{i + 1}</span>
              <span className="w-20 shrink-0 truncate group-hover:underline">{l.name}</span>
              <span className="relative h-5 flex-1 overflow-hidden rounded bg-bg">
                <span className="absolute inset-y-0 left-0 rounded" style={{ width: `${(st.aqi! / max) * 100}%`, background: s.bg }} />
              </span>
              <span className="w-24 shrink-0 text-right text-xs tabular-nums">
                <b>{st.aqi}</b> <span className="text-muted">{s.cat}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- page ---------- */

export function HomeDashboard() {
  const { devices } = useLive();
  const [place, setPlace] = useState<Locality>(LOCALITIES[0]);
  const [selected, setSelected] = useState<string | null>(null);
  const [fly, setFly] = useState<FlyTarget | null>(null);

  const pick = (l: Locality) => {
    setPlace(l);
    setFly({ lat: l.lat, lon: l.lon, zoom: 13, key: Date.now() });
    const st = areaStats(devices, l);
    setSelected(st.used[0]?.device ?? null);
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <section className="grid items-start gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">What is your street breathing right now?</h1>
          <p className="mt-2 max-w-xl text-muted">
            Every reading is signed on the sensor, checked against its neighbours, and backed by stake. Search a neighbourhood to see
            air you can verify yourself.
          </p>
          <div className="mt-5">
            <LocalitySearch onPick={pick} />
          </div>
        </div>
        <AreaCard place={place} />
      </section>

      <section className="mt-8">
        <Stats />
      </section>

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Sensor map</h2>
            <p className="text-xs text-muted">Each circle is a device, placed in its 6-character geohash cell (no GPS is published). Click one for details.</p>
          </div>
          <AqiLegend className="w-full max-w-md" />
        </div>
        <div className={`grid gap-4 ${selected ? "lg:grid-cols-[1fr_340px]" : ""}`}>
          <div className="card overflow-hidden p-0">
            <SensorMap devices={devices} selected={selected} onSelect={setSelected} fly={fly} />
          </div>
          {selected && <DevicePanel address={selected} onClose={() => setSelected(null)} />}
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Live feed</h2>
            <span className="text-xs text-muted">readings · flags · slashes</span>
          </div>
          <LiveFeed />
        </div>
        <div className="card p-4">
          <h2 className="mb-3 font-semibold">Localities, worst to best</h2>
          <Ranking onPick={pick} />
          <p className="mt-3 text-[11px] text-muted">Median of active devices within {RADIUS_KM} km of each locality centre.</p>
        </div>
      </section>
    </main>
  );
}
