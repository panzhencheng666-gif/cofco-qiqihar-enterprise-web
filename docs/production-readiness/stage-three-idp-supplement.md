# Stage 3C enterprise IdP supplement replay

This runner collects only the still-external Stage 3C identity evidence. It does
not provision an IdP, create employees, assign roles, implement login, or replace
Stage 4 identity acceptance.

## Approved inputs

Use `stage-three-idp-supplement.env.example` as the parameter manifest. The
enterprise identity owner provides two owner-only (`0600`) Playwright
storage-state files after logging in as two different real employees. The owner
also supplies a SHA-256 digest of each expected stable subject and the approved
role codes. The runner compares digests in memory and never records the raw
subject, display name, storage-state path, cookie, token, password, or secret.

The union of the two expected role lists must contain at least four role codes.
`STAGE3_IDP_CLIENT_SECRET` is deliberately unsupported: credentials remain in
the enterprise login flow and must never be placed in this parameter manifest.
The approved redirect must use the same origin as the application and the fixed
Spring OIDC callback path `/login/oauth2/code/enterprise`.

## Parameter gate

Run the non-network input check first:

```bash
npm run stage3:idp-supplement -- \
  --check-inputs-only \
  --evidence-dir /approved/evidence/path
```

Missing or invalid approved inputs produce
`idp-supplement-result.json` with `BLOCKED_EXTERNAL` and exit code `2`. A
complete two-employee/four-role set produces `READY_FOR_EXTERNAL_REPLAY`; this
is readiness to run, not a `PASS` result.

## Targeted replay

Run the same command without `--check-inputs-only`. The runner verifies both
real sessions and role sets, then writes `idp-invalidation-request.json`. The
enterprise identity owner performs the approved expiry or revocation out of
band and writes the configured confirmation file:

```json
{
  "runNonce": "copy-from-idp-invalidation-request.json",
  "approvalReference": "approved-change-or-test-reference",
  "confirmedAt": "2026-08-12T02:00:00+08:00"
}
```

The confirmation file must contain no credential, token, cookie, or employee
identifier. The runner hashes the approval reference in evidence, verifies the
target session is fail closed and the other employee remains authenticated,
and records every Chromium console error, page error, and failing HTTP response
without filtering. Identity/invalidation can pass independently, but any
browser error keeps the runner's overall status `FAIL` under the current strict
Stage 3 console wording.
