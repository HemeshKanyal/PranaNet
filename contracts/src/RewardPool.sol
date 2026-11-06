// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Registry} from "./Registry.sol";
import {Readings} from "./Readings.sol";
import {Stake} from "./Stake.sol";

/// @title PranaNet RewardPool
/// @notice Holds data revenue (fundPool, e.g. from x402 sales) and slashed stake. Operators of
///         active, staked devices claim a fixed `rewardPerEpoch` for each accepted, unflagged epoch:
///             earned epochs = acceptedEpochs - totalFlags - claimedEpochs   (floored at 0)
///         Payout is limited by the pool balance; unpaid epochs stay claimable.
contract RewardPool {
    Registry public immutable registry;
    Readings public immutable readings;
    address public admin;
    Stake public stake;
    uint256 public rewardPerEpoch;

    mapping(address => uint256) public claimedEpochs;

    event Funded(address indexed from, uint256 amount);
    event SlashReceived(address indexed device, uint256 amount);
    event Claimed(address indexed device, address indexed owner, uint256 epochs, uint256 amount);
    event RewardPerEpochSet(uint256 amount);
    event StakeSet(address indexed stake);

    error NotAdmin();
    error NotStake();
    error StakeAlreadySet();
    error NotDeviceOwner();
    error DeviceNotActive();
    error NotStaked();
    error NothingToClaim();
    error TransferFailed();

    constructor(Registry registry_, Readings readings_, address admin_, uint256 rewardPerEpoch_) {
        registry = registry_;
        readings = readings_;
        admin = admin_;
        rewardPerEpoch = rewardPerEpoch_;
        emit RewardPerEpochSet(rewardPerEpoch_);
    }

    /// @notice One-time link to the Stake contract (it is deployed after the pool).
    function setStake(Stake stake_) external {
        if (msg.sender != admin) revert NotAdmin();
        if (address(stake) != address(0)) revert StakeAlreadySet();
        stake = stake_;
        emit StakeSet(address(stake_));
    }

    function setRewardPerEpoch(uint256 amount) external {
        if (msg.sender != admin) revert NotAdmin();
        rewardPerEpoch = amount;
        emit RewardPerEpochSet(amount);
    }

    /// @notice Add revenue to the pool.
    function fundPool() external payable {
        emit Funded(msg.sender, msg.value);
    }

    /// @notice Stake contract deposits a slashed device's stake.
    function receiveSlash(address device) external payable {
        if (msg.sender != address(stake)) revert NotStake();
        emit SlashReceived(device, msg.value);
    }

    /// @notice Epochs `device` has earned but not yet been paid for.
    function claimableEpochs(address device) public view returns (uint256) {
        uint256 accepted = readings.acceptedEpochs(device);
        uint256 used = registry.totalFlags(device) + claimedEpochs[device];
        return accepted > used ? accepted - used : 0;
    }

    function claimable(address device) external view returns (uint256) {
        return _payable(claimableEpochs(device)) * rewardPerEpoch;
    }

    /// @notice Device owner claims rewards to their own address.
    function claimRewards(address device) external returns (uint256 amount) {
        if (registry.ownerOf(device) != msg.sender) revert NotDeviceOwner();
        if (!registry.isActive(device)) revert DeviceNotActive();
        if (stake.stakeOf(device) == 0) revert NotStaked();
        uint256 epochs = _payable(claimableEpochs(device));
        if (epochs == 0) revert NothingToClaim();
        claimedEpochs[device] += epochs;
        amount = epochs * rewardPerEpoch;
        emit Claimed(device, msg.sender, epochs, amount);
        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    function _payable(uint256 epochs) private view returns (uint256) {
        if (rewardPerEpoch == 0) return 0;
        uint256 affordable = address(this).balance / rewardPerEpoch;
        return epochs < affordable ? epochs : affordable;
    }
}
