"use client";
// The stage: a pointed folk arch (mihrab) in the chapter's mood colour, and the Watcher cut-out
// standing in front of it, breaking out (hood above the arch, feet below its base) with a soft
// ground shadow. Motion: arch scales in, the Watcher rises 120 ms later; a little parallax;
// hover tilts the figure towards the cursor and shows its mood label (tap toggles on touch).
/* eslint-disable @next/next/no-img-element */
import { useEffect, useId, useRef, useState } from "react";
import type { AqiCategory } from "@/lib/aqi";
import { useInView, useReducedMotion } from "@/lib/story/hooks";
import { MOOD_FILL, NEUTRAL_FILL, POSE_SIZE, poseSrc, type Pose } from "@/lib/story/poses";

const ARCH = "M4 300 V128 C4 78 44 46 100 4 C156 46 196 78 196 128 V300 Z";
const ARCH_INNER = "M15 300 V132 C15 86 50 58 100 20 C150 58 185 86 185 132 V300";

export function Stage({ pose, mood, label, prop, walk = false, priority = false, fill, children, className = "" }: {
  pose?: Pose;
  mood?: AqiCategory | null;
  label?: string;
  prop?: "peacock" | "peacock-right" | "pot";
  walk?: boolean;
  priority?: boolean;
  /** override the arch colours (chapters without a mood) */
  fill?: { fill: string; motif: string };
  /** content inside the arch instead of (or under) a character */
  children?: React.ReactNode;
  className?: string;
}) {
  const [ref, inView] = useInView<HTMLDivElement>("0px 0px -10% 0px");
  const reduced = useReducedMotion();
  const pid = useId().replace(/:/g, "");
  const colours = fill ?? (mood ? MOOD_FILL[mood] : NEUTRAL_FILL);
  const wide = pose === "with-builder";

  // Parallax: the figure moves ~8% faster than the arch (transform only, no re-render).
  const fig = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reduced || !pose) return;
    let raf = 0;
    const tick = () => {
      raf = 0;
      const el = ref.current, f = fig.current;
      if (!el || !f) return;
      const r = el.getBoundingClientRect();
      const d = r.top + r.height / 2 - window.innerHeight / 2;
      f.style.transform = `translate3d(0, ${(-d * 0.08).toFixed(1)}px, 0)`;
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(tick); };
    tick();
    window.addEventListener("scroll", on, { passive: true });
    return () => { window.removeEventListener("scroll", on); cancelAnimationFrame(raf); };
  }, [reduced, pose, ref]);

  // Hover tilt (±6°) + lift; touch: tap toggles the label.
  const [tilt, setTilt] = useState<{ x: number; y: number } | null>(null);
  const [pinned, setPinned] = useState(false);
  const showLabel = !!label && (tilt != null || pinned);

  return (
    <div
      ref={ref}
      data-in={inView}
      className={`stage relative mx-auto w-full ${wide ? "aspect-[6/5] max-w-[360px] lg:max-w-[540px]" : "aspect-[4/5] max-w-[280px] lg:max-w-[420px]"} ${className}`}
    >
      {/* arch */}
      <div className={`stage-arch absolute ${wide ? "inset-x-[12%]" : "inset-x-[14%]"} bottom-[9%] top-[11%]`}>
        <svg viewBox="0 0 200 300" preserveAspectRatio="none" className="h-full w-full" aria-hidden>
          <defs>
            <pattern id={`m${pid}`} width="26" height="26" patternUnits="userSpaceOnUse">
              <path d="M13 3l4 10-4 10-4-10z" fill={colours.motif} opacity="0.16" />
              <circle cx="0" cy="0" r="1.6" fill={colours.motif} opacity="0.22" />
              <circle cx="26" cy="26" r="1.6" fill={colours.motif} opacity="0.22" />
            </pattern>
          </defs>
          <path d={ARCH} fill={colours.fill} />
          <path d={ARCH} fill={`url(#m${pid})`} />
          <path d={ARCH_INNER} fill="none" stroke="#F3E3BE" strokeOpacity="0.4" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path d={ARCH} fill="none" stroke="#F3E3BE" strokeOpacity="0.9" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
        {children && <div className="absolute inset-[6%] top-[22%] flex items-center justify-center">{children}</div>}
      </div>
      {/* arch base line, wider than the arch, so the feet visibly step past it */}
      <div className="stage-arch absolute inset-x-[8%] bottom-[9%] h-px bg-cream/50" aria-hidden />

      {prop === "peacock" || prop === "peacock-right" ? (
        <div className={`stage-arch absolute top-[22%] w-[22%] ${prop === "peacock" ? "left-0" : "right-0"}`} aria-hidden>
          <svg viewBox="0 0 100 30" className="block w-full" aria-hidden><path d="M8 30 L50 4 L92 30" fill="none" stroke="#BFA98A" strokeWidth="1.5" /><circle cx="50" cy="4" r="2.5" fill="#BFA98A" /></svg>
          <img src="/story/prop-peacock.webp" alt="" width={267} height={270} loading="lazy" className="block w-full rounded-[2px] shadow-[0_10px_20px_rgb(0_0_0/0.45)]" />
        </div>
      ) : null}

      {pose && (
        <>
          {/* ground shadow */}
          <div className="stage-arch absolute bottom-[1.5%] left-1/2 h-[5%] w-[52%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgb(0_0_0/0.6),transparent)]" aria-hidden />
          <div className={`${walk ? "stage-walk" : "stage-rise"} absolute inset-x-0 bottom-[3%] top-0`}>
            <div ref={fig} className="flex h-full justify-center will-change-transform">
              <div
                className="stage-tilt relative h-full"
                data-hover={tilt != null}
                style={tilt ? { transform: `translateY(-6px) rotateX(${(-tilt.y * 12).toFixed(2)}deg) rotateY(${(tilt.x * 12).toFixed(2)}deg)` } : undefined}
                onPointerMove={(e) => {
                  if (e.pointerType !== "mouse" || reduced) return;
                  const r = e.currentTarget.getBoundingClientRect();
                  setTilt({ x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5 });
                }}
                onPointerLeave={() => setTilt(null)}
                onClick={() => setPinned((v) => !v)}
                role={label ? "button" : undefined}
                tabIndex={label ? 0 : undefined}
                aria-label={label ? `The Watcher: ${label}` : undefined}
                onKeyDown={(e) => { if (label && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setPinned((v) => !v); } }}
              >
                <picture className="block h-full">
                  <source media="(max-width: 767px)" srcSet={poseSrc(pose, "480")} width={POSE_SIZE[pose].sm[0]} height={POSE_SIZE[pose].sm[1]} />
                  <img
                    src={poseSrc(pose, "900")}
                    width={POSE_SIZE[pose].lg[0]}
                    height={POSE_SIZE[pose].lg[1]}
                    alt=""
                    loading={priority ? "eager" : "lazy"}
                    fetchPriority={priority ? "high" : "auto"}
                    decoding="async"
                    draggable={false}
                    className="block h-full w-auto max-w-none select-none"
                  />
                </picture>
                {label && (
                  <span
                    className={`pointer-events-none absolute left-[62%] top-[2%] whitespace-nowrap rounded-lg bg-cream px-2.5 py-1 text-xs font-bold text-kohl shadow-lg transition-[opacity,transform] duration-200 ${showLabel ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"}`}
                    aria-hidden={!showLabel}
                  >
                    {label}
                    <span className="absolute -left-1 bottom-1.5 h-2.5 w-2.5 rotate-45 bg-cream" />
                  </span>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {prop === "pot" && (
        <img src="/story/prop-pot.webp" alt="" width={181} height={159} loading="lazy" className="stage-rise absolute bottom-[4%] right-[4%] w-[22%] drop-shadow-[0_8px_8px_rgb(0_0_0/0.5)]" aria-hidden />
      )}
    </div>
  );
}
