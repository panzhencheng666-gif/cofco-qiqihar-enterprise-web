# Security Event

## Detection

Treat unexpected authentication failures, secret/key readiness loss, audit gaps,
integrity mismatches, suspicious trace patterns, or unauthorized configuration
changes as security indicators. Do not include secret values in diagnostics.

## Authority

The duty operator may isolate the affected local process and preserve evidence.
Credential rotation, KMS/RDS/OSS changes, disclosure, and external containment
require the security incident commander and remain outside this local drill.

## Steps

Preserve timestamps, revisions, structured logs, audit references, metric state,
and file digests. Restrict access, separate affected and known-good evidence,
and verify integrity using the checked-in verifier. Never test credentials or
send data to an external target.

## Verification

Confirm evidence hashes, audit continuity, access restriction, known affected
scope, and that monitoring remains active. Recovery must use verified clean
artifacts and pass the normal health and consistency checks.

## Escalation

Escalate immediately for suspected secret exposure, unauthorized access, audit
tampering, data integrity loss, or an unknown blast radius. Stop the normal
recovery path until security command authorizes it.

## Rollback

Do not restore a potentially compromised revision. Revert only approved
configuration through the normal immutable artifact workflow after evidence is
preserved and the security commander approves.

## Evidence

Retain chain-of-custody timestamps, revision and artifact hashes, audit
references, non-secret indicators, containment decisions, verifier output, and
all escalation/clearance approvals.
