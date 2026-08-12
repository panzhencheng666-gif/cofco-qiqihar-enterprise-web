#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
source "$SCRIPT_DIR/common.sh"

mode="${1:-dry-run}"
config_path="${2:-$PACKAGE_ROOT/config/preproduction.env}"
terraform_root="$PACKAGE_ROOT/terraform"
runtime_dir="$OPERATION_RUNTIME_ROOT/terraform"
plan_path="$runtime_dir/preproduction-network.tfplan"
backend_config_path="$runtime_dir/terraform-backend.hcl"
backend_fingerprint_path="$runtime_dir/terraform-backend.sha256"

case "$mode" in
  dry-run)
    "$SCRIPT_DIR/preflight.sh" --dry-run "$config_path"
    printf 'DRY_RUN: terraform init/plan/apply were not invoked.\n'
    exit 0
    ;;
  plan|apply) ;;
  *) fail "usage: infra.sh [dry-run|plan|apply] [config-path]" ;;
esac

require_command node
require_command jq
require_command terraform
require_command aliyun
node "$CONFIG_VALIDATOR" --config "$config_path" >/dev/null
require_shell_invariants "$config_path"
install -d -m 0700 "$runtime_dir"

umask 077
{
  printf 'region = "%s"\n' "$(read_config "$config_path" COFCO_PREPROD_REGION)"
  printf 'bucket = "%s"\n' "$(read_config "$config_path" COFCO_PREPROD_TF_STATE_BUCKET)"
  printf 'prefix = "%s"\n' "$(read_config "$config_path" COFCO_PREPROD_TF_STATE_PREFIX)"
  printf 'key = "%s"\n' "$(read_config "$config_path" COFCO_PREPROD_TF_STATE_KEY)"
  printf 'endpoint = "%s"\n' "$(read_config "$config_path" COFCO_PREPROD_TF_STATE_OSS_ENDPOINT)"
  printf 'tablestore_endpoint = "%s"\n' "$(read_config "$config_path" COFCO_PREPROD_TF_STATE_TABLESTORE_ENDPOINT)"
  printf 'tablestore_instance_name = "%s"\n' "$(read_config "$config_path" COFCO_PREPROD_TF_STATE_TABLESTORE_INSTANCE)"
  printf 'tablestore_table = "%s"\n' "$(read_config "$config_path" COFCO_PREPROD_TF_STATE_TABLESTORE_TABLE)"
  printf 'encrypt = true\n'
  printf 'acl = "private"\n'
} >"$backend_config_path"
chmod 0600 "$backend_config_path"
backend_fingerprint="$(sha256_file "$backend_config_path")"
"$SCRIPT_DIR/verify-terraform-backend.sh" "$config_path" "$runtime_dir/backend-evidence"

https_json="$(printf '%s' "$(read_config "$config_path" COFCO_PREPROD_HTTPS_SOURCE_CIDRS)" | jq -Rc 'split(",") | map(gsub("^[[:space:]]+|[[:space:]]+$"; ""))')"
terraform_args=(
  -var=enable_apply=true
  -var=environment=preproduction
  -var="region=$(read_config "$config_path" COFCO_PREPROD_REGION)"
  -var="zone_id=$(read_config "$config_path" COFCO_PREPROD_ZONE_ID)"
  -var="vpc_id=$(read_config "$config_path" COFCO_PREPROD_VPC_ID)"
  -var="vswitch_id=$(read_config "$config_path" COFCO_PREPROD_VSWITCH_ID)"
  -var="vswitch_cidr=$(read_config "$config_path" COFCO_PREPROD_VSWITCH_CIDR)"
  -var="security_group_id=$(read_config "$config_path" COFCO_PREPROD_SECURITY_GROUP_ID)"
  -var="ecs_instance_id=$(read_config "$config_path" COFCO_PREPROD_ECS_INSTANCE_ID)"
  -var="ecs_private_ip=$(read_config "$config_path" COFCO_PREPROD_ECS_PRIVATE_IP)"
  -var="rds_instance_id=$(read_config "$config_path" COFCO_PREPROD_RDS_INSTANCE_ID)"
  -var="https_source_cidrs=$https_json"
  -var="ssh_source_cidr=$(read_config "$config_path" COFCO_PREPROD_SSH_SOURCE_CIDR)"
)

if test "$mode" = "apply"; then
  require_apply_approval
  test -f "$plan_path" || fail "saved preproduction network plan is missing"
  approved_plan_sha="${COFCO_PREPROD_APPROVED_PLAN_SHA256:-}"
  [[ "$approved_plan_sha" =~ ^[a-f0-9]{64}$ ]] || fail "approved plan SHA-256 is missing or invalid"
  plan_sha="$(sha256_file "$plan_path")"
  test "$approved_plan_sha" = "$plan_sha" || fail "approved plan SHA-256 does not match the saved plan"
  test -f "$backend_fingerprint_path" || fail "approved backend fingerprint is missing"
  test "$(tr -d '\r\n' <"$backend_fingerprint_path")" = "$backend_fingerprint" \
    || fail "backend fingerprint does not match the backend used by the reviewed plan"
fi

terraform -chdir="$terraform_root" init -reconfigure -backend-config="$backend_config_path"
state_error="$runtime_dir/.state-pull-error.$$"
trap 'rm -f "$state_error"' EXIT
if ! terraform -chdir="$terraform_root" state pull >/dev/null 2>"$state_error"; then
  grep -Fq 'No state file was found' "$state_error" \
    || fail "authoritative remote Terraform state is not readable"
fi

if test "$mode" = "plan"; then
  terraform -chdir="$terraform_root" plan -input=false -lock=true -lock-timeout=0s -out="$plan_path" "${terraform_args[@]}"
  printf '%s\n' "$backend_fingerprint" >"$backend_fingerprint_path"
  chmod 0600 "$backend_fingerprint_path"
  printf 'PLAN_READY path=%s sha256=%s backend fingerprint=%s\n' "$plan_path" "$(sha256_file "$plan_path")" "$backend_fingerprint"
  exit 0
fi

printf 'APPLYING_PREPRODUCTION_PLAN sha256=%s backend fingerprint=%s\n' "$(sha256_file "$plan_path")" "$backend_fingerprint"
terraform -chdir="$terraform_root" apply -input=false -lock=true -lock-timeout=0s "$plan_path"
terraform -chdir="$terraform_root" state pull >/dev/null \
  || fail "authoritative remote Terraform state is not readable after apply"
