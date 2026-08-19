#!/usr/bin/env bash
#
# SolPredict local dev stack — start everything.
#
# Idempotent: safe to re-run. Starts, in order:
#   1. solana-test-validator (persistent ledger at .anchor/test-ledger, NO --reset)
#   2. program deploy (only if the program account is missing, e.g. fresh ledger)
#   3. Next.js dev server (3000)
#   4. WS server (3001)
#   5. price-alert checker
#   6. indexer --loop
#   7. user-stats cron
#
# Every long-running process is spawned with setsid + nohup so it survives the
# launching shell (systemd service, tool shell, etc). Logs go to ./logs/ in the
# repo root (persists across reboots, unlike /tmp).
#
# Usage:
#   scripts/start-stack.sh          # start whatever is not running
#   scripts/start-stack.sh --logs <dir>   # override log dir
#   scripts/start-stack.sh status   # show what's running (alias for status-stack.sh)
#
# Note: `stop-stack.sh status` is also supported (same alias).

set -euo pipefail

# `status` subcommand — shared with stop-stack.sh
if [[ "${1:-}" == "status" ]]; then
  exec "$(dirname "${BASH_SOURCE[0]}")/status-stack.sh" "${@:2}"
fi

# systemd user services do NOT inherit the login shell's PATH, so make sure
# the toolchain (solana CLI, anchor, node/npm from nvm) is findable.
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$HOME/.nvm/versions/node/v24.10.0/bin:$HOME/.local/bin:$PATH"

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$REPO_DIR/app"
LEDGER_DIR="$REPO_DIR/.anchor/test-ledger"
PROGRAM_ID="AWbRCjgFzoe3zMqtXxRzPz7zFo8PP34RLDYmpd8LyGKG"
RPC_URL="http://127.0.0.1:8899"

LOG_DIR="${LOG_DIR:-$REPO_DIR/logs}"
if [[ "${1:-}" == "--logs" && -n "${2:-}" ]]; then
  LOG_DIR="$2"
fi
mkdir -p "$LOG_DIR"

log() { echo "[start-stack] $*"; }

is_running() {
  # $1 = pgrep pattern
  pgrep -f "$1" >/dev/null 2>&1
}

wait_for_health() {
  local tries=60
  for ((i = 0; i < tries; i++)); do
    if curl -sf -m 2 -X POST "$RPC_URL" \
      -H 'Content-Type: application/json' \
      -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  log "WARN: validator did not become healthy within $((tries * 2))s"
  return 1
}

# getSlot for the running validator (empty/error if not reachable).
get_slot() {
  # Extract the numeric result from {"jsonrpc":"2.0","result":291,"id":1}
  curl -sf -m 2 -X POST "$RPC_URL" \
    -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"getSlot"}' 2>/dev/null \
    | grep -oE '"result":[0-9]+' | head -1 | grep -oE '[0-9]+$'
}

# A validator can answer getHealth="ok" while being FROZEN (not producing
# new blocks) — e.g. after recovering a ledger from a torn snapshot. Then
# transactions (airdrops, trades, proposals) are submitted but never confirm.
# Detect that by checking the slot actually advances.
wait_for_slot_advance() {
  local tries=12   # up to ~60s
  for ((i = 0; i < tries; i++)); do
    local s1 s2
    s1="$(get_slot)"
    sleep 5
    s2="$(get_slot)"
    if [[ -n "$s1" && -n "$s2" && "$s2" -gt "$s1" ]]; then
      log "validator producing blocks (slot $s1 -> $s2)"
      return 0
    fi
    log "validator slot not advancing ($s1 -> $s2), waiting..."
  done
  log "ERROR: validator is FROZEN — not producing blocks"
  return 1
}

