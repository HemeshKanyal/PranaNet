"use client";
import Link from "next/link";
import { Eye } from "./Eye";
import type { useStoryArea } from "@/lib/story/live";

type Live = ReturnType<typeof useStoryArea>;

export function Hero({ live }: { live: Live }) {
  const { stats, style, counts, placeName } = live;
  return (
    <section data-scene-idx={0} className="relative flex min-h-svh flex-col justify-end lg:justify-center">
      {/* Text scrim: from the bottom on phones (the Watcher stands in the middle), from the left on desktop */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-kohl/90 via-kohl/45 to-transparent lg:bg-gradient-to-r lg:from-kohl/85 lg:via-kohl/40 lg:to-transparent" aria-hidden />
      <div className="relative px-4 pb-10 pt-28 lg:max-w-[720px] lg:px-[5vw] lg:pb-0">
        <h1 className="text-[2.7rem] leading-[1.02] text-cream sm:text-6xl lg:text-7xl">
          The air doesn&apos;t lie. <span className="text-saffron">The readings can.</span>
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-snug text-cream/95 sm:text-xl">
          PranaNet is a network of honest air sensors that anyone can run, check and get paid for.
        </p>

        {/* Live chip: today's real air at our nodes */}
        <div className="mt-6 inline-flex min-h-[4.6rem] max-w-full flex-wrap content-center items-center sm:min-h-0 gap-x-2 gap-y-1 rounded-2xl border-2 border-maroon bg-cream px-3.5 py-2 text-[0.95rem] text-kohl shadow-lg">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-vermilion opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-vermilion" />
          </span>
          {placeName ? (
            <>
              <span>
                Right now at <b>{placeName}</b>:
              </span>
              {stats?.aqi != null && style ? (
                <span className="rounded-full px-2 py-0.5 font-bold" style={{ background: style.bg, color: style.fg }}>
                  AQI {stats.aqi} · {style.cat}
                </span>
              ) : (
                <span className="font-semibold">no live reading</span>
              )}
              <span className="text-kohl/80">
                · {counts.real} real node{counts.real === 1 ? "" : "s"}, {counts.simulated} simulated
              </span>
            </>
          ) : (
            <span>Waiting for the first node…</span>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/run-a-node" className="rounded-full bg-vermilion px-6 py-3 text-base font-bold text-cream shadow-lg ring-2 ring-cream/30 hover:bg-[#b02c18]">
            Run a node
          </Link>
          <Link href="/live" className="rounded-full border-2 border-cream bg-kohl/40 px-6 py-3 text-base font-bold text-cream hover:bg-kohl/60">
            See the live map
          </Link>
        </div>
        <div className="mt-8 hidden items-center gap-2 text-sm text-cream/80 lg:flex" aria-hidden>
          <Eye size={28} delay={0.4} /> <Eye size={28} delay={2.1} /> <Eye size={28} state="sim" delay={3.3} />
          <span className="ml-2">Scroll: why anyone should believe a number</span>
        </div>
      </div>
    </section>
  );
}

export function StoryNav() {
  return (
    <nav className="absolute inset-x-0 top-0 z-30 flex items-center gap-2 px-4 py-3 text-sm font-semibold text-cream lg:px-[5vw]">
      <Link href="/" className="mr-auto flex items-center gap-2 text-lg" aria-label="PranaNet home">
        <Eye size={30} state="official" blink={false} title="PranaNet" />
        <span className="font-[family-name:var(--font-rozha)] text-xl tracking-wide">PranaNet</span>
      </Link>
      <Link href="/live" className="rounded-full px-3 py-1.5 hover:bg-cream/15">Live map</Link>
      <Link href="/devices" className="hidden rounded-full px-3 py-1.5 hover:bg-cream/15 sm:block">Devices</Link>
      <Link href="/run-a-node" className="rounded-full border border-cream/70 px-3 py-1.5 hover:bg-cream/15">Run a node</Link>
    </nav>
  );
}
