"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLive } from "./LiveProvider";
import { CHAIN_ID, CONTRACTS_ARE_MOCK, READINGS_CONTRACT, REGISTRY_CONTRACT, addressUrl } from "@/lib/chain";
import { short } from "@/lib/format";

const NAV = [
  { href: "/", label: "Live map" },
  { href: "/devices", label: "Devices" },
  { href: "/register", label: "Register" },
  { href: "/about", label: "How it works" },
];

const CONN_LABEL = { replay: "mock replay", connecting: "connecting", live: "live", reconnecting: "reconnecting" } as const;

export function SiteHeader() {
  const path = usePathname();
  const { conn, devices } = useLive();
  const active = devices.filter((d) => d.status === "active").length;
  return (
    <header className="z-50 border-b sm:sticky sm:top-0 border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <svg viewBox="0 0 24 24" className="h-6 w-6 text-brand" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h7" />
          </svg>
          PranaNet
        </Link>
        <nav className="flex flex-wrap gap-1 text-sm">
          {NAV.map((n) => {
            const on = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} className={`rounded-md px-3 py-1.5 ${on ? "bg-ink text-white" : "text-muted hover:bg-bg hover:text-ink"}`}>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted">
          <span className={`h-2 w-2 rounded-full ${conn === "live" || conn === "replay" ? "animate-pulse bg-green-500" : "bg-amber-500"}`} />
          {CONN_LABEL[conn]} · {active} active devices
        </div>
      </div>
      {/* Chain strip: the verification infrastructure, always visible */}
      <div className="border-t border-line bg-chain-soft/60">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-1 px-4 py-1.5 text-[11px] text-chain">
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
