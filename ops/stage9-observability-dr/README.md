# Stage 9 Local Operator Boundary

This directory is the operator entry point for the local observability, recovery,
and continuity drill. It does not contact Alibaba Cloud, SSH targets, RDS, OSS,
KMS, or an online notification receiver. Those checks remain
`BLOCKED_EXTERNAL(EXT-005)`.

## Prerequisites

- Node.js 24 and npm 11 from the repository runtime.
- One complete native PostgreSQL 17 toolchain containing `initdb`, `postgres`,
  `pg_ctl`, `psql`, `createdb`, `pg_basebackup`, `pg_verifybackup`,
  `pg_controldata`, and `pg_waldump` in the same `bin` directory.
- JDK 21 and Maven 3.9.
- Clean Backend and Web tracked worktrees at their checked-in commits.
- Free loopback ports and enough local capacity for two temporary database
  clusters, one streamed base backup, WAL, and object replicas.

## Operator command

From the Web repository, choose a new evidence directory and run:

```sh
npm run stage9:continuity:local -- --output evidence/stage9-local-YYYYMMDDTHHMMSSZ
npm run stage9:evidence:verify -- evidence/stage9-local-YYYYMMDDTHHMMSSZ
```

The runner binds only to `127.0.0.1`, generates a unique
`cofco-stage9-dr-*` workspace under the operating-system temporary directory,
and removes only that owned workspace after stopping its owned processes. It
rejects dirty tracked worktrees and existing evidence targets. Do not manually
delete a workspace while the command is active.

## Success boundary

A valid bundle reports `LOCAL_EVIDENCE_READY`, RPO at most 900 seconds, RTO at
most 7200 seconds, seven passing operator scenarios, and
`BLOCKED_EXTERNAL(EXT-005)`. It is input to independent supervision, not a
production-readiness approval.
