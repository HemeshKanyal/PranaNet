import Link from "next/link";
import { PageBanner } from "@/components/PageBanner";

const PIPELINE = [
  { who: "Sensor", what: "ESP32 measures dust, temperature and humidity, then signs the reading with its own key (EIP-191 over a 264-byte packed message).", chain: "device key" },
  { who: "Relayer", what: "Receives the signed reading, checks the signature off-chain and pays gas. It is untrusted: changing any value breaks the signature.", chain: "untrusted" },
  { who: "Arkiv", what: "Every raw reading is stored openly as a queryable entity (by device, cell, time, PM level) for about 3 days.", chain: "Arkiv" },
  { who: "Sepolia", what: "Readings.submitEpoch runs ecrecover, checks the device is registered and active, and requires a strictly increasing nonce.", chain: "Readings.sol" },
  { who: "Verifier", what: "Compares each device with the median of its cell and neighbouring cells, and with the nearest official station.", chain: "Registry.flag" },
  { who: "Slash", what: "Three consecutive flags slash the stake into the reward pool, deactivate the device and revoke its ENS name.", chain: "Registry.slash" },
];

const STACK = [
  ["World ID", "Operators prove they are unique humans. One nullifier, at most 3 devices, so nobody can flood a neighbourhood with sock-puppet sensors."],
  ["ENS", "Each device gets <name>.prananet.eth with a geohash record: a readable identity that disappears if it cheats."],
  ["Arkiv", "Open, queryable storage for raw readings and flags, so anyone can audit without trusting our server."],
  ["Sepolia contracts", "Registry (devices, stake, flags, slashing) and Readings (signature + nonce checks)."],
  ["x402 on Hedera", "AI agents pay per request for cross-checked, baseline-corrected cell data."],
];

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <PageBanner kicker="How it works" title="Air-quality data that holds up in a dispute" art="watcher-in-folk-art-chair-pose">
        Cheap sensors are everywhere, but their numbers are easy to fake or fudge. PranaNet makes every reading traceable to a
        physical device, checks it against the neighbours, and puts the operator&apos;s money on the line.
      </PageBanner>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">From sensor to verified reading</h2>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PIPELINE.map((p, i) => (
            <li key={p.who} className="card relative p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-xs font-semibold text-ground">{i + 1}</span>
                <h3 className="font-semibold">{p.who}</h3>
                <span className="ml-auto rounded-full bg-chain-soft px-2 py-0.5 font-mono text-[10px] text-chain">{p.chain}</span>
              </div>
              <p className="mt-2 text-sm text-muted">{p.what}</p>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-muted">
          You can repeat steps 1–4 yourself: open any reading from a device page and the{" "}
          <Link href="/devices" className="text-chain underline">record page</Link> re-runs the signature check in your browser.
        </p>
      </section>

      <section className="mt-10 grid gap-6 md:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-semibold">When is a device flagged?</h2>
          <p className="mt-2 text-sm text-muted">
            Each epoch, a device is compared with the median of devices in its geohash cell and the neighbouring cells. It is
            flagged if it differs by <b className="text-ink">more than 50% and more than 25 µg/m³</b>. A looser threshold applies
            against the nearest official (OpenAQ) station.
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs">
            <span className="rounded-full bg-amber-400/15 px-2 py-1 font-medium text-amber-300">flag</span>→
            <span className="rounded-full bg-amber-400/15 px-2 py-1 font-medium text-amber-300">flag</span>→
            <span className="rounded-full bg-amber-400/15 px-2 py-1 font-medium text-amber-300">flag</span>→
            <span className="rounded-full bg-red-500/15 px-2 py-1 font-medium text-red-300">slashed</span>
          </div>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold">Privacy</h2>
          <p className="mt-2 text-sm text-muted">
            No GPS and no personal data on-chain. A device publishes only a 6-character geohash (a cell of roughly 1.2 × 0.6 km).
            World ID reveals a nullifier, not who you are.
          </p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">The stack</h2>
        <dl className="card mt-4 divide-y divide-line">
          {STACK.map(([k, v]) => (
            <div key={k} className="grid gap-1 px-5 py-3 sm:grid-cols-[180px_1fr]">
              <dt className="font-medium">{k}</dt>
              <dd className="text-sm text-muted">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-10 card p-5">
        <h2 className="font-semibold">Honest limits</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
          <li>The Sharp GP2Y1014AU0F is a dust proxy, not a calibrated PM2.5 counter. Each unit measures its own clean-air baseline at boot and reports the rise above it.</li>
          <li>The AQI shown uses India&apos;s CPCB breakpoints on instant readings, while CPCB defines them on 24-hour averages. Treat it as indicative.</li>
          <li>Some devices are simulated to demonstrate neighbour cross-checking. They are always labelled &quot;simulated&quot;.</li>
        </ul>
      </section>
    </main>
  );
}
