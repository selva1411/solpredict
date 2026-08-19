#!/usr/bin/env bash
#
# SolPredict local dev stack — stop everything (validator + app services).
#
# Usage:
#   scripts/stop-stack.sh          # stop everything
#   scripts/stop-stack.sh status   # show what's running (alias for status-stack.sh)

set -uo pipefail

# `status` subcommand — shared with start-stack.sh
if [[ "${1:-}" == "status" ]]; then
  exec "$(dirname "${BASH_SOURCE[0]}")/status-stack.sh" "${@:2}"
fi

# systemd user services do NOT inherit the login shell's PATH — restore the
# toolchain dirs so solana/npm invocations work when triggered by systemd.
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$HOME/.nvm/versions/node/v24.10.0/bin:$HOME/.local/bin:$PATH"

log() { echo "[stop-stack] $*"; }

# Kill app processes first (children), then the validator last.
# pgrep -f patterns match only our processes (paths are distinctive).
PATTERNS=(
  "src/workers/user-stats-cron.ts"
  "src/workers/indexer.ts --loop"
  "server/price-alert-checker.ts"
  "server/ws-server.ts"
  "next-server"
  "solana-test-validator --ledger"
)

# App processes first (SIGTERM, then brief grace, then force).
for pat in "${PATTERNS[@]:0:5}"; do
  pids="$(pgrep -f "$pat" 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    for pid in $pids; do
      log "stopping $pid ($pat)"
      kill "$pid" 2>/dev/null || true
    done
  fi
done

sleep 3
for pat in "${PATTERNS[@]:0:5}"; do
  pkill -9 -f "$pat" 2>/dev/null || true
done

# Validator last — give it time to write a clean snapshot on SIGTERM so the
# next start doesn't hit a torn snapshot.
V_PIDS="$(pgrep -f 'solana-test-validator --ledger' 2>/dev/null || true)"
if [[ -n "$V_PIDS" ]]; then
  for pid in $V_PIDS; do
    log "stopping validator $pid (graceful, up to 30s)"
    kill "$pid" 2>/dev/null || true
  done
  for _ in $(seq 1 30); do
    if ! pgrep -f 'solana-test-validator --ledger' >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  # Force only if still alive after the grace period
  pkill -9 -f 'solana-test-validator --ledger' 2>/dev/null || true
fi

log "done. use scripts/start-stack.sh to bring the stack back up."
