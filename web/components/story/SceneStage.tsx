"use client";
// Fixed backdrop of the Watcher's scenes. Sections mark themselves with data-scene-idx; the one
// crossing the middle of the viewport becomes active and its scene cross-fades in. Only the
// active scene, the next one and (for one second, while it fades out) the previous one are
// mounted, so the browser only downloads what is on screen or about to be.
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { sceneLoader, sceneSrc, type Scene } from "@/lib/story/scenes";

export function SceneStage({ order, children }: { order: Scene[]; children: React.ReactNode }) {
  const [idx, setIdx] = useState(0);
  const [fading, setFading] = useState<Scene | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const last = useRef(0);

  useEffect(() => {
    const els = root.current?.querySelectorAll<HTMLElement>("[data-scene-idx]") ?? [];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const i = Number((e.target as HTMLElement).dataset.sceneIdx);
          if (i === last.current) continue;
          setFading(order[last.current]);
          last.current = i;
          setIdx(i);
        }
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [order]);

  useEffect(() => {
    if (!fading) return;
    const t = setTimeout(() => setFading(null), 1100);
    return () => clearTimeout(t);
  }, [fading]);

  const active = order[idx];
  const next = order[idx + 1];
  const mounted = [...new Set([fading, active, next].filter((s): s is Scene => !!s))];

  return (
    <div ref={root}>
      <div className="fixed inset-x-0 top-0 z-0 h-lvh overflow-hidden bg-maroon" aria-hidden>
        {mounted.map((s) => (
          <div key={s} className="absolute inset-0 transition-opacity duration-1000 ease-in-out" style={{ opacity: s === active ? 1 : 0 }}>
            <Image
              loader={sceneLoader}
              src={sceneSrc(s)}
              alt=""
              fill
              sizes="100vw"
              priority={s === order[0]}
              className="scene-img object-cover"
            />
          </div>
        ))}
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}
