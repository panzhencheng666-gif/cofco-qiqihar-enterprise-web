# Database And Photo Recovery

## Detection

Invoke recovery for verified database loss/corruption or an authorized drill.
Record the incident cutoff and the required evidence-photo object key; never
copy photo contents into logs.

## Authority

Only the recovery operator may run the local isolated command. Production RDS,
OSS, KMS, regional failover, or restore-to-service decisions require separate
external authorization and remain blocked by EXT-005.

## Steps

Run the command in `../README.md` from clean tracked worktrees. The runner must
use PostgreSQL 17 checksums, streamed `pg_basebackup`, SHA-256 manifest
verification, continuous WAL archive, a named PITR target, and immutable primary
and replica object versions. Never substitute Docker or a real cloud target.

## Verification

Require Flyway V116, the target transaction present, the later mutation absent,
database and object SHA-256/byte length equal, replica verified, selected object
version no later than the target, RPO at most 900 seconds, and RTO at most 7200
seconds. Independently run the evidence verifier.

## Escalation

Stop and escalate on missing WAL, manifest drift, checksum failure, target
overshoot, photo mismatch, missing replica, dirty source, or either objective
breach. Do not select a more convenient target after a failure.

## Rollback

The local drill never promotes into an existing service. Stop only the runner's
owned processes, preserve the emitted failure log outside the temporary cluster
when safe, and restart with a new unique workspace after correction.

## Evidence

Retain canonical `run.json`, deterministic summaries, Git and runtime bindings,
backup manifest and target WAL hashes, archive count, PITR assertions, object
version assertions, scenario results, and the external boundary.
