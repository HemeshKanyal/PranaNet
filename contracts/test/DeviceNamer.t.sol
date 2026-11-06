// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Registry} from "../src/Registry.sol";
import {DeviceNamer, IENSUserRegistry, IENSPermissionedResolver} from "../src/DeviceNamer.sol";
import {IDeviceNamer} from "../src/interfaces/IDeviceNamer.sol";

interface IEAC {
    function grantRootRoles(uint256 roleBitmap, address account) external returns (bool);
}

interface IUserRegistryView {
    function findOwner(string calldata label) external view returns (address);
    function getResolver(string calldata label) external view returns (address);
}

interface IUniversalResolver {
    function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory, address);
}

interface IAddrText {
    function addr(bytes32 node) external view returns (address);
    function text(bytes32 node, string calldata key) external view returns (string memory);
}

/// Unit tests: no network.
contract DeviceNamerUnitTest is Test {
    DeviceNamer namer;

    function setUp() public {
        namer = new DeviceNamer(address(this), IENSUserRegistry(address(1)), IENSPermissionedResolver(address(2)), "prananet");
    }

    function test_dnsNameAndNode() public view {
        assertEq(namer.dnsName("andheri-01"), abi.encodePacked(hex"0a", "andheri-01", hex"08", "prananet", hex"03", "eth", hex"00"));
        assertEq(namer.nodeOf("andheri-01"), vm.ensNamehash("andheri-01.prananet.eth"));
        assertEq(namer.parentNode(), vm.ensNamehash("prananet.eth"));
        assertEq(namer.parentName(), "prananet.eth");
    }

    function test_rejectsBadLabels() public {
        vm.expectRevert(DeviceNamer.BadLabel.selector);
        namer.dnsName("");
        vm.expectRevert(DeviceNamer.BadLabel.selector);
        namer.dnsName("Andheri");
        vm.expectRevert(DeviceNamer.BadLabel.selector);
        namer.dnsName("a.b");
        vm.expectRevert(DeviceNamer.BadLabel.selector);
        namer.dnsName("0123456789012345678901234567890123456789012345678901234567890123"); // 64
    }

    function test_onlyRegistry() public {
        vm.prank(makeAddr("stranger"));
        vm.expectRevert(DeviceNamer.NotRegistry.selector);
        namer.nameDevice(address(3), address(4), "x", "te7ud2");
        vm.prank(makeAddr("stranger"));
        vm.expectRevert(DeviceNamer.NotRegistry.selector);
        namer.revokeDevice(address(3));
    }
}

contract RevertingNamer is IDeviceNamer {
    function nameDevice(address, address, string calldata, string calldata) external pure returns (bytes32) {
        return bytes32(uint256(1));
    }

    function revokeDevice(address) external pure {
        revert("ens down");
    }
}

/// A broken namer must never block deactivation (and so never block a slash).
contract RegistryRevokeFailureTest is Test {
    function test_deactivateSurvivesNamerRevert() public {
        address admin = makeAddr("admin");
        address device = makeAddr("device");
        Registry r = new Registry(admin);
        vm.startPrank(admin);
        r.setBackend(admin, true);
        r.setController(admin, true);
        r.setNamer(new RevertingNamer());
        r.registerDevice(device, admin, "x", "te7ud2", 1);
        vm.expectEmit(true, false, false, false, address(r));
        emit Registry.NameRevokeFailed(device);
        r.setActive(device, false);
        vm.stopPrank();
        assertFalse(r.getDevice(device).active);
    }
}

