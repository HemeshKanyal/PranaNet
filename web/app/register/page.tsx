import { PageBanner } from "@/components/PageBanner";
import { RegisterForm } from "@/components/RegisterForm";

const ONCHAIN = [
  ["World ID proof", "verified server-side by the relayer; the nullifier caps you at 3 devices"],
  ["Registry.registerDevice", "links device key, owner, label and geohash on Sepolia"],
  ["ENS subname", "<name>.prananet.eth with a geohash text record; revoked if slashed"],
  ["Stake", "a small deposit per device, slashed after 3 consecutive flags"],
];

export default function RegisterPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <PageBanner kicker="Join the network" title="Register a device" art="vintage-folk-art-aq-sensor">
        Put a PranaNet sensor on your balcony and its readings join the map, backed by your stake and checked by your neighbours.
      </PageBanner>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <RegisterForm />
        <aside className="card h-fit overflow-hidden">
          <div className="border-b border-line bg-chain-soft/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-chain">
            What happens on-chain
          </div>
          <ol className="space-y-3 p-4 text-sm">
            {ONCHAIN.map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-chain text-[11px] font-semibold text-ground">{i + 1}</span>
                <div>
                  <div className="font-medium">{t}</div>
                  <div className="text-muted">{d}</div>
                </div>
              </li>
            ))}
          </ol>
          <p className="border-t border-line px-4 py-3 text-xs text-muted">No personal data goes on-chain. Devices publish only a geohash cell.</p>
        </aside>
      </div>
    </main>
  );
}
