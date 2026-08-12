#!/usr/bin/env bash

STAGE5_INVOCATION_TRANSACTION_DIR=""
STAGE5_INVOCATION_RUNTIME_ROOT=""
STAGE5_INVOCATION_SECRETS_DIR=""
STAGE5_INVOCATION_CONFIG=""
STAGE5_INVOCATION_GATEWAY=""
STAGE5_INVOCATION_COMPOSE_FILE=""
STAGE5_INVOCATION_EVIDENCE_DIR=""
STAGE5_INVOCATION_SECRETS_MUTATED=false
STAGE5_INVOCATION_SERVICES_MUTATED=false

stage5_invocation_state_configure() {
  STAGE5_INVOCATION_TRANSACTION_DIR="$1"
  STAGE5_INVOCATION_RUNTIME_ROOT="$2"
  STAGE5_INVOCATION_SECRETS_DIR="$3"
  STAGE5_INVOCATION_CONFIG="$4"
  STAGE5_INVOCATION_GATEWAY="$5"
  STAGE5_INVOCATION_COMPOSE_FILE="$6"
  STAGE5_INVOCATION_EVIDENCE_DIR="$7"
}

stage5_invocation_state_snapshot() {
  local secrets_snapshot="$STAGE5_INVOCATION_TRANSACTION_DIR/runtime-secrets.tar"
  local secrets_present="$STAGE5_INVOCATION_TRANSACTION_DIR/runtime-secrets.present"
  local services_snapshot="$STAGE5_INVOCATION_TRANSACTION_DIR/running-services"

  if test -d "$STAGE5_INVOCATION_SECRETS_DIR"; then
    : >"$secrets_present"
    chmod 0600 "$secrets_present"
    tar -C "$STAGE5_INVOCATION_SECRETS_DIR" -cf "$secrets_snapshot" . \
      || return $?
    chmod 0600 "$secrets_snapshot" || return $?
  fi
  COFCO_PREPROD_GATEWAY_CONFIG="$STAGE5_INVOCATION_GATEWAY" \
    docker compose --env-file "$STAGE5_INVOCATION_CONFIG" \
      -f "$STAGE5_INVOCATION_COMPOSE_FILE" \
      ps --services --filter status=running >"$services_snapshot" \
    || return $?
  chmod 0600 "$services_snapshot" || return $?
  if grep -Ev '^(gateway|business-web|overview-web|backend|prometheus|blackbox|alertmanager)?$' "$services_snapshot" >/dev/null; then
    fail "running service snapshot contains an unknown Compose service"
  fi
}

stage5_invocation_state_mark_secrets_mutated() {
  STAGE5_INVOCATION_SECRETS_MUTATED=true
}

stage5_invocation_state_mark_services_mutated() {
  STAGE5_INVOCATION_SERVICES_MUTATED=true
}

stage5_invocation_state_clear_secrets() {
  stage5_invocation_state_mark_secrets_mutated
  case "$STAGE5_INVOCATION_SECRETS_DIR" in
    "$STAGE5_INVOCATION_RUNTIME_ROOT"/cofco-preproduction/secrets|/run/cofco-preproduction/secrets) ;;
    *) return 64 ;;
  esac
  if test -e "$STAGE5_INVOCATION_SECRETS_DIR"; then
    rm -r -- "$STAGE5_INVOCATION_SECRETS_DIR"
  fi
}

stage5_invocation_state_restore_secrets() {
  local secrets_snapshot="$STAGE5_INVOCATION_TRANSACTION_DIR/runtime-secrets.tar"
  local secrets_present="$STAGE5_INVOCATION_TRANSACTION_DIR/runtime-secrets.present"
  case "$STAGE5_INVOCATION_SECRETS_DIR" in
    "$STAGE5_INVOCATION_RUNTIME_ROOT"/cofco-preproduction/secrets|/run/cofco-preproduction/secrets) ;;
    *) return 64 ;;
  esac
  if test -f "$secrets_present"; then
    install -d -m 0700 "$STAGE5_INVOCATION_SECRETS_DIR" || return $?
    find "$STAGE5_INVOCATION_SECRETS_DIR" -mindepth 1 -maxdepth 1 \
      -exec rm -r -- {} + || return $?
    tar -C "$STAGE5_INVOCATION_SECRETS_DIR" -xf "$secrets_snapshot" \
      || return $?
  elif test -e "$STAGE5_INVOCATION_SECRETS_DIR"; then
    rm -r -- "$STAGE5_INVOCATION_SECRETS_DIR" || return $?
  fi
}

stage5_invocation_state_restore_services() {
  local restored_services="$STAGE5_INVOCATION_TRANSACTION_DIR/restored-services"
  local services_snapshot="$STAGE5_INVOCATION_TRANSACTION_DIR/running-services"
  local services
  export COFCO_PREPROD_GATEWAY_CONFIG="$STAGE5_INVOCATION_GATEWAY"
  docker compose --env-file "$STAGE5_INVOCATION_CONFIG" \
    -f "$STAGE5_INVOCATION_COMPOSE_FILE" stop || return $?
  if ! services="$(tr '\n' ' ' <"$services_snapshot")"; then
    return 1
  fi
  if test -n "${services//[[:space:]]/}"; then
    # Service names are constrained while captured, so intentional splitting is safe.
    # shellcheck disable=SC2086
    docker compose --env-file "$STAGE5_INVOCATION_CONFIG" \
      -f "$STAGE5_INVOCATION_COMPOSE_FILE" \
      up -d --remove-orphans --wait --wait-timeout 300 $services \
      || return $?
  fi
  docker compose --env-file "$STAGE5_INVOCATION_CONFIG" \
    -f "$STAGE5_INVOCATION_COMPOSE_FILE" \
    ps --services --filter status=running >"$restored_services" \
    || return $?
  cmp -s "$services_snapshot" "$restored_services" || return $?
  if test -n "${services//[[:space:]]/}"; then
    "$SCRIPT_DIR/verify.sh" \
      "$STAGE5_INVOCATION_CONFIG" "$STAGE5_INVOCATION_EVIDENCE_DIR" runtime-only \
      || return $?
  fi
}

stage5_invocation_state_compensate() {
  if test "$STAGE5_INVOCATION_SECRETS_MUTATED" = "true"; then
    stage5_compensate runtime-secrets stage5_invocation_state_restore_secrets
  fi
  if test "$STAGE5_INVOCATION_SECRETS_MUTATED" = "true" \
    || test "$STAGE5_INVOCATION_SERVICES_MUTATED" = "true"; then
    stage5_compensate running-services stage5_invocation_state_restore_services
  fi
}
