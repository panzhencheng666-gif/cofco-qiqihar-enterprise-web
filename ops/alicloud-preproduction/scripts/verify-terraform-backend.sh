#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
source "$SCRIPT_DIR/common.sh"

config_path="${1:-$PACKAGE_ROOT/config/preproduction.env}"
evidence_dir="${2:-$PACKAGE_ROOT/.runtime/backend-evidence}"

require_shell_invariants "$config_path"
for command_name in aliyun jq; do
  require_command "$command_name"
done
test "$(read_config "$config_path" COFCO_PREPROD_TF_STATE_VERSIONING_APPROVED)" = "true" \
  || fail "Terraform state versioning approval is missing"
test "$(read_config "$config_path" COFCO_PREPROD_TF_STATE_MINIMUM_PERMISSIONS_APPROVED)" = "true" \
  || fail "Terraform state minimum permissions approval is missing"
install -d -m 0700 "$evidence_dir"

bucket="$(read_config "$config_path" COFCO_PREPROD_TF_STATE_BUCKET)"
oss_endpoint="$(read_config "$config_path" COFCO_PREPROD_TF_STATE_OSS_ENDPOINT)"
tablestore_endpoint="$(read_config "$config_path" COFCO_PREPROD_TF_STATE_TABLESTORE_ENDPOINT)"
tablestore_instance="$(read_config "$config_path" COFCO_PREPROD_TF_STATE_TABLESTORE_INSTANCE)"
tablestore_table="$(read_config "$config_path" COFCO_PREPROD_TF_STATE_TABLESTORE_TABLE)"
versioning_info="$evidence_dir/.versioning.$$"
encryption_info="$evidence_dir/.encryption.$$"
table_info="$evidence_dir/.table.$$"
trap 'rm -f "$versioning_info" "$encryption_info" "$table_info"' EXIT

aliyun oss GetBucketVersioning \
  --BucketName "$bucket" \
  --endpoint "$oss_endpoint" >"$versioning_info"
jq -e '.. | strings | select(. == "Enabled")' "$versioning_info" >/dev/null \
  || fail "Terraform state OSS bucket versioning is not enabled"

aliyun oss GetBucketEncryption \
  --BucketName "$bucket" \
  --endpoint "$oss_endpoint" >"$encryption_info"
jq -e '.. | strings | select(. == "AES256" or . == "KMS")' "$encryption_info" >/dev/null \
  || fail "Terraform state OSS bucket encryption is not enabled"

aliyun ots DescribeTable \
  --InstanceName "$tablestore_instance" \
  --TableName "$tablestore_table" \
  --endpoint "$tablestore_endpoint" >"$table_info"
jq -e '[.. | objects
  | select((.Name? // .PrimaryKeyName? // .name? // "") == "LockID")
  | (.Type? // .PrimaryKeyType? // .type? // "")]
  | any(. == "STRING" or . == "String")' "$table_info" >/dev/null \
  || fail "Terraform TableStore lock table does not expose the required string LockID primary key"

evidence_file="$evidence_dir/terraform-backend-$(date -u +%Y%m%dT%H%M%SZ).json"
jq -n \
  --arg bucket "$bucket" \
  --arg table "$tablestore_table" \
  --arg verified_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{backend:"oss",bucket:$bucket,versioning:"PASS",encryption:"PASS",locking:"TableStore",lockTable:$table,minimumPermissionsApproval:"PASS",verifiedAt:$verified_at}' >"$evidence_file"
chmod 0600 "$evidence_file"
printf 'TERRAFORM_BACKEND_VERIFIED evidence=%s\n' "$evidence_file"
