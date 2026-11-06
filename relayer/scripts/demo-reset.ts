// Demo reset after a slash: give the board a fresh key, register it under the next free label
// with a FRESH World ID simulator identity (the first simulated human already owns 3 devices),
// then stake it. Repeatable for the video and live judging.
//
//   npm run demo-reset                       device 2, next label bkc-02b, bkc-02c, …
//   npm run demo-reset -- --device 1 --web https://<vercel-app> --stake 0.01 --headless
//   npm run demo-reset -- --warm             once, well before the demo (see below)
//
// Steps
//   1. find the board by `addr` (ports can swap), send `newkey`, read the new address
//   2. pick the next label: <base><letter> not owned in the prananet.eth registry and not listed by
//      the relayer (slashed names are unregistered, so the relayer list is checked too)
//   3. open the web register page in a new Chrome profile (playwright-core, installed Chrome),
//      switch the World ID Simulator to another test identity (a different human), then
//      Verify with World ID → Use the simulator → Continue → Register device; the relayer
//      verifies the proof and calls registerDevice
//   4. stake from the owner wallet (contracts/.env DEPLOYER_PRIVATE_KEY = operator wallet)
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { type Abi, type Address, createWalletClient, getAddress, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { registryAbi, stakeAbi } from "../src/abi.ts";
import { arg, config, etherscanTx, pub } from "./_common.ts";

const root = new URL("../../", import.meta.url).pathname;
const device = Number(arg("device", "2"));
const web = (arg("web", "http://localhost:3000") as string).replace(/\/$/, "");
const relayerUrl = (arg("relayer", "https://prananet-relayer.onrender.com") as string).replace(/\/$/, "");
const geohash = arg("geohash", "te7u6n") as string;
const base = arg("label", `bkc-0${device}`) as string;
const stakeEth = arg("stake", "0.01") as string;
const headless = process.argv.includes("--headless");
const serialTool = join(root, "firmware/tools/serial_cmd.py");

function log(m: string) {
  console.log(`${new Date().toISOString().slice(11, 19)} ${m}`);
}

// --warm: select each simulator identity once so staging inserts its commitment into the World
// ID tree (a fresh identity's first proof fails with invalid_merkle_root for a few minutes).
if (process.argv.includes("--warm")) {
  const b = await chromium.launch({ channel: "chrome", headless: true });
  const p = await (await b.newContext()).newPage();
  for (const n of [3, 2, 1, 0]) {
    await p.goto("https://simulator.worldcoin.org/", { waitUntil: "networkidle" });
    await p.getByRole("button", { name: "Settings" }).click();
    await p.getByText("Switch test identity").click();
    await p.getByText(new RegExp(`^Identity #${n}$`)).first().click({ force: true });
    await p.waitForURL(/\/id\/0x/, { timeout: 15_000 });
    log(`warmed Identity #${n} (${p.url().split("/").pop()})`);
  }
  await b.close();
  process.exit(0);
}

// 1. new key on the board
const port = execFileSync("python3", [serialTool, "--find", String(device)], { encoding: "utf8" }).trim();
if (!port) throw new Error(`device ${device} not found on any serial port`);
log(`device ${device} is on ${port}; sending newkey`);
const out = execFileSync("python3", [serialTool, port, "16", "12:newkey"], { encoding: "utf8" });
const m = out.match(/NEWKEY DEVICE \d address (0x[0-9a-f]{40})/);
if (!m) throw new Error(`no NEWKEY line from the board:\n${out.slice(-400)}`);
const newAddr = getAddress(m[1]);
log(`new device key: ${newAddr} (nonce reset to 0)`);

// 2. next free label
const deployment = JSON.parse(readFileSync(join(root, "contracts/deployments/sepolia.json"), "utf8"));
const userRegistry = deployment.ens.userRegistry as Address;
const findOwnerAbi = [{ type: "function", name: "findOwner", stateMutability: "view", inputs: [{ name: "label", type: "string" }], outputs: [{ type: "address" }] }] as const satisfies Abi;
const listed = new Set(((await (await fetch(`${relayerUrl}/devices`)).json()) as { ens: string }[]).map((d) => d.ens));
let label = "";
for (const c of "bcdefghijklmnopqrstuvwxyz") {
  const l = `${base}${c}`;
  const owner = await pub.readContract({ address: userRegistry, abi: findOwnerAbi, functionName: "findOwner", args: [l] });
  if (owner === "0x0000000000000000000000000000000000000000" && !listed.has(`${l}.${config.ensParent}`)) {
    label = l;
    break;
  }
}
if (!label) throw new Error(`no free label left for ${base}`);
log(`label: ${label}.${config.ensParent}`);

// 3. World ID with a different simulator human + register through the web app.
// The simulator ships 5 fixed test identities (#0-#4); #4 is its default and already owns 3
// devices here. Each identity is a separate human (own nullifier, own 3-device cap), so we pick
// one in Settings → Switch test identity, and move on to the next when it hits max_devices.
const identities = (arg("identity") ? [Number(arg("identity"))] : [3, 2, 1, 0]).map((n) => `Identity #${n}`);
async function registerWith(identity: string): Promise<"ok" | "max_devices" | "not_in_tree"> {
  const profile = mkdtempSync(join(tmpdir(), "prananet-worldid-"));
  const ctx = await chromium.launchPersistentContext(profile, { channel: "chrome", headless, viewport: { width: 1280, height: 900 } });
  try {
    const simSetup = await ctx.newPage();
    await simSetup.goto("https://simulator.worldcoin.org/", { waitUntil: "networkidle" });
    await simSetup.getByRole("button", { name: "Settings" }).click();
    await simSetup.getByText("Switch test identity").click();
    await simSetup.getByText(new RegExp(`^${identity}$`)).first().click({ force: true });
    await simSetup.waitForURL(/\/id\/0x/, { timeout: 15_000 });
    log(`simulator: using ${identity} (${simSetup.url().split("/").pop()})`);
    await simSetup.close();

    const page = ctx.pages()[0] ?? (await ctx.newPage());
    await page.goto(`${web}/register`, { waitUntil: "networkidle" });
    const inputs = page.locator("main input");
    await inputs.nth(0).fill(newAddr.toLowerCase());
    await inputs.nth(1).fill(label);
    await inputs.nth(2).fill(geohash);
    await page.getByRole("button", { name: /Verify with World ID/i }).click();
    const [sim] = await Promise.all([ctx.waitForEvent("page"), page.getByText(/Use the simulator/i).click()]);
    await sim.waitForLoadState("networkidle");
    const cont = sim.getByRole("button", { name: /^Continue$/ });
    await cont.waitFor({ timeout: 60_000 });
    await sim.waitForTimeout(2000); // the button renders before the session is connected
    await cont.click();
    await page.getByText(/Proof ready/i).waitFor({ timeout: 60_000 });
    log("World ID proof ready");
    await page.getByRole("button", { name: /Register device/i }).click();
    const done = page.getByText(new RegExp(`${label}\\.${config.ensParent.replace(".", "\\.")}`));
    const err = page.locator("p.text-red-800");
    await Promise.race([done.first().waitFor({ timeout: 180_000 }), err.first().waitFor({ timeout: 180_000 })]);
    if (await err.count()) {
      const msg = await err.first().innerText();
      if (/3 devices/.test(msg)) return "max_devices";
      if (/invalid_proof/.test(msg)) return "not_in_tree"; // staging hasn't inserted this identity yet
      throw new Error(`registration refused: ${msg}`);
    }
    return "ok";
  } finally {
    await ctx.close();
    rmSync(profile, { recursive: true, force: true });
  }
}
let registered = false;
for (const id of identities) {
  let r = await registerWith(id);
  if (r === "not_in_tree") {
    log(`${id}: World ID says the identity is not in the staging tree yet; retrying in 2 min`);
    await new Promise((res) => setTimeout(res, 120_000));
    r = await registerWith(id);
    if (r === "not_in_tree") throw new Error(`${id} still rejected by World ID (invalid_merkle_root)`);
  }
  if (r === "ok") {
    log(`registered ${label}.${config.ensParent} via World ID (${id})`);
    registered = true;
    break;
  }
  log(`${id} already has 3 devices; trying the next simulator human`);
}
if (!registered) throw new Error("all simulator identities are at the 3-device cap");

// wait until the Registry shows it (the page reports after the tx is mined, but be safe)
for (let i = 0; i < 30; i++) {
  const d = (await pub.readContract({ address: config.registry, abi: registryAbi, functionName: "getDevice", args: [newAddr] })) as { owner: Address };
  if (d.owner !== "0x0000000000000000000000000000000000000000") break;
  await new Promise((r) => setTimeout(r, 4000));
}

// 4. stake
const envFile = join(root, "contracts/.env");
const key = existsSync(envFile) ? readFileSync(envFile, "utf8").match(/^DEPLOYER_PRIVATE_KEY=(\S+)/m)?.[1] : undefined;
if (!key) throw new Error("contracts/.env DEPLOYER_PRIVATE_KEY (owner wallet) missing");
const owner = privateKeyToAccount(key as `0x${string}`);
const wallet = createWalletClient({ account: owner, chain: pub.chain, transport: http(config.rpcUrl) });
const { request } = await pub.simulateContract({ account: owner, address: config.stake, abi: stakeAbi, functionName: "stake", args: [newAddr], value: parseEther(stakeEth) });
const tx = await wallet.writeContract(request);
await pub.waitForTransactionReceipt({ hash: tx });
log(`staked ${stakeEth} ETH: ${etherscanTx(tx)}`);
log(`done: ${label}.${config.ensParent} = ${newAddr}; its readings flow from the next epoch`);
