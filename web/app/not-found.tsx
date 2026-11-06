import Link from "next/link";
import { PageBanner } from "@/components/PageBanner";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <PageBanner
        kicker="404"
        title="Nothing to measure here"
        art="masked-watcher-in-ornate-cloak"
        actions={
          <>
            <Link href="/" className="btn-primary rounded-full px-5 py-2.5 font-bold">Back to the story</Link>
            <Link href="/live" className="link-sweep py-2.5 font-bold text-cream">Live map</Link>
          </>
        }
      >
        This page doesn&apos;t exist, or the device you&apos;re looking for was never registered.
      </PageBanner>
    </main>
  );
}
