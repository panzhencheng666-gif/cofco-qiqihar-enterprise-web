# Rollback

## Detection

Consider rollback after a verified regression in the current approved revision,
not for an unexplained infrastructure, database, or security failure.

## Authority

The incident commander authorizes rollback. The duty operator may prepare and
verify the last approved immutable artifact but may not force-push, rewrite
history, or change a release tag.

## Steps

Identify the current and last approved revisions and artifact digests. Confirm
database compatibility and outstanding migrations, then use the existing
transactional rollback entry point for the authorized environment. The local
Stage 9 drill records the decision boundary without contacting a cloud target.

## Verification

Verify artifact digest, health, trace propagation, error rate, latency, queue,
pool, and database migration state. Observe through the agreed window before
declaring stability.

## Escalation

Stop for irreversible migrations, unknown artifact provenance, failed health,
continued SLO breach, or any data mismatch. Move to the database/photo recovery
runbook only with separate authorization.

## Rollback

Rollback of the rollback is a new deployment decision using an approved
artifact; it is never a Git history rewrite or ad hoc database reversal.

## Evidence

Retain authorization, before/after revisions and digests, compatibility check,
command receipt, health/metric results, observation window, and outcome.
