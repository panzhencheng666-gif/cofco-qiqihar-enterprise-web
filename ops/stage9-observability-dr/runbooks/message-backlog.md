# Message Backlog

## Detection

Confirm `Stage9EventBacklogStale`, `Stage9ImportQueueStalled`, or the related
missing-metric alert. Check pending count, oldest age, import activity, error
rate, and database pool pressure without inspecting payloads.

## Authority

The duty operator may pause new non-critical imports and collect diagnostics.
Replay, discard, or direct database edits require the incident commander and
the business data owner.

## Steps

Separate producer, consumer, database, and downstream failures using bounded
metrics. Preserve queue order and idempotency keys. For the local scenario,
record an injected oldest age greater than 60 seconds, then record zero after
the simulated consumer recovery.

## Verification

Pending and oldest-age metrics must trend down, failed imports must stop rising,
the database pool must return below saturation, and a sample item must complete
once without duplication.

## Escalation

Escalate for age above the approved SLO, uncertain ordering, duplicate effects,
or any request to delete backlog. Notify the business owner before extending a
manual degradation window.

## Rollback

Remove only the approved pause and restore normal admission gradually. Do not
purge messages or reset offsets as a rollback.

## Evidence

Retain the time series, bounded counts and ages, pause/resume authorization,
sample idempotency result, reconciliation status, and alert clear time.
