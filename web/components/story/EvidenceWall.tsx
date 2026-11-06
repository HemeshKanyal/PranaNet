import { WALL } from "@/lib/story/wall";
import { Reveal } from "./Reveal";

const KIND: Record<string, string> = { conviction: "court record", allegation: "reported allegation", inquiry: "court inquiry", survey: "survey" };

/** Chapter 1: headline cards (our own one-line summaries + links), never article images. */
export function EvidenceWall() {
  return (
    <>
      <blockquote className="border-l-4 border-vermilion pl-4 italic">
        Delhi, winter 2025. I watched people&apos;s home sensors show far worse air than the official numbers, while
        officials were accused of spraying water around the monitoring stations. Nobody could say which number to believe.
        <footer className="mt-1 text-sm not-italic text-kohl/70">Hemesh, PranaNet</footer>
      </blockquote>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {WALL.map((c, i) => (
          <Reveal as="li" key={c.summary} delay={i * 110}>
            <a
              href={c.url}
              target="_blank"
              rel="noreferrer"
              className="group flex h-full flex-col rounded border border-maroon/30 bg-[#fbf1da] p-3.5 shadow-sm transition-colors hover:border-vermilion"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-bold text-maroon">{c.place}</span>
                <span className="shrink-0 text-xs font-semibold text-kohl/60">{c.when}</span>
              </div>
              <p className="mt-1 flex-1 text-[0.95rem] leading-snug">{c.summary}</p>
              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-kohl/60">
                <span className="truncate group-hover:text-vermilion group-hover:underline">{c.source} ↗</span>
                <span className="shrink-0 rounded-full bg-maroon/10 px-2 py-0.5">{KIND[c.kind]}</span>
              </div>
            </a>
          </Reveal>
        ))}
      </ul>
      <p className="mt-5 font-semibold">
        Spray it, switch it off, stuff it with cotton: when one party owns the meter, the number is whatever they need it to be.
      </p>
      <p className="mt-2 text-sm text-kohl/70">
        It doesn&apos;t matter who holds power. The people being measured shouldn&apos;t be the only ones holding the meter.
      </p>
    </>
  );
}
