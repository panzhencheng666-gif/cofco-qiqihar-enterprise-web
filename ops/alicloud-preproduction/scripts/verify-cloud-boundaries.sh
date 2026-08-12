#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
source "$SCRIPT_DIR/common.sh"

config_path="${1:-$PACKAGE_ROOT/config/preproduction.env}"
evidence_dir="${2:-$PACKAGE_ROOT/.runtime/cloud-boundary-evidence}"

require_shell_invariants "$config_path"
for command_name in aliyun jq; do
  require_command "$command_name"
done
install -d -m 0700 "$evidence_dir"

region="$(read_config "$config_path" COFCO_PREPROD_REGION)"
vpc_id="$(read_config "$config_path" COFCO_PREPROD_VPC_ID)"
vswitch_id="$(read_config "$config_path" COFCO_PREPROD_VSWITCH_ID)"
ecs_instance_id="$(read_config "$config_path" COFCO_PREPROD_ECS_INSTANCE_ID)"
ecs_private_ip="$(read_config "$config_path" COFCO_PREPROD_ECS_PRIVATE_IP)"
https_endpoint_ip="$(read_config "$config_path" COFCO_PREPROD_HTTPS_ENDPOINT_IP)"
security_group_id="$(read_config "$config_path" COFCO_PREPROD_SECURITY_GROUP_ID)"
rds_instance_id="$(read_config "$config_path" COFCO_PREPROD_RDS_INSTANCE_ID)"
rds_endpoint="$(read_config "$config_path" COFCO_PREPROD_RDS_PRIVATE_ENDPOINT)"
whitelist_name="$(read_config "$config_path" COFCO_PREPROD_RDS_WHITELIST_NAME)"
whitelist_cidrs="$(read_config "$config_path" COFCO_PREPROD_RDS_WHITELIST_CIDRS)"
https_source_cidrs="$(read_config "$config_path" COFCO_PREPROD_HTTPS_SOURCE_CIDRS)"
ssh_source_cidr="$(read_config "$config_path" COFCO_PREPROD_SSH_SOURCE_CIDR)"

ecs_info="$evidence_dir/.ecs.$$"
rds_info="$evidence_dir/.rds.$$"
rds_net_info="$evidence_dir/.rds-net.$$"
security_info="$evidence_dir/.security-group.$$"
whitelist_info="$evidence_dir/.rds-whitelist.$$"
trap 'rm -f "$ecs_info" "$rds_info" "$rds_net_info" "$security_info" "$whitelist_info"' EXIT

instance_ids="$(jq -cn --arg id "$ecs_instance_id" '[$id]')"
aliyun ecs DescribeInstances \
  --RegionId "$region" \
  --InstanceIds "$instance_ids" >"$ecs_info"
