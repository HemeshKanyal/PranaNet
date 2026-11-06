import type { Metadata } from "next";
import { Story } from "@/components/story/Story";
import { arkivWriter } from "@/lib/arkiv";
import { deriveAreas } from "@/lib/area";
import { getDevices } from "@/lib/relayer";
import { getCell } from "@/lib/verifier";

export const metadata: Metadata = {
  title: "PranaNet: the air doesn't lie, the readings can",
  description: "A network of honest air sensors that anyone can run, check and get paid for. Signed at the source, cross-checked by neighbours, backed by stake.",
};

// The Arkiv writer (relayer wallet) is resolved here, so the browser only talks to Arkiv itself.
export default async function Home() {
  // The official-station cell is fetched here too (short timeout; Render may be cold) so the hero
  // renders with the place name already in it and nothing shifts when it arrives.
  const [writer, cell] = await Promise.all([
    arkivWriter(),
    getDevices()
      .then((ds) => deriveAreas(ds)[0]?.devices.find((d) => !d.simulated)?.geohash ?? null)
      .then((g) => (g ? getCell(g, 3500) : null))
      .catch(() => null),
  ]);
  return (
    <main className="story">
      <Story arkivWriter={writer} initialCell={cell} />
    </main>
  );
}
