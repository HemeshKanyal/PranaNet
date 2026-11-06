"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AqiChip, AqiLegend } from "./Aqi";
import { LiveChart } from "./LiveChart";
import { LiveFeed } from "./LiveFeed";
import { useLive } from "./LiveProvider";
import { SensorMap, type FlyTarget } from "./MapLoader";
import { VerifyBadge } from "./VerifyBadge";
import { aqi, aqiStyle, WHO_PM25, type AqiCategory } from "@/lib/aqi";
import { areaStats, devicePos, LOCALITIES, nearestLocality, RADIUS_KM, type Locality } from "@/lib/area";
import { ensUrl } from "@/lib/chain";
import { eth, time, x10 } from "@/lib/format";
import { isGeohash, decode } from "@/lib/geohash";
import { recordId } from "@/lib/verify";
import type { DeviceDetail, Reading } from "@/lib/types";

/* ---------- CPCB dynamic messages and backgrounds ---------- */

const ALL_CATEGORIES: AqiCategory[] = [
  "Good",
  "Satisfactory",
  "Moderate",
  "Poor",
  "Very Poor",
  "Severe",
];

const CPCB_HEADLINES: Record<AqiCategory, string> = {
  Good: "A good day to be outside",
  Satisfactory: "The air is reasonably comfortable",
  Moderate: "Give your outdoor plans a little thought",
  Poor: "Take care when spending time outdoors",
  "Very Poor": "Reduce prolonged outdoor exposure",
  Severe: "The air needs immediate attention",
};

const CPCB_BG: Record<AqiCategory, string> = {
  Good: "/bg/good.png",
  Satisfactory: "/bg/satisfactory.png",
  Moderate: "/bg/moderate.png",
  Poor: "/bg/poor.png",
  "Very Poor": "/bg/very poor.png",
  Severe: "/bg/severe.png",
};

function getCpcbCategory(aqiVal: number | null): AqiCategory {
  if (aqiVal == null) return "Satisfactory";
  if (aqiVal <= 50) return "Good";
  if (aqiVal <= 100) return "Satisfactory";
  if (aqiVal <= 200) return "Moderate";
  if (aqiVal <= 300) return "Poor";
  if (aqiVal <= 400) return "Very Poor";
  return "Severe";
}

/* ---------- search ---------- */

