"use client";
import { usePathname } from "next/navigation";

/** Footer for the app pages; the story page (/) has its own. */
export function SiteFooter() {
  if (usePathname() === "/") return null;
  return (
    <footer className="mx-auto mt-16 max-w-7xl px-4 pb-10 text-xs text-muted">
      PranaNet · ETHGlobal Mumbai 2026 · Sensor values are a PM proxy (Sharp GP2Y1014AU0F); AQI shown is indicative,
      computed on instant readings with India&apos;s CPCB breakpoints. Simulated neighbours are labelled everywhere.
    </footer>
  );
}
