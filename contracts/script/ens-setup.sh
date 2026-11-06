#!/usr/bin/env bash
# Register prananet.eth on Sepolia ENSv2 and set up the registry + resolver that device
# subnames (<label>.prananet.eth) live in. Idempotent: each step checks chain state first.
#
#   ./script/ens-setup.sh            (reads contracts/.env: SEPOLIA_RPC_URL, DEPLOYER_PRIVATE_KEY)
#
# What it does (addresses from https://docs.ens.domains/learn/deployments, ABIs from the
# verified sources on Sepolia Etherscan):
#   1. VerifiableFactory.deployProxy(PermissionedResolverImpl, salt, initialize(grants, []))
#      -> one shared resolver for prananet.eth and every device name. Deployer gets
#         ROLE_SET_ADDRESS | ROLE_SET_TEXT and their admin roles on root, so it can later hand
#         them to the DeviceNamer contract.
#   2. VerifiableFactory.deployProxy(UserRegistryImpl, salt, initialize(grants))
#      -> the subregistry holding device labels. Deployer gets REGISTRAR, UNREGISTER, RENEW,
#         SET_PARENT, SET_RESOLVER (+ admin roles) on root.
#   3. UserRegistry.setParent(ETHRegistry, "prananet")
#   4. MockUSDC.mint + approve, ETHRegistrar.commit, wait MIN_COMMITMENT_AGE, register(
#      "prananet", deployer, secret, userRegistry, resolver, 1 year, MockUSDC, 0)
#   5. resolver.setText(prananet.eth, "description" / "url"), setAddress(prananet.eth, 60, deployer)
# Results are merged into deployments/sepolia.json under "ens".
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a
: "${SEPOLIA_RPC_URL:?}" "${DEPLOYER_PRIVATE_KEY:?}"
C="${CAST:-$HOME/.foundry/bin/cast}"
RPC="$SEPOLIA_RPC_URL"; PK="$DEPLOYER_PRIVATE_KEY"
ME=$($C wallet address "$PK")
LABEL="${ENS_LABEL:-prananet}"
DURATION=31536000

FACTORY=0xda70306c98e97ece36f997a21368e53298572991
USER_REGISTRY_IMPL=0x9bd8a88719068d09ecee662f36c0e3856708366a
RESOLVER_IMPL=0x115eb53f0c60696633855f90b138178fb40b2b2c
ETH_REGISTRY=0xd4ebcbbdf463c9c45784603db0ddd499bc44a8b4
REGISTRAR=0xf633e7fc17e2bbe0d0965d18ec1821dcb754a3d3
USDC=0x240b0316df57887dbbe58b586508b19e633a14aa

