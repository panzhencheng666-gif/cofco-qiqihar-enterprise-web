# Manual Degradation And Reconciliation

## Detection

Use manual degradation only when an approved dependency is unavailable and the
normal transaction cannot complete safely. Identify the affected business
operation and start time without copying sensitive business values.

## Authority

The incident commander and business data owner jointly authorize entry and exit.
Operators may record opaque references but may not invent approvals or bypass
audit requirements.

## Steps

Pause the affected automated path, issue a unique reconciliation reference,
record actor/time/reason, and store the minimum offline action in the approved
worksheet. When service returns, replay in order through the normal validated
interface and mark each reference exactly once.

## Verification

The number of entries must equal the number reconciled, unreconciled must be
zero, duplicates must be zero, audit records must exist, and affected queue and
error alerts must clear before normal admission resumes.

## Escalation

Escalate on ambiguous ownership, conflicting values, missing audit, duplicates,
or a reconciliation window longer than the incident commander's approval.

## Rollback

If reconciliation validation fails, stop replay and retain the unresolved entry
for business review. Never delete the offline record or reverse a completed
business effect with an unaudited database edit.

## Evidence

Retain approval, opaque references, entry/reconciled/unreconciled counts, replay
timestamps, audit identifiers, validation results, and exit authorization.
