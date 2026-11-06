#!/usr/bin/env bash
# Export contract ABIs to contracts/abi/*.json (committed) for relayer, verifier and web.
set -euo pipefail
cd "$(dirname "$0")"
FORGE="${FORGE:-$HOME/.foundry/bin/forge}"
"$FORGE" build --quiet
for c in Registry Readings Stake RewardPool IDeviceNamer; do
  "$FORGE" inspect "$c" abi --json > "abi/$c.json"
done
ls -1 abi
