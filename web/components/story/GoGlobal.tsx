"use client";
// Chapter 8: start local, go global. An orthographic globe (graticule only, folk palette) that
// turns and zooms from BKC to Mumbai's construction sites, to Delhi NCR, to any city.
import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/story/hooks";
import type { useStoryArea } from "@/lib/story/live";
import { Stage } from "./Stage";

type Live = ReturnType<typeof useStoryArea>;
type View = { lon: number; lat: number; scale: number };

const MUMBAI = { lat: 19.07, lon: 72.88 };
const DELHI = { lat: 28.61, lon: 77.21 };
const CITIES = [
  ["Delhi", 28.61, 77.21], ["Mumbai", 19.07, 72.88], ["Xi'an", 34.34, 108.94], ["Changsha", 28.23, 112.94],
  ["Lahore", 31.55, 74.34], ["Dhaka", 23.81, 90.41], ["Jakarta", -6.2, 106.85], ["Lagos", 6.52, 3.38],
  ["Cairo", 30.04, 31.24], ["Mexico City", 19.43, -99.13], ["São Paulo", -23.55, -46.63], ["Los Angeles", 34.05, -118.24],
  ["Warsaw", 52.23, 21.01], ["Beijing", 39.9, 116.4], ["Kolkata", 22.57, 88.36], ["Karachi", 24.86, 67.0],
] as const;

const STEPS: { title: string; body: string; view: View }[] = [
  { title: "BKC, Mumbai: live now", body: "", view: { lon: 72.88, lat: 19.07, scale: 5200 } },
  { title: "Mumbai's 3,166 construction sites", body: "Dust monitoring there is already mandatory, so there are paying customers on day one.", view: { lon: 72.88, lat: 19.1, scale: 1500 } },
  { title: "Delhi NCR, where this started", body: "The city where the readings stopped being believed.", view: { lon: 76, lat: 24, scale: 520 } },
  { title: "Any city with a dispute about its air", body: "China, Delhi and others show the problem is everywhere.", view: { lon: 60, lat: 20, scale: 150 } },
];

// Deterministic scatter for the 3,166 sites (no Math.random: same on server and client).
function sites(n: number) {
  const out: [number, number][] = [];
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    const r = Math.sqrt(rnd()) * 0.22, a = rnd() * Math.PI * 2;
    out.push([MUMBAI.lat + 0.02 + r * Math.sin(a) * 1.3, MUMBAI.lon + 0.01 + r * Math.cos(a) * 0.6]);
  }
  return out;
}

const R = Math.PI / 180;
function project(v: View, lat: number, lon: number, cx: number, cy: number): [number, number] | null {
  const φ = lat * R, λ = lon * R, φ0 = v.lat * R, λ0 = v.lon * R;
  const cosc = Math.sin(φ0) * Math.sin(φ) + Math.cos(φ0) * Math.cos(φ) * Math.cos(λ - λ0);
  if (cosc < 0) return null;
  return [cx + v.scale * Math.cos(φ) * Math.sin(λ - λ0), cy - v.scale * (Math.cos(φ0) * Math.sin(φ) - Math.sin(φ0) * Math.cos(φ) * Math.cos(λ - λ0))];
}

