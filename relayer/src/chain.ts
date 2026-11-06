// Sepolia access: contract reads, and a polling event indexer that keeps device state
// (registration, status, flag streak, stake) for GET /devices and pushes flag/slash events.
import { type Address, type Hash, type Log, createPublicClient, http, getAddress } from "viem";
import { sepolia } from "viem/chains";
import { readingsAbi, registryAbi, stakeAbi } from "./abi.ts";
import type { Config } from "./config.ts";
import { log } from "./log.ts";

export interface DeviceState {
  device: Address; // lowercase
  owner: Address;
  label: string;
  geohash: string;
  ens: string;
  active: boolean;
  slashed: boolean;
  consecutiveFlags: number;
  stakeWei: bigint;
}

export interface FlagEvent {
  device: Address;
  epoch: number;
  reason: number;
  consecutiveFlags: number;
  tx: Hash;
}
export interface SlashEvent {
  device: Address;
  epoch: number;
  tx: Hash;
}

export interface ChainReads {
  isActive(device: Address): Promise<boolean>;
  lastNonce(device: Address): Promise<bigint>;
  getDevice(device: Address): Promise<DeviceState | null>;
}

export function makePublicClient(cfg: Config) {
  const chain = cfg.chainId === sepolia.id ? sepolia : { ...sepolia, id: cfg.chainId, name: `chain-${cfg.chainId}` };
  return createPublicClient({ chain, transport: http(cfg.rpcUrl, { retryCount: 3 }) });
}
export type PublicClient = ReturnType<typeof makePublicClient>;

const lc = (a: string) => a.toLowerCase() as Address;

export class ChainIndex implements ChainReads {
  readonly devices = new Map<Address, DeviceState>();
  private lastBlock: bigint;
  private timer?: NodeJS.Timeout;
  onFlag: (e: FlagEvent) => void = () => {};
  onSlash: (e: SlashEvent) => void = () => {};
  onDeviceChange: (d: DeviceState) => void = () => {};

  constructor(
    private client: PublicClient,
    private cfg: Config,
  ) {
    this.lastBlock = cfg.deployBlock > 0n ? cfg.deployBlock - 1n : 0n;
  }

  ensFor(label: string) {
    return `${label}.${this.cfg.ensParent}`;
  }

  byEns(ens: string): DeviceState | undefined {
    for (const d of this.devices.values()) if (d.ens === ens) return d;
    return undefined;
  }

  async isActive(device: Address) {
    return (await this.client.readContract({
      address: this.cfg.registry,
      abi: registryAbi,
      functionName: "isActive",
      args: [device],
    })) as boolean;
  }

  async lastNonce(device: Address) {
    return (await this.client.readContract({
      address: this.cfg.readings,
      abi: readingsAbi,
      functionName: "lastNonce",
      args: [device],
    })) as bigint;
  }

  /** Indexed state, falling back to a direct contract read for devices not yet indexed. */
  async getDevice(device: Address): Promise<DeviceState | null> {
    const known = this.devices.get(lc(device));
    if (known) return known;
    const d = (await this.client.readContract({
      address: this.cfg.registry,
      abi: registryAbi,
      functionName: "getDevice",
      args: [device],
    })) as { owner: Address; label: string; geohash: string; active: boolean };
    if (d.owner === "0x0000000000000000000000000000000000000000") return null;
    const state: DeviceState = {
      device: lc(device),
      owner: d.owner,
      label: d.label,
      geohash: d.geohash,
      ens: this.ensFor(d.label),
      active: d.active,
      slashed: false,
      consecutiveFlags: 0,
      stakeWei: 0n,
    };
    this.devices.set(state.device, state);
    return state;
  }

  start() {
    const loop = async () => {
      try {
        await this.poll();
      } catch (e) {
        log("chain", "poll failed:", (e as Error).message.split("\n")[0]);
      }
      this.timer = setTimeout(loop, this.cfg.pollMs);
    };
    return loop();
  }

  stop() {
    clearTimeout(this.timer);
  }

  /** Fetch new logs from all contracts in block chunks and apply them in order. */
  async poll() {
    const head = await this.client.getBlockNumber();
    const CHUNK = this.cfg.logChunkBlocks > 0n ? this.cfg.logChunkBlocks : 10n;
    while (this.lastBlock < head) {
      const from = this.lastBlock + 1n;
      const to = from + CHUNK - 1n < head ? from + CHUNK - 1n : head;
      const [reg, stk] = await Promise.all([
        this.client.getContractEvents({ address: this.cfg.registry, abi: registryAbi, fromBlock: from, toBlock: to }),
        this.cfg.stake === "0x0000000000000000000000000000000000000000"
          ? Promise.resolve([] as Log[])
          : this.client.getContractEvents({ address: this.cfg.stake, abi: stakeAbi, fromBlock: from, toBlock: to }),
      ]);
      const all = [...reg, ...stk].sort((a, b) =>
        a.blockNumber === b.blockNumber ? (a.logIndex ?? 0) - (b.logIndex ?? 0) : Number(a.blockNumber! - b.blockNumber!),
      );
      for (const l of all) this.apply(l as Log & { eventName: string; args: Record<string, unknown> });
      this.lastBlock = to;
    }
  }

  private apply(l: Log & { eventName: string; args: Record<string, unknown> }) {
    const a = l.args;
    const dev = a.device ? lc(a.device as string) : undefined;
    const d = dev ? this.devices.get(dev) : undefined;
    switch (l.eventName) {
      case "DeviceRegistered": {
        const s: DeviceState = {
          device: dev!,
          owner: getAddress(a.owner as string),
          label: a.label as string,
          geohash: a.geohash as string,
          ens: this.ensFor(a.label as string),
          active: true,
          slashed: false,
          consecutiveFlags: 0,
          stakeWei: d?.stakeWei ?? 0n,
        };
        this.devices.set(dev!, s);
        log("chain", `registered ${s.ens} ${dev}`);
        this.onDeviceChange(s);
        break;
      }
      case "DeviceStatusChanged":
        if (d) {
          d.active = a.active as boolean;
          this.onDeviceChange(d);
        }
        break;
      case "DeviceFlagged":
        if (d) d.consecutiveFlags = Number(a.consecutiveFlags);
        this.onFlag({
          device: dev!,
          epoch: Number(a.epoch),
          reason: Number(a.reason),
          consecutiveFlags: Number(a.consecutiveFlags),
          tx: l.transactionHash!,
        });
        if (d) this.onDeviceChange(d);
        break;
      case "FlagsCleared":
        if (d) {
          d.consecutiveFlags = 0;
          this.onDeviceChange(d);
        }
        break;
      case "DeviceSlashed":
        if (d) {
          d.slashed = true;
          d.consecutiveFlags = 0;
        }
        this.onSlash({ device: dev!, epoch: Number(a.epoch), tx: l.transactionHash! });
        if (d) this.onDeviceChange(d);
        break;
      case "Staked":
        if (d) {
          d.stakeWei = a.total as bigint;
          this.onDeviceChange(d);
        }
        break;
      case "Unstaked":
      case "Slashed":
        if (d) {
          d.stakeWei = 0n;
          this.onDeviceChange(d);
        }
        break;
    }
  }
}

export function statusOf(d: DeviceState): "active" | "flagged" | "slashed" {
  if (d.slashed || !d.active) return "slashed";
  return d.consecutiveFlags > 0 ? "flagged" : "active";
}
