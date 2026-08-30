#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
PACKAGE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)"
WEB_ROOT="$(cd "$PACKAGE_ROOT/../.." && pwd -P)"
CONFIG_VALIDATOR="$WEB_ROOT/scripts/preproduction-config.mjs"
RUNTIME_VALIDATOR="$WEB_ROOT/scripts/preproduction-runtime.mjs"
NETWORK_VALIDATOR="$WEB_ROOT/scripts/preproduction-network.mjs"
RELEASE_MANIFEST_VALIDATOR="$WEB_ROOT/scripts/preproduction-release-manifest.mjs"
if test -n "${XDG_RUNTIME_DIR:-}"; then
  default_operation_runtime_root="$XDG_RUNTIME_DIR/cofco-preproduction/operations"
else
  default_operation_runtime_root="$HOME/.local/state/cofco-preproduction/operations"
fi
OPERATION_RUNTIME_ROOT="${COFCO_PREPROD_OPERATION_RUNTIME_ROOT:-$default_operation_runtime_root}"
STAGE5_MUTATION_LOCK_DIR=""
STAGE5_INVOCATION_RUNTIME_DIR=""
STAGE5_INVOCATION_CLEANUP_STATUS=0
STAGE5_MUTATION_LOCK_CLEANUP_STATUS=0

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
  test -f "$NETWORK_VALIDATOR" || fail "controlled preproduction network validator is missing from the Web bundle"
  test -f "$RELEASE_MANIFEST_VALIDATOR" || fail "controlled release manifest validator is missing from the Web bundle"
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

require_candidate_release_manifest() {
  local config_path="$1"
  local manifest_path="${2:-${COFCO_RELEASE_MANIFEST_PATH:-}}"
  test -n "$manifest_path" || fail "canonical three-repository release manifest path is required"
  node "$RELEASE_MANIFEST_VALIDATOR" validate-candidate \
    --manifest "$manifest_path" --config "$config_path"
}

verify_release_identity() {
  local release_directory="$1"
  local current_pointer="${2:-}"
  if test -n "$current_pointer"; then
    node "$RELEASE_MANIFEST_VALIDATOR" verify-release \
      --release "$release_directory" --current "$current_pointer" --requireCurrent true
  else
    node "$RELEASE_MANIFEST_VALIDATOR" verify-release --release "$release_directory"
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

stage5_verify_known_host_fingerprints() {
  local host_name="$1"
  local known_hosts_file="$2"
  local approved_fingerprint="$3"
  local host_entries
  local actual_fingerprints
  host_entries="$(ssh-keygen -F "$host_name" -f "$known_hosts_file" | awk '!/^#/ && NF >= 3')"
  test -n "$host_entries" || fail "approved SSH host key is not present in known_hosts"
  actual_fingerprints="$(printf '%s\n' "$host_entries" \
    | ssh-keygen -lf - -E sha256 \
    | awk '{print $2}' \
    | LC_ALL=C sort -u)"
  test "$actual_fingerprints" = "$approved_fingerprint" \
    || fail "known_hosts contains an unapproved SSH host key for the target Host"
}

stage5_invocation_runtime_cleanup() {
  if test -n "${STAGE5_INVOCATION_RUNTIME_DIR:-}"; then
    case "$STAGE5_INVOCATION_RUNTIME_DIR" in
      "$OPERATION_RUNTIME_ROOT"/invocations/invocation-*) ;;
      *) return 64 ;;
    esac
    if test -e "$STAGE5_INVOCATION_RUNTIME_DIR"; then
      rm -r -- "$STAGE5_INVOCATION_RUNTIME_DIR" || return $?
    fi
    STAGE5_INVOCATION_RUNTIME_DIR=""
  fi
}

stage5_invocation_runtime_create() {
  local invocation_label="$1"
  local invocation_root="$OPERATION_RUNTIME_ROOT/invocations"
  case "$invocation_label" in
    *[!A-Za-z0-9._-]*|'') return 64 ;;
  esac
  install -d -m 0700 "$OPERATION_RUNTIME_ROOT" "$invocation_root"
  find "$invocation_root" -mindepth 1 -maxdepth 1 -type d \
    -name 'invocation-*' -mtime +0 -exec rm -r -- {} +
  STAGE5_INVOCATION_RUNTIME_DIR="$(mktemp -d "$invocation_root/invocation-$invocation_label.XXXXXX")"
  chmod 0700 "$STAGE5_INVOCATION_RUNTIME_DIR"
  trap stage5_process_cleanup EXIT
}

stage5_process_cleanup() {
  STAGE5_INVOCATION_CLEANUP_STATUS=0
  STAGE5_MUTATION_LOCK_CLEANUP_STATUS=0
  stage5_invocation_runtime_cleanup || STAGE5_INVOCATION_CLEANUP_STATUS=$?
  stage5_mutation_lock_release || STAGE5_MUTATION_LOCK_CLEANUP_STATUS=$?
  if test "$STAGE5_MUTATION_LOCK_CLEANUP_STATUS" -ne 0; then
    return "$STAGE5_MUTATION_LOCK_CLEANUP_STATUS"
  fi
  return "$STAGE5_INVOCATION_CLEANUP_STATUS"
}

stage5_mutation_lock_release() {
  local release_status=0
  if test -n "${STAGE5_MUTATION_LOCK_DIR:-}"; then
    rm -f "$STAGE5_MUTATION_LOCK_DIR/owner" || release_status=$?
    if test "$release_status" -eq 0; then
      rmdir "$STAGE5_MUTATION_LOCK_DIR" 2>/dev/null || release_status=$?
    fi
    test "$release_status" -eq 0 || return "$release_status"
    STAGE5_MUTATION_LOCK_DIR=""
  fi
}

stage5_mutation_lock_acquire() {
  local release_root="$1"
  install -d -m 0700 "$release_root"
  STAGE5_MUTATION_LOCK_DIR="$release_root/.mutation.lock"
  if ! mkdir -m 0700 "$STAGE5_MUTATION_LOCK_DIR" 2>/dev/null; then
    STAGE5_MUTATION_LOCK_DIR=""
    fail "preproduction mutation lock is already held"
  fi
  printf '%s\n' "$$" >"$STAGE5_MUTATION_LOCK_DIR/owner"
  trap stage5_process_cleanup EXIT
}