export function GoGlobal({ live }: { live: Live }) {
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  const [view, setView] = useState<View>(STEPS[0].view);
  const viewRef = useRef(view);
  const stepEls = useRef<(HTMLLIElement | null)[]>([]);
  const SITES = useMemo(() => sites(3166), []);

  // Step follows scroll (the list item crossing the middle of the viewport).
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setStep(Number((e.target as HTMLElement).dataset.step))),
      { rootMargin: "-45% 0px -45% 0px" },
    );
    stepEls.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  // Animate the globe to the step's view (log-interpolated zoom).
  useEffect(() => {
    const from = viewRef.current, to = STEPS[step].view;
    if (reduced) {
      viewRef.current = to;
      setView(to);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 1400);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      const v = {
        lon: from.lon + (to.lon - from.lon) * e,
        lat: from.lat + (to.lat - from.lat) * e,
        scale: Math.exp(Math.log(from.scale) + (Math.log(to.scale) - Math.log(from.scale)) * e),
      };
      viewRef.current = v;
      setView(v);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step, reduced]);

  const W = 400, H = 400, cx = 200, cy = 200;
  const graticule = useMemo(() => {
    const lines: string[] = [];
    const path = (pts: ([number, number] | null)[]) => {
      let d = "", pen = false;
      for (const p of pts) {
        if (!p) { pen = false; continue; }
        d += `${pen ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
        pen = true;
      }
      return d;
    };
    for (let lon = -180; lon < 180; lon += 15) lines.push(path(Array.from({ length: 73 }, (_, i) => project(view, -90 + i * 2.5, lon, cx, cy))));
    for (let lat = -75; lat <= 75; lat += 15) lines.push(path(Array.from({ length: 145 }, (_, i) => project(view, lat, -180 + i * 2.5, cx, cy))));
    return lines;
  }, [view]);

  const radius = Math.min(view.scale, 2000);
  const real = live.counts.real, sim = live.counts.simulated;
  const liveBody = `${real} real node${real === 1 ? "" : "s"} and ${sim} labelled simulated neighbours, cross-checked against the official station.`;
  // All 3,166 sites as one path: one DOM node instead of thousands, cheap to redraw every frame.
  const sitePath = step >= 1
    ? SITES.reduce((d, [la, lo]) => {
        const p = project(view, la, lo, cx, cy);
        const r = step === 1 ? 1.3 : 0.7;
        return p ? `${d}M${(p[0] - r).toFixed(1)} ${p[1].toFixed(1)}h${2 * r}` : d;
      }, "")
    : "";

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_1fr]">
      <div className="lg:sticky lg:top-[12svh]">
        <Stage fill={{ fill: "#2E3A22", motif: "#F2A12E" }} prop="pot">
        <svg viewBox={`0 0 ${W} ${H}`} className="aspect-square w-full" role="img" aria-label={`Globe: ${STEPS[step].title}`}>
          <defs>
            <clipPath id="globe-clip"><circle cx={cx} cy={cy} r={Math.min(radius, 199)} /></clipPath>
            <radialGradient id="globe-fill" cx="40%" cy="35%"><stop offset="0%" stopColor="#fbf1da" /><stop offset="100%" stopColor="#ecd3a0" /></radialGradient>
          </defs>
          <circle cx={cx} cy={cy} r={Math.min(radius, 199)} fill="url(#globe-fill)" stroke="var(--color-maroon)" strokeWidth="2" />
          <g clipPath="url(#globe-clip)">
            {graticule.map((d, i) => <path key={i} d={d} fill="none" stroke="var(--color-maroon)" strokeOpacity="0.18" strokeWidth="0.8" />)}
            {sitePath && <path d={sitePath} stroke="var(--color-olive)" strokeOpacity="0.6" strokeWidth={step === 1 ? 2.6 : 1.4} strokeLinecap="round" />}
            {(step >= 3 ? CITIES : CITIES.slice(0, 2)).map(([name, la, lo]) => {
              const p = project(view, la, lo, cx, cy);
              const hot = (name === "Mumbai" && step <= 1) || (name === "Delhi" && step === 2);
              return p && (
                <g key={name}>
                  <circle cx={p[0]} cy={p[1]} r={hot ? 7 : 4} fill={hot ? "var(--color-vermilion)" : "var(--color-saffron)"} stroke="var(--color-maroon)" strokeWidth="1.2" />
                  {(hot || step >= 3) && <text x={p[0] + 8} y={p[1] + 4} fontSize={hot ? 14 : 10} fontWeight="700" fill="var(--color-kohl)">{name}</text>}
                </g>
              );
            })}
            {step === 0 && (() => {
              const p = project(view, MUMBAI.lat - 0.01, MUMBAI.lon - 0.015, cx, cy);
              return p && <text x={p[0]} y={p[1] + 28} textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--color-maroon)">{live.area?.name ?? "BKC"} · {real} real + {sim} sim</text>;
            })()}
            {step === 2 && (() => {
              const a = project(view, MUMBAI.lat, MUMBAI.lon, cx, cy), b = project(view, DELHI.lat, DELHI.lon, cx, cy);
              return a && b && <path d={`M${a[0]} ${a[1]} Q${(a[0] + b[0]) / 2 - 40} ${(a[1] + b[1]) / 2} ${b[0]} ${b[1]}`} fill="none" stroke="var(--color-vermilion)" strokeWidth="2.5" strokeDasharray="6 5" />;
            })()}
          </g>
        </svg>
        </Stage>
      </div>
      <ol className="space-y-[30svh] py-[10svh] lg:space-y-[40svh]">
        {STEPS.map((s, i) => (
          <li
            key={s.title}
            ref={(el) => { stepEls.current[i] = el; }}
            data-step={i}
            className={`rounded-md border p-5 transition-colors duration-500 ${step === i ? "border-saffron bg-[#1f1912]" : "border-cream/10"}`}
          >
            <div className="text-sm font-bold uppercase tracking-widest text-saffron">{["Now", "Next", "Then", "Everywhere"][i]}</div>
            <h3 className="display mt-1 text-2xl text-cream">{s.title}</h3>
            <p className="mt-1 text-cream/85">{i === 0 ? liveBody : s.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