function LocalitySearch({
  onPick,
  currentPlaceName,
}: {
  onPick: (l: Locality) => void;
  currentPlaceName?: string;
}) {
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
            className="w-full rounded-xl border border-black/20 bg-white/55 backdrop-blur-[90px] backdrop-brightness-125 backdrop-saturate-150 px-4 py-3 text-sm font-semibold text-black placeholder:text-black/70 shadow-md outline-none transition-colors focus:bg-white/70 focus:border-black/40"
          />
          {open && matches.length > 0 && (
            <ul className="absolute z-[60] mt-1.5 w-full overflow-hidden rounded-xl border border-black/20 bg-white/55 backdrop-blur-[90px] backdrop-brightness-125 backdrop-saturate-150 shadow-2xl">
              {matches.map((m) => (
                <li key={m.hint + m.label}>
                  <button
                    type="button"
                    onMouseDown={() => { onPick(m.l); setQ(""); setOpen(false); }}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-medium text-black hover:bg-white/60"
                  >
                    <span>{m.label}</span>
                    <span className="text-xs text-black/60">{m.hint}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={nearMe}
          className="rounded-xl border border-black/20 bg-white/55 backdrop-blur-[90px] backdrop-brightness-125 backdrop-saturate-150 px-4 text-sm font-semibold text-black shadow-md hover:bg-white/70 hover:border-black/35 transition-colors"
        >
          Near me
        </button>
      </div>
      {geoErr && <p className="mt-1 text-xs font-semibold text-red-700">{geoErr}</p>}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {LOCALITIES.map((l) => {
          const isSelected = currentPlaceName === l.name;
          return (
            <button
              key={l.name}
              type="button"
              onClick={() => onPick(l)}
              className={`rounded-full border px-3.5 py-1.5 text-xs shadow-sm backdrop-blur-[90px] backdrop-brightness-125 backdrop-saturate-150 transition-all ${
                isSelected
                  ? "border-black bg-black text-white font-bold shadow-md"
                  : "border-black/20 bg-white/55 text-black font-semibold hover:bg-white/70 hover:border-black/35"
              }`}
            >
              {l.name}
            </button>
          );
        })}
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
    // No .card (solid white) and no backdrop-filter on this wrapper: either one stops the panels
    // inside from blurring the hero image behind the card.
    <div className="overflow-hidden rounded-3xl border border-white/80 shadow-2xl">
      <div className="flex items-stretch">
        <div
          className="flex w-44 sm:w-48 xl:w-52 shrink-0 flex-col items-center justify-center p-6 sm:p-7 text-center transition-colors duration-500"
          style={{ background: style?.bg ?? "#e2e6e3", color: style?.fg ?? "#13201b" }}
        >
          <div className="text-xs sm:text-sm font-semibold uppercase tracking-wider opacity-90">AQI</div>
          <div className="text-6xl sm:text-7xl xl:text-8xl font-black tabular-nums leading-none mt-1">{st.aqi ?? "–"}</div>
          <div className="mt-2 text-base sm:text-lg font-bold">{style?.cat ?? "No data"}</div>
        </div>
        <div className="min-w-0 flex-1 p-6 sm:p-7 bg-white/55 backdrop-blur-[90px] backdrop-brightness-125 backdrop-saturate-150 flex flex-col justify-center">
          <div className="text-xs sm:text-sm font-medium text-ink/70">Live air in</div>
          <div className="truncate text-2xl sm:text-3xl font-bold text-ink mt-0.5">{place.name}</div>
          {st.pm25_x10 != null ? (
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl sm:text-5xl font-black tabular-nums text-ink">{x10(st.pm25_x10)}</span>
                <span className="text-base sm:text-lg font-medium text-ink/70">µg/m³ PM2.5</span>
              </div>
              <div className="mt-2 text-base sm:text-lg text-ink/90 font-normal">
                <b className="font-bold">{(st.pm25_x10 / 10 / WHO_PM25).toFixed(1)}×</b> the WHO 24-hour guideline
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink/70 font-medium">No active devices within {RADIUS_KM} km yet. Register one.</p>
          )}
        </div>
      </div>
      {/* Verification strip: indigo-tinted glass, same family as the card */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-white/60 bg-chain-soft/75 px-5 py-2.5 text-xs font-medium text-chain backdrop-blur-[90px] backdrop-brightness-125 backdrop-saturate-150">
        <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <path d="M8 1.5l5.5 2v4c0 3.4-2.3 6-5.5 7-3.2-1-5.5-3.6-5.5-7v-4z" />
        </svg>
        <span>
          Median of <b className="font-bold">{st.used.length}</b> signed device{st.used.length === 1 ? "" : "s"} within {RADIUS_KM} km
        </span>
        {st.excluded.length > 0 && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-900">{st.excluded.length} flagged/slashed excluded</span>
        )}
        {sample && (
          <Link href={`/records/${recordId(sample)}`} className="rounded-full transition-opacity hover:opacity-80" title="Open this reading and check it yourself">
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

  const st = areaStats(devices, place);
  const currentCat = getCpcbCategory(st.aqi);
  const headline = CPCB_HEADLINES[currentCat];

  return (
    <main className="w-full">
      {/* Hero section */}
      <div className="p-2">
        <section className="relative w-full h-[calc(100vh-16px)] min-h-[640px] overflow-hidden rounded-2xl border border-line/60 shadow-sm flex flex-col justify-center">
          {/* Background Images with 2s transition */}
          <div className="absolute inset-0 select-none pointer-events-none overflow-hidden">
            {ALL_CATEGORIES.map((cat) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={cat}
                src={CPCB_BG[cat]}
                alt=""
                aria-hidden="true"
                className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-[2000ms] ease-in-out ${
                  currentCat === cat ? "opacity-100 z-10" : "opacity-0 z-0"
                }`}
              />
            ))}
          </div>

          {/* Foreground content: Left (Headline + Search), Middle (Character space), Right (Live Air Card) */}
          <div className="relative z-10 mx-auto flex h-full w-full max-w-[1580px] flex-col justify-between p-6 sm:p-10 lg:flex-row lg:items-center lg:gap-12 xl:px-14">
            {/* Left Section: Shifted more left to occupy larger area with bigger bold black headline */}
            <div className="w-full lg:max-w-xl xl:max-w-2xl">
              <div key={`headline-${place.name}-${currentCat}`} className="animate-drop-in">
                <h1 className="text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl xl:text-8xl leading-[0.98] text-white [text-shadow:-7px_30px_25px_rgba(0,0,0,0.65)]">
                  {headline}
                </h1>
                <p className="mt-5 max-w-xl rounded-2xl border border-black/20 bg-black/5 px-5 py-4 text-base font-bold leading-relaxed text-black/90 shadow-md backdrop-blur-[90px] backdrop-brightness-125 backdrop-saturate-150 sm:text-lg lg:text-xl">
                  Every reading is signed on the sensor, checked against its neighbours, and backed by stake. Search a
                  neighbourhood to see air you can verify yourself.
                </p>
              </div>
              <div className="mt-6 animate-drop-in-delay-1">
                <LocalitySearch onPick={pick} currentPlaceName={place.name} />
              </div>
            </div>

            {/* Middle Section: Character is visible in the background image */}
            <div className="hidden lg:block lg:flex-1 min-w-[80px] xl:min-w-[140px] pointer-events-none self-stretch" aria-hidden="true" />

            {/* Right Section: Bigger Live Air Card with blurred white section */}
            <div className="w-full lg:max-w-lg xl:max-w-xl flex lg:justify-end">
              <div key={`card-${place.name}-${currentCat}`} className="w-full animate-drop-in-delay-2">
                <AreaCard place={place} />
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
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
      </div>
    </main>
  );
}
