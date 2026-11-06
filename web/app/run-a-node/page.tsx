import type { Metadata } from "next";
import Link from "next/link";
import { FIRMWARE, REPO } from "@/lib/story/evidence";

export const metadata: Metadata = { title: "Run a node · PranaNet" };

const PARTS = [
  ["ESP32 DevKit (30-pin)", "the node: signs every reading with its own key", "₹450"],
  ["Sharp GP2Y1014AU0F", "optical dust sensor (PM proxy)", "₹400"],
  ["150 Ω resistor + 220 µF capacitor", "the sensor's LED supply, per the datasheet", "₹10"],
  ["10 kΩ + 22 kΩ resistors", "divider: 5 V sensor output → 3.3 V ADC", "₹5"],
  ["DHT22 (optional)", "temperature and humidity", "₹150"],
  ["USB cable + 5 V charger, jumper wires", "power and hookup", "—"],
];

const STEPS: { t: string; b: React.ReactNode }[] = [
  { t: "Wire it", b: "Follow the diagram. Keep the sensor's inlet clear of tissue, smoke and incense when the board powers up: it measures its clean-air baseline in the first 10 seconds." },
  {
    t: "Flash the firmware",
    b: (
      <>
        Copy <code>secrets.example.h</code> to <code>secrets.h</code> (Wi-Fi, relayer URL, your area&apos;s geohash), then compile and upload with
        arduino-cli. On first boot the board creates its key from the hardware RNG and prints its address (serial command <code>addr</code>).{" "}
        <a className="text-chain underline" href={FIRMWARE} target="_blank" rel="noreferrer">Firmware folder ↗</a>
      </>
    ),
  },
  {
    t: "Register with World ID",
    b: (
      <>
        On <Link className="text-chain underline" href="/register">Register</Link>, prove you&apos;re a unique human (nothing about who you are is revealed),
        paste the device address, pick a label and your 6-character geohash cell. The node gets a name like <code>you-01.prananet.eth</code>.
        One person can run up to 3 nodes.
      </>
    ),
  },
  { t: "Stake", b: "Put down a small deposit (0.01 ETH on the testnet). It's what you lose if your node is caught lying three times in a row." },
  { t: "Start earning", b: "Every signed reading that agrees with its neighbours is a unit of honest work. Revenue from data buyers funds the reward pool; claim your share any time." },
];

