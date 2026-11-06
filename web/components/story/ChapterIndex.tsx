"use client";
import { useEffect, useState } from "react";
import { CHAPTERS } from "@/lib/story/chapters";

/** Contents list under the hero (I–IX). */
export function Contents() {
  return (
    <nav aria-label="Chapters" className="story-contents mx-auto max-w-6xl px-4 pb-14 sm:px-6">
      <p className="text-base font-semibold text-sand">Explore the story</p>
      <ol className="mt-3 grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {CHAPTERS.map((c) => (
          <li key={c.id}>
            <a href={`#${c.id}`} className="group flex items-baseline gap-3 border-b border-cream/10 py-2 text-cream/90 hover:text-cream">
              <span className="w-10 shrink-0 font-[family-name:var(--font-rozha)] text-saffron">{c.roman}</span>
              <span className="link-sweep">{c.title}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Slim sticky side index (wide desktop), highlighting the chapter in view. */
export function SideIndex() {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const els = CHAPTERS.map((c) => document.getElementById(c.id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-50% 0px -50% 0px" },
    );
    els.forEach((e) => io.observe(e));
    const hero = document.getElementById("top");
    const ho = hero ? new IntersectionObserver(([e]) => e.isIntersecting && setActive(null), { rootMargin: "-50% 0px -50% 0px" }) : null;
    if (hero) ho!.observe(hero);
    return () => { io.disconnect(); ho?.disconnect(); };
  }, []);
  return (
    <nav
      aria-label="Chapter index"
      className={`fixed left-5 top-1/2 z-20 hidden w-48 -translate-y-1/2 transition-opacity duration-500 2xl:left-8 xl:block ${active ? "opacity-100" : "pointer-events-none opacity-0"}`}
    >
      <ol className="space-y-1.5">
        {CHAPTERS.map((c) => {
          const on = c.id === active;
          return (
            <li key={c.id}>
              <a href={`#${c.id}`} aria-current={on ? "true" : undefined} className={`group flex items-center gap-2 text-base ${on ? "text-saffron" : "text-sand hover:text-cream"}`}>
                <span className={`h-px transition-all ${on ? "w-6 bg-saffron" : "w-3 bg-current"}`} />
                <span className="w-8 font-[family-name:var(--font-rozha)]">{c.roman}</span>
                <span className={`max-w-[9rem] truncate rounded bg-ground/90 px-1 text-sm transition-opacity ${on ? "opacity-0 group-hover:opacity-100 2xl:opacity-100" : "opacity-0 group-hover:opacity-100"}`}>{c.title}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
