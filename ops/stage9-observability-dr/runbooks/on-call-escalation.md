# On-Call Escalation

## Detection

Escalate every critical alert immediately and every warning that persists beyond
its rule duration. Treat a missing required metric or stale backup as an
incident, not as healthy silence.

## Authority

The duty operator declares the local incident and contacts the incident
commander. Only named external owners may acknowledge real cloud or delivery
receipts once EXT-005 is satisfied.

## Steps

Record start time, severity, affected service, safe trace identifier, current
revision, SLO impact, and external blockers. Page the primary duty role, then the
incident commander if acknowledgement is absent. Keep sensitive receiver URLs
and credentials out of evidence.

## Verification

Confirm ownership, incident identifier, next update time, and a resolved receipt
for the local routing fixture. Do not claim online delivery from configuration
rendering or a local route test.

## Escalation

Escalate immediately for data loss, security indicators, failed recovery,
RPO/RTO risk, or multiple simultaneous critical signals. Follow the security
runbook when confidentiality or integrity may be affected.

## Rollback

If an escalation was misclassified, downgrade only with incident commander
approval; retain the original event and rationale. Do not silence the source
alert to close an incident.

## Evidence

Retain alert labels, route decision, notification state, ownership and response
times, decisions, SLO impact, resolution, and honest external status.
