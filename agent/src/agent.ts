// Buys one verified reading from the data API. With X402=off on the API this is a plain GET;
// the x402 payment step (402 -> pay on hedera:testnet -> retry) is added in M5.

const API_URL = process.env.API_URL ?? "http://localhost:8082";
const GEOHASH = process.env.GEOHASH ?? "te7ud2";

const res = await fetch(`${API_URL}/api/aqi?geohash=${GEOHASH}`);
if (res.status === 402) {
  console.error("payment required: x402 client not wired yet");
  process.exit(1);
}
if (!res.ok) {
  console.error(`api error ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const cell = await res.json();
console.log(`cell ${cell.geohash}: PM2.5 ${(cell.pm25_x10 / 10).toFixed(1)} µg/m³ from ${cell.devices_used} devices (${cell.devices_flagged} flagged)`);
