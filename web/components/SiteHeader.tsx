"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLive } from "./LiveProvider";
import { CHAIN_ID, CONTRACTS_ARE_MOCK, READINGS_CONTRACT, REGISTRY_CONTRACT, addressUrl } from "@/lib/chain";
import { short } from "@/lib/format";
import { nodeCounts } from "@/lib/area";
import { LogoEye } from "./LogoEye";

const NAV = [
  { href: "/", label: "Story" },
  { href: "/live", label: "Live map" },
  { href: "/devices", label: "Devices" },
  { href: "/run-a-node", label: "Run a node" },
  { href: "/register", label: "Register" },
  { href: "/about", label: "How it works" },
];

const CONN_LABEL = { replay: "mock replay", connecting: "connecting", live: "live", reconnecting: "reconnecting" } as const;

export function SiteHeader() {
  const path = usePathname();
  const { conn, devices } = useLive();
  const n = nodeCounts(devices);
  const story = path === "/";
  return (
    <header className="z-50 border-b border-cream/10 bg-ground text-cream sm:sticky sm:top-0">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 sm:py-3">
        <Link href="/" className="flex items-center gap-2.5" aria-label="PranaNet home">
          <LogoEye size={34} />
          <span className="font-[family-name:var(--font-rozha)] text-xl tracking-wide text-cream">PranaNet</span>
        </Link>
        <nav className="order-last -mx-4 flex w-[calc(100%+2rem)] gap-1 overflow-x-auto px-4 text-sm font-medium [scrollbar-width:none] md:order-none md:mx-0 md:w-auto md:px-0">
          {NAV.map((n) => {
            const on = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 transition-colors ${on ? "bg-saffron text-kohl" : "text-cream/80 hover:bg-cream/10 hover:text-cream"}`}>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2 text-xs font-medium text-sand">
          <span className={`h-2 w-2 rounded-full ${conn === "live" || conn === "replay" ? "animate-pulse bg-green-500" : "bg-amber-500"}`} />
          {CONN_LABEL[conn]} · {n.real} real · {n.simulated} simulated
        </div>
      </div>
      {/* Chain strip: the verification infrastructure, always visible */}
      <div className={story ? "hidden" : "hidden border-t border-cream/10 bg-[#1d1711] sm:block"}>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-1 px-4 py-1.5 text-[11px] font-medium text-sand">
          <span className="font-semibold uppercase tracking-wide">Verified by</span>
          <span>Sepolia · chain {CHAIN_ID}</span>
          <a className="font-mono hover:underline" href={addressUrl(READINGS_CONTRACT)} target="_blank" rel="noreferrer">
            Readings {short(READINGS_CONTRACT)} ↗
          </a>
          <a className="font-mono hover:underline" href={addressUrl(REGISTRY_CONTRACT)} target="_blank" rel="noreferrer">
            Registry {short(REGISTRY_CONTRACT)} ↗
          </a>
          <span>Raw data on Arkiv</span>
          <span>Operators verified with World ID</span>
          <span>Names on ENS</span>
          {CONTRACTS_ARE_MOCK && <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">mock addresses</span>}
        </div>
      </div>
    </header>
  );
}
