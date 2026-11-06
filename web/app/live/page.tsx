import type { Metadata } from "next";
import { HomeDashboard } from "@/components/HomeDashboard";

export const metadata: Metadata = { title: "Live map · PranaNet" };

export default function LivePage() {
  return <HomeDashboard />;
}