jq -e \
  --arg instance "$ecs_instance_id" \
  --arg vpc "$vpc_id" \
  --arg vswitch "$vswitch_id" \
  --arg private_ip "$ecs_private_ip" \
  --arg https_endpoint "$https_endpoint_ip" \
  --arg security_group "$security_group_id" '
    any(.Instances.Instance[]?;
      .InstanceId == $instance
      and .Status == "Running"
      and .VpcAttributes.VpcId == $vpc
      and .VpcAttributes.VSwitchId == $vswitch
      and any(.VpcAttributes.PrivateIpAddress.IpAddress[]?; . == $private_ip)
      and (
        $https_endpoint == $private_ip
        or any(.PublicIpAddress.IpAddress[]?; . == $https_endpoint)
        or (.EipAddress.IpAddress // "") == $https_endpoint
      )
      and any(.SecurityGroupIds.SecurityGroupId[]?; . == $security_group))
  ' "$ecs_info" >/dev/null || fail "ECS is not running inside the approved VPC/vSwitch/security group boundary"

aliyun rds DescribeDBInstanceAttribute \
  --RegionId "$region" \
  --DBInstanceId "$rds_instance_id" >"$rds_info"
jq -e --arg instance "$rds_instance_id" --arg vpc "$vpc_id" --arg vswitch "$vswitch_id" '
  any(.Items.DBInstanceAttribute[]?;
    .DBInstanceId == $instance
    and .Engine == "PostgreSQL"
    and .DBInstanceStatus == "Running"
    and .VpcId == $vpc
    and ((.VSwitchId // "") | split(",") | index($vswitch)) != null)
' "$rds_info" >/dev/null || fail "RDS is not a running PostgreSQL instance inside the approved VPC/vSwitch boundary"

aliyun rds DescribeDBInstanceNetInfo \
  --RegionId "$region" \
  --DBInstanceId "$rds_instance_id" >"$rds_net_info"
jq -e --arg endpoint "$rds_endpoint" '
  any(.DBInstanceNetInfos.DBInstanceNetInfo[]?;
    .ConnectionString == $endpoint and (.IPType == "Private" or .IPType == "Inner"))
  and all(.DBInstanceNetInfos.DBInstanceNetInfo[]?; .IPType != "Public")
' "$rds_net_info" >/dev/null || fail "RDS private endpoint or no-public-endpoint boundary was not confirmed"

aliyun ecs DescribeSecurityGroupAttribute \
  --RegionId "$region" \
  --SecurityGroupId "$security_group_id" \
  --Direction ingress >"$security_info"
approved_https="$(printf '%s' "$https_source_cidrs" | jq -Rc 'split(",") | map(gsub("^[[:space:]]+|[[:space:]]+$"; ""))')"
approved_ssh="$(printf '%s' "$ssh_source_cidr" | jq -Rc '.')"
jq -e --argjson approved_https "$approved_https" --argjson approved_ssh "$approved_ssh" '
  all(.Permissions.Permission[]?;
    . as $permission
    | (($permission.Policy // "Accept") | ascii_downcase) != "accept"
    or (
      ($permission.IpProtocol | ascii_downcase) == "tcp"
      and (
        ($permission.PortRange == "443/443" and ($approved_https | index($permission.SourceCidrIp // "")) != null)
        or ($permission.PortRange == "22/22" and ($permission.SourceCidrIp // "") == $approved_ssh)
      )
      and ($permission.SourceCidrIpv6 // "") != "::/0"
    ))
' "$security_info" >/dev/null || fail "security group contains an unapproved ingress rule"

aliyun rds DescribeDBInstanceIPArrayList \
  --RegionId "$region" \
  --DBInstanceId "$rds_instance_id" >"$whitelist_info"
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
  | [
      .Items.DBInstanceIPArray[]?.SecurityIPList
      | split(",")[]
      | gsub("^[[:space:]]+|[[:space:]]+$"; "")
      | if contains("/") then . else . + "/32" end
    ] as $all_whitelist_cidrs
  | ($matches | length) == 1
    and $matches[0] == $approved
    and all($all_whitelist_cidrs[]?; . as $cidr | $cidr == "127.0.0.1/32" or ($approved | index($cidr)) != null)
' "$whitelist_info" >/dev/null || fail "RDS whitelist is missing, drifted, or contains an unapproved whitelist CIDR"

evidence_file="$evidence_dir/cloud-boundaries-$(date -u +%Y%m%dT%H%M%SZ).json"
jq -n \
  --arg environment preproduction \
  --arg ecs "$ecs_instance_id" \
  --arg rds "$rds_instance_id" \
  --arg security_group "$security_group_id" \
  --arg verified_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{environment:$environment,ecsInstanceId:$ecs,rdsInstanceId:$rds,securityGroupId:$security_group,isolationBoundary:"PASS",verifiedAt:$verified_at}' >"$evidence_file"
chmod 0600 "$evidence_file"
printf 'CLOUD_BOUNDARIES_VERIFIED evidence=%s\n' "$evidence_file"
