#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
source "$SCRIPT_DIR/common.sh"
source "$SCRIPT_DIR/transaction.sh"

config_path="${1:-$PACKAGE_ROOT/config/preproduction.env}"
release_root="${COFCO_PREPROD_RELEASE_ROOT:-$HOME/.local/share/cofco-preproduction/releases}"
compose_file="$PACKAGE_ROOT/compose.yaml"

test "${COFCO_PREPROD_ROLLBACK:-}" = "ROLLBACK_PREPRODUCTION" || fail "set COFCO_PREPROD_ROLLBACK=ROLLBACK_PREPRODUCTION for an approved preproduction rollback"
require_shell_invariants "$config_path"
require_command docker

current_id="$(readlink "$release_root/current" 2>/dev/null || true)"
previous_id="$(readlink "$release_root/previous" 2>/dev/null || true)"
declared_target="$(read_config "$config_path" COFCO_PREPROD_ROLLBACK_RELEASE_ID)"
for release_link in "$current_id" "$previous_id"; do
  case "$release_link" in
    "") ;;
    .|..|/*|*/*) fail "release checkpoint contains an unsafe target" ;;
    *) ;;
  esac
done

runtime_root="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
export COFCO_PREPROD_RUNTIME_SECRETS_DIR="$runtime_root/cofco-preproduction/secrets"
current_config="$release_root/$current_id/release.env"
current_gateway="$release_root/$current_id/runtime/gateway/nginx.conf"

restore_current() {
  if test -n "$current_id" && test -f "$current_config"; then
    "$SCRIPT_DIR/rds-whitelist.sh" apply "$current_config" || return $?
    "$SCRIPT_DIR/materialize-secrets.sh" "$current_config" "$COFCO_PREPROD_RUNTIME_SECRETS_DIR" || return $?
    "$SCRIPT_DIR/render-gateway.sh" "$current_config" "$current_gateway" || return $?
    export COFCO_PREPROD_GATEWAY_CONFIG="$current_gateway"
    "$SCRIPT_DIR/verify-cloud-boundaries.sh" "$current_config" "$release_root/$current_id/evidence" || return $?
    docker compose --env-file "$current_config" -f "$compose_file" config --quiet || return $?
    docker compose --env-file "$current_config" -f "$compose_file" up -d --remove-orphans --wait --wait-timeout 300 || return $?
    "$SCRIPT_DIR/verify.sh" "$current_config" "$release_root/$current_id/evidence" || return $?
    ln -sfn "$current_id" "$release_root/current" || return $?
  fi
  if test -n "$previous_id"; then
    ln -sfn "$previous_id" "$release_root/previous" || return $?
  else
    rm -f "$release_root/previous" || return $?
  fi
}

stage5_transaction_begin restore_current

if test -z "$previous_id"; then
  test "$declared_target" = "undeployed" || fail "no verified previous release is available"
  test -n "$current_id" && test -f "$current_config" || fail "current release config is missing"
  snapshot_path="$release_root/$current_id/evidence/pre-rollback-rds-whitelist.json"
  stage5_transaction_step capture-whitelist \
    "$SCRIPT_DIR/rds-whitelist.sh" capture "$current_config" "$snapshot_path"
  stage5_transaction_step stop \
    docker compose --env-file "$current_config" -f "$compose_file" stop
  stage5_transaction_step checkpoint rm -f "$release_root/current" "$release_root/previous"
  stage5_transaction_commit
  printf 'PREPRODUCTION_ROLLED_BACK target=undeployed previous=%s\n' "$current_id"
  exit 0
fi

test "$declared_target" = "$previous_id" || fail "declared rollback target does not match the verified previous release"
previous_config="$release_root/$previous_id/release.env"
previous_gateway="$release_root/$previous_id/runtime/gateway/nginx.conf"
test -f "$current_config" || fail "current release config is missing"
test -f "$previous_config" || fail "previous release config is missing"
stage5_transaction_step rds-whitelist \
  "$SCRIPT_DIR/rds-whitelist.sh" apply "$previous_config"
stage5_transaction_step secrets \
  "$SCRIPT_DIR/materialize-secrets.sh" "$previous_config" "$COFCO_PREPROD_RUNTIME_SECRETS_DIR"
export COFCO_PREPROD_GATEWAY_CONFIG="$previous_gateway"
stage5_transaction_step gateway-config \
  "$SCRIPT_DIR/render-gateway.sh" "$previous_config" "$COFCO_PREPROD_GATEWAY_CONFIG"
stage5_transaction_step cloud-boundary \
  "$SCRIPT_DIR/verify-cloud-boundaries.sh" "$previous_config" "$release_root/$previous_id/evidence"
stage5_transaction_step compose-config \
  docker compose --env-file "$previous_config" -f "$compose_file" config --quiet
stage5_transaction_step pull \
  docker compose --env-file "$previous_config" -f "$compose_file" pull
stage5_transaction_step up \
  docker compose --env-file "$previous_config" -f "$compose_file" up -d --remove-orphans --wait --wait-timeout 300
stage5_transaction_step verify \
  "$SCRIPT_DIR/verify.sh" "$previous_config" "$release_root/$previous_id/evidence"
stage5_transaction_step checkpoint ln -sfn "$previous_id" "$release_root/current"
stage5_transaction_step previous-checkpoint ln -sfn "$current_id" "$release_root/previous"
stage5_transaction_commit
printf 'PREPRODUCTION_ROLLED_BACK target=%s previous=%s\n' "$previous_id" "$current_id"
