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
import { areaStats, deriveAreas, devicePos, LOCALITIES, nodeCounts, RADIUS_KM, type Area, type Locality } from "@/lib/area";
import { ensUrl } from "@/lib/chain";
import { eth, time, x10 } from "@/lib/format";
import { isGeohash, decode } from "@/lib/geohash";
import { recordId } from "@/lib/verify";
import type { DeviceDetail, Reading } from "@/lib/types";

/* ---------- search ---------- */

type Place = Locality & { code?: string };

function LocalitySearch({ areas, onPick, current }: { areas: Area[]; onPick: (l: Place) => void; current?: string }) {
  const { devices } = useLive();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [geoErr, setGeoErr] = useState("");

  // Placeholder from the data: the first real device and its cell.
  const example = devices.find((d) => !d.simulated && d.last_reading) ?? devices[0];
  const placeholder = example
    ? `Search an area, device or geohash: ${areas[0]?.name ?? ""}, ${example.ens.split(".")[0]}, ${example.geohash}`
    : "Search an area, device or geohash";

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const ars = areas.filter((a) => a.name.toLowerCase().includes(s)).map((a) => ({ label: a.name, hint: "area", l: a as Place }));
    const locs = LOCALITIES.filter((l) => l.name.toLowerCase().includes(s) && !areas.some((a) => a.name === l.name)).map((l) => ({ label: l.name, hint: "place", l: l as Place }));
    const devs = devices
      .filter((d) => d.ens.includes(s) || d.geohash.startsWith(s))
      .map((d) => ({ label: d.ens, hint: `cell ${d.geohash}`, l: { name: d.ens, ...devicePos(d) } as Place }));
    const cell = isGeohash(s) ? [{ label: s, hint: "geohash cell", l: { name: `cell ${s}`, ...decode(s) } as Place }] : [];
    return [...ars, ...devs, ...cell, ...locs].slice(0, 8);
  }, [q, devices, areas]);

  const nearMe = () => {
    setGeoErr("");
    if (!navigator.geolocation) return setGeoErr("Location isn't available in this browser.");
    navigator.geolocation.getCurrentPosition(
      (p) => onPick({ name: "Near you", lat: p.coords.latitude, lon: p.coords.longitude }),
      () => setGeoErr("Couldn't get your location. Pick an area instead."),
      { timeout: 8000 },
    );
  };

  const field = "rounded-xl border border-line bg-surface shadow-sm";
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
            placeholder={placeholder}
            aria-label="Search area, device or geohash"
            className={`${field} w-full px-4 py-2.5 text-sm text-ink placeholder:text-muted outline-none focus:border-ink/40`}
          />
          {open && matches.length > 0 && (
            <ul className={`${field} absolute z-[60] mt-1.5 w-full overflow-hidden shadow-xl`}>
              {matches.map((m) => (
                <li key={m.hint + m.label}>
                  <button
                    type="button"
                    onMouseDown={() => { onPick(m.l); setQ(""); setOpen(false); }}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-bg"
                  >
                    <span>{m.label}</span>
                    <span className="text-xs text-muted">{m.hint}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button type="button" onClick={nearMe} className={`${field} px-4 text-sm font-medium hover:border-ink/40`}>
          Near me
        </button>
      </div>
      {geoErr && <p className="mt-1 text-xs font-semibold text-red-300">{geoErr}</p>}
      {areas.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted">Areas with nodes:</span>
          {areas.map((a) => (
            <button
              key={a.name}
              type="button"
              onClick={() => onPick(a)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                current === a.name ? "border-ink bg-ink text-ground" : "border-line bg-surface hover:border-ink/40"
              }`}
            >
              {a.name} <span className="opacity-70">· {a.real} real{a.simulated ? ` · ${a.simulated} sim` : ""}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- area card ---------- */

function AreaCard({ place }: { place: Place }) {
  const { devices } = useLive();
  const st = areaStats(devices, place);
  const style = st.aqi != null ? aqiStyle(st.aqi) : null;
  const sample = st.used.map((d) => d.last_reading).find((r): r is Reading => !!r);
  const real = st.used.filter((d) => !d.simulated).length;
  const sim = st.used.length - real;
  return (
    <div className="card overflow-hidden">
      <div className="flex items-stretch">
        <div
          className="flex w-32 shrink-0 flex-col items-center justify-center p-4 text-center sm:w-40"
          style={{ background: style?.bg ?? "var(--color-line)", color: style?.fg ?? "var(--color-muted)" }}
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider opacity-90">AQI</div>
          <div className="mt-0.5 text-5xl font-black leading-none tabular-nums sm:text-6xl">{st.aqi ?? "–"}</div>
          <div className="mt-1.5 text-sm font-bold">{style?.cat ?? "No data"}</div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center p-4 sm:p-5">
          <div className="text-xs text-muted">Live air in</div>
          <div className="truncate text-xl font-bold sm:text-2xl">{place.name}</div>
          {st.pm25_x10 != null && st.pm10_x10 != null ? (
            <>
              <div className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
                <span><b className="text-2xl font-black tabular-nums">{x10(st.pm25_x10)}</b> <span className="text-xs text-muted">µg/m³ PM2.5</span></span>
                <span><b className="text-lg font-bold tabular-nums">{x10(st.pm10_x10)}</b> <span className="text-xs text-muted">µg/m³ PM10</span></span>
              </div>
              <div className="mt-1 text-sm">
                <b>{(st.pm25_x10 / 10 / WHO_PM25).toFixed(1)}×</b> the WHO 24-hour PM2.5 guideline
              </div>
              {style && <p className="mt-1 text-xs text-muted">{style.advice}</p>}
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">
              No active devices within {RADIUS_KM} km. <Link href="/register" className="font-medium text-chain hover:underline">Register one</Link>.
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line bg-chain-soft px-4 py-2 text-xs font-medium text-chain">
        <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <path d="M8 1.5l5.5 2v4c0 3.4-2.3 6-5.5 7-3.2-1-5.5-3.6-5.5-7v-4z" />
        </svg>
        <span>
          Median of <b>{st.used.length}</b> signed device{st.used.length === 1 ? "" : "s"} within {RADIUS_KM} km
          {st.used.length > 0 && <> ({real} real · {sim} simulated)</>}
        </span>
        {st.excluded.length > 0 && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-300">{st.excluded.length} flagged/slashed excluded</span>
        )}
        {sample && (
          <Link href={`/records/${recordId(sample)}`} className="rounded-full hover:opacity-80" title="Open this reading and check it yourself">
            <VerifyBadge reading={sample} />
          </Link>
        )}
        {st.latestEpoch && <span className="ml-auto text-ink/60">updated {time(st.latestEpoch)}</span>}
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
  const sinceOpen = events.filter((e) => e.type === "reading").length;
  // Nonces count up from 1 per device key, so their sum is every signed reading accepted so far.
  const accepted = devices.reduce((a, d) => a + (d.last_reading?.nonce ?? 0), 0);
  const n = nodeCounts(devices);
  const tiles = [
    { label: "Real devices reporting", value: n.real, sub: `+ ${n.simulated} simulated · ${active} active of ${devices.length}` },
    { label: "Signed readings accepted", value: accepted.toLocaleString("en-IN"), sub: `${sinceOpen} since you opened this page` },
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
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${d.status === "active" ? "bg-green-500/15 text-green-300" : d.status === "flagged" ? "bg-amber-400/15 text-amber-300" : "bg-red-500/15 text-red-300"}`}>
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
        <Link href={`/devices/${d.ens}`} className="flex-1 rounded-lg bg-ink px-3 py-2 text-center font-medium text-ground">Device page</Link>
        {r && <Link href={`/records/${recordId(r)}`} className="flex-1 rounded-lg border border-chain/40 px-3 py-2 text-center font-medium text-chain">Arkiv record</Link>}
      </div>
    </div>
  );
}

/* ---------- ranking ---------- */

function Ranking({ areas, onPick }: { areas: Area[]; onPick: (l: Place) => void }) {
  const { devices } = useLive();
  const rows = areas.map((l) => ({ l, st: areaStats(devices, l) }))
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
  // Areas follow the devices; the default is the one with the most reporting real devices.
  const areas = useMemo(() => deriveAreas(devices), [devices]);
  const [picked, setPicked] = useState<Place | null>(null);
  const place: Place | null = picked ?? areas[0] ?? null;
  const [selected, setSelected] = useState<string | null>(null);
  const [fly, setFly] = useState<FlyTarget | null>(null);

  const pick = (l: Place) => {
    setPicked(l);
    setFly({ lat: l.lat, lon: l.lon, zoom: 14, key: Date.now() });
    const st = areaStats(devices, l);
    setSelected(st.used.find((d) => !d.simulated)?.device ?? st.used[0]?.device ?? null);
  };

  const st = place ? areaStats(devices, place) : null;
  const style = st?.aqi != null ? aqiStyle(st.aqi) : null;
  const headline = place ? `${place.name}'s air right now, signed and cross-checked` : "No nodes yet";

  return (
    <main className="mx-auto max-w-7xl px-4 pb-8">
      {/* Small AQI-coloured accent: the only colour the category gets on the dashboard. */}
      <div className="h-1.5 rounded-b-full transition-colors duration-700" style={{ background: style?.bg ?? "var(--color-line)" }} aria-hidden />
      <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_minmax(0,520px)] lg:items-start">
        <div className="order-2 lg:order-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{headline}</h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted">
            Every reading is signed on the sensor, checked against its neighbours and backed by stake.{" "}
            <Link href="/" className="font-medium text-chain hover:underline">Why that matters</Link>
          </p>
          <div className="mt-4">
            <LocalitySearch areas={areas} onPick={pick} current={place?.name} />
          </div>
        </div>
        <div className="order-1 lg:order-2">
          {place ? <AreaCard place={place} /> : <div className="card p-6 text-sm text-muted">No devices registered yet.</div>}
        </div>
      </section>

      <section className="mt-8">
        <Stats />
      </section>

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Sensor map</h2>
            <p className="text-xs text-muted">Each circle is a device, placed in its 6-character geohash cell (no GPS is published). Simulated neighbours have a dashed ring. Click one for details.</p>
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
          <h2 className="mb-3 font-semibold">Areas, worst to best</h2>
          <Ranking areas={areas} onPick={pick} />
          <p className="mt-3 text-[11px] text-muted">Median of active devices within {RADIUS_KM} km of each area centre.</p>
        </div>
      </section>
    </main>
  );
}
