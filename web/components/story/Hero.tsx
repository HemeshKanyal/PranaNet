"use client";
import Link from "next/link";
import type { useStoryArea } from "@/lib/story/live";
import { moodLabel } from "@/lib/story/poses";
import { Stagger } from "./Chapter";
import { Contents } from "./ChapterIndex";
import { Stage } from "./Stage";

type Live = ReturnType<typeof useStoryArea>;

export function Hero({ live }: { live: Live }) {
  const { stats, style, counts, placeName, pose } = live;
  return (
    <section id="top">
      <div className="mx-auto grid max-w-6xl items-center gap-6 px-4 pb-12 pt-8 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-12 lg:pb-16 lg:pt-14">
        <div className="lg:order-2">
          <Stage pose={pose} mood={style?.cat ?? null} label={style ? moodLabel(style.cat) : "No live reading"} priority />
        </div>
        <Stagger className="lg:order-1">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-sand">A field notebook on air you can check</p>
          <h1 className="mt-3 text-[2.6rem] leading-[1.04] text-cream sm:text-6xl lg:text-[4.3rem]">
            The air doesn&apos;t lie. <span className="text-saffron">The readings can.</span>
          </h1>
          <p className="prose-col mt-4 text-lg text-cream/90 sm:text-xl">
            PranaNet is a network of honest air sensors that anyone can run, check and get paid for.
          </p>

          {/* Live chip: today's real air at our nodes */}
          <div className="mt-6 inline-flex min-h-[4.6rem] max-w-full flex-wrap content-center items-center gap-x-2 gap-y-1 rounded-2xl bg-cream px-3.5 py-2 text-[0.95rem] text-kohl shadow-lg sm:min-h-0">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-vermilion opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-vermilion" />
            </span>
            {placeName ? (
              <>
                <span>Right now at <b>{placeName}</b>:</span>
                {stats?.aqi != null && style ? (
                  <span className="rounded-full px-2 py-0.5 font-bold" style={{ background: style.bg, color: style.fg }}>
                    AQI {stats.aqi} · {style.cat}
                  </span>
                ) : (
                  <span className="font-semibold">no live reading</span>
                )}
                <span className="text-kohl/80">· {counts.real} real node{counts.real === 1 ? "" : "s"}, {counts.simulated} simulated</span>
              </>
            ) : (
              <span>Waiting for the first node…</span>
            )}
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/run-a-node" className="btn-primary rounded-full px-6 py-3 text-base font-bold shadow-lg">Run a node</Link>
            <Link href="/live" className="link-sweep text-base font-bold text-cream">See the live map →</Link>
          </div>
        </Stagger>
      </div>
      <Contents />
    </section>
  );
}
