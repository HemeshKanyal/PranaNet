// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Registry} from "../src/Registry.sol";

contract RegistryTest is Test {
    Registry registry;
    address admin = makeAddr("admin");
    address backend = makeAddr("backend");
    address operator = makeAddr("operator");
    uint256 constant NULLIFIER = 0xabc123;

    function setUp() public {
        registry = new Registry(admin);
        vm.prank(admin);
        registry.setBackend(backend, true);
    }

    function _register(address device, uint256 nullifier) internal {
        vm.prank(backend);
        registry.registerDevice(device, operator, "dev", "te7ud2", nullifier);
    }

    function test_RegisterDevice() public {
        address device = makeAddr("device1");
        _register(device, NULLIFIER);

        assertTrue(registry.isRegistered(device));
        assertTrue(registry.isActive(device));
        assertEq(registry.ownerOf(device), operator);
        assertEq(registry.devicesPerNullifier(NULLIFIER), 1);
        Registry.Device memory d = registry.getDevice(device);
        assertEq(d.geohash, "te7ud2");
        assertEq(d.nullifierHash, NULLIFIER);
    }

    function test_RevertWhen_FourthDeviceForSameNullifier() public {
        _register(makeAddr("d1"), NULLIFIER);
        _register(makeAddr("d2"), NULLIFIER);
        _register(makeAddr("d3"), NULLIFIER);

        address d4 = makeAddr("d4");
        vm.prank(backend);
        vm.expectRevert(abi.encodeWithSelector(Registry.DeviceLimitReached.selector, NULLIFIER));
        registry.registerDevice(d4, operator, "dev", "te7ud2", NULLIFIER);

        // A different human can still register.
        _register(d4, NULLIFIER + 1);
        assertTrue(registry.isRegistered(d4));
    }

    function test_RevertWhen_NotBackend() public {
        vm.prank(operator);
        vm.expectRevert(Registry.NotBackend.selector);
        registry.registerDevice(makeAddr("d"), operator, "dev", "te7ud2", NULLIFIER);
    }

    function test_RevertWhen_AlreadyRegistered() public {
        address device = makeAddr("d");
        _register(device, NULLIFIER);
        vm.prank(backend);
        vm.expectRevert(abi.encodeWithSelector(Registry.AlreadyRegistered.selector, device));
        registry.registerDevice(device, operator, "dev", "te7ud2", NULLIFIER);
    }

    function test_RevertWhen_InvalidGeohash() public {
        vm.startPrank(backend);
        vm.expectRevert(Registry.InvalidGeohash.selector);
        registry.registerDevice(makeAddr("d"), operator, "dev", "te7ud", NULLIFIER); // too short
        vm.expectRevert(Registry.InvalidGeohash.selector);
        registry.registerDevice(makeAddr("d"), operator, "dev", "te7uda", NULLIFIER); // 'a' not base32
        vm.stopPrank();
    }

    function test_SetActive_OnlyController() public {
        address device = makeAddr("d");
        _register(device, NULLIFIER);

        vm.prank(operator);
        vm.expectRevert(Registry.NotController.selector);
        registry.setActive(device, false);

        vm.prank(admin);
        registry.setActive(device, false);
        assertFalse(registry.isActive(device));
    }
}
