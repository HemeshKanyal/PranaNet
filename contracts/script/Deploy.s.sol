// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Registry} from "../src/Registry.sol";
import {Readings} from "../src/Readings.sol";
import {Stake, ISlashReceiver} from "../src/Stake.sol";
import {RewardPool} from "../src/RewardPool.sol";
import {DeviceNamer, IENSUserRegistry, IENSPermissionedResolver} from "../src/DeviceNamer.sol";

interface IEnsRoles {
    function grantRootRoles(uint256 roleBitmap, address account) external returns (bool);
}

/// Deploys and wires Registry, Readings, RewardPool and Stake, then writes the addresses to
/// deployments/<network>.json. Run through ./deploy.sh (reads contracts/.env).
///
/// Env: DEPLOYER_PRIVATE_KEY (required; becomes admin), BACKEND_ADDRESS (relayer wallet that
/// registers devices; default deployer), VERIFIER_ADDRESS (optional), MIN_STAKE_WEI,
/// REWARD_PER_EPOCH_WEI. ENS_USER_REGISTRY / ENS_RESOLVER (default: .ens in the existing
/// deployments/sepolia.json, written by script/ens-setup.sh): when set, deploys DeviceNamer, wires
/// it into the Registry and grants it the ENS roles it needs (deployer must hold the admin roles).
contract Deploy is Script {
    struct Out {
        Registry registry;
        Readings readings;
        RewardPool pool;
        Stake stake;
        DeviceNamer namer;
    }

    function _path() internal view returns (string memory) {
        string memory name = block.chainid == 11_155_111 ? "sepolia" : string.concat("local-", vm.toString(block.chainid));
        return string.concat(vm.projectRoot(), "/deployments/", name, ".json");
    }

    /// ENS_USER_REGISTRY / ENS_RESOLVER from env, else from .ens in the existing deployment file.
    function _ens(string memory path) internal view returns (address userRegistry, address resolver) {
        userRegistry = vm.envOr("ENS_USER_REGISTRY", address(0));
        resolver = vm.envOr("ENS_RESOLVER", address(0));
        if (!vm.exists(path)) return (userRegistry, resolver);
        string memory old = vm.readFile(path);
        if (!vm.keyExistsJson(old, ".ens")) return (userRegistry, resolver);
        if (userRegistry == address(0)) userRegistry = vm.parseJsonAddress(old, ".ens.userRegistry");
        if (resolver == address(0)) resolver = vm.parseJsonAddress(old, ".ens.resolver");
    }

    function _deploy(uint256 pk, address deployer, address backend, address verifier, uint256 minStake, uint256 rewardPerEpoch, address ensUserRegistry, address ensResolver)
        internal
        returns (Out memory d)
    {
        vm.startBroadcast(pk);
        d.registry = new Registry(deployer);
        d.readings = new Readings(d.registry);
        d.pool = new RewardPool(d.registry, d.readings, deployer, rewardPerEpoch);
        d.stake = new Stake(d.registry, ISlashReceiver(address(d.pool)), minStake);
        d.pool.setStake(d.stake);
        d.registry.setStakeManager(d.stake);
        d.registry.setBackend(backend, true);
        if (verifier != address(0)) d.registry.setVerifier(verifier, true);
        if (ensUserRegistry != address(0) && ensResolver != address(0)) {
            d.namer = new DeviceNamer(
                address(d.registry), IENSUserRegistry(ensUserRegistry), IENSPermissionedResolver(ensResolver), "prananet"
            );
            d.registry.setNamer(d.namer);
            IEnsRoles(ensUserRegistry).grantRootRoles((1 << 0) | (1 << 12), address(d.namer)); // REGISTRAR | UNREGISTER
            IEnsRoles(ensResolver).grantRootRoles((1 << 0) | (1 << 4), address(d.namer)); // SET_ADDRESS | SET_TEXT
        }
        vm.stopBroadcast();
    }

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address backend = vm.envOr("BACKEND_ADDRESS", deployer);
        address verifier = vm.envOr("VERIFIER_ADDRESS", address(0));
        uint256 minStake = vm.envOr("MIN_STAKE_WEI", uint256(0.001 ether));
        uint256 rewardPerEpoch = vm.envOr("REWARD_PER_EPOCH_WEI", uint256(0.00001 ether));
        string memory path = _path();
        (address ensUserRegistry, address ensResolver) = _ens(path);

        Out memory d = _deploy(pk, deployer, backend, verifier, minStake, rewardPerEpoch, ensUserRegistry, ensResolver);

        string memory o = "deployment";
        vm.serializeUint(o, "chainId", block.chainid);
        vm.serializeUint(o, "deployBlock", block.number);
        vm.serializeAddress(o, "admin", deployer);
        vm.serializeAddress(o, "backend", backend);
        vm.serializeAddress(o, "verifier", verifier);
        vm.serializeUint(o, "minStakeWei", minStake);
        vm.serializeUint(o, "rewardPerEpochWei", rewardPerEpoch);
        vm.serializeAddress(o, "Registry", address(d.registry));
        vm.serializeAddress(o, "Readings", address(d.readings));
        vm.serializeAddress(o, "RewardPool", address(d.pool));
        vm.serializeAddress(o, "DeviceNamer", address(d.namer));
        string memory json = vm.serializeAddress(o, "Stake", address(d.stake));
        vm.writeJson(json, path); // deploy.sh re-attaches the .ens block written by ens-setup.sh

        console.log("Registry  ", address(d.registry));
        console.log("Readings  ", address(d.readings));
        console.log("RewardPool", address(d.pool));
        console.log("Stake     ", address(d.stake));
        console.log("Namer     ", address(d.namer));
        console.log("written to", path);
    }
}
