# M4: tissue on device 2 → 3 flags → slash → stake to pool → ENS revoked (Fri 6 Nov ~18:15 IST)

Device 2 = `bkc-02.prananet.eth` (`0x0b715555…13b2`), staked 0.01 ETH. Neighbours: bkc-01 (real,
same cell) + 5 simulated devices around te7u6n; reference: OpenAQ BKC MPCB (0.5 km).

Device serial (excerpt; `http=-100` = the phone hotspot dropped Wi-Fi for a few epochs, those
epochs were never judged):
```
EPOCH 1793968980 nonce=90 vo=211mV  base=210mV pm_proxy=33.0ug/m3  http=202
EPOCH 1793969040 nonce=91 vo=2950mV base=210mV pm_proxy=580.9ug/m3 http=202   <- tissue
EPOCH 1793969100 nonce=92 vo=4566mV base=210mV pm_proxy=904.0ug/m3 http=-100
…
```

| Step | Proof |
|---|---|
| Flag 1 (580.9 vs median 36.1 µg/m³, neighbour outlier) | [0xed40741e…](https://sepolia.etherscan.io/tx/0xed40741e4fe6ffc692ab436ebe48940852837769388f6607902012ef748db1dc) |
| Flag 2 (903.9 vs 36.1) | [0xd790f796…](https://sepolia.etherscan.io/tx/0xd790f7965e8b5cc5d71d4152d98b2d4eb6c791f67dfab1d40cf914e720b28b74) |
| Flag 3 → `DeviceSlashed`, `Stake.Slashed`, `RewardPool.SlashReceived` (0.01 ETH) | [0xc4e52980…](https://sepolia.etherscan.io/tx/0xc4e52980c1e14c2fe8333960bb301ebe656ec46415525657ed021ec381cf80b8) |
| Relayer `GET /devices`: bkc-02 `status: slashed`, `stake_wei: 0`; WS `flag`×3 + `slash` | live |
| ENS revoked | see below |

**ENS revocation: what went wrong and how it was fixed.** The slash tx emitted `NameRevokeFailed`:
the verifier's gas limit came from `eth_estimateGas`, and because the Registry wraps the revoke in
try/catch (so ENS can never block a slash), the estimator found a limit where the inner revoke ran
out of gas without reverting the transaction (231k used; the revoke alone needs ~299k on Sepolia).
Fixes: (1) the verifier now sends `flag()` with a fixed 1.2M gas limit (refunded if unused);
(2) bkc-02 was revoked with `contracts/script/ens-revoke.sh` using the prananet.eth owner's roles:
[unregister](https://sepolia.etherscan.io/tx/0x7f4cffe4bd08c98f08e8cd5d4db6fe485ab9a30ec3446b0f53944463a90be864),
[clear records](https://sepolia.etherscan.io/tx/0x6846cd2862890247f0655b7d8c05afaed5bbc36e715317af5aa0eb806ca5096f).
Now `bkc-02.prananet.eth` → addr `0x0`, `prananet.status` = `slashed`, owner `0x0`.
A Sepolia-fork replay of three flags on bkc-02b with the 1.2M limit slashes **and** revokes in the
same transaction (no `NameRevokeFailed`, owner → 0x0). Anvil does not apply Sepolia's newer
storage pricing, so the next live slash is the definitive check.

## Rewards: honest operator claims, slashed device gets nothing
- Pool after the slash: 0.01005 ETH (0.01 slashed stake + 0.00005 bridged x402 revenue).
- bkc-01 (honest, 34 accepted unflagged epochs): `claimRewards` paid 0.00034 ETH,
  [0x8cf249ff…](https://sepolia.etherscan.io/tx/0x8cf249fffd0d3c0738619ce9dfc23fb59b0091489a296581a3cfcba29fd5f55d).
- bkc-02 (slashed, 26 epochs it would have earned): `claimRewards` reverts `DeviceNotActive`,
  [0xafe8f405…](https://sepolia.etherscan.io/tx/0xafe8f405870515ca954410ad34f782667a76a781673d7cfc9609849e774cc580) (failed on-chain).

## Repeatable: reset the board for the next take
`npm run demo-reset` (relayer/): `newkey` on the board → next label (`bkc-02b`, `bkc-02c`, …) →
World ID with another simulator test identity (#3, #2, #1, #0; the default #4 already owns 3
devices) → registerDevice + ENS → stake 0.01 ETH. Tested once: `bkc-02b.prananet.eth` =
`0xaAf23726…F2EA`, [stake tx](https://sepolia.etherscan.io/tx/0x5ceb21b8a524f2177bae8d53f3a9bb3ac19430b4581809f0e42fd73950bbd758),
readings flowing from nonce 1. Run `npm run demo-reset -- --warm` once well before the demo: a
simulator identity's first proof fails (`invalid_merkle_root`) until staging inserts it.
