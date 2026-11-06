// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Registry} from "./Registry.sol";

/// @title PranaNet Readings
/// @notice Accepts signed epoch readings from registered devices. Anyone (the untrusted relayer)
///         may submit; only a valid device signature over the exact values is accepted.
///
/// Signed message (docs/SPEC.md "Signed reading format"):
///   message = keccak256(abi.encodePacked(
///       address device, uint256 epoch,
///       uint256 pm25_x10, uint256 pm10_x10, int256 temp_x10, uint256 hum_x10,
///       uint256 nonce, uint256 chainId, address readingsContract))
///   digest  = keccak256("\x19Ethereum Signed Message:\n32" ++ message)   // EIP-191 personal_sign
/// Packed length: 20 + 7*32 + 20 = 264 bytes. Integers are big-endian 32-byte words;
/// temp_x10 is two's complement. chainId and readingsContract are taken from the chain, not
/// from the caller, so a signature for another chain or contract never verifies.
/// Nonces are per device and must strictly increase; the first accepted nonce must be >= 1.
contract Readings {
    struct Reading {
        address device;
        uint256 epoch;
        uint256 pm25_x10;
        uint256 pm10_x10;
        int256 temp_x10;
        uint256 hum_x10;
        uint256 nonce;
    }

    /// @dev secp256k1n / 2, upper bound for canonical (low-s) signatures.
    uint256 private constant HALF_N = 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0;

    Registry public immutable registry;
    mapping(address => uint256) public lastNonce;
    /// @notice Accepted epochs per device (used by RewardPool).
    mapping(address => uint256) public acceptedEpochs;

    event ReadingAccepted(
        address indexed device,
        uint256 indexed epoch,
        uint256 nonce,
        uint256 pm25_x10,
        uint256 pm10_x10,
        int256 temp_x10,
        uint256 hum_x10
    );

    error InvalidSignatureLength();
    error InvalidSignatureS();
    error InvalidSignatureV();
    error InvalidSignature();
    error DeviceNotActive(address device);
    error NonceNotIncreasing(uint256 nonce, uint256 lastNonce);

    constructor(Registry registry_) {
        registry = registry_;
    }

    /// @notice Submit one signed epoch reading. `sig` is 65 bytes r ++ s ++ v (v = 27/28 or 0/1).
    function submitEpoch(Reading calldata reading, bytes calldata sig) external {
        address signer = _recover(digestOf(reading), sig);
        if (signer != reading.device) revert InvalidSignature();
        if (!registry.isActive(reading.device)) revert DeviceNotActive(reading.device);

        uint256 last = lastNonce[reading.device];
        if (reading.nonce <= last) revert NonceNotIncreasing(reading.nonce, last);
        lastNonce[reading.device] = reading.nonce;
        acceptedEpochs[reading.device] += 1;

        emit ReadingAccepted(
            reading.device,
            reading.epoch,
            reading.nonce,
            reading.pm25_x10,
            reading.pm10_x10,
            reading.temp_x10,
            reading.hum_x10
        );
    }

    /// @notice The raw message a device hashes (before EIP-191), bound to this chain and contract.
    function messageOf(Reading calldata r) public view returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                r.device, r.epoch, r.pm25_x10, r.pm10_x10, r.temp_x10, r.hum_x10, r.nonce, block.chainid, address(this)
            )
        );
    }

    /// @notice EIP-191 personal_sign digest of `messageOf(r)`; this is what ecrecover checks.
    function digestOf(Reading calldata r) public view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageOf(r)));
    }

    function _recover(bytes32 digest, bytes calldata sig) private pure returns (address signer) {
        if (sig.length != 65) revert InvalidSignatureLength();
        bytes32 r = bytes32(sig[0:32]);
        bytes32 s = bytes32(sig[32:64]);
        uint8 v = uint8(sig[64]);
        if (v < 27) v += 27;
        if (v != 27 && v != 28) revert InvalidSignatureV();
        if (uint256(s) > HALF_N) revert InvalidSignatureS();
        signer = ecrecover(digest, v, r, s);
        if (signer == address(0)) revert InvalidSignature();
    }
}