function Wiring() {
  const box = "fill-white stroke-ink";
  const wire = (c: string) => ({ fill: "none", stroke: c, strokeWidth: 2.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });
  return (
    <svg viewBox="0 0 640 330" className="w-full" role="img" aria-label="Wiring diagram: Sharp GP2Y1014AU0F and DHT22 to an ESP32 DevKit">
      {/* ESP32 */}
      <rect x="430" y="40" width="180" height="250" rx="10" className={box} strokeWidth="2" />
      <text x="520" y="66" textAnchor="middle" className="fill-ink text-[15px] font-bold">ESP32 DevKit</text>
      {[["VIN (5 V)", 100], ["GND", 140], ["D25", 180], ["D34", 220], ["3V3", 255], ["D4", 280]].map(([l, y]) => (
        <g key={l as string}>
          <circle cx="430" cy={y as number} r="4" className="fill-ink" />
          <text x="442" y={(y as number) + 5} className="fill-ink text-[13px]">{l}</text>
        </g>
      ))}
      {/* Sharp sensor */}
      <rect x="20" y="40" width="150" height="230" rx="10" className={box} strokeWidth="2" />
      <text x="95" y="62" textAnchor="middle" className="fill-ink text-[13px] font-bold">Sharp GP2Y1014</text>
      {[["1 V-LED", 90], ["2 LED-GND", 120], ["3 LED", 150], ["4 S-GND", 180], ["5 Vo", 210], ["6 Vcc", 240]].map(([l, y]) => (
        <g key={l as string}>
          <circle cx="170" cy={y as number} r="4" className="fill-ink" />
          <text x="160" y={(y as number) + 5} textAnchor="end" className="fill-ink text-[12px]">{l}</text>
        </g>
      ))}
      {/* 5 V rail: Vcc direct, V-LED via 150 Ω, 220 µF to GND */}
      <path d="M170 240 H300 V100 H430" {...wire("#c8341e")} />
      <path d="M170 90 H205" {...wire("#c8341e")} />
      <rect x="205" y="82" width="40" height="16" rx="3" className="fill-amber-100 stroke-ink" />
      <text x="225" y="94" textAnchor="middle" className="fill-ink text-[10px]">150 Ω</text>
      <path d="M245 90 H300" {...wire("#c8341e")} />
      <path d="M190 90 V60 H260" {...wire("#c8341e")} />
      <text x="262" y="50" className="fill-ink text-[10px]">220 µF to GND</text>
      {/* grounds */}
      <path d="M170 120 H280 V140 H430 M170 180 H280 V140" {...wire("#2a1a12")} />
      {/* LED control */}
      <path d="M170 150 H260 V180 H430" {...wire("#4338ca")} />
      {/* Vo through 10k/22k divider */}
      <path d="M170 210 H330" {...wire("#0e5a43")} />
      <rect x="330" y="202" width="40" height="16" rx="3" className="fill-amber-100 stroke-ink" />
      <text x="350" y="214" textAnchor="middle" className="fill-ink text-[10px]">10 kΩ</text>
      <path d="M370 210 H400 V220 H430" {...wire("#0e5a43")} />
      <path d="M400 220 V250" {...wire("#0e5a43")} />
      <rect x="380" y="250" width="40" height="16" rx="3" className="fill-amber-100 stroke-ink" />
      <text x="400" y="262" textAnchor="middle" className="fill-ink text-[10px]">22 kΩ</text>
      <text x="400" y="282" textAnchor="middle" className="fill-ink text-[10px]">to GND</text>
      {/* DHT22 */}
      <rect x="230" y="290" width="110" height="30" rx="6" className="fill-white stroke-ink" strokeDasharray="5 4" />
      <text x="285" y="310" textAnchor="middle" className="fill-ink text-[12px]">DHT22 (optional)</text>
      <path d="M340 300 H380 V255 H430 M340 312 H410 V280 H430" {...wire("#6b6a2a")} />
    </svg>
  );
}

export default function RunANodePage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <p className="text-sm font-semibold uppercase tracking-wider text-brand">A democracy of honest nodes</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">Run a node</h1>
      <p className="mt-2 max-w-2xl text-muted">
        About ₹1,000 of parts, an hour of wiring, and your air joins a network nobody can quietly rewrite. Your node signs every reading
        on the device; neighbours and the official station check it; honest work earns.
      </p>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="card p-5">
          <h2 className="font-semibold">Parts (~₹1,000)</h2>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {PARTS.map(([p, why, cost]) => (
                <tr key={p} className="border-t border-line align-top">
                  <td className="py-2 pr-2 font-medium">{p}<div className="text-xs font-normal text-muted">{why}</div></td>
                  <td className="py-2 text-right tabular-nums text-muted">{cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted">Prices are rough Indian retail. The Sharp sensor is a low-cost PM proxy, calibrated against the nearest official station.</p>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold">Wiring</h2>
          <div className="mt-3"><Wiring /></div>
          <p className="mt-2 text-xs text-muted">
            D25 drives the sensor LED (active low); Vo reaches D34 through the 10k/22k divider (×1.45). The DHT22 data line goes to D4 with 3V3 power.
          </p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Five steps</h2>
        <ol className="mt-3 grid gap-3 sm:grid-cols-2">
          {STEPS.map((s, i) => (
            <li key={s.t} className="card flex gap-3 p-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">{i + 1}</span>
              <div>
                <h3 className="font-semibold">{s.t}</h3>
                <p className="mt-1 text-sm text-muted">{s.b}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        <Link href="/register" className="rounded-lg bg-ink px-4 py-2 font-medium text-white">Register a node</Link>
        <Link href="/live" className="rounded-lg border border-line px-4 py-2 font-medium">See the live map</Link>
        <a href={REPO} target="_blank" rel="noreferrer" className="rounded-lg border border-line px-4 py-2 font-medium">GitHub</a>
      </div>
    </main>
  );
}
