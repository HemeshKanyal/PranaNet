"use client";
import { useState } from "react";
import { Reveal } from "./Reveal";

const S = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const TRICKS: { label: string; caught: string; icon: React.ReactNode }[] = [
  {
    label: "Spray water",
    caught: "Reads far lower than its neighbours → flagged.",
    icon: (
      <svg viewBox="0 0 48 48" {...S}>
        <path d="M6 30h14l6-6h6" /><path d="M10 30v8h8v-8" /><path d="M36 18c2 3 2 5 0 7M40 15c3 4 3 9 0 13M44 12c4 5 4 13 0 19" />
      </svg>
    ),
  },
  {
    label: "Switch it off",
    caught: "The gap is recorded publicly; neighbours keep the map alive.",
    icon: (
      <svg viewBox="0 0 48 48" {...S}>
        <path d="M24 8v14" /><path d="M14 14a14 14 0 1 0 20 0" />
      </svg>
    ),
  },
  {
    label: "Stuff it with cotton",
    caught: "Reads low against its neighbours → flagged.",
    icon: (
      <svg viewBox="0 0 48 48" {...S}>
        <rect x="10" y="14" width="28" height="24" rx="3" /><path d="M16 22h16M16 28h16" />
        <path d="M18 14c-4-2-2-8 2-7 1-4 7-4 8 0 4-1 6 5 2 7" />
      </svg>
    ),
  },
  {
    label: "Move it somewhere clean",
    caught: "Its location cell is public on ENS: anyone can see it moved.",
    icon: (
      <svg viewBox="0 0 48 48" {...S}>
        <path d="M8 36h12M28 36h12" /><path d="M12 36V24h6v12M32 36V20l4-6 4 6v16" /><path d="M20 18h10m-3-3 3 3-3 3" />
      </svg>
    ),
  },
  {
    label: "Drop the data",
    caught: "Missing epochs are visible on-chain.",
    icon: (
      <svg viewBox="0 0 48 48" {...S}>
        <path d="M6 30l8-8 6 6 6-10" /><path d="M30 18l2 2" strokeDasharray="1 4" /><path d="M36 26l6-8" /><path d="M6 40h36" />
      </svg>
    ),
  },
];

/** Chapter II text: one meter, one owner. */
export function TricksText() {
  return (
    <>
      <p className="mt-5">
        An official station is <b className="text-cream">one meter with one owner</b>. If the owner wants a better number, there are plenty of
        ways to get one. Every one of them works because nobody else is watching.
      </p>
      <p className="mt-3 text-sand">Hover or tap a trick to see how a network of eyes catches it.</p>
    </>
  );
}

/** Chapter II tiles: each flips to show how PranaNet catches the trick. */
export function TrickTiles() {
  const [on, setOn] = useState<string | null>(null);
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {TRICKS.map((t, i) => (
        <Reveal as="li" key={t.label} delay={i * 90} className="h-44">
          <button
            type="button"
            data-on={on === t.label}
            onClick={() => setOn(on === t.label ? null : t.label)}
            aria-pressed={on === t.label}
            aria-label={`${t.label}: ${t.caught}`}
            className="flip block h-full w-full text-left"
          >
            <span className="flip-inner block">
              <span className="flip-face flex flex-col items-center justify-center rounded-md border border-cream/15 bg-[#1f1912] p-3 text-center">
                <span className="h-12 w-12 text-saffron">{t.icon}</span>
                <span className="mt-2 font-semibold leading-tight text-cream">{t.label}</span>
              </span>
              <span className="flip-face flip-back flex flex-col justify-center rounded-md bg-cream p-3.5 text-kohl">
                <span className="text-[0.7rem] font-bold uppercase tracking-wider text-olive">Caught</span>
                <span className="mt-1 text-[0.92rem] font-semibold leading-snug">{t.caught}</span>
              </span>
            </span>
          </button>
        </Reveal>
      ))}
    </ul>
  );
}
