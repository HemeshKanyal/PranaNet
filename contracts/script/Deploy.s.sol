// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Registry} from "../src/Registry.sol";
import {Readings} from "../src/Readings.sol";
import {Stake, ISlashReceiver} from "../src/Stake.sol";
import {RewardPool} from "../src/RewardPool.sol";

/// Deploys and wires Registry, Readings, RewardPool and Stake, then writes the addresses to
/// deployments/<network>.json. Run through ./deploy.sh (reads contracts/.env).
///
/// Env: DEPLOYER_PRIVATE_KEY (required; becomes admin), BACKEND_ADDRESS (relayer wallet that
/// registers devices; default deployer), VERIFIER_ADDRESS (optional), MIN_STAKE_WEI,
/// REWARD_PER_EPOCH_WEI.
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address backend = vm.envOr("BACKEND_ADDRESS", deployer);
        address verifier = vm.envOr("VERIFIER_ADDRESS", address(0));
        uint256 minStake = vm.envOr("MIN_STAKE_WEI", uint256(0.001 ether));
        uint256 rewardPerEpoch = vm.envOr("REWARD_PER_EPOCH_WEI", uint256(0.00001 ether));

        vm.startBroadcast(pk);
        Registry registry = new Registry(deployer);
        Readings readings = new Readings(registry);
        RewardPool pool = new RewardPool(registry, readings, deployer, rewardPerEpoch);
        Stake stake = new Stake(registry, ISlashReceiver(address(pool)), minStake);
        pool.setStake(stake);
        registry.setStakeManager(stake);
        registry.setBackend(backend, true);
        if (verifier != address(0)) registry.setVerifier(verifier, true);
        vm.stopBroadcast();

        string memory o = "deployment";
        vm.serializeUint(o, "chainId", block.chainid);
        vm.serializeUint(o, "deployBlock", block.number);
        vm.serializeAddress(o, "admin", deployer);
        vm.serializeAddress(o, "backend", backend);
        vm.serializeAddress(o, "verifier", verifier);
        vm.serializeUint(o, "minStakeWei", minStake);
        vm.serializeUint(o, "rewardPerEpochWei", rewardPerEpoch);
        vm.serializeAddress(o, "Registry", address(registry));
        vm.serializeAddress(o, "Readings", address(readings));
        vm.serializeAddress(o, "RewardPool", address(pool));
        string memory json = vm.serializeAddress(o, "Stake", address(stake));

        string memory name = block.chainid == 11_155_111 ? "sepolia" : string.concat("local-", vm.toString(block.chainid));
        string memory path = string.concat(vm.projectRoot(), "/deployments/", name, ".json");
        vm.writeJson(json, path);

        console.log("Registry  ", address(registry));
        console.log("Readings  ", address(readings));
        console.log("RewardPool", address(pool));
        console.log("Stake     ", address(stake));
        console.log("written to", path);
    }
}
