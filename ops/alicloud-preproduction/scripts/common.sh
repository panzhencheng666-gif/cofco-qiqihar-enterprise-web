#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
PACKAGE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)"
WEB_ROOT="$(cd "$PACKAGE_ROOT/../.." && pwd -P)"
CONFIG_VALIDATOR="$WEB_ROOT/scripts/preproduction-config.mjs"
RUNTIME_VALIDATOR="$WEB_ROOT/scripts/preproduction-runtime.mjs"

fail() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command is missing: $1"
}

config_mode() {
  local config_path="$1"
  if stat -f '%Lp' "$config_path" >/dev/null 2>&1; then
    stat -f '%Lp' "$config_path"
  else
    stat -c '%a' "$config_path"
  fi
}

require_config_mode() {
  local config_path="$1"
  test -f "$config_path" || fail "preproduction config file is missing"
  test "$(config_mode "$config_path")" = "600" || fail "preproduction config must have mode 0600"
}

read_config() {
  local config_path="$1"
  local key="$2"
  awk -v wanted="$key" '
    /^[[:space:]]*#/ || /^[[:space:]]*$/ { next }
    {
      line=$0
      sub(/^[[:space:]]*export[[:space:]]+/, "", line)
      separator=index(line, "=")
      if (separator == 0) next
      candidate=substr(line, 1, separator - 1)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", candidate)
      if (candidate != wanted) next
      value=substr(line, separator + 1)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
      if (length(value) >= 2) {
        first=substr(value, 1, 1)
        last=substr(value, length(value), 1)
        if ((first == "\"" && last == "\"") || (first == "\047" && last == "\047")) {
          value=substr(value, 2, length(value) - 2)
        }
      }
      print value
      exit
    }
  ' "$config_path"
}

require_shell_invariants() {
  local config_path="$1"
  require_config_mode "$config_path"
  require_command node
  test -f "$CONFIG_VALIDATOR" || fail "controlled preproduction config validator is missing from the Web bundle"
  test -f "$RUNTIME_VALIDATOR" || fail "controlled preproduction runtime validator is missing from the Web bundle"
  node "$CONFIG_VALIDATOR" --config "$config_path" >/dev/null
  test "$(read_config "$config_path" COFCO_DEPLOYMENT_ENV)" = "preproduction" || fail "deployment environment must be preproduction"
  test "$(read_config "$config_path" COFCO_PREPROD_FIRST_DEPLOYMENT)" = "true" || fail "first cloud deployment must remain preproduction"
  test "$(read_config "$config_path" COFCO_PREPROD_PRODUCTION_ISOLATION_APPROVED)" = "true" || fail "isolation boundary is not approved"
  test "$(read_config "$config_path" COFCO_PREPROD_RDS_NETWORK_TYPE)" = "VPC" || fail "RDS must use VPC networking"
  test "$(read_config "$config_path" COFCO_PREPROD_RDS_PUBLIC_ENDPOINT_ENABLED)" = "false" || fail "public RDS endpoint is forbidden"
  test "$(read_config "$config_path" COFCO_PREPROD_RDS_SSLMODE)" = "verify-full" || fail "RDS TLS must use verify-full"
  test "$(read_config "$config_path" COFCO_PREPROD_MIGRATION_COMPATIBILITY)" = "expand-only" || fail "image rollback requires expand-only migration compatibility"
  if awk -F= '
    /^[[:space:]]*#/ || /^[[:space:]]*$/ { next }
    {
      key=$1
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", key)
      upper=toupper(key)
      if (upper ~ /(PASSWORD|PRIVATE_KEY|ACCESS_KEY_SECRET|CLIENT_SECRET|TOKEN|COOKIE)/ && upper !~ /_SECRET_REF$/) found=1
    }
    END { exit(found ? 0 : 1) }
  ' "$config_path"; then
    fail "plaintext secret keys are forbidden"
  fi
}

require_apply_approval() {
  test "${COFCO_PREPROD_APPLY:-}" = "APPLY_PREPRODUCTION" || fail "set COFCO_PREPROD_APPLY=APPLY_PREPRODUCTION for an approved preproduction change"
}

require_preproduction_change_approval() {
  if test "${COFCO_PREPROD_APPLY:-}" = "APPLY_PREPRODUCTION"; then
    return
  fi
  test "${COFCO_PREPROD_ROLLBACK:-}" = "ROLLBACK_PREPRODUCTION" || fail "an approved preproduction deploy or rollback is required"
}

require_secret_materialization_approval() {
  if test "${COFCO_PREPROD_APPLY:-}" = "APPLY_PREPRODUCTION"; then
    return
  fi
  test "${COFCO_PREPROD_ROLLBACK:-}" = "ROLLBACK_PREPRODUCTION" || fail "secret materialization requires an approved preproduction deploy or rollback"
}

sha256_file() {
  local file_path="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file_path" | awk '{print $1}'
  else
    shasum -a 256 "$file_path" | awk '{print $1}'
  fi
}
