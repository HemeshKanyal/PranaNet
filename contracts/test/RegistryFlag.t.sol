// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Registry} from "../src/Registry.sol";
import {IDeviceNamer} from "../src/interfaces/IDeviceNamer.sol";

contract MockNamer is IDeviceNamer {
    mapping(address => bool) public named;

    function nameDevice(address device, address, string calldata, string calldata) external returns (bytes32) {
        named[device] = true;
        return keccak256(abi.encode(device));
    }

    function revokeDevice(address device) external {
        named[device] = false;
    }
}

contract RegistryFlagTest is Test {
    Registry registry;
    MockNamer namer;
    address admin = makeAddr("admin");
    address backend = makeAddr("backend");
    address verifier = makeAddr("verifier");
    address device = makeAddr("device");
    uint256 constant T = 1_762_360_200;

    function setUp() public {
        registry = new Registry(admin);
        namer = new MockNamer();
        vm.startPrank(admin);
        registry.setBackend(backend, true);
        registry.setVerifier(verifier, true);
        registry.setNamer(namer);
        vm.stopPrank();
        vm.prank(backend);
        registry.registerDevice(device, makeAddr("operator"), "andheri-01", "te7ud2", 42);
    }

    function _flag(uint256 epoch) internal {
        vm.prank(verifier);
        registry.flag(device, epoch, 1);
    }

    function test_FlagIncrementsAndEmits() public {
        vm.expectEmit(true, true, false, true, address(registry));
        emit Registry.DeviceFlagged(device, T, 1, 1);
        _flag(T);
        assertEq(registry.consecutiveFlags(device), 1);
        assertEq(registry.lastCheckedEpoch(device), T);
        assertTrue(registry.isActive(device));
    }

    function test_ThreeConsecutiveFlagsSlash() public {
        assertTrue(namer.named(device));
        _flag(T);
        _flag(T + 300);

        vm.expectEmit(true, true, false, false, address(registry));
        emit Registry.DeviceSlashed(device, T + 600);
        _flag(T + 600);

        assertFalse(registry.isActive(device));
        assertFalse(namer.named(device)); // ENS subname revoked
        assertEq(registry.consecutiveFlags(device), 0);

        // Slashed device can't be flagged again.
        vm.prank(verifier);
        vm.expectRevert(abi.encodeWithSelector(Registry.DeviceNotActive.selector, device));
        registry.flag(device, T + 900, 1);
    }

    function test_CleanEpochBreaksStreak() public {
        _flag(T);
        _flag(T + 300);
        vm.prank(verifier);
        registry.clearFlags(device, T + 600);
        assertEq(registry.consecutiveFlags(device), 0);

        _flag(T + 900);
        _flag(T + 1200);
        assertTrue(registry.isActive(device)); // only 2 consecutive
    }

    function test_RevertWhen_NotVerifier() public {
        vm.prank(backend);
        vm.expectRevert(Registry.NotVerifier.selector);
        registry.flag(device, T, 1);

        vm.prank(admin);
        vm.expectRevert(Registry.NotVerifier.selector);
        registry.clearFlags(device, T);
    }

    function test_RevertWhen_InvalidReason() public {
        vm.startPrank(verifier);
        vm.expectRevert(abi.encodeWithSelector(Registry.InvalidReason.selector, 0));
        registry.flag(device, T, 0);
        vm.expectRevert(abi.encodeWithSelector(Registry.InvalidReason.selector, 3));
        registry.flag(device, T, 3);
        registry.flag(device, T, 2); // station outlier ok
        vm.stopPrank();
    }

    function test_RevertWhen_SameOrOlderEpoch() public {
        _flag(T);
        vm.startPrank(verifier);
        vm.expectRevert(abi.encodeWithSelector(Registry.EpochNotAfterLastCheck.selector, T, T));
        registry.flag(device, T, 1); // same epoch can't count twice
        vm.expectRevert(abi.encodeWithSelector(Registry.EpochNotAfterLastCheck.selector, T - 1, T));
        registry.flag(device, T - 1, 1);
        vm.stopPrank();
    }

    function test_RevertWhen_Unregistered() public {
        address stranger = makeAddr("stranger");
        vm.prank(verifier);
        vm.expectRevert(abi.encodeWithSelector(Registry.NotRegistered.selector, stranger));
        registry.flag(stranger, T, 1);
    }

    function test_SetVerifier_OnlyAdmin() public {
        vm.prank(verifier);
        vm.expectRevert(Registry.NotAdmin.selector);
        registry.setVerifier(makeAddr("x"), true);
    }
}
