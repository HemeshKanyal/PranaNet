// One relayer wallet, one transaction in flight at a time: each job is simulated, sent, and
// awaited before the next, so the account nonce is never raced. Network/RPC errors retry with
// exponential backoff; contract reverts (bad signature, stale nonce, inactive device) are final.
import {
  type Address,
  type Hash,
  BaseError,
  ContractFunctionRevertedError,
  createWalletClient,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readingsAbi } from "./abi.ts";
import type { PublicClient } from "./chain.ts";
import type { Config } from "./config.ts";
import { log } from "./log.ts";
import type { Reading } from "./message.ts";

export interface TxResult {
  ok: boolean;
  tx?: Hash;
  error?: string;
}

export interface Submitter {
  readonly address: Address | null;
  /** Highest nonce queued (not yet confirmed) per device, so intake can reject duplicates early. */
  pendingNonce(device: Address): number;
  submit(r: Reading): Promise<TxResult>;
}

type Job = { run: () => Promise<void> };

export class TxQueue implements Submitter {
  readonly address: Address;
  private wallet;
  private jobs: Job[] = [];
  private running = false;
  private pending = new Map<string, number>();
  onResult: (r: Reading, res: TxResult) => void = () => {};

  constructor(
    private pub: PublicClient,
    private cfg: Config,
    private maxAttempts = 5,
  ) {
    const account = privateKeyToAccount(cfg.relayerKey as `0x${string}`);
    this.address = account.address;
    this.wallet = createWalletClient({ account, chain: pub.chain, transport: http(cfg.rpcUrl) });
  }

  pendingNonce(device: Address) {
    return this.pending.get(device.toLowerCase()) ?? 0;
  }

  submit(reading: Reading): Promise<TxResult> {
    const k = reading.device.toLowerCase();
    this.pending.set(k, Math.max(this.pendingNonce(reading.device), reading.nonce));
    return this.exclusive(async () => {
      const res = await this.send(reading);
      if (this.pending.get(k) === reading.nonce) this.pending.delete(k);
      this.onResult(reading, res);
      return res;
    });
  }

  /** Run `fn` with the relayer wallet while no other job is sending (keeps the account nonce in order). */
  exclusive<T>(fn: (wallet: typeof this.wallet) => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.jobs.push({ run: () => fn(this.wallet).then(resolve, reject) });
      void this.drain();
    });
  }

  get length() {
    return this.jobs.length;
  }

  private async drain() {
    if (this.running) return;
    this.running = true;
    while (this.jobs.length) {
      const job = this.jobs.shift()!;
      await job.run().catch(() => {});
    }
    this.running = false;
  }

  private async send(r: Reading): Promise<TxResult> {
    const args = [
      {
        device: r.device,
        epoch: BigInt(r.epoch),
        pm25_x10: BigInt(r.pm25_x10),
        pm10_x10: BigInt(r.pm10_x10),
        temp_x10: BigInt(r.temp_x10),
        hum_x10: BigInt(r.hum_x10),
        nonce: BigInt(r.nonce),
      },
      r.signature,
    ] as const;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        const { request } = await this.pub.simulateContract({
          account: this.wallet.account,
          address: this.cfg.readings,
          abi: readingsAbi,
          functionName: "submitEpoch",
          args,
        });
        const tx = await this.wallet.writeContract(request);
        log("tx", `submitEpoch ${r.ens} nonce=${r.nonce} sent ${tx}`);
        const receipt = await this.pub.waitForTransactionReceipt({ hash: tx, timeout: 180_000 });
        if (receipt.status !== "success") return { ok: false, tx, error: "reverted" };
        log("tx", `submitEpoch ${r.ens} nonce=${r.nonce} mined in block ${receipt.blockNumber}`);
        return { ok: true, tx };
      } catch (e) {
        const revert = e instanceof BaseError ? e.walk((x) => x instanceof ContractFunctionRevertedError) : null;
        if (revert instanceof ContractFunctionRevertedError) {
          const name = revert.data?.errorName ?? revert.shortMessage;
          log("tx", `submitEpoch ${r.ens} nonce=${r.nonce} reverted: ${name}`);
          return { ok: false, error: name };
        }
        const msg = (e as Error).message.split("\n")[0];
        const wait = Math.min(30_000, 1000 * 2 ** (attempt - 1));
        log("tx", `submitEpoch ${r.ens} nonce=${r.nonce} attempt ${attempt} failed: ${msg}; retry in ${wait}ms`);
        if (attempt < this.maxAttempts) await new Promise((res) => setTimeout(res, wait));
      }
    }
    return { ok: false, error: "gave_up_after_retries" };
  }
}
