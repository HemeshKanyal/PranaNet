import Link from "next/link";
import { DOCS, REPO } from "@/lib/story/evidence";

export function Ending({ idx }: { idx: number }) {
  return (
    <section id="ending" data-scene-idx={idx} className="relative flex min-h-svh flex-col justify-end lg:justify-center">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-kohl/90 via-kohl/40 to-transparent lg:bg-gradient-to-r lg:from-kohl/80 lg:via-kohl/30 lg:to-transparent" aria-hidden />
      <div className="relative px-4 pb-12 pt-[50svh] lg:max-w-[700px] lg:px-[5vw] lg:pb-0 lg:pt-0">
        <div className="text-xs font-bold uppercase tracking-[0.22em] text-saffron">Chapter 9</div>
        <h2 className="mt-1 text-[2.4rem] leading-[1.05] text-cream sm:text-6xl">
          When anyone can run the meter, nobody can own the truth.
        </h2>
        <p className="mt-3 max-w-lg text-lg text-cream/90">The Watcher and the builder walk together: one runs the meter, the other pays for honest air.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/run-a-node" className="rounded-full bg-vermilion px-6 py-3 font-bold text-cream shadow-lg hover:bg-[#b02c18]">Run a node</Link>
          <Link href="/live" className="rounded-full border-2 border-cream bg-kohl/40 px-6 py-3 font-bold text-cream hover:bg-kohl/60">Live map</Link>
          <a href={REPO} target="_blank" rel="noreferrer" className="rounded-full border-2 border-cream/70 px-5 py-3 font-bold text-cream hover:bg-kohl/50">GitHub</a>
          <a href={DOCS} target="_blank" rel="noreferrer" className="rounded-full border-2 border-cream/70 px-5 py-3 font-bold text-cream hover:bg-kohl/50">Docs</a>
        </div>
      </div>
    </section>
  );
}

export function StoryFooter() {
  return (
    <footer className="relative z-10 bg-kohl text-cream/85">
      <div className="folk-band" aria-hidden />
      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-10 text-sm sm:grid-cols-2">
        <div>
          <p className="font-[family-name:var(--font-rozha)] text-xl text-cream">PranaNet</p>
          <p className="mt-1">Built at ETHGlobal Mumbai 2026 · ENS · World · Arkiv · Hedera · Sepolia</p>
          <p className="mt-1">Hemesh · Arpan · Siddhartha</p>
          <p className="mt-3 text-cream/70">Scenes: the Watcher, painted for PranaNet.</p>
        </div>
        <div>
          <p className="font-bold text-cream">Honest notes</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-cream/75">
            <li>The hackathon sensor (Sharp GP2Y1014AU0F) is a low-cost PM proxy, calibrated against the nearest official station. AQI shown is indicative.</li>
            <li>Simulated neighbours fill out the map during the demo and are labelled everywhere.</li>
            <li>An ESP32&apos;s key can be extracted with physical access; production nodes would use a secure element.</li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
