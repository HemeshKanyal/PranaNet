import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { LiveProvider } from "@/components/LiveProvider";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getDevices, RELAYER_URL } from "@/lib/relayer";
import { getFlags } from "@/lib/arkiv";
import { mukta, rozha } from "@/lib/story/fonts";

const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PranaNet: verifiable air quality",
  description: "Signed sensor readings, cross-checked by neighbours, with stake on the line.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [devices, flags] = await Promise.all([getDevices(), getFlags()]);
  return (
    <html lang="en" className={`${rozha.variable} ${mukta.variable}`}>
      <body className={`${geistMono.variable} antialiased`}>
        <LiveProvider
          initialDevices={devices}
          initialFlags={flags}
          relayerUrl={RELAYER_URL}
          wsUrl={process.env.NEXT_PUBLIC_RELAYER_WS_URL || ""}
        >
          <SiteHeader />
          {children}
          <SiteFooter />
        </LiveProvider>
      </body>
    </html>
  );
}
