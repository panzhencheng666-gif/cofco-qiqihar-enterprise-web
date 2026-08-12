#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
source "$SCRIPT_DIR/common.sh"

config_path="${1:-$PACKAGE_ROOT/config/preproduction.env}"
evidence_dir="${2:-$OPERATION_RUNTIME_ROOT/verification-evidence}"
verification_scope="${3:-full}"
compose_file="$PACKAGE_ROOT/compose.yaml"
case "$verification_scope" in
  full|runtime-only) ;;
  *) fail "verification scope must be full or runtime-only" ;;
esac

require_shell_invariants "$config_path"
for command_name in curl docker jq openssl; do
  require_command "$command_name"
done
install -d -m 0700 "$evidence_dir"

domain="$(read_config "$config_path" COFCO_PREPROD_TLS_DOMAIN)"
https_endpoint_ip="$(read_config "$config_path" COFCO_PREPROD_HTTPS_ENDPOINT_IP)"
oidc_authorization_endpoint="$(read_config "$config_path" COFCO_PREPROD_OIDC_AUTHORIZATION_ENDPOINT)"
oidc_client_id="$(read_config "$config_path" COFCO_PREPROD_OIDC_CLIENT_ID)"
oidc_redirect_uri="$(read_config "$config_path" COFCO_PREPROD_OIDC_REDIRECT_URI)"
runtime_secrets_dir="${COFCO_PREPROD_RUNTIME_SECRETS_DIR:?runtime secrets directory required}"
export COFCO_PREPROD_RUNTIME_SECRETS_DIR="$runtime_secrets_dir"

headers_file="$evidence_dir/.headers.$$"
certificate_file="$evidence_dir/.certificate.$$"
dns_file="$evidence_dir/.dns.$$"
trap 'rm -f "$headers_file" "$certificate_file" "$dns_file"' EXIT

if test "$verification_scope" = "full"; then
  "$SCRIPT_DIR/verify-cloud-boundaries.sh" "$config_path" "$evidence_dir"
fi

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

spoofed_host_status="$(curl "${curl_endpoint[@]}" --silent --output /dev/null --write-out '%{http_code}' \
  --header 'Host: unapproved.invalid' "https://$domain/healthz" || true)"
test "$spoofed_host_status" = "421" || fail "SNI-correct request with an unapproved Host did not fail closed (expected 421)"

login_deadline=$((SECONDS + 120))
login_status=""
login_location=""
while test "$SECONDS" -lt "$login_deadline"; do
  login_status="$(curl "${curl_endpoint[@]}" --silent --show-error --output /dev/null \
    --dump-header "$headers_file" --write-out '%{http_code}' "https://$domain/api/v1/session/login" || true)"
  login_location="$(awk 'tolower($1) == "location:" {sub(/^[^:]*:[[:space:]]*/, ""); sub(/\r$/, ""); print; exit}' "$headers_file")"
  if test "$login_status" = "302" \
    && node "$RUNTIME_VALIDATOR" oidc-redirect \
      "$login_location" "$oidc_authorization_endpoint" "$oidc_client_id" "$oidc_redirect_uri"; then
    break
  fi
  sleep 3
done
test "$login_status" = "302" || fail "OIDC login did not return the expected 302 status"
node "$RUNTIME_VALIDATOR" oidc-redirect \
  "$login_location" "$oidc_authorization_endpoint" "$oidc_client_id" "$oidc_redirect_uri" \
  || fail "OIDC login Location did not match the approved OIDC authorization endpoint"
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
        | jq -e '.status == "success" and (.data.result | length) >= 3 and all(.data.result[]; .value[1] == "1")' >/dev/null; then
      return
    fi
    sleep 3
  done
  fail "one or more internal monitoring probes are not healthy"
}
wait_for_prometheus

evidence_file="$evidence_dir/verification-$verification_scope-$(date -u +%Y%m%dT%H%M%SZ).json"
jq -n \
  --arg environment preproduction \
  --arg release "$(read_config "$config_path" COFCO_PREPROD_RELEASE_ID)" \
  --arg scope "$verification_scope" \
  --arg verified_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '({environment:$environment,releaseId:$release,scope:$scope,tls:"PASS",gateway:"PASS",monitoring:"PASS",verifiedAt:$verified_at})
   + (if $scope == "full" then {rdsPrivateEndpoint:"PASS",securityGroup:"PASS"} else {} end)' >"$evidence_file"
chmod 0600 "$evidence_file"
if test "$verification_scope" = "full"; then
  printf 'PREPRODUCTION_VERIFIED evidence=%s\n' "$evidence_file"
else
  printf 'PREPRODUCTION_RUNTIME_RESTORED evidence=%s\n' "$evidence_file"
fi
