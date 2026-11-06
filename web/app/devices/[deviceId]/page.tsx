import Link from "next/link";
import { notFound } from "next/navigation";
import { getDevice } from "@/lib/relayer";
import { eth, time, x10 } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DevicePage({ params }: { params: Promise<{ ens: string }> }) {
  const { ens } = await params;
  const d = await getDevice(decodeURIComponent(ens));
  if (!d) notFound();
  const latest = [...d.readings].reverse().slice(0, 50);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/" className="text-sm underline">← All devices</Link>
      <h1 className="mt-2 text-2xl font-semibold">{d.ens}</h1>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
        <dt className="text-gray-500">Address</dt><dd className="font-mono break-all sm:col-span-3">{d.device}</dd>
        <dt className="text-gray-500">Geohash</dt><dd className="font-mono">{d.geohash}</dd>
        <dt className="text-gray-500">Status</dt><dd>{d.status}{d.simulated && " (simulated)"}</dd>
        <dt className="text-gray-500">Stake</dt><dd>{eth(d.stake_wei)} ETH</dd>
        <dt className="text-gray-500">Baseline</dt><dd>{d.baseline_mv} mV</dd>
      </dl>

      <h2 className="mt-8 text-lg font-semibold">Latest readings</h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b text-gray-500">
            <tr>
              <th className="py-1 pr-4">Time (IST)</th>
              <th className="py-1 pr-4">PM2.5</th>
              <th className="py-1 pr-4">PM10</th>
              <th className="py-1 pr-4">Temp °C</th>
              <th className="py-1 pr-4">Hum %</th>
              <th className="py-1 pr-4">Nonce</th>
            </tr>
          </thead>
          <tbody>
            {latest.map((r) => (
              <tr key={r.nonce} className="border-b">
                <td className="py-1 pr-4">{time(r.epoch)}</td>
                <td className="py-1 pr-4">{x10(r.pm25_x10)}</td>
                <td className="py-1 pr-4">{x10(r.pm10_x10)}</td>
                <td className="py-1 pr-4">{x10(r.temp_x10)}</td>
                <td className="py-1 pr-4">{x10(r.hum_x10)}</td>
                <td className="py-1 pr-4 font-mono">{r.nonce}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
