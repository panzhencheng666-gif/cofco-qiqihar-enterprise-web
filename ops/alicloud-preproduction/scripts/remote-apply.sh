#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
source "$SCRIPT_DIR/common.sh"
source "$SCRIPT_DIR/transaction.sh"

config_path="${1:-$PACKAGE_ROOT/config/preproduction.env}"
release_root="${COFCO_PREPROD_RELEASE_ROOT:-$HOME/.local/share/cofco-preproduction/releases}"
release_id="$(read_config "$config_path" COFCO_PREPROD_RELEASE_ID)"
release_dir="$release_root/$release_id"
compose_file="$PACKAGE_ROOT/compose.yaml"

require_apply_approval
require_shell_invariants "$config_path"
for command_name in aliyun curl docker jq openssl; do
  require_command "$command_name"
done

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

whitelist_snapshot="$release_dir/evidence/prior-rds-whitelist.json"
environment_mutation_started=false

runtime_root="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
export COFCO_PREPROD_RUNTIME_SECRETS_DIR="$runtime_root/cofco-preproduction/secrets"

prepare_release() {
  install -d -m 0700 "$release_dir" "$release_dir/evidence" "$release_dir/runtime/gateway"
  install -m 0600 "$config_path" "$release_dir/release.env"
}

begin_environment_mutation() {
  environment_mutation_started=true
  "$@"
}

restore_checkpoints() {
  if test -n "$old_current"; then
    ln -sfn "$old_current" "$release_root/current"
  else
    rm -f "$release_root/current"
  fi
  if test -n "$old_previous"; then
    ln -sfn "$old_previous" "$release_root/previous"
  else
    rm -f "$release_root/previous"
  fi
}

clear_candidate_secrets() {
  rm -f \
    "$COFCO_PREPROD_RUNTIME_SECRETS_DIR/rds-ca.pem" \
    "$COFCO_PREPROD_RUNTIME_SECRETS_DIR/spring.datasource.password" \
    "$COFCO_PREPROD_RUNTIME_SECRETS_DIR/qiqihar.security.oidc.client-secret" \
    "$COFCO_PREPROD_RUNTIME_SECRETS_DIR/tls.crt" \
    "$COFCO_PREPROD_RUNTIME_SECRETS_DIR/tls.key" \
    "$COFCO_PREPROD_RUNTIME_SECRETS_DIR/alert-target"
}

restore_original() {
  local previous_config previous_gateway
  if test "$environment_mutation_started" = "true"; then
    "$SCRIPT_DIR/rds-whitelist.sh" restore "$release_dir/release.env" "$whitelist_snapshot" || return $?
    if test -n "$old_current"; then
      previous_config="$release_root/$old_current/release.env"
      previous_gateway="$release_root/$old_current/runtime/gateway/nginx.conf"
      "$SCRIPT_DIR/materialize-secrets.sh" "$previous_config" "$COFCO_PREPROD_RUNTIME_SECRETS_DIR" || return $?
      "$SCRIPT_DIR/render-gateway.sh" "$previous_config" "$previous_gateway" || return $?
      export COFCO_PREPROD_GATEWAY_CONFIG="$previous_gateway"
      "$SCRIPT_DIR/verify-cloud-boundaries.sh" "$previous_config" "$release_dir/evidence" || return $?
      docker compose --env-file "$previous_config" -f "$compose_file" config --quiet || return $?
      docker compose --env-file "$previous_config" -f "$compose_file" up -d --remove-orphans --wait --wait-timeout 300 || return $?
      "$SCRIPT_DIR/verify.sh" "$previous_config" "$release_dir/evidence" || return $?
    else
      export COFCO_PREPROD_GATEWAY_CONFIG="$release_dir/runtime/gateway/nginx.conf"
      docker compose --env-file "$release_dir/release.env" -f "$compose_file" stop || return $?
      clear_candidate_secrets || return $?
    fi
  fi
  restore_checkpoints || return $?
  case "$release_dir" in
    "$release_root"/*) ;;
    *) return 64 ;;
  esac
  if test -e "$release_dir"; then
    rm -r -- "$release_dir" || return $?
  fi
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
stage5_transaction_step prepare-release prepare_release
stage5_transaction_step capture-whitelist \
  "$SCRIPT_DIR/rds-whitelist.sh" capture "$release_dir/release.env" "$whitelist_snapshot"
stage5_transaction_step rds-whitelist \
  begin_environment_mutation "$SCRIPT_DIR/rds-whitelist.sh" apply "$release_dir/release.env"
stage5_transaction_step cloud-boundary \
  "$SCRIPT_DIR/verify-cloud-boundaries.sh" "$release_dir/release.env" "$release_dir/evidence"
stage5_transaction_step secrets \
  "$SCRIPT_DIR/materialize-secrets.sh" "$release_dir/release.env" "$COFCO_PREPROD_RUNTIME_SECRETS_DIR"
export COFCO_PREPROD_GATEWAY_CONFIG="$release_dir/runtime/gateway/nginx.conf"
stage5_transaction_step gateway-config \
  "$SCRIPT_DIR/render-gateway.sh" "$release_dir/release.env" "$COFCO_PREPROD_GATEWAY_CONFIG"
stage5_transaction_step compose-config \
  docker compose --env-file "$release_dir/release.env" -f "$compose_file" config --quiet
stage5_transaction_step backup \
  "$SCRIPT_DIR/backup-rds.sh" "$release_dir/release.env" "$release_dir/evidence"
stage5_transaction_step pull \
  docker compose --env-file "$release_dir/release.env" -f "$compose_file" pull
stage5_transaction_step up \
  docker compose --env-file "$release_dir/release.env" -f "$compose_file" up -d --remove-orphans --wait --wait-timeout 300
stage5_transaction_step verify \
  "$SCRIPT_DIR/verify.sh" "$release_dir/release.env" "$release_dir/evidence"
stage5_transaction_step checkpoint checkpoint_candidate
stage5_transaction_commit
printf 'PREPRODUCTION_DEPLOYED release=%s previous=%s\n' "$release_id" "${old_current:-undeployed}"
