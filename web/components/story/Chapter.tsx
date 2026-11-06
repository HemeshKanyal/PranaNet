"use client";
// Editorial chapter: Roman-numeral heading, text column (lines stagger in) and a stage on the
// other side, alternating; full-width module (ledger card) below. Mobile: stage first.
import { chapter, type ChapterId } from "@/lib/story/chapters";
import { useInView } from "@/lib/story/hooks";

export function ChapterHeading({ id }: { id: ChapterId }) {
  const c = chapter(id);
  return (
    <h2 className="text-[2.3rem] leading-[1.12] text-cream sm:text-[3.2rem] lg:text-[3.6rem]">
      <span className="text-saffron">{c.roman}</span>
      <span className="text-sand"> · </span>
      {c.title}
    </h2>
  );
}

export function Stagger({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <div ref={ref} data-in={inView} className={`stagger ${className}`}>
      {children}
    </div>
  );
}

export function Chapter({ id, stage, side = "right", children, below }: {
  id: ChapterId;
  stage?: React.ReactNode;
  /** which side the stage sits on (desktop); alternate per chapter */
  side?: "left" | "right";
  children: React.ReactNode;
  below?: React.ReactNode;
}) {
  return (
    <>
      <section id={id} className="scroll-mt-16 py-16 lg:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className={`grid items-center gap-8 ${stage ? "lg:grid-cols-2 lg:gap-16" : ""}`}>
            {stage && <div className={side === "left" ? "lg:order-1" : "lg:order-2"}>{stage}</div>}
            <Stagger className={`prose-col text-lg lg:text-[1.3rem] ${side === "left" ? "lg:order-2" : "lg:order-1"}`}>
              <ChapterHeading id={id} />
              {children}
            </Stagger>
          </div>
          {below && <div className="mt-12">{below}</div>}
        </div>
      </section>
      <FolkRule />
    </>
  );
}

/** Thin folk-border rule between chapters: scallops and dots in saffron at ~40%. */
export function FolkRule() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6" aria-hidden>
      <svg className="block h-[14px] w-full text-saffron opacity-40" preserveAspectRatio="none">
        <defs>
          <pattern id="folk-rule" width="24" height="14" patternUnits="userSpaceOnUse">
            <path d="M0 4 Q6 13 12 4 Q18 13 24 4" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="12" cy="11.5" r="1.3" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="14" fill="url(#folk-rule)" />
      </svg>
    </div>
  );
}

export function Ledger({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`ledger p-5 sm:p-8 ${className}`}>{children}</div>;
}
