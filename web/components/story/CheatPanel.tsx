"use client";
// Chapter 4 "Try to cheat": the real nodes of the live area (eyes, live states), the official
// station in gold, and a new node — yours — judged with the SPEC rule against the median of its
// neighbours: flagged if more than 50% AND more than 25 µg/m³ away.
import { useMemo, useState } from "react";
import { decode } from "@/lib/geohash";
import { useNow } from "@/lib/story/hooks";
import { STALE_S, type useStoryArea } from "@/lib/story/live";
import { ABS_UG, band, isOutlier, median, REL } from "@/lib/story/rule";
import type { Device } from "@/lib/types";
import { Art } from "./Art";
import { Eye, type EyeState } from "./Eye";

type Live = ReturnType<typeof useStoryArea>;
type Mode = "honest" | "spray" | "incense" | "off" | "custom";

function stateOf(d: Device, now: number): EyeState {
  if (d.status === "slashed") return "slashed";
  if (d.status === "flagged") return "flagged";
  const fresh = !!d.last_reading && (now === 0 || now - d.last_reading.epoch < STALE_S);
  if (!fresh) return "half";
  return d.simulated ? "sim" : "open";
}

export function CheatPanel({ live }: { live: Live }) {
  const now = useNow();
  // Nodes that have ever reported (a registered-but-silent test key adds nothing to the picture).
  const nodes = useMemo(() => (live.area?.devices ?? []).filter((d) => d.last_reading), [live.area]);
  const states = nodes.map((d) => stateOf(d, now));
  const peers = nodes.filter((_, i) => states[i] === "open" || states[i] === "sim");
  const m = peers.length ? median(peers.map((d) => d.last_reading!.pm25_x10 / 10)) : null;
  const stationUg = live.station?.pm25_x10 != null ? live.station.pm25_x10 / 10 : null;

  const vmax = useMemo(() => Math.ceil(Math.max(150, (m ?? 50) * 3, (stationUg ?? 0) * 2) / 50) * 50, [m, stationUg]);
  const [mode, setMode] = useState<Mode>("honest");
  const [custom, setCustom] = useState(0);
  const mine = m == null ? null : mode === "honest" ? m : mode === "spray" ? Math.max(0, Math.round(m * 0.15)) : mode === "incense" ? Math.min(vmax, Math.round(m * 3 + 60)) : mode === "custom" ? custom : null;
  const flagged = mine != null && m != null && isOutlier(mine, m);
  const myState: EyeState = mode === "off" ? "closed" : flagged ? "flagged" : "open";
  const [lo, hi] = m != null ? band(m) : [0, 0];

  // Ring layout: each node keeps its real compass direction from the area centre (from its
  // geohash cell), evenly spaced so labels never collide; your node joins in the middle.
  const layout = useMemo(() => {
    if (!nodes.length) return { pts: [] as { x: number; y: number }[], me: { x: 50, y: 50 } };
    const cs = nodes.map((d) => decode(d.geohash));
    const c0 = { lat: cs.reduce((a, c) => a + c.lat, 0) / cs.length, lon: cs.reduce((a, c) => a + c.lon, 0) / cs.length };
    const order = nodes
      .map((d, i) => ({ i, a: Math.atan2(cs[i].lat - c0.lat, cs[i].lon - c0.lon) + i * 1e-6 }))
      .sort((p, q) => p.a - q.a);
    const pts: { x: number; y: number }[] = new Array(nodes.length);
    order.forEach(({ i }, k) => {
      const a = (2 * Math.PI * k) / nodes.length - Math.PI / 2;
      pts[i] = { x: 50 + 36 * Math.cos(a), y: 50 + 34 * Math.sin(a) };
    });
    return { pts, me: { x: 50, y: 50 } };
  }, [nodes]);

  if (!nodes.length || m == null) return <p className="text-kohl/70">Waiting for live nodes to cross-check against…</p>;
  const pct = (v: number) => `${Math.min(100, (v / vmax) * 100)}%`;
  const diff = mine != null ? Math.abs(mine - m) : 0;

  return (
    <div className="mt-4">
      {/* Eye map of the live area */}
      <div className="relative h-56 overflow-hidden rounded border border-maroon/30 bg-[#fbf1da] sm:h-64" role="group" aria-label={`Nodes around ${live.area?.name}`}>
        <div className="absolute left-2 top-1.5 text-sm font-semibold text-kohl/60">{live.area?.name} · live nodes</div>
        {nodes.map((d, i) => (
          <div key={d.device} className="absolute -translate-x-1/2 -translate-y-1/2 text-center" style={{ left: `${layout.pts[i].x}%`, top: `${layout.pts[i].y}%` }}>
            <Eye state={states[i]} size={40} delay={(i * 1.37) % 6} title={`${d.ens}: ${states[i]}`} />
            <div className="mt-0.5 whitespace-nowrap text-xs leading-tight text-kohl/70">
              {d.ens.split(".")[0]}
              {d.simulated && <span className="text-olive"> (sim)</span>}
            </div>
          </div>
        ))}
        <div className="absolute -translate-x-1/2 -translate-y-1/2 text-center" style={{ left: `${layout.me.x}%`, top: `${layout.me.y}%` }}>
          <div className={`rounded-full p-1 ${flagged ? "bg-vermilion/20" : "bg-saffron/40"}`}>
            <Eye state={myState} size={52} delay={0.8} title={`your node: ${myState}`} />
          </div>
          <div className="text-sm font-bold">your node</div>
        </div>
      </div>

      {/* Value strip: neighbours, median, allowed band, official station */}
      <div className="mt-3">
        <div className="relative h-14 rounded border border-maroon/30 bg-[#fbf1da]">
          <div className="absolute inset-y-0 bg-leaf/25" style={{ left: pct(lo), width: `calc(${pct(hi)} - ${pct(lo)})` }} title="not flagged inside this band" />
          {peers.map((d) => (
            <span key={d.device} className="absolute top-2 h-3 w-1 -translate-x-1/2 rounded bg-olive" style={{ left: pct(d.last_reading!.pm25_x10 / 10) }} title={`${d.ens} ${d.last_reading!.pm25_x10 / 10}`} />
          ))}
          <span className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-kohl" style={{ left: pct(m) }} />
          <span className="absolute -top-0.5 -translate-x-1/2 whitespace-nowrap text-xs font-bold" style={{ left: pct(m) }}>median {m.toFixed(1)}</span>
          {stationUg != null && (
            <span className="absolute bottom-0.5 -translate-x-1/2" style={{ left: pct(stationUg) }} title={`${live.station?.name}: ${stationUg} µg/m³`}>
              <Eye state="official" size={22} blink={false} />
            </span>
          )}
          {mine != null && (
            <span className={`absolute bottom-1 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-kohl ${flagged ? "bg-vermilion" : "bg-saffron"} transition-[left] duration-300`} style={{ left: pct(mine) }} title={`your node ${mine}`} />
          )}
        </div>
        <div className="mt-0.5 flex justify-between text-xs text-kohl/60"><span>0</span><span>PM2.5 µg/m³</span><span>{vmax}</span></div>
      </div>

      {/* Controls */}
      <div className="mt-3 flex flex-wrap gap-2">
        {([
          ["honest", "Honest reading", "vintage-folk-art-aq-sensor"],
          ["spray", "Spray water", "folk-art-water-sprinkler-truck"],
          ["incense", "Burn incense", "folk-art-incense-holder-with-curling-smoke"],
          ["off", "Switch it off", null],
        ] as const).map(([k, label, icon]) => (
          <button
            key={k}
            type="button"
            onClick={() => setMode(k)}
            aria-pressed={mode === k}
            className={`inline-flex items-center gap-2 rounded-full border-2 py-1.5 pl-2 pr-3.5 text-base font-bold transition-colors ${mode === k ? "border-kohl bg-kohl text-cream" : "border-kohl/40 hover:border-kohl"}`}
          >
            {icon ? <Art name={icon} small className="h-7 w-auto" /> : <svg viewBox="0 0 24 24" className="h-7 w-7 p-1" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M12 3v8" /><path d="M6.3 7.5a8 8 0 1 0 11.4 0" /></svg>}
            {label}
          </button>
        ))}
      </div>
      <label className="mt-3 flex items-center gap-3 text-base">
        <span className="shrink-0 font-semibold">Or set it:</span>
        <input
          type="range"
          min={0}
          max={vmax}
          step={1}
          value={mine ?? 0}
          disabled={mode === "off"}
          onChange={(e) => {
            setCustom(Number(e.target.value));
            setMode("custom");
          }}
          className="w-full accent-vermilion"
          aria-label="Your node's PM2.5 reading"
        />
        <span className="w-20 shrink-0 text-right font-mono">{mine != null ? `${mine.toFixed(0)} µg` : "off"}</span>
      </label>

      <div aria-live="polite" className={`mt-3 min-h-[4.75rem] rounded border-2 p-3 text-[1.05rem] leading-snug ${mode === "off" ? "border-olive bg-olive/10" : flagged ? "border-vermilion bg-vermilion/10" : "border-leaf bg-leaf/15"}`}>
        {mode === "off" ? (
          <>
            <b>Switched off.</b> Your eye closes, the {peers.length} neighbours keep the map alive, and the missing epochs are recorded publicly.
            Silence is visible.
          </>
        ) : flagged ? (
          <>
            <b className="text-vermilion">Flagged.</b> {mine!.toFixed(0)} is {diff.toFixed(0)} µg/m³ from the median {m.toFixed(1)}: more than {REL * 100}% (
            {(REL * m).toFixed(1)}) <i>and</i> more than {ABS_UG} µg/m³. Three flags in a row and the stake is gone.
          </>
        ) : (
          <>
            <b className="text-leaf">Agrees with its neighbours.</b> {mine!.toFixed(0)} is {diff.toFixed(0)} µg/m³ from the median {m.toFixed(1)}, inside the band
            ({lo.toFixed(0)}–{hi.toFixed(0)}). That&apos;s a unit of honest work.
          </>
        )}
      </div>
      <p className="mt-2 text-sm text-kohl/70">
        Rule: flagged if more than {REL * 100}% <b>and</b> more than {ABS_UG} µg/m³ away from the neighbourhood median.
        {live.station && stationUg != null && (
          <> Official reference: {live.station.name}, {stationUg.toFixed(1)} µg/m³ (gold eye, via OpenAQ).</>
        )}{" "}
        Simulated neighbours are labelled (sim).
      </p>
    </div>
  );
}
