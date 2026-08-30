#!/usr/bin/env bash
set -euo pipefail

remote_base="$1"
remote_staging="$2"
release_id="$3"
expected_config_sha="$4"
expected_runtime_sha="$5"
expected_network_sha="$6"
expected_release_manifest_sha="$7"
expected_manifest_core_sha="$8"
expected_candidate_manifest_file_sha="$9"
shift 9
test "${1:-}" = "--" || {
  printf 'ERROR: bundle activation requires a bounded command\n' >&2
  exit 64
}
shift
test "$#" -gt 0 || {
  printf 'ERROR: bundle activation command is missing\n' >&2
  exit 64
}
case "$release_id" in
  *[!A-Za-z0-9._-]*|'')
    printf 'ERROR: invalid release ID for bundle activation\n' >&2
    exit 64
    ;;
esac

invocation_directory="$PWD"
case "$remote_base" in
  /*) ;;
  *) remote_base="$invocation_directory/$remote_base" ;;
esac
case "$remote_staging" in
  /*) ;;
  *) remote_staging="$invocation_directory/$remote_staging" ;;
esac

remote_bundle="$remote_base/bundle"
remote_bundles="$remote_base/bundles"
remote_release_bundle="$remote_bundles/$release_id"
remote_staging_package="$remote_staging/ops/alicloud-preproduction"
remote_release_package="$remote_release_bundle/ops/alicloud-preproduction"
case "$remote_staging" in
  "$remote_base"/bundle-staging-*) ;;
  *)
    printf 'ERROR: unsafe remote bundle staging path\n' >&2
    exit 64
    ;;
esac
staging_owned=true
cleanup_unactivated_staging() {
  local original_status="$?"
  trap - EXIT
  if test "$staging_owned" = "true" && test -d "$remote_staging"; then
    rm -r -- "$remote_staging" || true
  fi
  exit "$original_status"
}
trap cleanup_unactivated_staging EXIT
atomic_rename() {
  node -e 'require("node:fs").renameSync(process.argv[1], process.argv[2])' \
    "$1" "$2"
}
cd "$remote_staging_package"
source ./scripts/common.sh
test "$(sha256_file "$CONFIG_VALIDATOR")" = "$expected_config_sha"
test "$(sha256_file "$RUNTIME_VALIDATOR")" = "$expected_runtime_sha"
test "$(sha256_file "$NETWORK_VALIDATOR")" = "$expected_network_sha"
test "$(sha256_file "$RELEASE_MANIFEST_VALIDATOR")" = "$expected_release_manifest_sha"
test "$(sha256_file "$WEB_ROOT/scripts/release-manifest.mjs")" = "$expected_manifest_core_sha"
chmod 0600 ./config/preproduction.env
test "$(sha256_file ./config/.cofco-release-manifest.json)" = "$expected_candidate_manifest_file_sha" \
  || fail "transferred release manifest does not match the approved candidate file"
require_candidate_release_manifest \
  ./config/preproduction.env ./config/.cofco-release-manifest.json
forbidden_asset="$(find "$remote_staging" \
  \( -name .runtime -o -name .terraform -o -name '*.tfstate' -o -name '*.tfstate.*' -o -name '*.tfplan' \) \
  -print -quit)"
test -z "$forbidden_asset" \
  || fail "forbidden bundle runtime asset survived fresh extraction"

install -d -m 0700 "$remote_base" "$remote_bundles"
bundle_lock="$remote_base/.bundle.lock"
mkdir -m 0700 "$bundle_lock" 2>/dev/null \
  || fail "remote bundle replacement lock is already held"
previous_link=""
retired_bundle=""
next_link="$remote_base/.bundle-next-$$"
activation_complete=false
cleanup_bundle_activation() {
  local original_status="$?"
  trap - EXIT
  rm -f "$next_link"
  if test "$staging_owned" = "true" && test -d "$remote_staging"; then
    rm -r -- "$remote_staging" || true
  fi
  if test "$activation_complete" != "true"; then
    if test -n "$previous_link"; then
      rollback_link="$remote_base/.bundle-rollback-$$"
      ln -s "$previous_link" "$rollback_link"
      atomic_rename "$rollback_link" "$remote_bundle" || true
    elif test -n "$retired_bundle" && test -d "$retired_bundle"; then
      rm -f "$remote_bundle"
      atomic_rename "$retired_bundle" "$remote_bundle" || true
    else
      rm -f "$remote_bundle"
    fi
    if test -d "$remote_release_bundle"; then
      rm -r -- "$remote_release_bundle" || true
    fi
  fi
  rmdir "$bundle_lock" 2>/dev/null || true
  exit "$original_status"
}
trap cleanup_bundle_activation EXIT

test ! -e "$remote_release_bundle" \
  || fail "immutable remote release bundle already exists"
if test -L "$remote_bundle"; then
  previous_link="$(readlink "$remote_bundle")"
elif test -d "$remote_bundle"; then
  retired_bundle="$remote_base/.bundle-retired-$$"
  atomic_rename "$remote_bundle" "$retired_bundle"
elif test -e "$remote_bundle"; then
  fail "fixed remote bundle has an unsupported file type"
fi
atomic_rename "$remote_staging" "$remote_release_bundle"
staging_owned=false
ln -s "bundles/$release_id" "$next_link"
atomic_rename "$next_link" "$remote_bundle"

set +e
(
  cd "$remote_release_package"
  "$@"
)
command_status=$?
set -e
if test "$command_status" -ne 0; then
  exit "$command_status"
fi
activation_complete=true
if test -n "$retired_bundle" && test -d "$retired_bundle"; then
  rm -r -- "$retired_bundle"
fi
