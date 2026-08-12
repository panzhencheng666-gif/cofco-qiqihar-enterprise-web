#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
source "$SCRIPT_DIR/common.sh"

config_path="${1:-$PACKAGE_ROOT/config/preproduction.env}"
default_runtime_root="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
output_dir="${2:-$default_runtime_root/cofco-preproduction/secrets}"

require_secret_materialization_approval
require_shell_invariants "$config_path"
for command_name in aliyun jq openssl; do
  require_command "$command_name"
done

case "$output_dir" in
  "$default_runtime_root"/cofco-preproduction/secrets|/run/cofco-preproduction/secrets) ;;
  *) test "${COFCO_PREPROD_TEST_MODE:-}" = "true" || fail "secret output must be in the approved runtime directory" ;;
esac

install -d -m 0700 "$output_dir"
response_file="$output_dir/.kms-response.$$"
value_file="$output_dir/.kms-value.$$"
trap 'rm -f "$response_file" "$value_file"' EXIT

region="$(read_config "$config_path" COFCO_PREPROD_REGION)"
kms_endpoint="$(read_config "$config_path" COFCO_PREPROD_KMS_ENDPOINT)"

fetch_secret() {
  local reference="$1"
  local output_name="$2"
  local extraction="$3"
  local destination="$output_dir/$output_name"

  aliyun kms GetSecretValue \
    --RegionId "$region" \
    --SecretName "$reference" \
    --VersionStage ACSCurrent \
    --endpoint "$kms_endpoint" >"$response_file"

  test "$(jq -er '.SecretDataType' "$response_file")" = "text" || fail "KMS secret must use text data"
  if test "$extraction" = "rds-password"; then
    jq -erj '.SecretData | fromjson | .AccountPassword' "$response_file" >"$value_file"
  else
    jq -erj '.SecretData' "$response_file" >"$value_file"
  fi
  test -s "$value_file" || fail "KMS returned an empty secret"
  install -m 0600 "$value_file" "$destination"
}

fetch_secret "$(read_config "$config_path" COFCO_PREPROD_RDS_CA_SECRET_REF)" rds-ca.pem raw
fetch_secret "$(read_config "$config_path" COFCO_PREPROD_DB_SECRET_REF)" spring.datasource.password rds-password
fetch_secret "$(read_config "$config_path" COFCO_PREPROD_OIDC_CLIENT_SECRET_REF)" qiqihar.security.oidc.client-secret raw
fetch_secret "$(read_config "$config_path" COFCO_PREPROD_TLS_CERT_SECRET_REF)" tls.crt raw
fetch_secret "$(read_config "$config_path" COFCO_PREPROD_TLS_KEY_SECRET_REF)" tls.key raw
fetch_secret "$(read_config "$config_path" COFCO_PREPROD_ALERT_TARGET_SECRET_REF)" alert-target raw

openssl x509 -in "$output_dir/rds-ca.pem" -noout -checkend 86400 >/dev/null
openssl x509 -in "$output_dir/tls.crt" -noout -checkend 86400 >/dev/null
openssl pkey -in "$output_dir/tls.key" -noout -check >/dev/null
cert_key_digest="$(openssl x509 -in "$output_dir/tls.crt" -pubkey -noout | openssl pkey -pubin -outform DER 2>/dev/null | openssl dgst -sha256)"
private_key_digest="$(openssl pkey -in "$output_dir/tls.key" -pubout -outform DER 2>/dev/null | openssl dgst -sha256)"
test "$cert_key_digest" = "$private_key_digest" || fail "TLS certificate and private key do not match"
grep -Eq '^https://[^[:space:]]+$' "$output_dir/alert-target" || fail "alert target must be an HTTPS URL"

printf 'SECRETS_READY files=6 directory_mode=0700 file_mode=0600\n'
