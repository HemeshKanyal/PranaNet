import Link from "next/link";
import { DevicesTable } from "@/components/DevicesTable";
import { PageBanner } from "@/components/PageBanner";

export default function DevicesPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <PageBanner
        kicker="Every eye on the network"
        title="Registered devices"
        art="minimalist-black-teardrop-eye-icon"
        artHeight="h-28 md:h-36"
        actions={<Link href="/register" className="btn-primary rounded-full px-5 py-2.5 font-bold">Register a device</Link>}
      >
        Each device holds its own signing key, owns an ENS subname and is backed by its operator&apos;s stake. Operators are
        verified humans (World ID), at most 3 devices each.
      </PageBanner>
      <div className="mt-6">
        <DevicesTable />
      </div>
    </main>
  );
}
