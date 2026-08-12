#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
source "$SCRIPT_DIR/common.sh"

mode="${1:-dry-run}"
config_path="${2:-$PACKAGE_ROOT/config/preproduction.env}"
terraform_root="$PACKAGE_ROOT/terraform"
runtime_dir="$PACKAGE_ROOT/.runtime"
plan_path="$runtime_dir/preproduction-network.tfplan"

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

https_json="$(printf '%s' "$(read_config "$config_path" COFCO_PREPROD_HTTPS_SOURCE_CIDRS)" | jq -Rc 'split(",") | map(gsub("^[[:space:]]+|[[:space:]]+$"; ""))')"
terraform_args=(
  -var=enable_apply=true
  -var=environment=preproduction
  -var="region=$(read_config "$config_path" COFCO_PREPROD_REGION)"
  -var="zone_id=$(read_config "$config_path" COFCO_PREPROD_ZONE_ID)"
  -var="vpc_id=$(read_config "$config_path" COFCO_PREPROD_VPC_ID)"
  -var="vswitch_id=$(read_config "$config_path" COFCO_PREPROD_VSWITCH_ID)"
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
fi

terraform -chdir="$terraform_root" init -backend=false

if test "$mode" = "plan"; then
  terraform -chdir="$terraform_root" plan -input=false -out="$plan_path" "${terraform_args[@]}"
  printf 'PLAN_READY path=%s sha256=%s\n' "$plan_path" "$(sha256_file "$plan_path")"
  exit 0
fi

printf 'APPLYING_PREPRODUCTION_PLAN sha256=%s\n' "$(sha256_file "$plan_path")"
terraform -chdir="$terraform_root" apply -input=false "$plan_path"
