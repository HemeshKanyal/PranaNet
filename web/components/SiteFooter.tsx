"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Footer for the app pages; the story page (/) has its own. */
export function SiteFooter() {
  if (usePathname() === "/") return null;
  return (
    <footer className="mx-auto mt-16 max-w-7xl px-4 pb-10 text-xs text-muted">
      PranaNet · ETHGlobal Mumbai 2026 · Sensor values are a PM proxy (Sharp GP2Y1014AU0F); AQI shown is indicative,
      computed on instant readings with India&apos;s CPCB breakpoints. Simulated neighbours are labelled everywhere.{" "}
      <Link href="/roadmap" className="link-sweep text-ink">Roadmap</Link> · <Link href="/run-a-node" className="link-sweep text-ink">Run a node</Link>
    </footer>
  );
}
