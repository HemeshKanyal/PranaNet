import Link from "next/link";
import { DevicesTable } from "@/components/DevicesTable";

export default function DevicesPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Registered devices</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Each device holds its own signing key, owns an ENS subname and is backed by its operator&apos;s stake. Operators are
            verified humans (World ID), at most 3 devices each.
          </p>
        </div>
        <Link href="/register" className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white">Register a device</Link>
      </div>
      <div className="mt-6">
        <DevicesTable />
      </div>
    </main>
  );
}
