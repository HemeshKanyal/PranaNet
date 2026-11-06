import { WALL } from "@/lib/story/wall";
import { Reveal } from "./Reveal";

const KIND: Record<string, string> = {
  conviction: "court record",
  notice: "official notice",
  news: "news report",
  allegation: "reported allegation",
  inquiry: "court inquiry",
  survey: "survey",
};

/** Chapter I, text column: Hemesh's Delhi story, then the closing lines. */
export function DelhiStory() {
  return (
    <>
      <blockquote className="mt-5 border-l-2 border-vermilion pl-4 italic text-cream/90">
        Delhi, winter 2025. I watched people&apos;s home sensors show far worse air than the official numbers, while officials
        were accused of spraying water around the monitoring stations. Nobody could say which number to believe.
        <footer className="mt-1 text-base not-italic text-sand">Hemesh, PranaNet</footer>
      </blockquote>
      <p className="mt-5 font-semibold text-cream">
        Spray it, switch it off, stuff it with cotton: when one party owns the meter, the number is whatever they need it to be.
      </p>
      <p className="mt-2 text-sand">
        It doesn&apos;t matter who holds power. The people being measured shouldn&apos;t be the only ones holding the meter.
      </p>
    </>
  );
}

/** Chapter I, below: headline clippings (our own one-line summaries + links, never article images). */
export function Clippings() {
  return (
    <ul className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
      {WALL.map((c, i) => (
        <Reveal as="li" key={c.summary} delay={(i % 3) * 110}>
          <a
            href={c.url}
            target="_blank"
            rel="noreferrer"
            className={`group relative block h-full rounded-[3px] bg-cream p-4 pt-5 text-kohl shadow-[0_10px_24px_rgb(0_0_0/0.45)] transition-[transform,box-shadow] duration-300 hover:-translate-y-1.5 hover:rotate-0 hover:shadow-[0_18px_34px_rgb(0_0_0/0.55)] focus-visible:rotate-0 ${i % 2 ? "rotate-1" : "-rotate-1"}`}
          >
            {/* tape strip */}
            <span className="absolute -top-2.5 left-1/2 h-5 w-16 -translate-x-1/2 -rotate-2 bg-saffron/55 shadow-sm" aria-hidden />
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-[family-name:var(--font-rozha)] text-lg text-maroon">{c.place}</span>
              <span className="shrink-0 text-sm font-semibold text-kohl/60">{c.when}</span>
            </div>
            <p className="mt-1 text-[1.05rem] leading-snug">{c.summary}</p>
            <div className="mt-3 flex items-center justify-between gap-2 text-sm text-kohl/60">
              <span className="truncate">{c.source}</span>
              <span className="shrink-0 rounded-full bg-maroon/10 px-2 py-0.5">{KIND[c.kind]}</span>
            </div>
            <span className="mt-2 block text-sm font-bold text-vermilion opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100">
              Read the source →
            </span>
          </a>
        </Reveal>
      ))}
    </ul>
  );
}
