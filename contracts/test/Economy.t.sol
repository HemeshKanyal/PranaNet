// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Registry} from "../src/Registry.sol";
import {Readings} from "../src/Readings.sol";
import {Stake, ISlashReceiver} from "../src/Stake.sol";
import {RewardPool} from "../src/RewardPool.sol";

contract EconomyTest is Test {
    Registry registry;
    Readings readings;
    Stake stakeC;
    RewardPool pool;

    address admin = makeAddr("admin");
    address backend = makeAddr("backend");
    address verifier = makeAddr("verifier");
    address operator = makeAddr("operator");
    address device;
    uint256 deviceKey;

    uint256 constant MIN_STAKE = 0.001 ether;
    uint256 constant REWARD = 0.0001 ether;
    uint256 constant T = 1_762_360_200;

    function setUp() public {
        (device, deviceKey) = makeAddrAndKey("device");
        registry = new Registry(admin);
        readings = new Readings(registry);
        pool = new RewardPool(registry, readings, admin, REWARD);
        stakeC = new Stake(registry, ISlashReceiver(address(pool)), MIN_STAKE);
        vm.startPrank(admin);
        pool.setStake(stakeC);
        registry.setStakeManager(stakeC);
        registry.setBackend(backend, true);
        registry.setVerifier(verifier, true);
        vm.stopPrank();
        vm.prank(backend);
        registry.registerDevice(device, operator, "andheri-01", "te7ud2", 7);
        vm.deal(operator, 1 ether);
        vm.deal(address(this), 10 ether);
    }

    // ------------------------------------------------------------- helpers

    function _submit(uint256 nonce) internal {
        Readings.Reading memory r = Readings.Reading(device, T + nonce * 60, 400, 400, 290, 640, nonce);
        (uint8 v, bytes32 rr, bytes32 s) = vm.sign(deviceKey, readings.digestOf(r));
        readings.submitEpoch(r, abi.encodePacked(rr, s, v));
    }

    function _flag(uint256 epoch) internal {
        vm.prank(verifier);
        registry.flag(device, epoch, 1);
    }

    function _stake(uint256 amount) internal {
        vm.prank(operator);
        stakeC.stake{value: amount}(device);
    }

    // ---------------------------------------------------------------- stake

    function test_StakeAndUnstake() public {
        _stake(MIN_STAKE);
        assertEq(stakeC.stakeOf(device), MIN_STAKE);
        _stake(1 wei); // top-up
        assertEq(stakeC.stakeOf(device), MIN_STAKE + 1);

        uint256 before = operator.balance;
        vm.prank(operator);
        stakeC.unstake(device);
        assertEq(stakeC.stakeOf(device), 0);
        assertEq(operator.balance, before + MIN_STAKE + 1);
    }

    function test_RevertWhen_StakeBelowMinimum() public {
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(Stake.BelowMinStake.selector, MIN_STAKE - 1, MIN_STAKE));
        stakeC.stake{value: MIN_STAKE - 1}(device);
    }

    function test_RevertWhen_StakeByNonOwner() public {
        vm.expectRevert(Stake.NotDeviceOwner.selector);
        stakeC.stake{value: MIN_STAKE}(device);
    }

    function test_RevertWhen_UnstakeWithOpenFlags() public {
        _stake(MIN_STAKE);
        _flag(T);
        vm.prank(operator);
        vm.expectRevert(Stake.DeviceHasOpenFlags.selector);
        stakeC.unstake(device);
    }

    function test_RevertWhen_SlashNotFromRegistry() public {
        vm.expectRevert(Stake.NotRegistry.selector);
        stakeC.slash(device);
    }

    // ------------------------------------------------------- slash to pool

    function test_ThirdFlagMovesStakeToPool() public {
        _stake(MIN_STAKE);
        _flag(T);
        _flag(T + 60);
        vm.expectEmit(true, false, false, true, address(pool));
        emit RewardPool.SlashReceived(device, MIN_STAKE);
        _flag(T + 120);

        assertEq(stakeC.stakeOf(device), 0);
        assertEq(address(pool).balance, MIN_STAKE);
        assertEq(address(stakeC).balance, 0);
        assertFalse(registry.isActive(device));

        // Slashed device can neither submit nor claim.
        Readings.Reading memory r = Readings.Reading(device, T, 1, 1, 0, 0, 1);
        (uint8 v, bytes32 rr, bytes32 s) = vm.sign(deviceKey, readings.digestOf(r));
        vm.expectRevert(abi.encodeWithSelector(Readings.DeviceNotActive.selector, device));
        readings.submitEpoch(r, abi.encodePacked(rr, s, v));
        vm.prank(operator);
        vm.expectRevert(RewardPool.DeviceNotActive.selector);
        pool.claimRewards(device);
    }

    function test_SlashWithoutStakeStillDeactivates() public {
        _flag(T);
        _flag(T + 60);
        _flag(T + 120);
        assertFalse(registry.isActive(device));
        assertEq(address(pool).balance, 0);
    }

    // ---------------------------------------------------------------- claim

    function test_ClaimForAcceptedUnflaggedEpochs() public {
        _stake(MIN_STAKE);
        pool.fundPool{value: 1 ether}();
        for (uint256 n = 1; n <= 5; ++n) {
            _submit(n);
        }
        _flag(T + 60); // one flagged epoch, streak broken below
        vm.prank(verifier);
        registry.clearFlags(device, T + 120);

        assertEq(pool.claimableEpochs(device), 4);
        assertEq(pool.claimable(device), 4 * REWARD);

        uint256 before = operator.balance;
        vm.prank(operator);
        uint256 paid = pool.claimRewards(device);
        assertEq(paid, 4 * REWARD);
        assertEq(operator.balance, before + 4 * REWARD);
        assertEq(pool.claimableEpochs(device), 0);

        vm.prank(operator);
        vm.expectRevert(RewardPool.NothingToClaim.selector);
        pool.claimRewards(device);

        _submit(6);
        assertEq(pool.claimableEpochs(device), 1);
    }

    function test_ClaimLimitedByPoolBalance() public {
        _stake(MIN_STAKE);
        pool.fundPool{value: 2 * REWARD + 1}();
        for (uint256 n = 1; n <= 5; ++n) {
            _submit(n);
        }
        vm.prank(operator);
        assertEq(pool.claimRewards(device), 2 * REWARD);
        assertEq(pool.claimableEpochs(device), 3); // rest stays claimable

        pool.fundPool{value: 1 ether}();
        vm.prank(operator);
        assertEq(pool.claimRewards(device), 3 * REWARD);
    }

    function test_RevertWhen_ClaimWithoutStake() public {
        pool.fundPool{value: 1 ether}();
        _submit(1);
        vm.prank(operator);
        vm.expectRevert(RewardPool.NotStaked.selector);
        pool.claimRewards(device);
    }

    function test_RevertWhen_ClaimByNonOwner() public {
        _stake(MIN_STAKE);
        vm.expectRevert(RewardPool.NotDeviceOwner.selector);
        pool.claimRewards(device);
    }

    function test_SlashedStakeFundsHonestOperator() public {
        // Second, honest device owned by another operator.
        (address honest, uint256 honestKey) = makeAddrAndKey("honest");
        address honestOp = makeAddr("honestOp");
        vm.deal(honestOp, 1 ether);
        vm.prank(backend);
        registry.registerDevice(honest, honestOp, "andheri-02", "te7ud2", 8);
        vm.prank(honestOp);
        stakeC.stake{value: MIN_STAKE}(honest);

        // Cheater gets slashed; its stake is the only money in the pool.
        _stake(MIN_STAKE);
        _flag(T);
        _flag(T + 60);
        _flag(T + 120);
        assertEq(address(pool).balance, MIN_STAKE);

        Readings.Reading memory r = Readings.Reading(honest, T, 400, 400, 0, 0, 1);
        (uint8 v, bytes32 rr, bytes32 s) = vm.sign(honestKey, readings.digestOf(r));
        readings.submitEpoch(r, abi.encodePacked(rr, s, v));

        vm.prank(honestOp);
        assertEq(pool.claimRewards(honest), REWARD);
    }

    function test_AdminOnlyPoolSettings() public {
        vm.expectRevert(RewardPool.NotAdmin.selector);
        pool.setRewardPerEpoch(1);
        vm.prank(admin);
        vm.expectRevert(RewardPool.StakeAlreadySet.selector);
        pool.setStake(stakeC);
    }

    function test_RevertWhen_NonAdminSetsStakeManager() public {
        vm.expectRevert(Registry.NotAdmin.selector);
        registry.setStakeManager(stakeC);
    }
}
