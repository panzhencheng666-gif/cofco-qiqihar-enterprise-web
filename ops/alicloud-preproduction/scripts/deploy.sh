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
expected_port="$(read_config "$config_path" COFCO_PREPROD_SSH_PORT)"
expected_host_key="$(read_config "$config_path" COFCO_PREPROD_SSH_HOST_KEY_SHA256)"
region="$(read_config "$config_path" COFCO_PREPROD_REGION)"
ecs_instance_id="$(read_config "$config_path" COFCO_PREPROD_ECS_INSTANCE_ID)"
release_id="$(read_config "$config_path" COFCO_PREPROD_RELEASE_ID)"
ssh_config="$(ssh -G "$ssh_alias")"
actual_host="$(awk '$1 == "hostname" {print $2; exit}' <<<"$ssh_config")"
actual_user="$(awk '$1 == "user" {print $2; exit}' <<<"$ssh_config")"
actual_port="$(awk '$1 == "port" {print $2; exit}' <<<"$ssh_config")"
actual_proxyjump="$(awk '$1 == "proxyjump" {print $2; exit}' <<<"$ssh_config")"
actual_proxycommand="$(awk '$1 == "proxycommand" {print $2; exit}' <<<"$ssh_config")"
identity_file="$(awk '$1 == "identityfile" {print $2; exit}' <<<"$ssh_config")"
user_known_hosts="$(awk '$1 == "userknownhostsfile" {print $2; exit}' <<<"$ssh_config")"
test "$actual_host" = "$expected_host" || fail "SSH alias does not expand to the approved HostName"
test "$actual_user" = "$expected_user" || fail "SSH alias does not expand to the approved non-root user"
test "$actual_port" = "$expected_port" && test "$actual_port" = "22" || fail "SSH alias does not expand to the approved direct port 22"
case "${actual_proxyjump:-none}" in
  ""|none) ;;
  *) fail "direct SSH target has an unapproved proxyjump" ;;
esac
case "${actual_proxycommand:-none}" in
  ""|none) ;;
  *) fail "direct SSH target has an unapproved proxycommand" ;;
esac
test -n "$identity_file" && test -f "$identity_file" || fail "SSH identity file must exist with mode 0600 or 0400"
identity_mode="$(config_mode "$identity_file")"
case "$identity_mode" in
  600|400) ;;
  *) fail "SSH identity file must exist with mode 0600 or 0400" ;;
esac
known_hosts_file="${user_known_hosts%% *}"
test -f "$known_hosts_file" || fail "SSH known_hosts file is missing"
stage5_verify_known_host_fingerprints \
  "$actual_host" "$known_hosts_file" "$expected_host_key"

ecs_info="$(mktemp "${TMPDIR:-/tmp}/cofco-preproduction-ecs.XXXXXX")"
trap 'rm -f "$ecs_info"' EXIT
instance_ids="$(jq -cn --arg id "$ecs_instance_id" '[$id]')"
aliyun ecs DescribeInstances \
  --RegionId "$region" \
  --InstanceIds "$instance_ids" >"$ecs_info"
cloud_addresses="$(jq -c --arg instance "$ecs_instance_id" '
  [.Instances.Instance[]?
    | select(.InstanceId == $instance)
    | (.VpcAttributes.PrivateIpAddress.IpAddress[]?,
       .PublicIpAddress.IpAddress[]?,
       .EipAddress.IpAddress?)]
  | map(select(type == "string" and length > 0))
  | unique
' "$ecs_info")"
resolved_addresses="$(node "$RUNTIME_VALIDATOR" resolve-host "$actual_host")"
node "$RUNTIME_VALIDATOR" addresses-approved "$resolved_addresses" "$cloud_addresses" \
  || fail "resolved SSH target is not the cloud-confirmed ECS"

ssh_options=(
  -o BatchMode=yes
  -o StrictHostKeyChecking=yes
  -o CheckHostIP=yes
  -o IdentitiesOnly=yes
  -o ProxyCommand=none
  -o ProxyJump=none
  -o "Port=$expected_port"
  -o "IdentityFile=$identity_file"
  -o "UserKnownHostsFile=$known_hosts_file"
)

remote_base='.local/share/cofco-preproduction'
remote_bundle="$remote_base/bundle"
remote_bundles="$remote_base/bundles"
remote_staging="$remote_base/bundle-staging-$release_id-$$"
remote_release_bundle="$remote_bundles/$release_id"
remote_staging_package="$remote_staging/ops/alicloud-preproduction"
config_validator_sha="$(sha256_file "$CONFIG_VALIDATOR")"
runtime_validator_sha="$(sha256_file "$RUNTIME_VALIDATOR")"
network_validator_sha="$(sha256_file "$NETWORK_VALIDATOR")"
ssh "${ssh_options[@]}" "$ssh_alias" \
  "install -d -m 0700 '$remote_base' '$remote_bundles'; test ! -e '$remote_staging'; test ! -e '$remote_release_bundle'; install -d -m 0700 '$remote_staging'"
tar -C "$WEB_ROOT" \
  --exclude='ops/alicloud-preproduction/.runtime' \
  --exclude='ops/alicloud-preproduction/config/preproduction.env' \
  --exclude='ops/alicloud-preproduction/terraform/.terraform' \
  --exclude='ops/alicloud-preproduction/terraform/*.tfstate' \
  --exclude='ops/alicloud-preproduction/terraform/*.tfstate.*' \
  --exclude='ops/alicloud-preproduction/terraform/*.tfplan' \
  -cf - \
  ops/alicloud-preproduction \
  scripts/preproduction-config.mjs \
  scripts/preproduction-network.mjs \
  scripts/preproduction-runtime.mjs \
  | ssh "${ssh_options[@]}" "$ssh_alias" "cd '$remote_staging' && tar -xf -"
scp -q "${ssh_options[@]}" "$config_path" "$ssh_alias:$remote_staging_package/config/preproduction.env"
ssh "${ssh_options[@]}" "$ssh_alias" bash \
  "$remote_staging_package/scripts/activate-bundle.sh" \
  "$remote_base" "$remote_staging" "$release_id" \
  "$config_validator_sha" "$runtime_validator_sha" "$network_validator_sha" \
  -- env COFCO_PREPROD_APPLY=APPLY_PREPRODUCTION \
  ./scripts/remote-apply.sh ./config/preproduction.env
