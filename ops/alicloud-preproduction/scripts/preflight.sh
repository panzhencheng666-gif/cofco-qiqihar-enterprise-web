#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
source "$SCRIPT_DIR/common.sh"

mode="${1:---dry-run}"
config_path="${2:-$PACKAGE_ROOT/config/preproduction.env}"

case "$mode" in
  --dry-run|--apply) ;;
  *) fail "usage: preflight.sh [--dry-run|--apply] [config-path]" ;;
esac

if ! test -f "$config_path"; then
  printf 'BLOCKED_EXTERNAL: preproduction config is not present; copy the example and supply approved references only.\n'
  exit 2
fi

require_command node
set +e
node "$CONFIG_VALIDATOR" --config "$config_path"
validation_status=$?
set -e
if test "$validation_status" -ne 0; then
  exit "$validation_status"
fi

if test "$mode" = "--apply"; then
  require_apply_approval
  for command_name in aliyun docker jq openssl ssh terraform; do
    require_command "$command_name"
  done
  printf 'READY_FOR_VALIDATION: approved references and required tools are present; cloud state still requires plan review.\n'
else
  printf 'DRY_RUN_READY: configuration is complete; no cloud or remote write was performed.\n'
fi
