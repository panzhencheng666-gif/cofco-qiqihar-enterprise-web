#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
source "$SCRIPT_DIR/common.sh"

config_path="${1:-$PACKAGE_ROOT/config/preproduction.env}"
evidence_dir="${2:-$PACKAGE_ROOT/.runtime/backup-evidence}"

require_apply_approval
require_shell_invariants "$config_path"
require_command aliyun
require_command jq
install -d -m 0700 "$evidence_dir"

region="$(read_config "$config_path" COFCO_PREPROD_REGION)"
rds_instance_id="$(read_config "$config_path" COFCO_PREPROD_RDS_INSTANCE_ID)"
backup_method="$(read_config "$config_path" COFCO_PREPROD_BACKUP_METHOD)"
response_file="$evidence_dir/.create-backup.$$"
task_file="$evidence_dir/.describe-backup.$$"
trap 'rm -f "$response_file" "$task_file"' EXIT

aliyun rds CreateBackup \
  --RegionId "$region" \
  --DBInstanceId "$rds_instance_id" \
  --BackupMethod "$backup_method" >"$response_file"
backup_job_id="$(jq -er '.BackupJobId | tostring' "$response_file")"
printf 'BACKUP_STARTED job=%s\n' "$backup_job_id"

deadline=$((SECONDS + 7200))
while test "$SECONDS" -lt "$deadline"; do
  aliyun rds DescribeBackupTasks \
    --RegionId "$region" \
    --DBInstanceId "$rds_instance_id" \
    --BackupJobId "$backup_job_id" >"$task_file"
  status="$(jq -r '.Items.BackupJob[0].BackupStatus // .Items.BackupJob[0].BackupProgressStatus // "Unknown"' "$task_file")"
  case "$status" in
    Finished)
      backup_id="$(jq -er '.Items.BackupJob[0].BackupId | tostring' "$task_file")"
      evidence_file="$evidence_dir/rds-backup-$backup_job_id.json"
      jq -n \
        --arg environment preproduction \
        --arg instance "$rds_instance_id" \
        --arg job "$backup_job_id" \
        --arg backup "$backup_id" \
        --arg method "$backup_method" \
        --arg completed_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        '{environment:$environment,rdsInstanceId:$instance,backupJobId:$job,backupId:$backup,backupMethod:$method,status:"Finished",completedAt:$completed_at}' >"$evidence_file"
      chmod 0600 "$evidence_file"
      printf 'BACKUP_FINISHED job=%s backup=%s evidence=%s\n' "$backup_job_id" "$backup_id" "$evidence_file"
      exit 0
      ;;
    Failed)
      fail "RDS backup job failed"
      ;;
    *)
      printf 'BACKUP_PROGRESS job=%s status=%s\n' "$backup_job_id" "$status"
      sleep 15
      ;;
  esac
done

fail "RDS backup did not finish within the two-hour preproduction bound"
