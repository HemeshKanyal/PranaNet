#!/usr/bin/env bash
# Manually revoke <label>.prananet.eth exactly like DeviceNamer.revokeDevice (unregister + clear
# addr/geohash, status=slashed), using the prananet.eth owner's roles. For repairing a slash whose
# in-transaction revoke failed (Registry emits NameRevokeFailed).   ./script/ens-revoke.sh bkc-02
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a
C="${CAST:-$HOME/.foundry/bin/cast}"; L="${1:?label}"
UR=$(jq -r .ens.userRegistry deployments/sepolia.json); RES=$(jq -r .ens.resolver deployments/sepolia.json)
NAME=0x$(python3 -c "import sys; print((b''.join(bytes([len(p)])+p.encode() for p in sys.argv[1].split('.'))+b'\0').hex())" "$L.prananet.eth")
TOKEN=$($C call "$UR" "findTokenId(string)(uint256)" "$L" --rpc-url "$SEPOLIA_RPC_URL" | awk '{print $1}')
send() { $C send --private-key "$DEPLOYER_PRIVATE_KEY" --rpc-url "$SEPOLIA_RPC_URL" --json "$@" | jq -r '.transactionHash + " " + .status'; }
echo "unregister $L ($TOKEN): $(send "$UR" "unregister(uint256)" "$TOKEN")"
echo "clear records: $(send "$RES" "multicall(bytes[])" "[$($C calldata "setAddress(bytes,uint256,bytes)" "$NAME" 60 0x),$($C calldata "setText(bytes,string,string)" "$NAME" geohash ""),$($C calldata "setText(bytes,string,string)" "$NAME" prananet.status slashed)]")"
