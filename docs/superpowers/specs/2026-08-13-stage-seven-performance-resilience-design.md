# Stage Seven Performance and Resilience Design

## Purpose and truth boundary

Stage 7A supplies the shortest defensible performance and resilience test for the frozen enterprise candidate. It covers short baseline, peak, burst, stress, capacity, import, concurrency-correctness, and component-failure scenarios. It does not run or claim the final 24-hour stability gate.

Every result has one of two provenance classes:

- `LOCAL_PROPORTIONAL_ONLY`: an isolated local PostgreSQL database, backend process, and private filesystem content store. It proves runner behavior, correctness assertions, failure recovery, and scaled-load feasibility only.
- `PREPRODUCTION_EQUIVALENT`: an admitted Alibaba Cloud preproduction topology whose exact candidate commits, HTTPS endpoint, RDS, private OSS, monitoring endpoints, service identity, and capacity inputs have been validated before load starts.

The runner exits `2` with `BLOCKED_EXTERNAL(EXT-005)` when the second class is requested without complete inputs. Local evidence can never be relabeled as preproduction-equivalent.

## Fixed requirements and thresholds

The authoritative design baseline is 1,000 registered employees, 300 peak concurrent employees, 5,000,000 business rows per year, 100 GB of new photos per month, 5,000 synchronous spreadsheet rows, and more than 5,000 rows through the asynchronous queue. Core read/save API p95 is at most 800 ms and page main content is at most 3,000 ms. Monthly availability, RPO, RTO, and the final 24-hour gate are recorded but not claimed by this short test.

Stage 7 adds explicit engineering guardrails where the product specification is silent: unexpected HTTP error rate at most 0.1%, successful write consistency at 100%, no duplicate business effect, no silent overwrite, short component recovery at most 120 seconds, CPU expansion review at 70%, memory expansion review at 75%, database connection expansion review at 70%, and oldest recoverable queue backlog at most 60 seconds after fault recovery. These are versioned Stage 7 engineering thresholds, not newly invented product SLOs.

## Private evidence content boundary

PostgreSQL remains the authority for photo metadata, authorization, attachment state, hash, and content locator. Existing `DATABASE` rows remain readable. A forward migration permits new `EXTERNAL` rows whose original and watermarked bytes are absent from PostgreSQL and whose generated private object key is present.

The application port stores one versioned binary envelope per photo. The envelope contains the original and watermarked payloads, media type, and SHA-256 integrity values. A single-object write avoids half-written original/watermarked pairs. The local adapter writes atomically beneath a configured private root. The Alibaba OSS adapter uses a private bucket and workload identity; it never creates or returns a public URL.

Upload writes the immutable content object before inserting the metadata row in the surrounding database transaction. A transaction synchronization deletes the exact generated key if the transaction rolls back. Store failure produces no metadata row, metadata failure triggers exact-key compensation, and content read failure returns a controlled service-unavailable contract without leaking locator, credentials, or bytes. Authorization is evaluated before the content store read.

## Load and failure runner

One checked-in JSON profile defines scale, workload mix, thresholds, scenario durations, resource watermarks, fault recovery, and evidence schema version. A pure Node module validates the profile, calculates percentiles and thresholds, rejects false provenance, and renders deterministic evidence. Unit tests are part of the normal `npm test` and `npm run verify` path.

The executable runner accepts `--mode local` or `--mode preproduction`. Local mode creates a uniquely named PostgreSQL database, builds and starts the frozen backend on a loopback port, uses a unique filesystem content root, loads governed test identities, runs proportionally scaled short scenarios, samples process and database resources, and cleans only its exact temporary namespace. Preproduction mode performs admission first and does not mutate infrastructure.

The scenario catalogue covers reads, saves, review transitions, synchronous 5,000-row import, asynchronous larger import with concurrent jobs, photo upload/read, map, analysis, supply-demand, reporting, duplicate clicks, client retry, concurrent editing, optimistic locking, session-expiry draft semantics, slow query, connection pressure, lock wait, deadlock victim recovery, long transaction, queue backlog, application restart, database interruption, event-stream reconnect with cursor, and private content-store interruption. Destructive cloud faults are not automated by this stage; their approved control commands are required inputs and remain blocked by EXT-005 until supplied.

Local evidence uses one exact 28-row order: `baseline`, `peak`, `burst`, `stress`, `capacity-300`, `capacity-375`, `capacity-450`, `capacity-525`, `page-main-content`, `sync-import-5000`, `async-import-5001-concurrent`, `duplicate-click-idempotency`, `client-retry-idempotency`, `concurrent-edit`, `optimistic-lock`, `no-silent-overwrite`, `no-duplicate-business-effect`, `session-expiry-draft-recovery`, `slow-query`, `connection-pool-pressure`, `lock-wait`, `deadlock-victim-recovery`, `long-transaction`, `queue-backlog-recovery`, `application-restart`, `database-interruption`, `event-publisher-reconnect-cursor`, and `private-content-store-interruption`. The verifier derives latency percentiles, throughput, error rate, write consistency, resource maxima, database-connection percentage, scenario decisions, and overall status from retained raw samples and counts; it rejects a reordered or coherently re-rendered aggregate model.

## Evidence and completion

Each run writes machine-readable `run.json` plus `SUMMARY.md`, `MATRIX.md`, `VERIFICATION.md`, and `HANDOFF.md`. A run records exact candidate commits, profile hash, provenance, start/end time, per-scenario counts, latency distribution, throughput, errors, resource trend, backlog recovery, consistency assertions, faults, and exclusions. Secrets, raw session state, database passwords, and object-store credentials are never written.

The evidence publisher atomically reserves the final directory with no replacement, refuses both empty and non-empty existing targets, and removes its exact reservation on interrupted writes so no partial package remains. Local Backend provenance is revalidated after build, before every start, and immediately before evidence publication or verification: the JAR and each repository-relative parent must be non-symlink real paths inside the real Backend root, and the verifier re-extracts the raw manifest to check its digest, full recorded fields, `Java-Version`, and `Build-Jdk-Spec` at JDK 21. Production-equivalent phase receipts use only the pinned Ed25519 `cofco-stage7-phase-receipt-v2` envelope; signed legacy v1 envelopes fail closed.

Local code is ready for independent supervision only after focused red/green tests, backend standard JDK 21 tests and package, Web standard tests/build/budget, a proportionally scaled isolated run, exact commits and ordinary pushes, clean three-repository status, and upstream 0/0. EXT-005 remains external until a real admitted preproduction run succeeds.
