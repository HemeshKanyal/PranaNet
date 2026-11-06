import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { LiveProvider } from "@/components/LiveProvider";
import { SiteHeader } from "@/components/SiteHeader";
import { getDevices, RELAYER_URL } from "@/lib/relayer";
import { getFlags } from "@/lib/arkiv";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PranaNet: verifiable air quality",
  description: "Signed sensor readings, cross-checked by neighbours, with stake on the line.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [devices, flags] = await Promise.all([getDevices(), getFlags()]);
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <LiveProvider
          initialDevices={devices}
          initialFlags={flags}
          relayerUrl={RELAYER_URL}
          wsUrl={process.env.NEXT_PUBLIC_RELAYER_WS_URL || ""}
        >
          <SiteHeader />
          {children}
          <footer className="mx-auto mt-16 max-w-7xl px-4 pb-10 text-xs text-muted">
            PranaNet · ETHGlobal Mumbai 2026 · Sensor values are a PM proxy (Sharp GP2Y1014AU0F); AQI shown is indicative,
            computed on instant readings with India&apos;s CPCB breakpoints.
          </footer>
        </LiveProvider>
      </body>
    </html>
  );
}
