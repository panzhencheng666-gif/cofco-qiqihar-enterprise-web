#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
source "$SCRIPT_DIR/common.sh"

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
install -d -m 0700 "$release_dir" "$release_dir/evidence"
install -m 0600 "$config_path" "$release_dir/release.env"

"$SCRIPT_DIR/rds-whitelist.sh" apply "$release_dir/release.env"
"$SCRIPT_DIR/verify-cloud-boundaries.sh" "$release_dir/release.env" "$release_dir/evidence"

runtime_root="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
export COFCO_PREPROD_RUNTIME_SECRETS_DIR="$runtime_root/cofco-preproduction/secrets"
"$SCRIPT_DIR/materialize-secrets.sh" "$release_dir/release.env" "$COFCO_PREPROD_RUNTIME_SECRETS_DIR"
docker compose --env-file "$release_dir/release.env" -f "$compose_file" config --quiet
"$SCRIPT_DIR/backup-rds.sh" "$release_dir/release.env" "$release_dir/evidence"

old_current=""
if test -L "$release_root/current"; then
  old_current="$(readlink "$release_root/current")"
fi

restore_previous_or_stop() {
  previous_config="$release_root/$old_current/release.env"
  if test -n "$old_current" && test -f "$previous_config"; then
    "$SCRIPT_DIR/rds-whitelist.sh" apply "$previous_config"
    "$SCRIPT_DIR/materialize-secrets.sh" "$previous_config" "$COFCO_PREPROD_RUNTIME_SECRETS_DIR"
    "$SCRIPT_DIR/verify-cloud-boundaries.sh" "$previous_config" "$release_dir/evidence"
    docker compose --env-file "$previous_config" -f "$compose_file" up -d --remove-orphans --wait --wait-timeout 300
    "$SCRIPT_DIR/verify.sh" "$previous_config" "$release_dir/evidence"
  else
    docker compose --env-file "$release_dir/release.env" -f "$compose_file" stop
  fi
}

docker compose --env-file "$release_dir/release.env" -f "$compose_file" pull
if ! docker compose --env-file "$release_dir/release.env" -f "$compose_file" up -d --remove-orphans --wait --wait-timeout 300; then
  restore_previous_or_stop
  fail "candidate deployment failed and the previous state was restored"
fi

if ! "$SCRIPT_DIR/verify.sh" "$release_dir/release.env" "$release_dir/evidence"; then
  restore_previous_or_stop
  fail "candidate verification failed and the previous state was restored"
fi

if test -n "$old_current"; then
  ln -sfn "$old_current" "$release_root/previous"
fi
ln -sfn "$release_id" "$release_root/current"
printf 'PREPRODUCTION_DEPLOYED release=%s previous=%s\n' "$release_id" "${old_current:-undeployed}"
