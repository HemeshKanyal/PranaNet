// Every on-chain proof the story links to, copied from docs/evidence/*.md. One place, so a
// re-run of the demo means updating this file only. Values are the recorded run, not live data.
const SEPOLIA = "https://sepolia.etherscan.io/tx/";
const HASHSCAN = "https://hashscan.io/testnet";

/** docs/evidence/m4-slash.md: tissue on bkc-02 → 3 neighbour-outlier flags → slash.
 *  Flag values/medians cross-checked against the prananet.flag entities on Arkiv. */
export const SLASH_RUN = {
  ens: "bkc-02.prananet.eth",
  device: "0x0b715555721a00cce73e03efb239db39a5e313b2",
  stakeEth: "0.01",
  /** The honest bkc-02 reading just before the tissue went on. */
  before: { nonce: 90, ug: 33.0 },
  flags: [
    { n: 1, ug: 580.9, medianUg: 36.1, tx: `${SEPOLIA}0xed40741e4fe6ffc692ab436ebe48940852837769388f6607902012ef748db1dc` },
    { n: 2, ug: 903.9, medianUg: 36.1, tx: `${SEPOLIA}0xd790f7965e8b5cc5d71d4152d98b2d4eb6c791f67dfab1d40cf914e720b28b74` },
    // Third flag: the same transaction emits DeviceSlashed, Stake.Slashed and RewardPool.SlashReceived.
    { n: 3, ug: 903.9, medianUg: 34.1, tx: `${SEPOLIA}0xc4e52980c1e14c2fe8333960bb301ebe656ec46415525657ed021ec381cf80b8` },
  ],
  slashTx: `${SEPOLIA}0xc4e52980c1e14c2fe8333960bb301ebe656ec46415525657ed021ec381cf80b8`,
  ensRevoke: [
    { label: "unregister", tx: `${SEPOLIA}0x7f4cffe4bd08c98f08e8cd5d4db6fe485ab9a30ec3446b0f53944463a90be864` },
    { label: "clear records", tx: `${SEPOLIA}0x6846cd2862890247f0655b7d8c05afaed5bbc36e715317af5aa0eb806ca5096f` },
  ],
} as const;

/** docs/evidence/m4-slash.md "Rewards". */
export const REWARDS = {
  honestClaim: { ens: "bkc-01.prananet.eth", eth: "0.00034", epochs: 34, tx: `${SEPOLIA}0x8cf249fffd0d3c0738619ce9dfc23fb59b0091489a296581a3cfcba29fd5f55d` },
  slashedClaim: { ens: "bkc-02.prananet.eth", error: "DeviceNotActive", tx: `${SEPOLIA}0xafe8f405870515ca954410ad34f782667a76a781673d7cfc9609849e774cc580` },
} as const;

/** docs/evidence/m5-x402-hedera.md: an AI agent pays per request over x402 on Hedera. */
export const X402 = {
  payment: `${HASHSCAN}/transaction/0.0.9185802@1793964343.612274191`,
  hbar: "0.1",
  hcsTopic: `${HASHSCAN}/topic/0.0.11338299`,
  revenueAccount: `${HASHSCAN}/account/0.0.11336714`,
  agentAccount: `${HASHSCAN}/account/0.0.11338297`,
  fundPool: `${SEPOLIA}0xf07a43f1c284ebaa4253857e877270553aca1bdcbfc41003b1f0e20f4818ba26`,
  apiDiscovery: "https://prananet-api.onrender.com/.well-known/x402",
} as const;

/** docs/evidence/m3-worldid-ens.md */
export const REGISTRATION = {
  stakeBkc01: `${SEPOLIA}0x4d39bf8a45f36a24b8b827d6c4da88fbece650ebd5d69677307cc47ad949139c`,
} as const;

export const REPO = "https://github.com/HemeshKanyal/PranaNet";
export const DOCS = `${REPO}#readme`;
export const FIRMWARE = `${REPO}/tree/main/firmware/prananet`;
