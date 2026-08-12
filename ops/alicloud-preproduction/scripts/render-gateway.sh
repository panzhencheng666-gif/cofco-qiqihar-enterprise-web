#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
source "$SCRIPT_DIR/common.sh"

config_path="${1:-$PACKAGE_ROOT/config/preproduction.env}"
output_path="${2:-$PACKAGE_ROOT/.runtime/gateway/nginx.conf}"
template_path="$PACKAGE_ROOT/gateway/nginx.conf"

require_shell_invariants "$config_path"
domain="$(read_config "$config_path" COFCO_PREPROD_TLS_DOMAIN)"
install -d -m 0700 "$(dirname "$output_path")"
node "$RUNTIME_VALIDATOR" render-gateway "$template_path" "$output_path" "$domain"
chmod 0600 "$output_path"
grep -Fq "server_name $domain;" "$output_path" || fail "rendered gateway is not bound to the approved TLS domain"
test "$(grep -Foc "$domain" "$output_path")" -ge 3 || fail "rendered gateway did not bind every forwarded Host to the approved TLS domain"
printf 'GATEWAY_RENDERED sha256=%s\n' "$(sha256_file "$output_path")"
