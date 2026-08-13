# Stage 9 Observability, Disaster Recovery, and Continuity Design

## Scope and authority

This design implements only enterprise go-live Stage 9 against the frozen Backend, Frontend, and Web runtime repositories. The Stage 9 ticket and execution ledger are authoritative. Frontend has no new contract and remains unchanged unless a failing cross-repository contract proves otherwise. Real Alibaba Cloud alert delivery, RDS/OSS recovery, and regional failover remain `BLOCKED_EXTERNAL(EXT-005)`; Stage 8 external sign-off remains independently blocked by `EXT-008`.

## Architecture

### Correlated observability

The TLS gateway owns the external correlation identifier. It writes the same safe generated value to its structured `request_id` and `trace_id` log fields and forwards it as both `X-Trace-Id` and `X-Request-Id`. Backend accepts a safe `X-Trace-Id` first, falls back to a safe `X-Request-Id`, otherwise generates a UUID, exposes the resolved `X-Trace-Id`, and scopes it in MDC. Invalid client values never enter logs or responses.

Backend exposes Prometheus metrics only on the existing private application/monitoring networks. Spring HTTP/JVM/system/disk/Hikari metrics are supplemented by bounded application metrics for import queue activity, report generation, and durable business-event delivery. Metrics contain counts, status, duration, and age only; they never contain subjects, filenames, object keys, request bodies, business values, or secrets.

### SLO, alerts, and synthetic probes

Prometheus recording and alert rules derive thresholds from the approved Stage 7 profile: API p95 800 ms, error rate 0.1%, CPU 70%, memory 75%, pool utilization 70%, backlog 60 seconds, RPO 15 minutes, and RTO 120 minutes. Rules cover availability, errors, latency, traffic absence/spikes, host/JVM resources, Hikari saturation, disk, import queue/failures, reports, event backlog, certificate expiry, secret/key readiness, backup age, and capacity. Every alert has severity and a Stage 9 runbook reference. Blackbox probes retain health coverage and add a bounded authenticated-read-shaped endpoint only where no credentials are needed. Configuration tests verify coverage and fail closed on missing metrics or stale backup evidence. Online notification delivery is not claimed locally.

### Local PostgreSQL and object recovery

One operator command creates a unique `mktemp` workspace, initializes PostgreSQL 17 with checksums, enables continuous WAL archiving to a private local directory, applies the real Backend Flyway migrations, and seeds an external evidence-photo metadata row plus its immutable object version. It takes a streamed `pg_basebackup`, validates the manifest with `pg_verifybackup`, records a target restore point, commits a target transaction, archives its WAL, then commits a later mutation that must be absent after recovery.

The operator restores a separate PostgreSQL data directory to the named target, promotes it, and verifies migration state, target transaction presence, later mutation absence, photo metadata, object version time, byte length, SHA-256, and replica digest. Measured RPO must be at most 15 minutes and RTO at most 120 minutes. Missing/tampered backup data, missing WAL, invalid targets, object overwrite, digest drift, missing replica, active retention, and legal hold fail closed. Cleanup is limited to the unique current workspace and always stops only PIDs owned by that workspace.

The local object store is an evidence fixture, not an OSS emulator: immutable versions and manifests are written to a primary directory, copied and re-hashed in a replica directory, and lifecycle evaluation only reports eligible versions. It never deletes evidence. This proves the application recovery contract locally while leaving real OSS versioning, lifecycle, and replication under `EXT-005`.

### Continuity operation and evidence

Runbooks cover application failure, message backlog, database/photo recovery, manual degraded operation and reconciliation, on-call escalation, rollback, and security events. Each defines detection, authority, stop/escalation conditions, safe commands, verification, and rollback. The local drill is executable by an operator from the checked-in CLI without source edits or developer tools beyond the listed native runtimes.

The run emits one canonical JSON record and deterministic human summaries. Verification recomputes hashes, thresholds, scenario outcomes, Git bindings, and external boundaries from the canonical record. Evidence publication uses a unique target and rejects replacement. A local success is labeled `LOCAL_EVIDENCE_READY + BLOCKED_EXTERNAL(EXT-005)`, never production ready.

## Repository boundary

- Backend: correlation fallback, private Prometheus exposure, stable application metrics, tests.
- Web: gateway propagation/log field, Prometheus/Alertmanager/blackbox rules, local backup/object/recovery/operator tooling, runbooks, evidence, tests.
- Frontend: no planned change.

## Verification

Implementation follows red-green tests. First run focused Backend trace/metrics tests and Web Stage 9 contract/unit tests. Then run the real isolated PostgreSQL restore once, verify its evidence independently, and run proportional affected-repository gates. Existing clean Stage 8 full gates are baseline evidence and are not repeated unless new failures point beyond the affected boundary.
