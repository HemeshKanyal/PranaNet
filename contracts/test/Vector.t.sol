// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Registry} from "../src/Registry.sol";
import {Readings} from "../src/Readings.sol";

/// Fixed cross-implementation vector, identical to relayer/test/vector.json (generated with viem)
/// and to what the firmware `selftest` serial command prints. Key = Hardhat test key #0 (public).
contract VectorTest is Test {
    address constant DEVICE = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
    address constant READINGS_AT = 0x5FbDB2315678afecb367f032d93F642f64180aa3;
    uint256 constant CHAIN_ID = 11_155_111;
    bytes32 constant MESSAGE = 0xf920ce88124f7e4845796eb90f81329a74f4ae9753291650afba2a1bf3e09a9c;
    bytes32 constant DIGEST = 0x7e91e0a7eeaf999f31609c6496bbb71875af5668734189b88143fcc21a38dbc5;
    bytes constant SIG =
        hex"8bf0d72d56d07cd5a48285abc17b6362eb62f327463446840fa6e8fc989607af1628f6b9f14af9b7a2cb62d26cb1e234d4467455f2559e5114e851aa15b27a6a1b";

    Registry registry;
    Readings readings;

    function setUp() public {
        vm.chainId(CHAIN_ID);
        address admin = makeAddr("admin");
        registry = new Registry(admin);
        deployCodeTo("Readings.sol:Readings", abi.encode(registry), READINGS_AT);
        readings = Readings(READINGS_AT);
        vm.startPrank(admin);
        registry.setBackend(admin, true);
        registry.registerDevice(DEVICE, admin, "vector", "te7ud2", 1);
        vm.stopPrank();
    }

    function _reading() internal pure returns (Readings.Reading memory) {
        return Readings.Reading({
            device: DEVICE, epoch: 1_762_360_200, pm25_x10: 423, pm10_x10: 610, temp_x10: -15, hum_x10: 640, nonce: 17
        });
    }

    function test_VectorMessageAndDigest() public view {
        assertEq(readings.messageOf(_reading()), MESSAGE);
        assertEq(readings.digestOf(_reading()), DIGEST);
    }

    function test_VectorRecoversDevice() public pure {
        (bytes32 r, bytes32 s) = (bytes32(0), bytes32(0));
        bytes memory sig = SIG;
        uint8 v;
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        assertEq(ecrecover(DIGEST, v, r, s), DEVICE);
    }

    function test_VectorAcceptedOnChain() public {
        vm.expectEmit(true, true, false, true, READINGS_AT);
        emit Readings.ReadingAccepted(DEVICE, 1_762_360_200, 17, 423, 610, -15, 640);
        readings.submitEpoch(_reading(), SIG);
    }
}
