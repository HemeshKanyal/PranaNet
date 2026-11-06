// Software device for testing without hardware: signs one reading exactly like the firmware and
// POSTs it to the relayer.  npm run sign-reading -- --key 0xKEY [--nonce N] [--pm 423] [--relayer URL]
import type { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readingMessage } from "../src/message.ts";
import { arg, config, relayerUrl } from "./_common.ts";

const key = arg("key") as Hex | undefined;
if (!key) throw new Error("--key required");
const acct = privateKeyToAccount(key);
const pm = Number(arg("pm", "423"));
const r = {
  device: acct.address.toLowerCase() as Hex,
  epoch: Number(arg("epoch", String(Math.floor(Date.now() / 60000) * 60))),
  pm25_x10: pm,
  pm10_x10: pm,
  temp_x10: Number(arg("temp", "0")),
  hum_x10: Number(arg("hum", "0")),
  nonce: Number(arg("nonce", String(Math.floor(Date.now() / 1000)))),
};
const signature = await acct.signMessage({ message: { raw: readingMessage(r, config.chainId, config.readings) } });
const body = { ...r, ens: "", geohash: arg("geohash", "te7ud2"), signature, simulated: false };
const res = await fetch(`${relayerUrl()}/readings`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
console.log(res.status, await res.text());
