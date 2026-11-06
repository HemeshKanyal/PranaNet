import { Eye } from "./Eye";
import { Reveal } from "./Reveal";

const S = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const TRICKS: { label: string; icon: React.ReactNode }[] = [
  {
    label: "Spray water",
    icon: (
      <svg viewBox="0 0 48 48" {...S}>
        <path d="M6 30h14l6-6h6" /><path d="M10 30v8h8v-8" /><path d="M36 18c2 3 2 5 0 7M40 15c3 4 3 9 0 13M44 12c4 5 4 13 0 19" />
      </svg>
    ),
  },
  {
    label: "Switch it off",
    icon: (
      <svg viewBox="0 0 48 48" {...S}>
        <path d="M24 8v14" /><path d="M14 14a14 14 0 1 0 20 0" />
      </svg>
    ),
  },
  {
    label: "Stuff it with cotton",
    icon: (
      <svg viewBox="0 0 48 48" {...S}>
        <rect x="10" y="14" width="28" height="24" rx="3" /><path d="M16 22h16M16 28h16" />
        <path d="M18 14c-4-2-2-8 2-7 1-4 7-4 8 0 4-1 6 5 2 7" />
      </svg>
    ),
  },
  {
    label: "Move it somewhere clean",
    icon: (
      <svg viewBox="0 0 48 48" {...S}>
        <path d="M8 36h12M28 36h12" /><path d="M12 36V24h6v12M32 36V20l4-6 4 6v16" /><path d="M20 18h10m-3-3 3 3-3 3" />
      </svg>
    ),
  },
  {
    label: "Drop the data",
    icon: (
      <svg viewBox="0 0 48 48" {...S}>
        <path d="M6 30l8-8 6 6 6-10" /><path d="M30 18l2 2" strokeDasharray="1 4" /><path d="M36 26l6-8" /><path d="M6 40h36" />
      </svg>
    ),
  },
];

/** Chapter 2: one meter, one owner. */
export function Tricks() {
  return (
    <>
      <p>
        An official station is <b>one meter with one owner</b>. If the owner wants a better number, there are plenty of ways to
        get one:
      </p>
      <ul className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-5">
        {TRICKS.map((t, i) => (
          <Reveal as="li" key={t.label} delay={i * 90} className="flex flex-col items-center rounded border border-maroon/25 bg-[#fbf1da] p-2.5 text-center">
            <span className="h-11 w-11 text-vermilion">{t.icon}</span>
            <span className="mt-1.5 text-[0.8rem] font-semibold leading-tight">{t.label}</span>
          </Reveal>
        ))}
      </ul>
      <div className="mt-5 flex items-center gap-3">
        <Eye size={52} state="official" delay={1} />
        <p className="font-semibold">Every one of them works because nobody else is watching.</p>
      </div>
    </>
  );
}
