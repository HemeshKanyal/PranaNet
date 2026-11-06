import { notFound } from "next/navigation";
import { DeviceView } from "@/components/DeviceView";
import { resolveDevice } from "@/lib/relayer";

export const dynamic = "force-dynamic";

// deviceId is an ENS name (bkc-01.prananet.eth) or the device's 0x address.
export default async function DevicePage({ params }: { params: Promise<{ deviceId: string }> }) {
  const { deviceId } = await params;
  const d = await resolveDevice(decodeURIComponent(deviceId));
  if (!d) notFound();
  return <DeviceView initial={d} />;
}
