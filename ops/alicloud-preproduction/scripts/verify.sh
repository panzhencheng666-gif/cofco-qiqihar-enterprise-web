#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
source "$SCRIPT_DIR/common.sh"

config_path="${1:-$PACKAGE_ROOT/config/preproduction.env}"
evidence_dir="${2:-$PACKAGE_ROOT/.runtime/verification-evidence}"
compose_file="$PACKAGE_ROOT/compose.yaml"

require_shell_invariants "$config_path"
for command_name in curl docker jq openssl; do
  require_command "$command_name"
done
install -d -m 0700 "$evidence_dir"

domain="$(read_config "$config_path" COFCO_PREPROD_TLS_DOMAIN)"
https_endpoint_ip="$(read_config "$config_path" COFCO_PREPROD_HTTPS_ENDPOINT_IP)"
runtime_secrets_dir="${COFCO_PREPROD_RUNTIME_SECRETS_DIR:?runtime secrets directory required}"
export COFCO_PREPROD_RUNTIME_SECRETS_DIR="$runtime_secrets_dir"

headers_file="$evidence_dir/.headers.$$"
certificate_file="$evidence_dir/.certificate.$$"
dns_file="$evidence_dir/.dns.$$"
trap 'rm -f "$headers_file" "$certificate_file" "$dns_file"' EXIT

"$SCRIPT_DIR/verify-cloud-boundaries.sh" "$config_path" "$evidence_dir"

node -e 'require("node:dns").promises.resolve4(process.argv[1]).then((addresses) => process.stdout.write(JSON.stringify(addresses))).catch(() => process.exit(1))' "$domain" >"$dns_file"
jq -e --arg endpoint "$https_endpoint_ip" 'index($endpoint) != null' "$dns_file" >/dev/null || fail "DNS A records do not include the approved ECS HTTPS endpoint"

openssl s_client \
  -connect "$https_endpoint_ip:443" \
  -servername "$domain" \
  -verify_hostname "$domain" \
  -verify_return_error </dev/null 2>/dev/null >"$certificate_file"
openssl x509 -in "$certificate_file" -noout -checkhost "$domain" -checkend 86400 >/dev/null

curl_endpoint=(--resolve "$domain:443:$https_endpoint_ip")
wait_for_http_code() {
  local expected="$1"
  local path="$2"
  local label="$3"
  local deadline=$((SECONDS + 120))
  local status=""
  while test "$SECONDS" -lt "$deadline"; do
    status="$(curl "${curl_endpoint[@]}" --silent --output /dev/null --write-out '%{http_code}' "https://$domain$path" || true)"
    if test "$status" = "$expected"; then
      return
    fi
    sleep 3
  done
  fail "$label (expected $expected, last status ${status:-unreachable})"
}

wait_for_http_code 200 /healthz "gateway health check failed"
wait_for_http_code 404 /prototype.html "removed prototype entry is reachable"
wait_for_http_code 401 /api/v1/session/me "anonymous session endpoint did not fail closed"

login_deadline=$((SECONDS + 120))
until curl "${curl_endpoint[@]}" --silent --show-error --output /dev/null --dump-header "$headers_file" "https://$domain/api/v1/session/login" && grep -Eiq '^location: https://' "$headers_file"; do
  test "$SECONDS" -lt "$login_deadline" || fail "OIDC login did not return an HTTPS redirect"
  sleep 3
done
grep -Eiq '^location: https://' "$headers_file" || fail "OIDC login did not return an HTTPS redirect"
if grep -Eiq '(127\.0\.0\.1:8090|backend:8090)' "$headers_file"; then
  fail "OIDC redirect leaked an internal backend address"
fi

prometheus_id="$(docker compose --env-file "$config_path" -f "$compose_file" ps -q prometheus)"
prometheus_ip="$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$prometheus_id")"
wait_for_prometheus() {
  local deadline=$((SECONDS + 120))
  while test "$SECONDS" -lt "$deadline"; do
    if curl --silent --fail "http://$prometheus_ip:9090/-/ready" >/dev/null \
      && curl --silent --fail --get --data-urlencode 'query=probe_success' "http://$prometheus_ip:9090/api/v1/query" \
        | jq -e '.status == "success" and (.data.result | length) >= 3 and all(.[]; .value[1] == "1")' >/dev/null; then
      return
    fi
    sleep 3
  done
  fail "one or more internal monitoring probes are not healthy"
}
wait_for_prometheus

evidence_file="$evidence_dir/verification-$(date -u +%Y%m%dT%H%M%SZ).json"
jq -n \
  --arg environment preproduction \
  --arg release "$(read_config "$config_path" COFCO_PREPROD_RELEASE_ID)" \
  --arg verified_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{environment:$environment,releaseId:$release,tls:"PASS",gateway:"PASS",rdsPrivateEndpoint:"PASS",securityGroup:"PASS",monitoring:"PASS",verifiedAt:$verified_at}' >"$evidence_file"
chmod 0600 "$evidence_file"
printf 'PREPRODUCTION_VERIFIED evidence=%s\n' "$evidence_file"
