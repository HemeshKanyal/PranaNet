// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IDeviceNamer} from "./interfaces/IDeviceNamer.sol";
import {IStakeManager} from "./interfaces/IStakeManager.sol";

/// @title PranaNet device Registry
/// @notice Records which ESP32 device keys may submit readings, who operates them, and the
///         geohash cell they report for. Registration is done by a trusted backend after it has
///         verified a World ID proof; the World ID nullifier hash caps each human at 3 devices.
contract Registry {
    uint256 public constant MAX_DEVICES_PER_HUMAN = 3;
    uint256 public constant GEOHASH_LENGTH = 6;
    /// @notice Consecutive flags that slash a device.
    uint8 public constant SLASH_THRESHOLD = 3;
    uint8 public constant REASON_NEIGHBOUR_OUTLIER = 1;
    uint8 public constant REASON_STATION_OUTLIER = 2;

    struct Device {
        address owner;
        uint256 nullifierHash;
        string label;
        string geohash;
        bytes32 ensNode;
        uint64 registeredAt;
        bool active;
    }

    address public admin;
    /// @notice Backends allowed to register devices (after World ID verification).
    mapping(address => bool) public isBackend;
    /// @notice Contracts/accounts allowed to change a device's active flag (admin, later Stake/slash).
    mapping(address => bool) public isController;
    /// @notice ENS naming hook; address(0) disables naming.
    IDeviceNamer public namer;

    mapping(address => Device) private _devices;
    mapping(uint256 => uint256) public devicesPerNullifier;
    /// @notice Accounts allowed to flag devices (the cross-check verifier).
    mapping(address => bool) public isVerifier;
    /// @notice Flags since the device's last clean epoch.
    mapping(address => uint8) public consecutiveFlags;
    /// @notice Last epoch flagged or cleared per device; flags must move forward in time.
    mapping(address => uint256) public lastCheckedEpoch;
    /// @notice All flags ever raised against a device (flagged epochs earn no rewards).
    mapping(address => uint256) public totalFlags;
    /// @notice Stake contract that moves a slashed device's stake to the reward pool.
    IStakeManager public stakeManager;

    event DeviceRegistered(
        address indexed device, address indexed owner, uint256 indexed nullifierHash, string label, string geohash
    );
    event DeviceStatusChanged(address indexed device, bool active);
    event AdminChanged(address indexed admin);
    event BackendSet(address indexed account, bool allowed);
    event ControllerSet(address indexed account, bool allowed);
    event NamerSet(address indexed namer);
    event VerifierSet(address indexed account, bool allowed);
    event StakeManagerSet(address indexed stakeManager);
    event DeviceFlagged(address indexed device, uint256 indexed epoch, uint8 reason, uint8 consecutiveFlags);
    event FlagsCleared(address indexed device, uint256 indexed epoch);
    event DeviceSlashed(address indexed device, uint256 indexed epoch);

    error NotAdmin();
    error NotBackend();
    error NotController();
    error NotVerifier();
    error InvalidReason(uint8 reason);
    error EpochNotAfterLastCheck(uint256 epoch, uint256 lastCheckedEpoch);
    error DeviceNotActive(address device);
    error ZeroAddress();
    error AlreadyRegistered(address device);
    error NotRegistered(address device);
    error InvalidGeohash();
    error EmptyLabel();
    error DeviceLimitReached(uint256 nullifierHash);

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    constructor(address admin_) {
        if (admin_ == address(0)) revert ZeroAddress();
        admin = admin_;
        isController[admin_] = true;
        emit AdminChanged(admin_);
        emit ControllerSet(admin_, true);
    }

    // ---------------------------------------------------------------- admin

    function setAdmin(address admin_) external onlyAdmin {
        if (admin_ == address(0)) revert ZeroAddress();
        admin = admin_;
        emit AdminChanged(admin_);
    }

    function setBackend(address account, bool allowed) external onlyAdmin {
        isBackend[account] = allowed;
        emit BackendSet(account, allowed);
    }

    function setController(address account, bool allowed) external onlyAdmin {
        isController[account] = allowed;
        emit ControllerSet(account, allowed);
    }

    function setNamer(IDeviceNamer namer_) external onlyAdmin {
        namer = namer_;
        emit NamerSet(address(namer_));
    }

    function setVerifier(address account, bool allowed) external onlyAdmin {
        isVerifier[account] = allowed;
        emit VerifierSet(account, allowed);
    }

    function setStakeManager(IStakeManager stakeManager_) external onlyAdmin {
        stakeManager = stakeManager_;
        emit StakeManagerSet(address(stakeManager_));
    }

    // ---------------------------------------------------------- registration

    /// @notice Register a device key. Backend-only, called after a valid World ID proof.
    /// @param device        Address derived from the device's secp256k1 key (signs readings).
    /// @param owner         Operator wallet that owns the device.
    /// @param label         Human-readable label, used for the ENS subname.
    /// @param geohash       6-character geohash cell (~1.2 x 0.6 km). No finer location on-chain.
    /// @param nullifierHash World ID nullifier hash of the operator.
    function registerDevice(
        address device,
        address owner,
        string calldata label,
        string calldata geohash,
        uint256 nullifierHash
    ) external {
        if (!isBackend[msg.sender]) revert NotBackend();
        if (device == address(0) || owner == address(0)) revert ZeroAddress();
        if (_devices[device].owner != address(0)) revert AlreadyRegistered(device);
        if (bytes(label).length == 0) revert EmptyLabel();
        if (!_isGeohash(bytes(geohash))) revert InvalidGeohash();
        if (devicesPerNullifier[nullifierHash] >= MAX_DEVICES_PER_HUMAN) revert DeviceLimitReached(nullifierHash);

        devicesPerNullifier[nullifierHash] += 1;
        Device storage d = _devices[device];
        d.owner = owner;
        d.nullifierHash = nullifierHash;
        d.label = label;
        d.geohash = geohash;
        // casting to 'uint64' is safe because timestamps fit in 64 bits for billions of years
        // forge-lint: disable-next-line(unsafe-typecast)
        d.registeredAt = uint64(block.timestamp);
        d.active = true;

        emit DeviceRegistered(device, owner, nullifierHash, label, geohash);
        emit DeviceStatusChanged(device, true);

        IDeviceNamer n = namer;
        if (address(n) != address(0)) {
            d.ensNode = n.nameDevice(device, owner, label, geohash);
        }
    }

    /// @notice Activate or deactivate a device (admin now; Stake/slash contract later).
    ///         Deactivation also revokes the ENS subname when a namer is set.
    function setActive(address device, bool active) external {
        if (!isController[msg.sender]) revert NotController();
        Device storage d = _devices[device];
        if (d.owner == address(0)) revert NotRegistered(device);
        _setActive(device, d, active);
    }

    // ------------------------------------------------------------ flagging

    /// @notice Verifier flags a device's epoch as an outlier. `reason`: 1 = neighbour outlier,
    ///         2 = station outlier. The third consecutive flag slashes the device: it is
    ///         deactivated, its ENS subname revoked and its stake moved to the reward pool.
    function flag(address device, uint256 epoch, uint8 reason) external {
        if (!isVerifier[msg.sender]) revert NotVerifier();
        if (reason != REASON_NEIGHBOUR_OUTLIER && reason != REASON_STATION_OUTLIER) revert InvalidReason(reason);
        Device storage d = _devices[device];
        if (d.owner == address(0)) revert NotRegistered(device);
        if (!d.active) revert DeviceNotActive(device);
        _advanceEpoch(device, epoch);

        uint8 count = consecutiveFlags[device] + 1;
        consecutiveFlags[device] = count;
        totalFlags[device] += 1;
        emit DeviceFlagged(device, epoch, reason, count);

        if (count >= SLASH_THRESHOLD) {
            consecutiveFlags[device] = 0;
            emit DeviceSlashed(device, epoch);
            _setActive(device, d, false);
            IStakeManager sm = stakeManager;
            if (address(sm) != address(0)) sm.slash(device);
        }
    }

    /// @notice Verifier marks a clean (cross-checked, unflagged) epoch, breaking the flag streak.
    function clearFlags(address device, uint256 epoch) external {
        if (!isVerifier[msg.sender]) revert NotVerifier();
        if (_devices[device].owner == address(0)) revert NotRegistered(device);
        _advanceEpoch(device, epoch);
        if (consecutiveFlags[device] != 0) {
            consecutiveFlags[device] = 0;
            emit FlagsCleared(device, epoch);
        }
    }

    // --------------------------------------------------------------- views

    function isRegistered(address device) external view returns (bool) {
        return _devices[device].owner != address(0);
    }

    function isActive(address device) external view returns (bool) {
        return _devices[device].active;
    }

    function ownerOf(address device) external view returns (address) {
        address o = _devices[device].owner;
        if (o == address(0)) revert NotRegistered(device);
        return o;
    }

    function getDevice(address device) external view returns (Device memory) {
        return _devices[device];
    }

    // ------------------------------------------------------------ internal

    function _advanceEpoch(address device, uint256 epoch) private {
        uint256 last = lastCheckedEpoch[device];
        if (epoch <= last) revert EpochNotAfterLastCheck(epoch, last);
        lastCheckedEpoch[device] = epoch;
    }

    function _setActive(address device, Device storage d, bool active) private {
        if (d.active == active) return;
        d.active = active;
        emit DeviceStatusChanged(device, active);

        IDeviceNamer n = namer;
        if (!active && address(n) != address(0) && d.ensNode != bytes32(0)) {
            d.ensNode = bytes32(0);
            n.revokeDevice(device);
        }
    }

    /// @dev Geohash base32 alphabet: 0-9 and b-z without a, i, l, o.
    function _isGeohash(bytes memory g) private pure returns (bool) {
        if (g.length != GEOHASH_LENGTH) return false;
        for (uint256 i; i < g.length; ++i) {
            bytes1 c = g[i];
            bool digit = c >= "0" && c <= "9";
            bool letter = c >= "b" && c <= "z" && c != "i" && c != "l" && c != "o";
            if (!digit && !letter) return false;
        }
        return true;
    }
}
