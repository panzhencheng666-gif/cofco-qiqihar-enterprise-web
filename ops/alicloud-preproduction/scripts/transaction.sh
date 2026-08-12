#!/usr/bin/env bash
set -euo pipefail

STAGE5_TRANSACTION_ACTIVE=false
STAGE5_TRANSACTION_COMMITTED=false
STAGE5_TRANSACTION_COMPENSATION=""
STAGE5_TRANSACTION_LAST_STEP="not-started"

_stage5_transaction_on_exit() {
  local original_status="$1"
  local compensation_status=0
  trap - EXIT

  if test "$STAGE5_TRANSACTION_ACTIVE" = "true" \
    && test "$STAGE5_TRANSACTION_COMMITTED" != "true"; then
    STAGE5_TRANSACTION_ACTIVE=false
    "$STAGE5_TRANSACTION_COMPENSATION" || compensation_status=$?
    if test "$compensation_status" -ne 0; then
      printf 'ERROR: stage-five compensation failed after step %s\n' "$STAGE5_TRANSACTION_LAST_STEP" >&2
      exit 70
    fi
  fi

  exit "$original_status"
}

stage5_transaction_begin() {
  local compensation="${1:-}"
  test -n "$compensation" || {
    printf 'ERROR: stage-five transaction requires a compensation function\n' >&2
    return 64
  }
  test "$STAGE5_TRANSACTION_ACTIVE" != "true" || {
    printf 'ERROR: a stage-five transaction is already active\n' >&2
    return 64
  }

  STAGE5_TRANSACTION_ACTIVE=true
  STAGE5_TRANSACTION_COMMITTED=false
  STAGE5_TRANSACTION_COMPENSATION="$compensation"
  STAGE5_TRANSACTION_LAST_STEP="armed"
  trap '_stage5_transaction_on_exit "$?"' EXIT
}

stage5_transaction_step() {
  local step_name="$1"
  shift
  test "$STAGE5_TRANSACTION_ACTIVE" = "true" || {
    printf 'ERROR: stage-five transaction is not active\n' >&2
    return 64
  }
  STAGE5_TRANSACTION_LAST_STEP="$step_name"
  "$@"
}

stage5_transaction_commit() {
  test "$STAGE5_TRANSACTION_ACTIVE" = "true" || {
    printf 'ERROR: stage-five transaction is not active\n' >&2
    return 64
  }
  STAGE5_TRANSACTION_COMMITTED=true
  STAGE5_TRANSACTION_ACTIVE=false
  STAGE5_TRANSACTION_LAST_STEP="committed"
  trap - EXIT
}
