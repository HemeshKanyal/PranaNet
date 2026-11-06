"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { useLive } from "./LiveProvider";
import { CHAIN_ID, CONTRACTS_ARE_MOCK, READINGS_CONTRACT, REGISTRY_CONTRACT, addressUrl } from "@/lib/chain";
import { short } from "@/lib/format";
import { aqiStyle } from "@/lib/aqi";
import { areaStats, deriveAreas, nodeCounts } from "@/lib/area";
import { LogoEye } from "./LogoEye";

const NAV = [
  { href: "/", label: "Story" },
  { href: "/live", label: "Live map" },
  { href: "/devices", label: "Devices" },
  { href: "/register", label: "Register" },
  { href: "/about", label: "How it works" },
  { href: "/roadmap", label: "Roadmap", wide: true },
];

/** Live AQI of the busiest area, as a pill in the header: the site's pulse on every page. */
function LivePill() {
  const { conn, devices } = useLive();
  const area = useMemo(() => deriveAreas(devices)[0] ?? null, [devices]);
  const st = area ? areaStats(devices, area) : null;
  const style = st?.aqi != null ? aqiStyle(st.aqi) : null;
  const n = nodeCounts(devices);
  const live = conn === "live" || conn === "replay";
  return (
    <Link
      href="/live"
      title={`${live ? "Live" : "Connecting"} · ${n.real} real nodes, ${n.simulated} simulated`}
      className="group flex items-center gap-2 rounded-full border border-cream/15 bg-cream/5 py-1 pl-2.5 pr-1 text-sm font-semibold text-cream transition-colors hover:border-saffron/60"
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${live ? "animate-pulse bg-leaf" : "bg-saffron"}`} />
      <span className="hidden whitespace-nowrap sm:inline">{area?.name ?? "No nodes"}</span>
      <span
        className="whitespace-nowrap rounded-full px-2.5 py-0.5 text-sm font-bold"
        style={style ? { background: style.bg, color: style.fg } : { background: "rgb(243 227 190 / 0.15)" }}
      >
        {style ? `AQI ${st!.aqi}` : "no data"}
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const path = usePathname();
  const story = path === "/";
  return (
    <header className="z-50 bg-ground text-cream sm:sticky sm:top-0">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-2 px-4 pt-3 sm:px-6 lg:h-[72px] lg:flex-nowrap lg:pt-0">
        <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="PranaNet home">
          <LogoEye size={42} />
          <span className="font-[family-name:var(--font-rozha)] text-[1.7rem] leading-none text-cream">PranaNet</span>
        </Link>

        <nav className="order-last -mx-4 flex w-[calc(100%+2rem)] gap-5 overflow-x-auto px-4 pb-2.5 text-base font-semibold [mask-image:linear-gradient(to_right,black_82%,transparent)] [scrollbar-width:none] lg:gap-6 lg:text-[1.05rem] md:[mask-image:none] lg:order-none lg:mx-0 lg:w-auto lg:overflow-visible lg:px-0 lg:pb-0">
          {NAV.map((n) => {
            const on = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={on ? "page" : undefined}
                className={`relative shrink-0 whitespace-nowrap py-2 transition-colors ${"wide" in n ? "lg:hidden xl:block" : ""} ${on ? "text-saffron" : "text-cream/75 hover:text-cream"}`}
              >
                {n.label}
                {/* folk diamond under the current page */}
                <span className={`absolute -bottom-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rotate-45 bg-saffron transition-opacity ${on ? "opacity-100" : "opacity-0"}`} aria-hidden />
              </Link>
            );
          })}
          <Link href="/run-a-node" className={`shrink-0 whitespace-nowrap py-2 sm:hidden ${path.startsWith("/run-a-node") ? "text-saffron" : "text-vermilion"}`}>
            Run a node
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <LivePill />
          <Link href="/run-a-node" className="btn-primary hidden rounded-full px-4 py-2 text-sm font-bold sm:inline-block">
            Run a node
          </Link>
        </div>
      </div>

      {/* Folk scallop edge */}
      <svg className="block h-[10px] w-full text-saffron opacity-50" preserveAspectRatio="none" aria-hidden>
        <defs>
          <pattern id="hdr-scallop" width="20" height="10" patternUnits="userSpaceOnUse">
            <path d="M0 1 Q5 9 10 1 Q15 9 20 1" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="10" cy="7.5" r="1.1" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="10" fill="url(#hdr-scallop)" />
      </svg>

      {/* Chain strip (app pages): the verification infrastructure */}
      <div className={story ? "hidden" : "hidden bg-[#1d1711] lg:block"}>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-1 px-4 py-1.5 text-xs font-medium text-sand sm:px-6">
          <span className="font-semibold uppercase tracking-wide text-cream/80">Verified by</span>
          <span>Sepolia · chain {CHAIN_ID}</span>
          <a className="font-mono hover:text-saffron" href={addressUrl(READINGS_CONTRACT)} target="_blank" rel="noreferrer">
            Readings {short(READINGS_CONTRACT)} ↗
          </a>
          <a className="font-mono hover:text-saffron" href={addressUrl(REGISTRY_CONTRACT)} target="_blank" rel="noreferrer">
            Registry {short(REGISTRY_CONTRACT)} ↗
          </a>
          <span>Raw data on Arkiv</span>
          <span>Operators verified with World ID</span>
          <span>Names on ENS</span>
          {CONTRACTS_ARE_MOCK && <span className="rounded bg-amber-400/15 px-1.5 py-0.5 font-medium text-amber-300">mock addresses</span>}
        </div>
      </div>
    </header>
  );
}