/// Fork test against the real ENSv2 deployment on Sepolia and the real prananet.eth setup
/// (contracts/deployments/sepolia.json .ens). Skipped when SEPOLIA_RPC_URL is unset.
///   SEPOLIA_RPC_URL=... forge test --match-contract DeviceNamerForkTest
contract DeviceNamerForkTest is Test {
    address constant UNIVERSAL_RESOLVER = 0x24E1D8e068620B647CA097f961A61055f4f42D72;
    uint256 constant REG_REGISTRAR = 1 << 0;
    uint256 constant REG_UNREGISTER = 1 << 12;
    uint256 constant RES_SET_ADDRESS = 1 << 0;
    uint256 constant RES_SET_TEXT = 1 << 4;

    Registry registry;
    DeviceNamer namer;
    address userRegistry;
    address resolver;
    address ensAdmin;
    address device = makeAddr("device");
    address owner = makeAddr("prananet-fork-test-owner"); // makeAddr("owner") has code on Sepolia
    string label;

    function setUp() public {
        string memory rpc = vm.envOr("SEPOLIA_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);
        string memory json = vm.readFile(string.concat(vm.projectRoot(), "/deployments/sepolia.json"));
        userRegistry = vm.parseJsonAddress(json, ".ens.userRegistry");
        resolver = vm.parseJsonAddress(json, ".ens.resolver");
        ensAdmin = vm.parseJsonAddress(json, ".admin");
        label = string.concat("fork-", vm.toString(block.number));

        registry = new Registry(address(this));
        registry.setBackend(address(this), true);
        registry.setController(address(this), true);
        namer = new DeviceNamer(address(registry), IENSUserRegistry(userRegistry), IENSPermissionedResolver(resolver), "prananet");
        registry.setNamer(namer);
        vm.startPrank(ensAdmin);
        IEAC(userRegistry).grantRootRoles(REG_REGISTRAR | REG_UNREGISTER, address(namer));
        IEAC(resolver).grantRootRoles(RES_SET_ADDRESS | RES_SET_TEXT, address(namer));
        vm.stopPrank();
    }

    function _resolve(bytes memory call) internal view returns (bytes memory out) {
        (out,) = IUniversalResolver(UNIVERSAL_RESOLVER).resolve(namer.dnsName(label), call);
    }

    function test_registerCreatesResolvableSubname_andRevokeRemovesIt() public {
        registry.registerDevice(device, owner, label, "te7ud2", 7);
        bytes32 node = vm.ensNamehash(string.concat(label, ".prananet.eth"));
        assertEq(registry.getDevice(device).ensNode, node);
        assertEq(IUserRegistryView(userRegistry).findOwner(label), owner);

        // Resolves through the live ENSv2 UniversalResolver: root -> .eth -> prananet -> label.
        assertEq(abi.decode(_resolve(abi.encodeCall(IAddrText.addr, (node))), (address)), device);
        assertEq(abi.decode(_resolve(abi.encodeCall(IAddrText.text, (node, "geohash"))), (string)), "te7ud2");
        assertEq(abi.decode(_resolve(abi.encodeCall(IAddrText.text, (node, "prananet.status"))), (string)), "active");

        registry.setActive(device, false); // same path a slash takes
        assertEq(IUserRegistryView(userRegistry).findOwner(label), address(0));
        assertEq(IUserRegistryView(userRegistry).getResolver(label), address(0));
        // Wildcard resolution falls back to prananet.eth's resolver: records are cleared.
        assertEq(abi.decode(_resolve(abi.encodeCall(IAddrText.addr, (node))), (address)), address(0));
        assertEq(abi.decode(_resolve(abi.encodeCall(IAddrText.text, (node, "geohash"))), (string)), "");
        assertEq(abi.decode(_resolve(abi.encodeCall(IAddrText.text, (node, "prananet.status"))), (string)), "slashed");
    }

    function test_labelTakenRevertsRegistration() public {
        registry.registerDevice(device, owner, label, "te7ud2", 7);
        vm.expectRevert();
        registry.registerDevice(makeAddr("device2"), owner, label, "te7ud2", 8);
        assertEq(registry.getDevice(makeAddr("device2")).owner, address(0));
    }

    function test_ownerCannotRepointOrTransfer() public {
        registry.registerDevice(device, owner, label, "te7ud2", 7);
        vm.prank(owner);
        vm.expectRevert();
        IENSUserRegistry(userRegistry).unregister(uint256(keccak256(bytes(label))));
    }
}
