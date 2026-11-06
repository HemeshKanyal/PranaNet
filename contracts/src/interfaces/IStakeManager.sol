// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Called by the Registry when a device is slashed (third consecutive flag).
interface IStakeManager {
    function slash(address device) external;
}
