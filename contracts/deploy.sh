#!/usr/bin/env bash
# Deploy to Sepolia (or any RPC in SEPOLIA_RPC_URL) using contracts/.env, verify on Etherscan
# when ETHERSCAN_API_KEY is set, then re-export ABIs.  Usage: ./deploy.sh [--dry-run]
set -euo pipefail
cd "$(dirname "$0")"
FORGE="${FORGE:-$HOME/.foundry/bin/forge}"
[ -f .env ] || { echo "contracts/.env missing (copy .env.example)"; exit 1; }
set -a; source .env; set +a
: "${SEPOLIA_RPC_URL:?set in .env}" "${DEPLOYER_PRIVATE_KEY:?set in .env}"

args=(script script/Deploy.s.sol:Deploy --rpc-url "$SEPOLIA_RPC_URL")
if [ "${1:-}" != "--dry-run" ]; then
  args+=(--broadcast)
  [ -n "${ETHERSCAN_API_KEY:-}" ] && args+=(--verify --etherscan-api-key "$ETHERSCAN_API_KEY")
fi
"$FORGE" "${args[@]}"
./export-abi.sh
