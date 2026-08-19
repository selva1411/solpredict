#!/usr/bin/env bash
#
# SolPredict local dev stack — status.
#
# Shows which stack components are running (with PIDs), plus quick health
# checks for the validator RPC, the app, and the WS server.
#
# Usage:
#   scripts/status-stack.sh
#   scripts/status-stack.sh --quiet   # only print down/unknown components
#
# Exit code: 0 if every component is up, 1 if any is down.

set -uo pipefail

export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$HOME/.nvm/versions/node/v24.10.0/bin:$HOME/.local/bin:$PATH"

QUIET=0
[[ "${1:-}" == "--quiet" ]] && QUIET=1

RPC_URL="http://127.0.0.1:8899"
APP_URL="http://127.0.0.1:3000"
WS_URL="http://127.0.0.1:3001"

# name | pgrep pattern | description
COMPONENTS=(
  "validator|solana-test-validator --ledger|solana-test-validator (RPC 8899)"
  "next|next-server|Next.js dev server (3000)"
  "ws|server/ws-server.ts|WebSocket server (3001)"
  "alerts|server/price-alert-checker.ts|price-alert checker"
  "indexer|src/workers/indexer.ts --loop|indexer loop"
  "user-stats|src/workers/user-stats-cron.ts|user-stats cron"
)

up=0
down=0
unknown=0

check_component() {
  local name="$1" pattern="$2" desc="$3"
  local pids
  pids="$(pgrep -f "$pattern" 2>/dev/null | tr '\n' ' ' | sed 's/ $//')"
  if [[ -n "$pids" ]]; then
    echo "  UP   ${name}   ${pids}   (${desc})"
    up=$((up + 1))
  else
    echo "  DOWN ${name}   -          (${desc})"
    down=$((down + 1))
  fi
}

check_http() {
  # $1 = label, $2 = url, $3 = method/body (optional)
  local label="$1" url="$2"
  if curl -sf -m 3 -o /dev/null "$url" 2>/dev/null; then
    echo "  UP   ${label}   (${url})"
    up=$((up + 1))
  else
    echo "  DOWN ${label}   (${url})"
    down=$((down + 1))
  fi
}

check_rpc() {
  if curl -sf -m 3 -X POST "$RPC_URL" \
    -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' 2>/dev/null | grep -q '"ok"'; then
    echo "  UP   rpc       (getHealth ok @ $RPC_URL)"
    up=$((up + 1))
  else
    echo "  DOWN rpc       ($RPC_URL)"
    down=$((down + 1))
  fi
}

if [[ "$QUIET" -eq 0 ]]; then
  echo "SolPredict stack status:"
  echo "  --- processes ---"
fi

for entry in "${COMPONENTS[@]}"; do
  IFS='|' read -r name pattern desc <<<"$entry"
  if [[ "$QUIET" -eq 0 ]]; then
    check_component "$name" "$pattern" "$desc"
  else
    # quiet mode: report only down components
    if ! pgrep -f "$pattern" >/dev/null 2>&1; then
      echo "  DOWN ${name}   (${desc})"
      down=$((down + 1))
    fi
  fi
done

if [[ "$QUIET" -eq 0 ]]; then
  echo "  --- health ---"
  check_rpc
  check_http "app" "$APP_URL"
  check_http "ws"  "$WS_URL/health"
  echo ""
  echo "Summary: $up up, $down down"
fi

if [[ "$down" -gt 0 ]]; then
  exit 1
fi
exit 0
