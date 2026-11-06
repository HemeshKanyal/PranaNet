import { REWARDS, X402 } from "@/lib/story/evidence";
import { Reveal } from "./Reveal";

const CUSTOMERS = [
  ["Builders", "prove dust compliance at their sites"],
  ["Regulators", "audit without sending inspectors"],
  ["Apps", "show air people can trust"],
  ["Researchers", "get signed, timestamped history"],
  ["AI agents", "pay per request over x402"],
] as const;

const FLOW = [
  { k: "Agent asks", v: "GET /api/aqi → 402 Payment Required" },
  { k: "Pays", v: `${X402.hbar} HBAR on Hedera`, href: X402.payment, link: "HashScan" },
  { k: "Logged", v: "purchase written to an HCS topic", href: X402.hcsTopic, link: "topic" },
  { k: "Bridged", v: "revenue → RewardPool.fundPool on Sepolia", href: X402.fundPool, link: "Etherscan" },
  { k: "Earned", v: `honest node claims ${REWARDS.honestClaim.eth} ETH`, href: REWARDS.honestClaim.tx, link: "claimRewards" },
];

/** Chapter 7: who pays for honest air. */
export function WhoPays() {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        <p className="text-lg leading-relaxed">
          Customers buy <b>verified data</b>, not raw readings: a cross-checked value with the signatures behind it.
        </p>
        <ul className="mt-4 grid gap-2">
          {CUSTOMERS.map(([who, what], i) => (
            <Reveal as="li" key={who} delay={i * 80} className="flex gap-3 rounded border border-maroon/25 bg-[#fbf1da] px-3 py-2">
              <b className="w-28 shrink-0 text-maroon">{who}</b>
              <span>{what}</span>
            </Reveal>
          ))}
        </ul>
        <p className="mt-4 font-semibold">No token. Rewards come from revenue.</p>
      </div>
      <div>
        <h3 className="display text-2xl text-maroon">A real agent payment</h3>
        <ol className="relative mt-3 border-l-4 border-saffron pl-5">
          {FLOW.map((f, i) => (
            <Reveal as="li" key={f.k} delay={i * 120} className="relative pb-4 last:pb-0">
              <span className="absolute -left-[1.85rem] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-maroon bg-cream text-xs font-bold">{i + 1}</span>
              <div className="font-bold">{f.k}</div>
              <div className="text-[1.05rem]">
                {f.v}
                {f.href && (
                  <>
                    {" "}
                    <a href={f.href} target="_blank" rel="noreferrer" className="text-vermilion underline">{f.link} ↗</a>
                  </>
                )}
              </div>
            </Reveal>
          ))}
        </ol>
        <p className="mt-3 text-sm text-kohl/70">
          Try it: the API advertises itself at <a className="underline" href={X402.apiDiscovery} target="_blank" rel="noreferrer">/.well-known/x402</a>.
        </p>
      </div>
    </div>
  );
}
