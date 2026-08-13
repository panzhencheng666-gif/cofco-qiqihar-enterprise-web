# Stage 9 Observability, Disaster Recovery, and Continuity Plan

## Completion boundary

Complete DEF-140 through DEF-144 locally; preserve `EXT-005` and `EXT-008`; produce one verified `LOCAL_EVIDENCE_READY` bundle; commit and normally push precise Backend/Web changes; leave all three runtime repositories clean with `HEAD=upstream` and 0/0. Stop before Stage 10.

## Tasks

1. Add failing Backend tests for `X-Request-Id` fallback, invalid header rejection, anonymous private-network Prometheus contract, and stable import/report/event metric names.
2. Add failing Web tests for gateway trace propagation, monitoring network reachability, full Stage 9 signal/alert/runbook coverage, and package command wiring.
3. Implement the smallest Backend correlation and Micrometer changes needed for those tests; run focused tests.
4. Implement gateway, scrape, SLO rules, alert routing, and synthetic probe changes; run Stage 5 adjacency plus Stage 9 tests.
5. Add failing unit tests for immutable local object versions, replica verification, lifecycle/hold decisions, backup manifest and WAL preconditions, PITR evidence invariants, and no-replace evidence publication.
6. Implement the Stage 9 core modules and operator CLI with exact temporary-directory ownership and cleanup.
7. Execute one real native PostgreSQL 17 source/base-backup/WAL/PITR/restore cycle using real Flyway migrations and external-photo metadata; verify database/object consistency, RPO, RTO, and negative target boundary.
8. Add and validate runbooks for application failure, backlog, recovery, degraded operation/reconciliation, on-call escalation, rollback, and security events; replay the operator-only drill without source edits.
9. Run proportional Backend and Web gates, verify Frontend remains unchanged, update the defect, execution, and external-condition ledgers, publish the structured handoff, commit/push, and verify three-repository clean 0/0 boundaries.

## Stop conditions

Stop and report rather than bypass if a security control rejects an action, the working-tree boundary changes unexpectedly, PostgreSQL tooling cannot provide real WAL/PITR evidence, a command would touch a non-isolated database, or real cloud/online delivery becomes necessary. Do not use Docker, SSH/SCP, KMS/RDS writes, real cloud APIs, destructive broad deletion, force, history rewriting, main, tags, or releases.
