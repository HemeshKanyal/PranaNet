import Link from "next/link";
import { getDevices, USING_MOCKS } from "@/lib/relayer";
import { eth, short, time, x10 } from "@/lib/format";
import type { DeviceStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<DeviceStatus, string> = {
  active: "bg-green-100 text-green-800",
  flagged: "bg-amber-100 text-amber-800",
  slashed: "bg-red-100 text-red-800",
};

export default async function Home() {
  const devices = await getDevices();
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold">PranaNet devices</h1>
      {USING_MOCKS && <p className="mt-1 text-sm text-amber-700">Showing mock data (NEXT_PUBLIC_RELAYER_URL not set).</p>}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b text-gray-500">
            <tr>
              <th className="py-2 pr-4">Device</th>
              <th className="py-2 pr-4">Geohash</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">PM2.5 µg/m³</th>
              <th className="py-2 pr-4">PM10 µg/m³</th>
              <th className="py-2 pr-4">Stake ETH</th>
              <th className="py-2 pr-4">Last reading (IST)</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.device} className="border-b">
                <td className="py-2 pr-4">
                  <Link href={`/devices/${d.ens}`} className="font-medium underline">{d.ens}</Link>
                  <div className="font-mono text-xs text-gray-500">
                    {short(d.device)}
                    {d.simulated && <span className="ml-2 rounded bg-gray-200 px-1 text-gray-700">simulated</span>}
                  </div>
                </td>
                <td className="py-2 pr-4 font-mono">{d.geohash}</td>
                <td className="py-2 pr-4">
                  <span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLE[d.status]}`}>{d.status}</span>
                </td>
                <td className="py-2 pr-4">{d.last_reading ? x10(d.last_reading.pm25_x10) : "—"}</td>
                <td className="py-2 pr-4">{d.last_reading ? x10(d.last_reading.pm10_x10) : "—"}</td>
                <td className="py-2 pr-4">{eth(d.stake_wei)}</td>
                <td className="py-2 pr-4">{d.last_reading ? time(d.last_reading.epoch) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
