# M5: agent pays for data over x402 on hedera:testnet (Fri 6 Nov ~16:55 IST)

- API revenue account (PAY_TO): [0.0.11336714](https://hashscan.io/testnet/account/0.0.11336714)
- Agent payer account: [0.0.11338297](https://hashscan.io/testnet/account/0.0.11338297) (created by agent `npm run setup`)
- Purchase log (HCS): [topic 0.0.11338299](https://hashscan.io/testnet/topic/0.0.11338299)
- Facilitator: https://x402.org/facilitator (fee payer 0.0.9185802)
- Bridge: [fundPool 0.00003 ETH on Sepolia](https://sepolia.etherscan.io/tx/0xf07a43f1c284ebaa4253857e877270553aca1bdcbfc41003b1f0e20f4818ba26) for 3 mirror-node-verified payments

## Agent runs
```
discovered: http://localhost:8082/api/aqi?geohash={geohash}
  Verified PM2.5/PM10 for a 6-char geohash cell (median of cross-checked devices + nearest reference station)
  402: pay 10000000 tinybar (0.1 HBAR) to 0.0.11336714 on hedera:testnet -> approved by budget
cell te7u6n @ 2026-11-06T11:24:00.000Z: PM2.5 30.0 µg/m³, PM10 58.0 µg/m³ from 2 devices (0 flagged), station Bandra Kurla Complex, Mumbai - MPCB 32.9
  paid: https://hashscan.io/testnet/transaction/0.0.9185802@1793964343.612274191
  budget: spent 10000000 / 50000000 tinybar
  logged to HCS topic 0.0.11338299 seq #2: https://hashscan.io/testnet/topic/0.0.11338299
  402: pay 10000000 tinybar (0.1 HBAR) to 0.0.11336714 on hedera:testnet -> approved by budget
cell te7u6n @ 2026-11-06T11:24:00.000Z: PM2.5 30.0 µg/m³, PM10 58.0 µg/m³ from 2 devices (0 flagged), station Bandra Kurla Complex, Mumbai - MPCB 32.9
  paid: https://hashscan.io/testnet/transaction/0.0.9185802@1793964352.463095559
  budget: spent 20000000 / 50000000 tinybar
  logged to HCS topic 0.0.11338299 seq #3: https://hashscan.io/testnet/topic/0.0.11338299
```

## Budget hard cap (BUDGET_TINYBAR=25000000)
```
  402: pay 10000000 tinybar (0.1 HBAR) to 0.0.11336714 on hedera:testnet -> approved by budget
  paid: https://hashscan.io/testnet/transaction/0.0.9185802@1793964386.164863249
  budget: spent 10000000 / 25000000 tinybar
  logged to HCS topic 0.0.11338299 seq #4: https://hashscan.io/testnet/topic/0.0.11338299
  402: pay 10000000 tinybar (0.1 HBAR) to 0.0.11336714 on hedera:testnet -> approved by budget
  paid: https://hashscan.io/testnet/transaction/0.0.9185802@1793964389.776540407
  budget: spent 20000000 / 25000000 tinybar
  logged to HCS topic 0.0.11338299 seq #5: https://hashscan.io/testnet/topic/0.0.11338299
  402: pay 10000000 tinybar (0.1 HBAR) to 0.0.11336714 on hedera:testnet -> REFUSED: budget exhausted: 20000000 spent + 10000000 > cap 25000000
stopped: Failed to create payment payload: Payment creation aborted: budget exhausted: 20000000 spent + 10000000 > cap 25000000
```

## Bridge record (api/data/bridged.json)
```json
{
  "batches": [
    {
      "sepoliaTx": "0xf07a43f1c284ebaa4253857e877270553aca1bdcbfc41003b1f0e20f4818ba26",
      "wei": "30000000000000",
      "hedera": [
        "0.0.9185802@1793964241.290186009",
        "0.0.9185802@1793964343.612274191",
        "0.0.9185802@1793964352.463095559"
      ],
      "at": "2026-11-06T11:26:15.589Z"
    }
  ]
}```
