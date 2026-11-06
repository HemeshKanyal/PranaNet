"use client";
// Chapter 5: the real slash run (docs/evidence/m4-slash.md), driven by scroll. A tall section
// with a sticky panel; progress through it steps the story. Reduced motion: everything at once.
import { REWARDS, SLASH_RUN } from "@/lib/story/evidence";
import { useReducedMotion, useScrollProgress } from "@/lib/story/hooks";
import { Eye, type EyeState } from "./Eye";
import { FolkRule, Stagger, ChapterHeading } from "./Chapter";
import { Stage } from "./Stage";
import { moodLabel } from "@/lib/story/poses";

const STEPS = [
  "bkc-02 reads 33.0 µg/m³, in line with its neighbours.",
  "Tissue on the sensor: 580.9 µg/m³ against a median of 36.1. Flag 1.",
  "Still 903.9 µg/m³. Flag 2.",
  "903.9 again. Flag 3: the contract slashes the node in the same transaction.",
  "Its 0.01 ETH stake slides into the reward pool.",
  "Its name is revoked: bkc-02.prananet.eth now resolves to nobody.",
  "Cheaters pay the honest: bkc-01 claims its share; bkc-02's claim reverts.",
];
const AT = [0, 0.14, 0.27, 0.4, 0.54, 0.68, 0.82];

export function SlashSequence() {
  const reduced = useReducedMotion();
  const [ref, p] = useScrollProgress<HTMLDivElement>();
  const step = reduced ? STEPS.length - 1 : AT.filter((a) => p >= a).length - 1;
  const value = step === 0 ? SLASH_RUN.before.ug : step === 1 ? SLASH_RUN.flags[0].ug : SLASH_RUN.flags[Math.min(2, step - 1)].ug;
  const eye: EyeState = step >= 3 ? "slashed" : step >= 1 ? "flagged" : "open";

  return (
    <>
      <section id="honest-work" className="scroll-mt-16 pt-16 lg:pt-24">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
          <Stage pose="gasmask" mood="Severe" label={moodLabel("Severe")} />
          <Stagger className="prose-col text-[1.08rem]">
            <ChapterHeading id="honest-work" />
            <p className="mt-5">
              A signed reading that agrees with its neighbours is a unit of <b className="text-cream">honest work</b> and earns from the reward
              pool. Every node stakes a deposit. Three flags in a row and it&apos;s slashed.
            </p>
            <p className="mt-3 text-sand">Scroll through the real run from our demo: tissue on the sensor of bkc-02.</p>
          </Stagger>
        </div>
        <div ref={ref} className={reduced ? "py-12" : "relative h-[300svh]"}>
          <div className={reduced ? "px-4" : "sticky top-0 flex h-svh items-center px-4"}>
            <div className="ledger mx-auto w-full max-w-2xl p-5 sm:p-8">
          <div className="mt-4 flex items-center gap-4">
                <Eye state={eye} size={60} blink={step === 0} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold">
                    <span className="relative inline-block">
                      {SLASH_RUN.ens}
                      <span className="absolute left-0 top-1/2 h-[3px] bg-vermilion transition-[width] duration-700" style={{ width: step >= 5 ? "100%" : "0%" }} aria-hidden />
                    </span>
                    {step >= 5 && <span className="ml-2 rounded bg-vermilion px-1.5 py-0.5 text-xs font-bold text-cream">revoked</span>}
                  </div>
                  <div className={`font-mono text-4xl font-bold tabular-nums transition-colors sm:text-5xl ${step >= 1 ? "text-vermilion" : "text-kohl"}`}>
                    {value.toFixed(1)}
                    <span className="ml-1 text-base font-normal text-kohl/70">µg/m³</span>
                  </div>
                </div>
              </div>

              {/* Three flags, each an on-chain transaction */}
              <ol className="mt-4 grid grid-cols-3 gap-2" aria-label="Flags">
                {SLASH_RUN.flags.map((f, i) => {
                  const on = step >= i + 1;
                  return (
                    <li key={f.n}>
                      <a
                        href={f.tx}
                        target="_blank"
                        rel="noreferrer"
                        className={`block rounded border-2 px-2 py-1.5 text-center text-xs font-bold transition-colors ${on ? "border-vermilion bg-vermilion text-cream" : "border-dashed border-maroon/30 text-kohl/40"}`}
                      >
                        {i === 2 ? "Flag 3 + slash" : `Flag ${f.n}`}
                        <span className="block font-normal opacity-90">{f.ug} vs {f.medianUg} ↗</span>
                      </a>
                    </li>
                  );
                })}
              </ol>

              {/* Stake → pool */}
              <div className="relative mt-4 flex items-center justify-between rounded border [container-type:inline-size] border-maroon/30 bg-[#fbf1da] px-3 py-2 text-xs font-semibold">
                <span>bkc-02 stake</span>
                <span>reward pool</span>
                <span
                  className="absolute left-[5.75rem] top-[calc(50%-1rem)] flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#b9770e] bg-saffron text-[9px] font-bold text-kohl shadow transition-transform duration-1000 ease-in-out"
                  style={{ transform: step >= 4 ? "translateX(calc(100cqw - 13.25rem))" : "none" }}
                  aria-label={`${SLASH_RUN.stakeEth} ETH stake ${step >= 4 ? "in the reward pool" : "held by the node"}`}
                >
                  0.01Ξ
                </span>
              </div>

              <p aria-live="polite" className="mt-3 min-h-[2.75rem] text-[0.95rem] font-semibold leading-snug">
                {STEPS[step]}
              </p>

              <div className={`grid gap-1 text-xs ${step >= 6 ? "visible" : "invisible"}`}>
                <a className="text-leaf underline" href={REWARDS.honestClaim.tx} target="_blank" rel="noreferrer">
                  ✓ {REWARDS.honestClaim.ens.split(".")[0]} claimRewards: {REWARDS.honestClaim.eth} ETH for {REWARDS.honestClaim.epochs} honest epochs ↗
                </a>
                <a className="text-vermilion underline" href={REWARDS.slashedClaim.tx} target="_blank" rel="noreferrer">
                  ✕ {REWARDS.slashedClaim.ens.split(".")[0]} claimRewards reverts: {REWARDS.slashedClaim.error} ↗
                </a>
                <span className="text-kohl/70">
                  <a className="underline" href={SLASH_RUN.slashTx} target="_blank" rel="noreferrer">Slash tx</a> ·{" "}
                  <a className="underline" href={SLASH_RUN.ensRevoke[0].tx} target="_blank" rel="noreferrer">ENS revoke</a> (on this first run the revoke
                  ran out of gas and was redone by script; it now happens inside the slash transaction)
                </span>
              </div>
              <p className="mt-3 font-[family-name:var(--font-rozha)] text-2xl text-maroon">Cheaters pay the honest.</p>
            </div>
          </div>
        </div>
      </section>
      <FolkRule />
    </>
  );
}
