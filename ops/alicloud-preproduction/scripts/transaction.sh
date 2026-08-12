#!/usr/bin/env bash
set -euo pipefail

STAGE5_TRANSACTION_ACTIVE=false
STAGE5_TRANSACTION_COMMITTED=false
STAGE5_TRANSACTION_COMPENSATION=""
STAGE5_TRANSACTION_LAST_STEP="not-started"
STAGE5_COMPENSATION_FAILURES=0

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

  if declare -F stage5_mutation_lock_release >/dev/null 2>&1; then
    stage5_mutation_lock_release
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
  if test "${COFCO_PREPROD_TEST_MODE:-}" = "true" \
    && test "${COFCO_PREPROD_TEST_FAIL_AT:-}" = "$step_name"; then
    printf 'TEST_INJECTED_FAILURE step=%s\n' "$step_name" >&2
    return 97
  fi
}

stage5_transaction_commit() {
  test "$STAGE5_TRANSACTION_ACTIVE" = "true" || {
    printf 'ERROR: stage-five transaction is not active\n' >&2
    return 64
  }
  STAGE5_TRANSACTION_COMMITTED=true
  STAGE5_TRANSACTION_ACTIVE=false
  STAGE5_TRANSACTION_LAST_STEP="committed"
}

stage5_compensation_begin() {
  STAGE5_COMPENSATION_FAILURES=0
}

stage5_compensate() {
  local label="$1"
  shift
  if "$@"; then
    return 0
  fi
  STAGE5_COMPENSATION_FAILURES=$((STAGE5_COMPENSATION_FAILURES + 1))
  printf 'ERROR: compensation item failed: %s\n' "$label" >&2
  return 0
}

stage5_compensation_finish() {
  if test "$STAGE5_COMPENSATION_FAILURES" -ne 0; then
    printf 'ERROR: compensation completed with %s failure(s)\n' "$STAGE5_COMPENSATION_FAILURES" >&2
    return 1
  fi
}
