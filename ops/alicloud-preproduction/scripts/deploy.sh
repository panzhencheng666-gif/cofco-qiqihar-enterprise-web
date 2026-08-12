#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
source "$SCRIPT_DIR/common.sh"

mode="${1:-dry-run}"
config_path="${2:-$PACKAGE_ROOT/config/preproduction.env}"

case "$mode" in
  dry-run)
    "$SCRIPT_DIR/preflight.sh" --dry-run "$config_path"
    printf 'DRY_RUN: no SSH connection, image pull, backup, or deployment was attempted.\n'
    exit 0
    ;;
  apply) ;;
  *) fail "usage: deploy.sh [dry-run|apply] [config-path]" ;;
esac

"$SCRIPT_DIR/preflight.sh" --apply "$config_path"
require_command scp
require_command tar
require_command ssh-keygen
ssh_alias="$(read_config "$config_path" COFCO_PREPROD_SSH_HOST_ALIAS)"
expected_host="$(read_config "$config_path" COFCO_PREPROD_SSH_EXPECTED_HOST)"
expected_user="$(read_config "$config_path" COFCO_PREPROD_SSH_USER)"
ssh_config="$(ssh -G "$ssh_alias")"
actual_host="$(awk '$1 == "hostname" {print $2; exit}' <<<"$ssh_config")"
actual_user="$(awk '$1 == "user" {print $2; exit}' <<<"$ssh_config")"
identity_file="$(awk '$1 == "identityfile" {print $2; exit}' <<<"$ssh_config")"
user_known_hosts="$(awk '$1 == "userknownhostsfile" {print $2; exit}' <<<"$ssh_config")"
test "$actual_host" = "$expected_host" || fail "SSH alias does not expand to the approved HostName"
test "$actual_user" = "$expected_user" || fail "SSH alias does not expand to the approved non-root user"
test -n "$identity_file" && test -f "$identity_file" || fail "SSH identity file must exist with mode 0600 or 0400"
identity_mode="$(config_mode "$identity_file")"
case "$identity_mode" in
  600|400) ;;
  *) fail "SSH identity file must exist with mode 0600 or 0400" ;;
esac
known_hosts_file="${user_known_hosts%% *}"
test -f "$known_hosts_file" || fail "SSH known_hosts file is missing"
ssh-keygen -F "$actual_host" -f "$known_hosts_file" >/dev/null || fail "approved SSH host key is not present in known_hosts"

ssh_options=(-o BatchMode=yes -o StrictHostKeyChecking=yes -o IdentitiesOnly=yes)

remote_bundle='.local/share/cofco-preproduction/bundle'
ssh "${ssh_options[@]}" "$ssh_alias" "install -d -m 0700 '$remote_bundle/config'"
tar -C "$PACKAGE_ROOT" --exclude='.runtime' -cf - . | ssh "${ssh_options[@]}" "$ssh_alias" "cd '$remote_bundle' && tar -xf -"
scp -q "${ssh_options[@]}" "$config_path" "$ssh_alias:$remote_bundle/config/preproduction.env"
ssh "${ssh_options[@]}" "$ssh_alias" "chmod 0600 '$remote_bundle/config/preproduction.env' && cd '$remote_bundle' && COFCO_PREPROD_APPLY=APPLY_PREPRODUCTION ./scripts/remote-apply.sh ./config/preproduction.env"
