#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
source "$SCRIPT_DIR/common.sh"
source "$SCRIPT_DIR/transaction.sh"
source "$SCRIPT_DIR/invocation-state.sh"

config_path="${1:-$PACKAGE_ROOT/config/preproduction.env}"
release_root="${COFCO_PREPROD_RELEASE_ROOT:-$HOME/.local/share/cofco-preproduction/releases}"
compose_file="$PACKAGE_ROOT/compose.yaml"

test "${COFCO_PREPROD_ROLLBACK:-}" = "ROLLBACK_PREPRODUCTION" \
  || fail "set COFCO_PREPROD_ROLLBACK=ROLLBACK_PREPRODUCTION for an approved preproduction rollback"
require_shell_invariants "$config_path"
for command_name in aliyun cmp docker jq tar; do
  require_command "$command_name"
done

stage5_mutation_lock_acquire "$release_root"
stage5_invocation_runtime_create "rollback"
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
test -n "$current_id" || fail "no current preproduction release is available"
verify_release_identity "$release_root/$current_id" "$release_root/current"

runtime_root="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
export COFCO_PREPROD_RUNTIME_SECRETS_DIR="$runtime_root/cofco-preproduction/secrets"
current_config="$release_root/$current_id/release.env"
current_gateway="$release_root/$current_id/runtime/gateway/nginx.conf"
test -f "$current_config" || fail "current release config is missing"
export COFCO_PREPROD_GATEWAY_CONFIG="$current_gateway"
transaction_dir="$STAGE5_INVOCATION_RUNTIME_DIR"
whitelist_snapshot="$transaction_dir/prior-rds-whitelist.json"
stage5_invocation_state_configure \
  "$transaction_dir" "$runtime_root" "$COFCO_PREPROD_RUNTIME_SECRETS_DIR" \
  "$current_config" "$current_gateway" "$compose_file" "$release_root/$current_id/evidence"

whitelist_mutated=false

prepare_transaction_snapshot() {
  install -d -m 0700 "$transaction_dir"
  "$SCRIPT_DIR/rds-whitelist.sh" capture "$current_config" "$whitelist_snapshot"
  stage5_invocation_state_snapshot
}

mutate_whitelist() {
  local target_config="$1"
  local mode="${2:-apply}"
  whitelist_mutated=true
  "$SCRIPT_DIR/rds-whitelist.sh" "$mode" "$target_config"
}

mutate_secrets() {
  local target_config="$1"
  stage5_invocation_state_mark_secrets_mutated
  "$SCRIPT_DIR/materialize-secrets.sh" "$target_config" "$COFCO_PREPROD_RUNTIME_SECRETS_DIR"
}

mutate_services_up() {
  local target_config="$1"
  stage5_invocation_state_mark_services_mutated
  docker compose --env-file "$target_config" -f "$compose_file" \
    up -d --remove-orphans --wait --wait-timeout 300
}

mutate_services_stop() {
  stage5_invocation_state_mark_services_mutated
  docker compose --env-file "$current_config" -f "$compose_file" stop
}

restore_current_checkpoint() {
  ln -sfn "$current_id" "$release_root/current"
}

restore_previous_checkpoint() {
  if test -n "$previous_id"; then
    ln -sfn "$previous_id" "$release_root/previous"
  else
    rm -f "$release_root/previous"
  fi
}

restore_invocation_state() {
  stage5_compensation_begin
  if test "$whitelist_mutated" = "true"; then
    stage5_compensate rds-whitelist \
      "$SCRIPT_DIR/rds-whitelist.sh" restore "$current_config" "$whitelist_snapshot"
  fi
  stage5_invocation_state_compensate
  stage5_compensate current-checkpoint restore_current_checkpoint
  stage5_compensate previous-checkpoint restore_previous_checkpoint
  stage5_compensation_finish
}

checkpoint_previous_as_current() {
  ln -sfn "$previous_id" "$release_root/current"
}

checkpoint_current_as_previous() {
  ln -sfn "$current_id" "$release_root/previous"
}

checkpoint_remove_current() {
  rm -f "$release_root/current"
}

checkpoint_remove_previous() {
  rm -f "$release_root/previous"
}

require_same_rds_target() {
  local target_config="$1"
  local key
  for key in \
    COFCO_PREPROD_REGION \
    COFCO_PREPROD_RDS_INSTANCE_ID \
    COFCO_PREPROD_RDS_WHITELIST_NAME \
    COFCO_PREPROD_RDS_NETWORK_TYPE; do
    test "$(read_config "$current_config" "$key")" = "$(read_config "$target_config" "$key")" \
      || fail "rollback RDS target differs from the captured current release"
  done
}

if test -n "$previous_id"; then
  test "$declared_target" = "$previous_id" \
    || fail "declared rollback target does not match the verified previous release"
  previous_config="$release_root/$previous_id/release.env"
  previous_gateway="$release_root/$previous_id/runtime/gateway/nginx.conf"
  verify_release_identity "$release_root/$previous_id"
  require_config_mode "$previous_config"
  node "$CONFIG_VALIDATOR" --config "$previous_config" >/dev/null
  require_same_rds_target "$previous_config"
fi

stage5_transaction_begin restore_invocation_state
stage5_transaction_step snapshot-invocation prepare_transaction_snapshot

if test -z "$previous_id"; then
  test "$declared_target" = "undeployed" || fail "no verified previous release is available"
  stage5_transaction_step deny-whitelist mutate_whitelist "$current_config" deny
  stage5_transaction_step clear-secrets stage5_invocation_state_clear_secrets
  stage5_transaction_step stop mutate_services_stop
  stage5_transaction_step current-checkpoint checkpoint_remove_current
  stage5_transaction_step previous-checkpoint checkpoint_remove_previous
  stage5_transaction_commit
  printf 'PREPRODUCTION_ROLLED_BACK target=undeployed previous=%s\n' "$current_id"
  exit 0
fi

stage5_transaction_step rds-whitelist mutate_whitelist "$previous_config"
stage5_transaction_step secrets mutate_secrets "$previous_config"
export COFCO_PREPROD_GATEWAY_CONFIG="$previous_gateway"
stage5_transaction_step gateway-config \
  "$SCRIPT_DIR/render-gateway.sh" "$previous_config" "$COFCO_PREPROD_GATEWAY_CONFIG"
stage5_transaction_step cloud-boundary \
  "$SCRIPT_DIR/verify-cloud-boundaries.sh" "$previous_config" "$release_root/$previous_id/evidence"
stage5_transaction_step compose-config \
  docker compose --env-file "$previous_config" -f "$compose_file" config --quiet
stage5_transaction_step pull \
  docker compose --env-file "$previous_config" -f "$compose_file" pull
stage5_transaction_step up mutate_services_up "$previous_config"
stage5_transaction_step verify \
  "$SCRIPT_DIR/verify.sh" "$previous_config" "$release_root/$previous_id/evidence"
stage5_transaction_step current-checkpoint checkpoint_previous_as_current
stage5_transaction_step previous-checkpoint checkpoint_current_as_previous
stage5_transaction_step post-rollback-verify \
  verify_release_identity "$release_root/$previous_id" "$release_root/current"
stage5_transaction_commit
printf 'PREPRODUCTION_ROLLED_BACK target=%s previous=%s\n' "$previous_id" "$current_id"
