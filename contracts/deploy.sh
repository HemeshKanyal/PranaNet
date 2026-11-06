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
  # Sepolia now charges far more for contract creation (state growth pricing) than forge's
  # local simulation assumes: Registry needs ~10.3M gas on-chain vs ~1.5M simulated (7x). Without a
  # multiplier every CREATE runs out of gas. Unused gas is refunded, so overshooting is cheap.
  args+=(--broadcast --gas-estimate-multiplier "${GAS_ESTIMATE_MULTIPLIER:-900}")
  [ -n "${ETHERSCAN_API_KEY:-}" ] && args+=(--verify --etherscan-api-key "$ETHERSCAN_API_KEY")
fi
"$FORGE" "${args[@]}"
./export-abi.sh
