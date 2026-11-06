// One story chapter over a scene: first the scene alone (the Watcher's moment), then a cream
// paper panel with the text scrolls up over it. Paper-only chapters set `paper`.
export function Chapter({ id, idx, n, title, children, wide = false, paper = false, after = true }: {
  id: string;
  /** index into the SceneStage order; omit for paper chapters (opaque, no scene) */
  idx?: number;
  n: number;
  title: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
  paper?: boolean;
  after?: boolean;
}) {
  const head = (
    <>
      <div className="text-xs font-bold uppercase tracking-[0.22em] text-vermilion">Chapter {n}</div>
      <h2 className="mt-1 text-[2rem] leading-[1.1] sm:text-[2.6rem]">{title}</h2>
    </>
  );
  if (paper) {
    return (
      <section id={id} className="relative bg-cream">
        <div className="folk-band" aria-hidden />
        <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
          {head}
          <div className="mt-4">{children}</div>
        </div>
      </section>
    );
  }
  return (
    <section id={id} data-scene-idx={idx} className="relative">
      <div className="h-[58svh] lg:h-[40svh]" aria-hidden />
      <div className="px-4 lg:px-[5vw]">
        <div className={`paper p-5 sm:p-7 ${wide ? "lg:max-w-[860px]" : "lg:max-w-[560px]"}`}>
          {head}
          <div className="mt-3 text-[1.05rem] leading-relaxed">{children}</div>
        </div>
      </div>
      {after && <div className="h-[28svh]" aria-hidden />}
    </section>
  );
}
