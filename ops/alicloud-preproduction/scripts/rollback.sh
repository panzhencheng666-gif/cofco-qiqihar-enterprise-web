#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
source "$SCRIPT_DIR/common.sh"

config_path="${1:-$PACKAGE_ROOT/config/preproduction.env}"
release_root="${COFCO_PREPROD_RELEASE_ROOT:-$HOME/.local/share/cofco-preproduction/releases}"
compose_file="$PACKAGE_ROOT/compose.yaml"

test "${COFCO_PREPROD_ROLLBACK:-}" = "ROLLBACK_PREPRODUCTION" || fail "set COFCO_PREPROD_ROLLBACK=ROLLBACK_PREPRODUCTION for an approved preproduction rollback"
require_shell_invariants "$config_path"
require_command docker

current_id="$(readlink "$release_root/current" 2>/dev/null || true)"
previous_id="$(readlink "$release_root/previous" 2>/dev/null || true)"
declared_target="$(read_config "$config_path" COFCO_PREPROD_ROLLBACK_RELEASE_ID)"

if test -z "$previous_id"; then
  test "$declared_target" = "undeployed" || fail "no verified previous release is available"
  runtime_root="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
  export COFCO_PREPROD_RUNTIME_SECRETS_DIR="$runtime_root/cofco-preproduction/secrets"
  docker compose --env-file "$config_path" -f "$compose_file" stop
  printf 'PREPRODUCTION_ROLLED_BACK target=undeployed previous=%s\n' "${current_id:-none}"
  exit 0
fi

test "$declared_target" = "$previous_id" || fail "declared rollback target does not match the verified previous release"
previous_config="$release_root/$previous_id/release.env"
test -f "$previous_config" || fail "previous release config is missing"
runtime_root="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
export COFCO_PREPROD_RUNTIME_SECRETS_DIR="$runtime_root/cofco-preproduction/secrets"
"$SCRIPT_DIR/rds-whitelist.sh" apply "$previous_config"
"$SCRIPT_DIR/materialize-secrets.sh" "$previous_config" "$COFCO_PREPROD_RUNTIME_SECRETS_DIR"
"$SCRIPT_DIR/verify-cloud-boundaries.sh" "$previous_config" "$release_root/$previous_id/evidence"
docker compose --env-file "$previous_config" -f "$compose_file" pull
docker compose --env-file "$previous_config" -f "$compose_file" up -d --remove-orphans --wait --wait-timeout 300
"$SCRIPT_DIR/verify.sh" "$previous_config" "$release_root/$previous_id/evidence"
ln -sfn "$current_id" "$release_root/previous"
ln -sfn "$previous_id" "$release_root/current"
printf 'PREPRODUCTION_ROLLED_BACK target=%s previous=%s\n' "$previous_id" "$current_id"
