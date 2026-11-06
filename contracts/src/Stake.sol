// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Registry} from "./Registry.sol";
import {IStakeManager} from "./interfaces/IStakeManager.sol";

interface ISlashReceiver {
    function receiveSlash(address device) external payable;
}

/// @title PranaNet Stake
/// @notice Operators deposit a small ETH stake per device. A slash (third consecutive flag in the
///         Registry) moves the whole stake into the RewardPool.
contract Stake is IStakeManager {
    Registry public immutable registry;
    ISlashReceiver public immutable pool;
    uint256 public immutable minStake;

    mapping(address => uint256) public stakeOf;

    event Staked(address indexed device, address indexed owner, uint256 amount, uint256 total);
    event Unstaked(address indexed device, address indexed owner, uint256 amount);
    event Slashed(address indexed device, uint256 amount);

    error NotDeviceOwner();
    error NotRegistry();
    error BelowMinStake(uint256 total, uint256 minStake);
    error DeviceNotActive();
    error DeviceHasOpenFlags();
    error NothingStaked();
    error TransferFailed();

    constructor(Registry registry_, ISlashReceiver pool_, uint256 minStake_) {
        registry = registry_;
        pool = pool_;
        minStake = minStake_;
    }

    modifier onlyOwnerOf(address device) {
        if (registry.ownerOf(device) != msg.sender) revert NotDeviceOwner();
        _;
    }

    /// @notice Add stake for `device`. Total must reach `minStake`.
    function stake(address device) external payable onlyOwnerOf(device) {
        if (!registry.isActive(device)) revert DeviceNotActive();
        uint256 total = stakeOf[device] + msg.value;
        if (total < minStake) revert BelowMinStake(total, minStake);
        stakeOf[device] = total;
        emit Staked(device, msg.sender, msg.value, total);
    }

    /// @notice Withdraw the whole stake. Not allowed while the device has an open flag streak,
    ///         so an operator can't dodge a pending slash.
    function unstake(address device) external onlyOwnerOf(device) {
        if (registry.consecutiveFlags(device) != 0) revert DeviceHasOpenFlags();
        uint256 amount = stakeOf[device];
        if (amount == 0) revert NothingStaked();
        stakeOf[device] = 0;
        emit Unstaked(device, msg.sender, amount);
        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    /// @inheritdoc IStakeManager
    function slash(address device) external {
        if (msg.sender != address(registry)) revert NotRegistry();
        uint256 amount = stakeOf[device];
        stakeOf[device] = 0;
        emit Slashed(device, amount);
        pool.receiveSlash{value: amount}(device);
    }
}
