# Application Failure

## Detection

Confirm `Stage9EndpointUnavailable` or a failed loopback health probe. Record the
alert start time, target, trace identifier, and last known deployment revision;
do not record request bodies or credentials.

## Authority

The duty operator may inspect, isolate, and restart the approved application
revision. A rollback, data mutation, or production traffic change requires the
incident commander.

## Steps

Verify `/actuator/health`, correlate gateway and Backend structured logs by
`trace_id`, and inspect error rate, latency, CPU, memory, disk, and pool metrics.
In the local drill, allow the owned runner to stop and restart only its loopback
Backend process. Stop if the failure is not confined to that process.

## Verification

Health must return success, the original alert condition must clear, a new probe
must carry one matching request/trace identifier, and no database recovery may
be required unexpectedly.

## Escalation

Escalate immediately for suspected data loss, security impact, repeated restart
failure, or unavailable dependencies. Keep the external delivery claim blocked
until EXT-005 supplies an online receipt.

## Rollback

Restore only the last approved application revision through the separate
rollback runbook. Never rewrite Git history or alter database state to hide an
application failure.

## Evidence

Retain alert state, bounded health responses, revision identifiers, metric
snapshots, matching trace identifiers, actions, timestamps, and final outcome.
