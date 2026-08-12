#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
source "$SCRIPT_DIR/common.sh"

mode="${1:-dry-run}"
config_path="${2:-$PACKAGE_ROOT/config/preproduction.env}"
runtime_dir="$PACKAGE_ROOT/.runtime/rds-whitelist"

case "$mode" in
  dry-run|apply) ;;
  *) fail "usage: rds-whitelist.sh [dry-run|apply] [config-path]" ;;
esac

require_command node
node "$CONFIG_VALIDATOR" --config "$config_path" >/dev/null
require_shell_invariants "$config_path"

if test "$mode" = "dry-run"; then
  printf 'DRY_RUN: the named preproduction RDS whitelist was not modified.\n'
  exit 0
fi

require_preproduction_change_approval
require_command aliyun
require_command jq
install -d -m 0700 "$runtime_dir"

region="$(read_config "$config_path" COFCO_PREPROD_REGION)"
rds_instance_id="$(read_config "$config_path" COFCO_PREPROD_RDS_INSTANCE_ID)"
whitelist_name="$(read_config "$config_path" COFCO_PREPROD_RDS_WHITELIST_NAME)"
whitelist_cidrs="$(read_config "$config_path" COFCO_PREPROD_RDS_WHITELIST_CIDRS)"
response_file="$runtime_dir/.whitelist.$$"
trap 'rm -f "$response_file"' EXIT

aliyun rds ModifySecurityIps \
  --RegionId "$region" \
  --DBInstanceId "$rds_instance_id" \
  --DBInstanceIPArrayName "$whitelist_name" \
  --SecurityIps "$whitelist_cidrs" \
  --WhitelistNetworkType VPC \
  --ModifyMode Cover >/dev/null

aliyun rds DescribeDBInstanceIPArrayList \
  --RegionId "$region" \
  --DBInstanceId "$rds_instance_id" >"$response_file"

approved_json="$(printf '%s' "$whitelist_cidrs" | jq -Rc 'split(",") | map(gsub("^[[:space:]]+|[[:space:]]+$"; "") | if contains("/") then . else . + "/32" end) | sort')"
jq -e --arg name "$whitelist_name" --argjson approved "$approved_json" '
  [
    .Items.DBInstanceIPArray[]?
    | select(.DBInstanceIPArrayName == $name)
    | .SecurityIPList
    | split(",")
    | map(gsub("^[[:space:]]+|[[:space:]]+$"; "") | if contains("/") then . else . + "/32" end)
    | sort
  ] as $matches
  | ($matches | length) == 1 and $matches[0] == $approved
' "$response_file" >/dev/null || fail "RDS whitelist read-back did not match the approved CIDRs"

printf 'RDS_WHITELIST_VERIFIED name=%s cidr_count=%s\n' "$whitelist_name" "$(jq 'length' <<<"$approved_json")"