# Recover a frozen ledger: wipe and reseed from scratch. Only called when the
# validator is alive but stuck (slot never advances) — the ledger state is
# unrecoverable at that point (the app DB already mirrors the seeded markets,
# and the seed script recreates the chain).
reset_validator() {
  log "resetting validator (wiping ledger + reseeding)"
  # stop any validator process using this ledger
  for pid in $(pgrep -f "solana-test-validator --ledger" 2>/dev/null || true); do
    kill "$pid" 2>/dev/null || true
  done
  sleep 3
  pkill -9 -f "solana-test-validator --ledger" 2>/dev/null || true
  rm -rf "$LEDGER_DIR"
  sleep 1
  start_validator
  if ! wait_for_health; then
    log "ERROR: validator did not come up after reset (see $LOG_DIR/validator.log)"
    exit 1
  fi
  if ! wait_for_slot_advance; then
    log "ERROR: validator still frozen after reset — manual intervention needed"
    exit 1
  fi
  log "deploying program on fresh ledger"
  (cd "$REPO_DIR" && anchor deploy --provider.cluster localnet >"$LOG_DIR/deploy.log" 2>&1) \
    || { log "deploy failed (see $LOG_DIR/deploy.log)"; exit 1; }
  if [[ -f "$REPO_DIR/scripts/seed-localnet.ts" ]]; then
    log "reseeding chain (config + 13 markets)"
    (cd "$REPO_DIR" && npx tsx scripts/seed-localnet.ts >"$LOG_DIR/seed.log" 2>&1) \
      || log "WARN: seed-localnet failed (see $LOG_DIR/seed.log) — chain has config but no markets"
  fi
}

spawn() {
  # $1 = name, $2 = logfile, rest = command
  local name="$1" logfile="$2"
  shift 2
  if is_running "$name"; then
    log "already running: $name (skip)"
    return 0
  fi
  log "starting $name -> $logfile"
  setsid nohup "$@" >"$logfile" 2>&1 </dev/null &
  disown || true
}

# ── 1. Validator ─────────────────────────────────────────────────────────────
start_validator() {
  log "starting validator (ledger=$LEDGER_DIR)"
  setsid nohup solana-test-validator --ledger "$LEDGER_DIR" --quiet \
    >"$LOG_DIR/validator.log" 2>&1 </dev/null &
  disown || true
}

if is_running "solana-test-validator --ledger"; then
  log "validator already running (skip)"
elif is_running "solana-test-validator"; then
  log "another validator instance is running (skip)"
else
  start_validator
fi

if ! wait_for_health; then
  log "validator not healthy — aborting (see $LOG_DIR/validator.log)"
  exit 1
fi
log "validator healthy at $RPC_URL (getHealth ok)"

# Verify the validator actually PRODUCES blocks. A recovered ledger can be
# frozen (getHealth ok, slot stuck) — airdrops/trades would silently never
# confirm. If frozen, wipe + reseed the ledger.
if ! wait_for_slot_advance; then
  reset_validator
fi

solana config set --url "$RPC_URL" >/dev/null 2>&1 || true

# ── 2. Program deploy (only if missing) ──────────────────────────────────────
if is_running "solana-test-validator"; then
  if ! solana program show "$PROGRAM_ID" --url "$RPC_URL" >/dev/null 2>&1; then
    log "program not deployed — deploying (this may take a minute)"
    (cd "$REPO_DIR" && anchor deploy --provider.cluster localnet >"$LOG_DIR/deploy.log" 2>&1) \
      || { log "deploy failed (see $LOG_DIR/deploy.log)"; exit 1; }
    log "program deployed"
  else
    log "program already deployed (skip)"
  fi
fi

# ── 3. App stack ─────────────────────────────────────────────────────────────
(
  cd "$APP_DIR"
  spawn "next-server" "$LOG_DIR/next.log" npm run dev
  spawn "server/ws-server.ts" "$LOG_DIR/ws.log" npm run ws:start
  spawn "server/price-alert-checker.ts" "$LOG_DIR/alerts.log" \
    node --env-file=.env.local --import tsx server/price-alert-checker.ts
  spawn "src/workers/indexer.ts --loop" "$LOG_DIR/indexer.log" \
    node --env-file=.env.local --import tsx src/workers/indexer.ts --loop
  spawn "src/workers/user-stats-cron.ts" "$LOG_DIR/user-stats.log" \
    node --env-file=.env.local --import tsx src/workers/user-stats-cron.ts
)

log "done. logs: $LOG_DIR"
