// Page header for the app pages, in the story's language: Rozha heading, a piece of the
// hand-painted kit on the right, and the lotus border band underneath.
import { Art } from "./story/Art";
import { artSrc, type ArtName } from "@/lib/story/poses";

export function PageBanner({ kicker, title, art, children, actions, artHeight = "h-56 md:h-64" }: {
  kicker?: string;
  title: React.ReactNode;
  art: ArtName;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  /** height classes for the art (wide pieces want less) */
  artHeight?: string;
}) {
  return (
    <header className="relative">
      <div className="grid items-end gap-6 md:grid-cols-[1fr_auto]">
        <div className="pb-6">
          {kicker && <p className="text-sm font-bold uppercase tracking-[0.2em] text-saffron">{kicker}</p>}
          <h1 className="mt-1 font-[family-name:var(--font-rozha)] text-[2.4rem] font-normal leading-[1.1] text-cream sm:text-5xl">{title}</h1>
          {children && <div className="mt-3 max-w-2xl text-lg leading-relaxed text-muted">{children}</div>}
          {actions && <div className="mt-5 flex flex-wrap gap-3">{actions}</div>}
        </div>
        <div className={`relative mx-auto hidden sm:block ${artHeight}`} aria-hidden>
          <div className="absolute -bottom-1 left-1/2 h-4 w-3/4 -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgb(0_0_0/0.6),transparent)]" />
          <Art name={art} small priority className="relative h-full w-auto max-w-none drop-shadow-[0_10px_14px_rgb(0_0_0/0.5)]" />
        </div>
      </div>
      <div
        className="h-5 opacity-80"
        style={{ backgroundImage: `url(${artSrc("hand-painted-lotus-scallop-border", "480")})`, backgroundSize: "auto 100%", backgroundRepeat: "repeat-x" }}
        aria-hidden
      />
    </header>
  );
}
