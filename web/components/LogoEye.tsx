"use client";
// PranaNet's logo: an eye whose pupil follows the cursor (clamped) and blinks now and then.
import { useEffect, useRef } from "react";

export function LogoEye({ size = 32 }: { size?: number }) {
  const svg = useRef<SVGSVGElement>(null);
  const pupil = useRef<SVGGElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0, x = 0, y = 0;
    const on = (e: PointerEvent) => {
      x = e.clientX; y = e.clientY;
      if (!raf) raf = requestAnimationFrame(() => {
        raf = 0;
        const r = svg.current?.getBoundingClientRect();
        if (!r || !pupil.current) return;
        const dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height / 2);
        const d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 220);
        pupil.current.setAttribute("transform", `translate(${((dx / d) * 9 * k).toFixed(2)} ${((dy / d) * 5 * k).toFixed(2)})`);
      });
    };
    window.addEventListener("pointermove", on, { passive: true });
    return () => { window.removeEventListener("pointermove", on); cancelAnimationFrame(raf); };
  }, []);
  return (
    <svg ref={svg} viewBox="0 0 64 40" width={size} height={(size * 40) / 64} className="eye eye-blink" aria-hidden>
      <g className="eye-ball" style={{ animationDelay: "2.5s" }}>
        <path d="M3 20 Q32 -5 61 20 Q32 45 3 20Z" fill="#F3E3BE" stroke="#F2A12E" strokeWidth="3" />
        <g ref={pupil}>
          <circle cx="32" cy="20" r="10" fill="#C8341E" />
          <circle cx="32" cy="20" r="4.2" fill="#15110C" />
          <circle cx="35" cy="17" r="1.8" fill="#F3E3BE" />
        </g>
      </g>
    </svg>
  );
}
