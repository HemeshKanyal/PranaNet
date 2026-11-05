// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Registry} from "../src/Registry.sol";
import {Readings} from "../src/Readings.sol";

contract ReadingsTest is Test {
    Registry registry;
    Readings readings;

    address admin = makeAddr("admin");
    address backend = makeAddr("backend");
    address relayer = makeAddr("relayer");
    address device;
    uint256 deviceKey;

    function setUp() public {
        (device, deviceKey) = makeAddrAndKey("device");
        registry = new Registry(admin);
        readings = new Readings(registry);
        vm.prank(admin);
        registry.setBackend(backend, true);
        vm.prank(backend);
        registry.registerDevice(device, makeAddr("operator"), "dev1", "te7ud2", 42);
    }

    // ------------------------------------------------------------- helpers

    function _reading(uint256 nonce) internal view returns (Readings.Reading memory) {
        return Readings.Reading({
            device: device,
            epoch: 1_762_356_600,
            pm25_x10: 523,
            pm10_x10: 811,
            temp_x10: -15, // -1.5 C exercises the signed field
            hum_x10: 634,
            nonce: nonce
        });
    }

    /// Mirrors SPEC.md: keccak256(abi.encodePacked(device, epoch, pm25, pm10, temp, hum, nonce,
    /// chainId, contract)), then EIP-191. chainId/contract are parameters so tests can forge them.
    function _digest(Readings.Reading memory r, uint256 chainId, address target) internal pure returns (bytes32) {
        bytes32 message = keccak256(
            abi.encodePacked(r.device, r.epoch, r.pm25_x10, r.pm10_x10, r.temp_x10, r.hum_x10, r.nonce, chainId, target)
        );
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", message));
    }

    function _sign(uint256 key, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function _signValid(Readings.Reading memory r) internal view returns (bytes memory) {
        return _sign(deviceKey, _digest(r, block.chainid, address(readings)));
    }

    // --------------------------------------------------------------- tests

    function test_ValidReadingAccepted() public {
        Readings.Reading memory r = _reading(1);
        bytes memory sig = _signValid(r);

        vm.expectEmit(true, true, false, true, address(readings));
        emit Readings.ReadingAccepted(device, r.epoch, 1, 523, 811, -15, 634);
        vm.prank(relayer); // untrusted relayer pays gas
        readings.submitEpoch(r, sig);

        assertEq(readings.lastNonce(device), 1);
    }

    function test_DigestMatchesSpecEncoding() public view {
        Readings.Reading memory r = _reading(7);
        assertEq(readings.digestOf(r), _digest(r, block.chainid, address(readings)));
        // 20 + 7*32 + 20 bytes, as documented for the firmware.
        bytes memory packed = abi.encodePacked(
            r.device, r.epoch, r.pm25_x10, r.pm10_x10, r.temp_x10, r.hum_x10, r.nonce, block.chainid, address(readings)
        );
        assertEq(packed.length, 264);
    }

    function test_RevertWhen_WrongKey() public {
        (, uint256 attackerKey) = makeAddrAndKey("attacker");
        Readings.Reading memory r = _reading(1);
        bytes memory sig = _sign(attackerKey, _digest(r, block.chainid, address(readings)));

        vm.expectRevert(Readings.InvalidSignature.selector);
        readings.submitEpoch(r, sig);
    }

    function test_RevertWhen_ValueTamperedByRelayer() public {
        Readings.Reading memory r = _reading(1);
        bytes memory sig = _signValid(r);
        r.pm25_x10 = 100; // relayer tries to lower the reading

        vm.expectRevert(Readings.InvalidSignature.selector);
        readings.submitEpoch(r, sig);
    }

    function test_RevertWhen_NonceReplayed() public {
        Readings.Reading memory r = _reading(5);
        bytes memory sig = _signValid(r);
        readings.submitEpoch(r, sig);

        // Exact replay.
        vm.expectRevert(abi.encodeWithSelector(Readings.NonceNotIncreasing.selector, 5, 5));
        readings.submitEpoch(r, sig);

        // Older nonce, freshly signed.
        Readings.Reading memory older = _reading(4);
        bytes memory olderSig = _signValid(older);
        vm.expectRevert(abi.encodeWithSelector(Readings.NonceNotIncreasing.selector, 4, 5));
        readings.submitEpoch(older, olderSig);

        // Next nonce still works.
        Readings.Reading memory next = _reading(6);
        readings.submitEpoch(next, _signValid(next));
        assertEq(readings.lastNonce(device), 6);
    }

    function test_RevertWhen_NonceZero() public {
        Readings.Reading memory r = _reading(0);
        bytes memory sig = _signValid(r);
        vm.expectRevert(abi.encodeWithSelector(Readings.NonceNotIncreasing.selector, 0, 0));
        readings.submitEpoch(r, sig);
    }

    function test_RevertWhen_DeviceInactive() public {
        vm.prank(admin);
        registry.setActive(device, false);

        Readings.Reading memory r = _reading(1);
        bytes memory sig = _signValid(r);
        vm.expectRevert(abi.encodeWithSelector(Readings.DeviceNotActive.selector, device));
        readings.submitEpoch(r, sig);
    }

    function test_RevertWhen_DeviceUnregistered() public {
        (address stranger, uint256 strangerKey) = makeAddrAndKey("stranger");
        Readings.Reading memory r = _reading(1);
        r.device = stranger;
        bytes memory sig = _sign(strangerKey, _digest(r, block.chainid, address(readings)));

        vm.expectRevert(abi.encodeWithSelector(Readings.DeviceNotActive.selector, stranger));
        readings.submitEpoch(r, sig);
    }

    function test_RevertWhen_WrongChainId() public {
        Readings.Reading memory r = _reading(1);
        uint256 otherChain = block.chainid == 1 ? 11_155_111 : 1;
        bytes memory sig = _sign(deviceKey, _digest(r, otherChain, address(readings)));

        vm.expectRevert(Readings.InvalidSignature.selector);
        readings.submitEpoch(r, sig);
    }

    function test_RevertWhen_SignedForOtherChainThenReplayedThere() public {
        // Signature valid on Sepolia must not verify on a fork with a different chainId.
        vm.chainId(11_155_111);
        Readings.Reading memory r = _reading(1);
        bytes memory sig = _signValid(r);
        vm.chainId(1);

        vm.expectRevert(Readings.InvalidSignature.selector);
        readings.submitEpoch(r, sig);
    }

    function test_RevertWhen_WrongContract() public {
        Readings other = new Readings(registry);
        Readings.Reading memory r = _reading(1);
        bytes memory sig = _sign(deviceKey, _digest(r, block.chainid, address(other)));

        vm.expectRevert(Readings.InvalidSignature.selector);
        readings.submitEpoch(r, sig);

        // ...but the same signature is valid on the contract it was made for.
        other.submitEpoch(r, sig);
    }

    function test_RevertWhen_BadSignatureLength() public {
        vm.expectRevert(Readings.InvalidSignatureLength.selector);
        readings.submitEpoch(_reading(1), hex"1234");
    }

    function test_AcceptsVZeroOrOne() public {
        Readings.Reading memory r = _reading(1);
        (uint8 v, bytes32 rr, bytes32 s) = vm.sign(deviceKey, _digest(r, block.chainid, address(readings)));
        readings.submitEpoch(r, abi.encodePacked(rr, s, v - 27));
        assertEq(readings.lastNonce(device), 1);
    }
}
