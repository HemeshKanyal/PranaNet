// ABIs exported by contracts/export-abi.sh (committed in contracts/abi/).
import Readings from "../../contracts/abi/Readings.json" with { type: "json" };
import Registry from "../../contracts/abi/Registry.json" with { type: "json" };
import RewardPool from "../../contracts/abi/RewardPool.json" with { type: "json" };
import Stake from "../../contracts/abi/Stake.json" with { type: "json" };
import type { Abi } from "viem";

export const registryAbi = Registry as Abi;
export const readingsAbi = Readings as Abi;
export const stakeAbi = Stake as Abi;
export const rewardPoolAbi = RewardPool as Abi;
