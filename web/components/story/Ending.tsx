import Link from "next/link";
import { DOCS, REPO } from "@/lib/story/evidence";

/** Chapter IX text. */
export function EndingText() {
  return (
    <>
      <p className="mt-5 font-[family-name:var(--font-rozha)] text-[2.2rem] leading-tight text-cream sm:text-[2.8rem]">
        When anyone can run the meter, nobody can own the truth.
      </p>
      <p className="mt-4 text-sand">The Watcher runs the meter. The builder pays for honest air. Neither of them can fake it.</p>
      <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 font-bold">
        <Link href="/run-a-node" className="btn-primary rounded-full px-6 py-3 shadow-lg">Run a node</Link>
        <Link href="/live" className="link-sweep text-cream">Live map</Link>
        <a href={REPO} target="_blank" rel="noreferrer" className="link-sweep text-cream">GitHub</a>
        <Link href="/roadmap" className="link-sweep text-cream">Roadmap</Link>
        <a href={DOCS} target="_blank" rel="noreferrer" className="link-sweep text-cream">Docs</a>
      </div>
    </>
  );
}

export function StoryFooter() {
  return (
    <footer className="text-cream/85">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 text-base sm:grid-cols-2 sm:px-6">
        <div>
          <p className="font-[family-name:var(--font-rozha)] text-2xl text-cream">PranaNet</p>
          <p className="mt-2">Built at ETHGlobal Mumbai 2026 · ENS · World · Arkiv · Hedera · Sepolia</p>
          <p className="mt-1 text-sand">Hemesh · Arpan · Siddhartha</p>
          <p className="mt-3 text-sand">The Watcher, painted for PranaNet.</p>
        </div>
        <div>
          <p className="font-bold text-cream">Honest notes</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sand">
            <li>The hackathon sensor (Sharp GP2Y1014AU0F) is a low-cost PM proxy, calibrated against the nearest official station. AQI shown is indicative.</li>
            <li>Simulated neighbours fill out the map during the demo and are labelled everywhere.</li>
            <li>An ESP32&apos;s key can be extracted with physical access; production nodes would use a secure element.</li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
