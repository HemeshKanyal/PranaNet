// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IDeviceNamer
/// @notice Hook the Registry calls to give each device an ENSv2 subname carrying its geohash
///         record, and to revoke it on slash. Implemented in M3; until then the Registry runs
///         with namer == address(0) and skips naming.
interface IDeviceNamer {
    /// @notice Create the subname for `device` (e.g. `<label>.prananet.eth`) with a geohash record.
    /// @return node The ENS node of the new subname.
    function nameDevice(address device, address owner, string calldata label, string calldata geohash)
        external
        returns (bytes32 node);

    /// @notice Revoke the subname previously created for `device`.
    function revokeDevice(address device) external;
}