send() { $C send --private-key "$PK" --rpc-url "$RPC" --json "$@" | jq -r '.transactionHash + " " + .status'; }
adm() { python3 -c "import sys; r=0
for b in sys.argv[1:]: v=1<<int(b); r|=v|(v<<128)
print(r)" "$@"; }

# Resolver roles: SET_ADDRESS (bit 0), SET_TEXT (bit 4), each with its admin role.
RESOLVER_ROLES=$(adm 0 4)
# Registry roles: REGISTRAR 0, SET_PARENT 8, UNREGISTER 12, RENEW 16, SET_RESOLVER 24.
REGISTRY_ROLES=$(adm 0 8 12 16 24)

proxy() { # impl salt initdata -> address
  local addr; addr=$($C call $FACTORY "predictProxyAddress(address,uint256)(address)" "$ME" "$2" --rpc-url "$RPC")
  if [ "$($C codesize "$addr" --rpc-url "$RPC")" = "0" ]; then
    echo "  deployProxy -> $(send $FACTORY "deployProxy(address,uint256,bytes)" "$1" "$2" "$3")" >&2
  fi
  echo "$addr"
}

echo "deployer $ME"
SALT_RES=$($C keccak "$LABEL.eth/resolver")
SALT_REG=$($C keccak "$LABEL.eth/registry")
INIT_RES=$($C calldata "initialize((address,uint256)[],bytes[])" "[($ME,$RESOLVER_ROLES)]" "[]")
INIT_REG=$($C calldata "initialize((address,uint256)[])" "[($ME,$REGISTRY_ROLES)]")
RESOLVER=$(proxy $RESOLVER_IMPL "$SALT_RES" "$INIT_RES"); echo "resolver      $RESOLVER"
USERREG=$(proxy $USER_REGISTRY_IMPL "$SALT_REG" "$INIT_REG"); echo "user registry $USERREG"

PARENT=$($C call "$USERREG" "getParent()(address,string)" --rpc-url "$RPC" | head -1)
if [ "${PARENT,,}" != "${ETH_REGISTRY,,}" ]; then
  echo "  setParent -> $(send "$USERREG" "setParent(address,string)" $ETH_REGISTRY "$LABEL")"
fi

OWNER=$($C call $ETH_REGISTRY "findOwner(string)(address)" "$LABEL" --rpc-url "$RPC" 2>/dev/null || echo 0x0)
if [ "${OWNER,,}" != "${ME,,}" ]; then
  [ "$($C call $REGISTRAR "isAvailable(string)(bool)" "$LABEL" --rpc-url "$RPC")" = "true" ] || { echo "$LABEL.eth is taken by $OWNER"; exit 1; }
  PRICE=$($C call $REGISTRAR "getRegisterPrice(string,uint64,address)(uint256,uint256)" "$LABEL" $DURATION $USDC --rpc-url "$RPC" | head -1 | awk '{print $1}')
  echo "price $PRICE (6 decimals)"
  echo "  mint    -> $(send $USDC "mint(address,uint256)" "$ME" "$PRICE")"
  echo "  approve -> $(send $USDC "approve(address,uint256)" $REGISTRAR "$PRICE")"
  SECRET=$($C keccak "$LABEL-$(date +%s)-$RANDOM")
  COMMIT=$($C call $REGISTRAR "makeCommitment(string,address,bytes32,address,address,uint64,bytes32)(bytes32)" \
    "$LABEL" "$ME" "$SECRET" "$USERREG" "$RESOLVER" $DURATION 0x0000000000000000000000000000000000000000000000000000000000000000 --rpc-url "$RPC")
  echo "  commit  -> $(send $REGISTRAR "commit(bytes32)" "$COMMIT")"
  AGE=$($C call $REGISTRAR "MIN_COMMITMENT_AGE()(uint64)" --rpc-url "$RPC")
  echo "  waiting $((AGE + 15)) s (MIN_COMMITMENT_AGE $AGE)"; sleep $((AGE + 15))
  echo "  register-> $(send $REGISTRAR "register(string,address,bytes32,address,address,uint64,address,bytes32)" \
    "$LABEL" "$ME" "$SECRET" "$USERREG" "$RESOLVER" $DURATION $USDC 0x0000000000000000000000000000000000000000000000000000000000000000)"
fi
echo "owner of $LABEL.eth: $($C call $ETH_REGISTRY "findOwner(string)(address)" "$LABEL" --rpc-url "$RPC")"
echo "subregistry: $($C call $ETH_REGISTRY "getSubregistry(string)(address)" "$LABEL" --rpc-url "$RPC")"

NAME=$(python3 -c "import sys; n=b''.join(bytes([len(p)])+p.encode() for p in sys.argv[1].split('.'))+b'\0'; print('0x'+n.hex())" "$LABEL.eth")
echo "  records -> $(send "$RESOLVER" "multicall(bytes[])" "[$($C calldata "setText(bytes,string,string)" "$NAME" description "PranaNet: signed air-quality sensors, one subname per device"),$($C calldata "setText(bytes,string,string)" "$NAME" url "https://github.com/HemeshKanyal/PranaNet"),$($C calldata "setAddress(bytes,uint256,bytes)" "$NAME" 60 "$ME")]")"

tmp=$(mktemp)
jq --arg p "$LABEL.eth" --arg r "$RESOLVER" --arg u "$USERREG" --arg e $ETH_REGISTRY --arg ur 0x24e1d8e068620b647ca097f961a61055f4f42d72 \
  '.ens = {parent: $p, resolver: $r, userRegistry: $u, ethRegistry: $e, universalResolver: $ur}' deployments/sepolia.json > "$tmp" && mv "$tmp" deployments/sepolia.json
echo "written deployments/sepolia.json .ens"
