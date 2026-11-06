// Registry calls with the verifier key: flag(device, epoch, reason) and clearFlags(device, epoch).
// One transaction at a time (the verifier wallet's nonce is never raced).
import { type Abi, type Address, BaseError, ContractFunctionRevertedError, createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import Registry from "../../contracts/abi/Registry.json" with { type: "json" };
import type { Config } from "./config.ts";

const abi = Registry as Abi;
export const FLAG_GAS = 1_200_000n;

export class RegistryClient {
  readonly address: Address;
  private pub;
  private wallet;
  private chainQ: Promise<unknown> = Promise.resolve();

  constructor(private cfg: Config) {
    const account = privateKeyToAccount(cfg.verifierKey as `0x${string}`);
    this.address = account.address;
    this.pub = createPublicClient({ chain: sepolia, transport: http(cfg.rpcUrl) });
    this.wallet = createWalletClient({ account, chain: sepolia, transport: http(cfg.rpcUrl) });
  }

  consecutiveFlags(device: Address): Promise<number> {
    return this.pub
      .readContract({ address: this.cfg.registry as Address, abi, functionName: "consecutiveFlags", args: [device] })
      .then(Number);
  }

  isVerifier(): Promise<boolean> {
    return this.pub.readContract({ address: this.cfg.registry as Address, abi, functionName: "isVerifier", args: [this.address] }) as Promise<boolean>;
  }

  private send(functionName: "flag" | "clearFlags", args: readonly unknown[]): Promise<{ ok: boolean; tx?: string; error?: string }> {
    const run = async () => {
      try {
        // flag() may slash, and the slash revokes the ENS name inside a try/catch. eth_estimateGas
        // happily returns a limit where that inner call runs out of gas (the try/catch swallows
        // it), which leaves the name alive. The revoke alone needs ~300k on Sepolia, so flag()
        // always gets FLAG_GAS (unused gas is refunded).
        const gas = functionName === "flag" ? FLAG_GAS : undefined;
        const { request } = await this.pub.simulateContract({ account: this.wallet.account, address: this.cfg.registry as Address, abi, functionName, args, gas });
        const tx = await this.wallet.writeContract(request);
        const r = await this.pub.waitForTransactionReceipt({ hash: tx, timeout: 120_000 });
        return { ok: r.status === "success", tx };
      } catch (e) {
        const rv = e instanceof BaseError ? e.walk((x) => x instanceof ContractFunctionRevertedError) : null;
        const error = rv instanceof ContractFunctionRevertedError ? (rv.data?.errorName ?? rv.shortMessage) : (e as Error).message.split("\n")[0];
        return { ok: false, error };
      }
    };
    const p = this.chainQ.then(run, run);
    this.chainQ = p;
    return p;
  }

  flag(device: Address, epoch: number, reason: number) {
    return this.send("flag", [device, BigInt(epoch), reason]);
  }

  clearFlags(device: Address, epoch: number) {
    return this.send("clearFlags", [device, BigInt(epoch)]);
  }
}
