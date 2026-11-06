"use client";
// The stage, composed from the hand-painted kit. Back to front:
//   wall panel in the chapter's mood colour with the floral tile blended in,
//   lotus border band as a dado, a lotus pillar either side, the painted arch,
//   props, then the Watcher in front, breaking out of the arch (hood above it,
//   feet below the band) with a ground shadow.
// Motion: back layers fade/scale in, the figure rises 120 ms later; light parallax on the
// figure; hover tilts it towards the cursor and shows its mood label (tap toggles on touch).
import { useEffect, useRef, useState } from "react";
import type { AqiCategory } from "@/lib/aqi";
import { useInView, useReducedMotion } from "@/lib/story/hooks";
import { MOOD_FILL, NEUTRAL_FILL, POSE_ART, TILE, artSrc, type Pose } from "@/lib/story/poses";
import { Art } from "./Art";

export type Prop = "peacock-left" | "peacock-right" | "table" | "sensor" | "incense";

export function Stage({ pose, mood, label, props = [], walk = false, priority = false, fill, arch = true, children, className = "" }: {
  pose?: Pose;
  mood?: AqiCategory | null;
  label?: string;
  props?: Prop[];
  walk?: boolean;
  priority?: boolean;
  /** wall colour override (chapters without a mood) */
  fill?: string;
  /** draw the painted arch (off when the stage frames something else, e.g. the globe) */
  arch?: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  const [ref, inView] = useInView<HTMLDivElement>("0px 0px -10% 0px");
  const reduced = useReducedMotion();
  const wall = fill ?? (mood ? MOOD_FILL[mood] : NEUTRAL_FILL);
  const wide = pose === "with-builder";
  const has = (p: Prop) => props.includes(p);

  // Parallax: the figure moves ~8% faster than the set behind it (transform only, no re-render).
  const fig = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reduced || !pose) return;
    let raf = 0;
    const tick = () => {
      raf = 0;
      const el = ref.current, f = fig.current;
      if (!el || !f) return;
      const r = el.getBoundingClientRect();
      f.style.transform = `translate3d(0, ${(-(r.top + r.height / 2 - window.innerHeight / 2) * 0.08).toFixed(1)}px, 0)`;
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(tick); };
    tick();
    window.addEventListener("scroll", on, { passive: true });
    return () => { window.removeEventListener("scroll", on); cancelAnimationFrame(raf); };
  }, [reduced, pose, ref]);

  const [tilt, setTilt] = useState<{ x: number; y: number } | null>(null);
  const [pinned, setPinned] = useState(false);
  const showLabel = !!label && (tilt != null || pinned);

  return (
    <div
      ref={ref}
      data-in={inView}
      className={`stage relative mx-auto w-full ${wide ? "aspect-[6/5] max-w-[380px] lg:max-w-[560px]" : "aspect-[4/5] max-w-[320px] lg:max-w-[460px]"} ${className}`}
    >
      {/* ---- the set (back layers) ---- */}
      <div className="stage-arch absolute inset-0" aria-hidden>
        {/* wall panel: mood colour + floral tile */}
        <div className="absolute inset-x-[7%] bottom-[10%] top-[15%] overflow-hidden rounded-t-[3px]" style={{ background: wall }}>
          <div className="absolute inset-0 opacity-25 mix-blend-multiply" style={{ backgroundImage: `url(${TILE})`, backgroundSize: "34%" }} />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,transparent_40%,rgb(0_0_0/0.35))]" />
        </div>
        {/* lotus border band as a dado along the wall's foot */}
        <div
          className="absolute inset-x-[5%] bottom-[8%] h-[8%]"
          style={{ backgroundImage: `url(${artSrc("hand-painted-lotus-scallop-border", "480")})`, backgroundSize: "auto 100%", backgroundRepeat: "repeat-x", backgroundPosition: "center" }}
        />
        {/* pillars */}
        <div className="absolute bottom-[9%] left-[1%] h-[76%]"><Art name="indian-folk-art-lotus-pillar" small className="h-full w-auto drop-shadow-[0_6px_6px_rgb(0_0_0/0.4)]" /></div>
        <div className="absolute bottom-[9%] right-[1%] h-[76%]"><Art name="indian-folk-art-lotus-pillar" small className="h-full w-auto drop-shadow-[0_6px_6px_rgb(0_0_0/0.4)]" /></div>
        {/* the painted arch */}
        {arch && (
          <div className="absolute bottom-[15%] left-1/2 h-[64%] -translate-x-1/2">
            <Art name="ornate-indian-folk-art-arch-motif" className="h-full w-auto max-w-none drop-shadow-[0_10px_14px_rgb(0_0_0/0.45)]" priority={priority} />
          </div>
        )}
        {children && <div className="absolute inset-x-[18%] bottom-[16%] top-[20%] flex items-center justify-center">{children}</div>}
        {/* hanging painting */}
        {(has("peacock-left") || has("peacock-right")) && (
          <div className={`absolute top-[17%] w-[26%] ${has("peacock-left") ? "left-[9%]" : "right-[9%]"}`}>
            <Art name="ornate-red-peacock-folk-painting" small className="h-auto w-full drop-shadow-[0_10px_14px_rgb(0_0_0/0.5)]" />
          </div>
        )}
      </div>

      {/* ---- the Watcher ---- */}
      {pose && (
        <>
          <div className="stage-arch absolute bottom-[1.5%] left-1/2 h-[5%] w-[56%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgb(0_0_0/0.65),transparent)]" aria-hidden />
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
                <Art name={POSE_ART[pose]} priority={priority} className="block h-full w-auto max-w-none" />
                {label && (
                  <span
                    className={`pointer-events-none absolute left-[62%] top-[2%] whitespace-nowrap rounded-lg bg-cream px-2.5 py-1 text-sm font-bold text-kohl shadow-lg transition-[opacity,transform] duration-200 ${showLabel ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"}`}
                    aria-hidden={!showLabel}
                  >
                    {label}
                    <span className="absolute -left-1 bottom-2 h-2.5 w-2.5 rotate-45 bg-cream" />
                  </span>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ---- props in front, at the base ---- */}
      {has("table") && (
        <div className="stage-rise absolute bottom-[2%] right-[0%] w-[38%]" aria-hidden>
          <Art name="folk-art-table-with-floral-vessels" small className="h-auto w-full drop-shadow-[0_10px_10px_rgb(0_0_0/0.5)]" />
        </div>
      )}
      {has("sensor") && (
        <div className="stage-rise absolute bottom-[3%] right-[2%] w-[24%]" aria-hidden>
          <Art name="vintage-folk-art-aq-sensor" small className="h-auto w-full drop-shadow-[0_10px_10px_rgb(0_0_0/0.5)]" />
        </div>
      )}
      {has("incense") && (
        <div className="stage-rise absolute bottom-[3%] left-[3%] w-[13%]" aria-hidden>
          <Art name="folk-art-incense-holder-with-curling-smoke" small className="h-auto w-full drop-shadow-[0_8px_8px_rgb(0_0_0/0.5)]" />
        </div>
      )}
    </div>
  );
}
