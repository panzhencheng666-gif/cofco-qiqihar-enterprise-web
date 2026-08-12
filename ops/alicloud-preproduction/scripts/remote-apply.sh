#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
source "$SCRIPT_DIR/common.sh"
source "$SCRIPT_DIR/transaction.sh"
source "$SCRIPT_DIR/invocation-state.sh"

config_path="${1:-$PACKAGE_ROOT/config/preproduction.env}"
release_root="${COFCO_PREPROD_RELEASE_ROOT:-$HOME/.local/share/cofco-preproduction/releases}"
release_id="$(read_config "$config_path" COFCO_PREPROD_RELEASE_ID)"
release_dir="$release_root/$release_id"
compose_file="$PACKAGE_ROOT/compose.yaml"

require_apply_approval
require_shell_invariants "$config_path"
for command_name in aliyun cmp curl docker jq openssl tar; do
  require_command "$command_name"
done

stage5_mutation_lock_acquire "$release_root"
stage5_invocation_runtime_create "deploy-$release_id"
old_current="$(readlink "$release_root/current" 2>/dev/null || true)"
old_previous="$(readlink "$release_root/previous" 2>/dev/null || true)"
for release_link in "$old_current" "$old_previous"; do
  case "$release_link" in
    "") ;;
    .|..|/*|*/*) fail "release checkpoint contains an unsafe target" ;;
    *) ;;
  esac
done
if test -n "$old_current"; then
  test -f "$release_root/$old_current/release.env" \
    || fail "current release checkpoint is missing its immutable config"
fi
test ! -e "$release_dir" || fail "candidate release ID already exists and cannot be overwritten"

runtime_root="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
export COFCO_PREPROD_RUNTIME_SECRETS_DIR="$runtime_root/cofco-preproduction/secrets"
transaction_dir="$STAGE5_INVOCATION_RUNTIME_DIR"
whitelist_snapshot="$transaction_dir/prior-rds-whitelist.json"
original_config="$config_path"
original_gateway="$transaction_dir/no-running-gateway.conf"
if test -n "$old_current"; then
  original_config="$release_root/$old_current/release.env"
  original_gateway="$release_root/$old_current/runtime/gateway/nginx.conf"
fi
export COFCO_PREPROD_GATEWAY_CONFIG="$original_gateway"
stage5_invocation_state_configure \
  "$transaction_dir" "$runtime_root" "$COFCO_PREPROD_RUNTIME_SECRETS_DIR" \
  "$original_config" "$original_gateway" "$compose_file" "$release_dir/evidence"

whitelist_mutated=false

prepare_transaction_snapshot() {
  install -d -m 0700 "$transaction_dir"
  "$SCRIPT_DIR/rds-whitelist.sh" capture "$config_path" "$whitelist_snapshot"
  stage5_invocation_state_snapshot
}

prepare_release() {
  install -d -m 0700 "$release_dir" "$release_dir/evidence" "$release_dir/runtime/gateway"
  install -m 0600 "$config_path" "$release_dir/release.env"
}

mutate_whitelist() {
  whitelist_mutated=true
  "$SCRIPT_DIR/rds-whitelist.sh" apply "$release_dir/release.env"
}

mutate_secrets() {
  stage5_invocation_state_mark_secrets_mutated
  "$SCRIPT_DIR/materialize-secrets.sh" "$release_dir/release.env" "$COFCO_PREPROD_RUNTIME_SECRETS_DIR"
}

mutate_services() {
  stage5_invocation_state_mark_services_mutated
  docker compose --env-file "$release_dir/release.env" -f "$compose_file" \
    up -d --remove-orphans --wait --wait-timeout 300
}

restore_current_checkpoint() {
  if test -n "$old_current"; then
    ln -sfn "$old_current" "$release_root/current"
  else
    rm -f "$release_root/current"
  fi
}

restore_previous_checkpoint() {
  if test -n "$old_previous"; then
    ln -sfn "$old_previous" "$release_root/previous"
  else
    rm -f "$release_root/previous"
  fi
}

cleanup_candidate() {
  case "$release_dir" in
    "$release_root"/*) ;;
    *) return 64 ;;
  esac
  if test -e "$release_dir"; then
    rm -r -- "$release_dir"
  fi
}

restore_original() {
  stage5_compensation_begin
  if test "$whitelist_mutated" = "true"; then
    stage5_compensate rds-whitelist \
      "$SCRIPT_DIR/rds-whitelist.sh" restore "$config_path" "$whitelist_snapshot"
  fi
  stage5_invocation_state_compensate
  stage5_compensate current-checkpoint restore_current_checkpoint
  stage5_compensate previous-checkpoint restore_previous_checkpoint
  stage5_compensate candidate-release cleanup_candidate
  stage5_compensation_finish
}

checkpoint_candidate() {
  if test -n "$old_current"; then
    ln -sfn "$old_current" "$release_root/previous"
  else
    rm -f "$release_root/previous"
  fi
  ln -sfn "$release_id" "$release_root/current"
}

stage5_transaction_begin restore_original
stage5_transaction_step snapshot-invocation prepare_transaction_snapshot
stage5_transaction_step prepare-release prepare_release
stage5_transaction_step rds-whitelist mutate_whitelist
stage5_transaction_step cloud-boundary \
  "$SCRIPT_DIR/verify-cloud-boundaries.sh" "$release_dir/release.env" "$release_dir/evidence"
stage5_transaction_step secrets mutate_secrets
export COFCO_PREPROD_GATEWAY_CONFIG="$release_dir/runtime/gateway/nginx.conf"
stage5_transaction_step gateway-config \
  "$SCRIPT_DIR/render-gateway.sh" "$release_dir/release.env" "$COFCO_PREPROD_GATEWAY_CONFIG"
stage5_transaction_step compose-config \
  docker compose --env-file "$release_dir/release.env" -f "$compose_file" config --quiet
stage5_transaction_step backup \
  "$SCRIPT_DIR/backup-rds.sh" "$release_dir/release.env" "$release_dir/evidence"
stage5_transaction_step pull \
  docker compose --env-file "$release_dir/release.env" -f "$compose_file" pull
stage5_transaction_step up mutate_services
stage5_transaction_step verify \
  "$SCRIPT_DIR/verify.sh" "$release_dir/release.env" "$release_dir/evidence"
stage5_transaction_step checkpoint checkpoint_candidate
stage5_transaction_commit
printf 'PREPRODUCTION_DEPLOYED release=%s previous=%s\n' "$release_id" "${old_current:-undeployed}"
