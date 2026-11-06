// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IDeviceNamer} from "./interfaces/IDeviceNamer.sol";

/// Minimal slices of the ENSv2 contracts this namer calls. Signatures copied from the verified
/// sources on Sepolia (UserRegistry 0x9bd8…366a impl, PermissionedResolver 0x115e…2b2c impl).
interface IENSUserRegistry {
    function register(
        string calldata label,
        address owner,
        address registry,
        address resolver,
        uint256 roleBitmap,
        uint64 expiry
    ) external returns (uint256 tokenId);

    function unregister(uint256 anyId) external;
}

interface IENSPermissionedResolver {
    function setText(bytes calldata name, string calldata key, string calldata value) external;
    function setAddress(bytes calldata name, uint256 coinType, bytes calldata addressBytes) external;
}

/// @title DeviceNamer
/// @notice Gives each registered device an ENSv2 subname `<label>.<parent>.eth` in the
///         prananet.eth UserRegistry, with records on a shared PermissionedResolver:
///         `addr` = the device key, text `geohash`, text `prananet.status`.
///         Revoking unregisters the label (owner loses the token) and clears the records, leaving
///         only `prananet.status = slashed` visible through wildcard resolution.
/// @dev Needs root ROLE_REGISTRAR | ROLE_UNREGISTER on the UserRegistry and root
///      ROLE_SET_TEXT | ROLE_SET_ADDRESS on the resolver (granted by the prananet.eth owner).
///      Device owners get no roles on their subname (roleBitmap 0): they cannot transfer it,
///      repoint its resolver or subregistry, or keep it alive after a slash.
contract DeviceNamer is IDeviceNamer {
    uint256 public constant COIN_TYPE_ETH = 60;
    uint64 public constant NAME_DURATION = 365 days;

    address public immutable registry;
    IENSUserRegistry public immutable userRegistry;
    IENSPermissionedResolver public immutable resolver;
    bytes32 public immutable parentNode;
    /// DNS-encoded parent suffix, e.g. hex"08" "prananet" hex"03" "eth" hex"00".
    bytes public dnsSuffix;
    string public parentName;

    struct Named {
        uint256 tokenId;
        string label;
    }

    mapping(address device => Named) public named;

    event DeviceNamed(address indexed device, string label, bytes32 indexed node, uint256 tokenId);
    event DeviceRevoked(address indexed device, string label, bytes32 indexed node);

    error NotRegistry();
    error BadLabel();
    error AlreadyNamed(address device);

    constructor(address registry_, IENSUserRegistry userRegistry_, IENSPermissionedResolver resolver_, string memory parentLabel) {
        registry = registry_;
        userRegistry = userRegistry_;
        resolver = resolver_;
        bytes32 ethNode = keccak256(abi.encodePacked(bytes32(0), keccak256("eth")));
        parentNode = keccak256(abi.encodePacked(ethNode, keccak256(bytes(parentLabel))));
        // forge-lint: disable-next-line(unsafe-typecast)
        dnsSuffix = abi.encodePacked(uint8(bytes(parentLabel).length), parentLabel, uint8(3), "eth", uint8(0));
        parentName = string.concat(parentLabel, ".eth");
    }

    modifier onlyRegistry() {
        if (msg.sender != registry) revert NotRegistry();
        _;
    }

    /// @inheritdoc IDeviceNamer
    function nameDevice(address device, address owner, string calldata label, string calldata geohash)
        external
        onlyRegistry
        returns (bytes32 node)
    {
        if (named[device].tokenId != 0) revert AlreadyNamed(device);
        bytes memory dns = dnsName(label); // validates label
        uint256 tokenId = userRegistry.register(
            label, owner, address(0), address(resolver), 0, uint64(block.timestamp) + NAME_DURATION
        );
        named[device] = Named(tokenId, label);
        resolver.setAddress(dns, COIN_TYPE_ETH, abi.encodePacked(device));
        resolver.setText(dns, "geohash", geohash);
        resolver.setText(dns, "prananet.status", "active");
        node = nodeOf(label);
        emit DeviceNamed(device, label, node, tokenId);
    }

    /// @inheritdoc IDeviceNamer
    function revokeDevice(address device) external onlyRegistry {
        Named memory n = named[device];
        if (n.tokenId == 0) return;
        delete named[device];
        bytes memory dns = dnsName(n.label);
        userRegistry.unregister(n.tokenId);
        // The label is gone from the registry, but ENSIP-10 wildcard resolution then falls back to
        // prananet.eth's resolver (this same shared resolver), so clear the records too.
        resolver.setAddress(dns, COIN_TYPE_ETH, "");
        resolver.setText(dns, "geohash", "");
        resolver.setText(dns, "prananet.status", "slashed");
        emit DeviceRevoked(device, n.label, nodeOf(n.label));
    }

    /// @notice ENS namehash of `<label>.<parent>.eth`.
    function nodeOf(string memory label) public view returns (bytes32) {
        return keccak256(abi.encodePacked(parentNode, keccak256(bytes(label))));
    }

    /// @notice DNS wire-format name of `<label>.<parent>.eth`. Labels: 1–63 bytes of a-z, 0-9, '-'.
    function dnsName(string memory label) public view returns (bytes memory) {
        bytes memory b = bytes(label);
        if (b.length == 0 || b.length > 63) revert BadLabel();
        for (uint256 i; i < b.length; ++i) {
            bytes1 c = b[i];
            if (!((c >= "a" && c <= "z") || (c >= "0" && c <= "9") || c == "-")) revert BadLabel();
        }
        // forge-lint: disable-next-line(unsafe-typecast)
        return abi.encodePacked(uint8(b.length), b, dnsSuffix);
    }
}
