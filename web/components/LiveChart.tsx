"use client";
// PM2.5 / PM10 over time. One y-axis (both µg/m³), crosshair + tooltip, WHO guideline,
// amber rings where the verifier flagged the device. Palette validated with the dataviz checker.
import { useEffect, useMemo, useRef, useState } from "react";
import { WHO_PM25 } from "@/lib/aqi";
import type { Flag, Reading } from "@/lib/types";

const SERIES = [
  { key: "pm25_x10", label: "PM2.5", color: "#0891b2" },
  { key: "pm10_x10", label: "PM10", color: "#c2410c" },
] as const;

const fmtTime = (e: number) =>
  new Date(e * 1000).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });

function niceMax(v: number) {
  const step = v > 200 ? 100 : v > 100 ? 50 : 20;
  return Math.ceil(v / step) * step;
}

export function LiveChart({ readings, flags = [], height = 260, compact = false }: {
  readings: Reading[];
  flags?: Flag[];
  height?: number;
  compact?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pad = compact ? { l: 30, r: 10, t: 8, b: 18 } : { l: 40, r: 56, t: 12, b: 26 };
  const data = readings;
  const { x, y, yMax, ticks } = useMemo(() => {
    const t0 = data[0]?.epoch ?? 0;
    const t1 = data[data.length - 1]?.epoch ?? 1;
    const max = niceMax(Math.max(WHO_PM25 * 2, ...data.map((r) => r.pm10_x10 / 10)));
    const iw = width - pad.l - pad.r;
    const ih = height - pad.t - pad.b;
    const nt = compact ? 3 : 5;
    return {
      x: (e: number) => pad.l + (t1 === t0 ? iw : ((e - t0) / (t1 - t0)) * iw),
      y: (v: number) => pad.t + ih - (v / max) * ih,
      yMax: max,
      ticks: Array.from({ length: nt }, (_, i) => Math.round((max / (nt - 1)) * i)),
    };
  }, [data, width, height, pad.l, pad.r, pad.t, pad.b, compact]);

  if (!data.length) return <div className="flex items-center justify-center text-sm text-muted" style={{ height }}>No readings yet</div>;

  const path = (k: (typeof SERIES)[number]["key"]) => data.map((r, i) => `${i ? "L" : "M"}${x(r.epoch).toFixed(1)},${y(r[k] / 10).toFixed(1)}`).join("");
  const flagged = flags.map((f) => data.find((r) => r.epoch === f.epoch)).filter((r): r is Reading => !!r);
  const last = data[data.length - 1];
  const h = hover != null ? data[hover] : null;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    let best = 0;
    for (let i = 1; i < data.length; i++) if (Math.abs(x(data[i].epoch) - px) < Math.abs(x(data[best].epoch) - px)) best = i;
    setHover(best);
  };

  const xTicks = compact ? [data[0], last] : [0, 0.25, 0.5, 0.75, 1].map((f) => data[Math.round(f * (data.length - 1))]);

  return (
    <div ref={box} className="relative w-full">
      {!compact && (
        <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-muted">
          {SERIES.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded" style={{ background: s.color }} /> {s.label} µg/m³
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 border-t border-dashed border-muted" /> WHO 24-h PM2.5 guideline ({WHO_PM25})
          </span>
          {flagged.length > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border-2 border-amber-500" /> flagged by verifier
            </span>
          )}
        </div>
      )}
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        className="block touch-none select-none"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={`PM2.5 and PM10 over ${data.length} readings; latest PM2.5 ${(last.pm25_x10 / 10).toFixed(1)} µg/m³`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke="#e2e6e3" strokeWidth={1} />
            <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill="#5d6b65">{t}</text>
          </g>
        ))}
        {xTicks.map((r, i) => (
          <text key={i} x={x(r.epoch)} y={height - 6} textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"} fontSize={10} fill="#5d6b65">
            {fmtTime(r.epoch)}
          </text>
        ))}
        <line x1={pad.l} x2={width - pad.r} y1={y(WHO_PM25)} y2={y(WHO_PM25)} stroke="#5d6b65" strokeDasharray="3 4" strokeWidth={1} />
        {SERIES.map((s) => (
          <path key={s.key} d={path(s.key)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {flagged.map((r) => (
          <circle key={r.nonce} cx={x(r.epoch)} cy={y(r.pm25_x10 / 10)} r={5} fill="#fff" stroke="#f59e0b" strokeWidth={2} />
        ))}
        {/* direct labels at the line ends */}
        {!compact &&
          SERIES.map((s) => (
            <text key={s.key} x={x(last.epoch) + 6} y={y(last[s.key] / 10) + 3} fontSize={10} fill="#13201b" fontWeight={600}>
              {s.label}
            </text>
          ))}
        {h && (
          <g pointerEvents="none">
            <line x1={x(h.epoch)} x2={x(h.epoch)} y1={pad.t} y2={height - pad.b} stroke="#13201b" strokeOpacity={0.3} />
            {SERIES.map((s) => (
              <circle key={s.key} cx={x(h.epoch)} cy={y(h[s.key] / 10)} r={4} fill={s.color} stroke="#fff" strokeWidth={2} />
            ))}
          </g>
        )}
      </svg>
      {h && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-md"
          style={{
            left: `${(x(h.epoch) / width) * 100}%`,
            top: compact ? 0 : 28,
            transform: x(h.epoch) > width * 0.7 ? "translateX(calc(-100% - 10px))" : "translateX(10px)",
          }}
        >
          <div className="font-medium">{fmtTime(h.epoch)} IST · nonce {h.nonce}</div>
          {SERIES.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.label} <span className="ml-auto pl-3 font-semibold tabular-nums">{(h[s.key] / 10).toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}
      <span className="sr-only">Max of y-axis {yMax} µg/m³</span>
    </div>
  );
}
