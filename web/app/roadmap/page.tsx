import type { Metadata } from "next";
import Link from "next/link";
import { PageBanner } from "@/components/PageBanner";
import { Art } from "@/components/story/Art";
import { REPO } from "@/lib/story/evidence";

export const metadata: Metadata = { title: "Roadmap · PranaNet" };

const DOC = `${REPO}/blob/main/docs/ROADMAP.md`;

const STATION: [string, string][] = [
  ["Laser PM sensor", "real PM1 / PM2.5 / PM10 instead of the hackathon's dust proxy (SPS30 / SEN5x class)"],
  ["Secure element", "the signing key is born inside the chip and never leaves it; factory attestation, so only genuine stations can register"],
  ["GNSS + Proof of Location", "a signed daily location; moving a station resets its score, WeatherXM-style"],
  ["Tamper and health sensing", "lid switch, accelerometer, fan and flow checks: a blocked inlet or a moved box shows up in the signed data"],
  ["Secure boot and signed OTA", "readings carry the firmware hash, so unofficial firmware is visible"],
  ["Wi-Fi + LoRaWAN / LTE-M, store-and-forward", "outages give late readings, not missing ones; solar kit for sites"],
  ["Calibrated per unit", "co-located with a reference monitor; the certificate lives on Arkiv, linked from the ENS name"],
];

const PHASES = [
  {
    n: "1",
    title: "PranaNet Station v1",
    when: "months 0–4",
    points: ["Purpose-built hardware (left)", "20 stations co-located at a reference site through monsoon and winter", "Every one of the five tricks caught by the hardware itself"],
  },
  {
    n: "2",
    title: "A fairer, harder protocol",
    when: "in parallel",
    points: [
      "Quality-of-Data score instead of a yes/no flag; rewards weighted by quality, location and coverage",
      "Warnings and a review window before any slash: honest faults never cost stake",
      "Judge only with enough real neighbours from different operators; no simulated nodes",
      "Several verifiers and relayers; one Merkle root per cell per minute on an L2; audits and a bug bounty",
    ],
  },
  {
    n: "3",
    title: "The product people pay for",
    when: "months 4–9",
    points: [
      "Construction-site compliance kit for Mumbai: stations, dashboard, signed monthly reports",
      "Audit portal for regulators; API for apps, researchers and AI agents (x402 + fiat)",
      "Operator app: claim by QR, guided install, health alerts, UPI payouts",
      "No token: rewards come from revenue",
    ],
  },
  {
    n: "4",
    title: "Scale",
    when: "year 2",
    points: ["Delhi NCR, where this started, then any city with a dispute about its air", "Open hardware spec so other makers can build certified stations", "Community governance of scoring and reward rules"],
  },
];

const LESSONS: [string, string][] = [
  ["An honest board was slashed for three false zeros", "faults and fraud must be told apart"],
  ["The ESP32's key can be read out of flash", "a secure element"],
  ["The dust sensor is a proxy needing calibration", "a laser PM sensor, calibrated per unit"],
  ["Cross-checks leaned on simulated neighbours", "real density rules"],
];

export default function RoadmapPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <PageBanner
        kicker="What we build next"
        title="From a hackathon demo to a network you can take to court"
        art="watcher-and-builder-walking-together"
        actions={<a href={DOC} target="_blank" rel="noreferrer" className="btn-primary rounded-full px-5 py-2.5 font-bold">Read the full plan</a>}
      >
        Today two hand-wired boards prove the idea. To make it real, the trust has to come from the hardware, the judging has to be
        fair to honest operators, and someone has to pay for the data. We are learning from WeatherXM, which already does this for weather.
      </PageBanner>

      <section className="mt-12 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="ledger p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <Art name="vintage-folk-art-aq-sensor" small className="h-24 w-auto shrink-0" />
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-vermilion">Phase 1 hardware</p>
              <h2 className="font-[family-name:var(--font-rozha)] text-3xl text-maroon">PranaNet Station v1</h2>
              <p className="mt-1 text-kohl/75">Target: under ₹10,000 retail. The ₹1,000 DIY node stays as a labelled community tier.</p>
            </div>
          </div>
          <ul className="mt-5 space-y-3">
            {STATION.map(([k, v]) => (
              <li key={k} className="border-t border-maroon/15 pt-3">
                <b className="text-maroon">{k}</b>
                <span className="block text-kohl/80">{v}</span>
              </li>
            ))}
          </ul>
        </div>

        <ol className="space-y-5">
          {PHASES.map((p) => (
            <li key={p.n} className="rounded-lg border border-line bg-surface p-5 sm:p-6">
              <div className="flex items-baseline gap-3">
                <span className="font-[family-name:var(--font-rozha)] text-3xl text-saffron">{p.n}</span>
                <h3 className="font-[family-name:var(--font-rozha)] text-2xl text-cream">{p.title}</h3>
                <span className="ml-auto text-sm text-muted">{p.when}</span>
              </div>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-lg text-cream/85 marker:text-saffron">
                {p.points.map((x) => <li key={x}>{x}</li>)}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14">
        <h2 className="font-[family-name:var(--font-rozha)] text-3xl text-cream">What the hackathon taught us</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {LESSONS.map(([what, fix]) => (
            <div key={what} className="rounded-lg border border-line bg-surface p-4 text-lg">
              <p className="text-cream">{what}</p>
              <p className="mt-1 text-muted">→ {fix}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-muted">
          Dates are plans, not promises; component names are examples of the classes we&apos;ll evaluate.{" "}
          <Link href="/run-a-node" className="link-sweep text-cream">Build today&apos;s node</Link> ·{" "}
          <a href={DOC} target="_blank" rel="noreferrer" className="link-sweep text-cream">full roadmap on GitHub</a>
        </p>
      </section>
    </main>
  );
}
