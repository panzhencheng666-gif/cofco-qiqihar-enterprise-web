# Stage Seven Performance and Resilience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This execution is inline because the controlling task forbids subagents.

**Goal:** Build the local correctness/failure boundary and the production-equivalent admission/load/evidence tooling required for the Stage 7A short performance and resilience gate.

**Architecture:** Backend splits evidence metadata from a private content-store port while retaining legacy database reads. Web owns a versioned scenario profile, pure validation/statistics/evidence core, preproduction admission gate, and isolated local runner; provenance prevents local results from being reported as production-equivalent.

**Tech Stack:** Java 21, Spring Boot 4.1, PostgreSQL/Flyway, JUnit 5, Alibaba Cloud OSS Java SDK, Node.js 24, Node test runner, JSON/Markdown evidence.

## Global Constraints

- Stage 7A only; do not run the final 24-hour stability gate and do not enter Stage 8.
- Keep Backend `444fa6e`, Frontend `c8b5f443`, and Web `711d459` as the recorded frozen starting points.
- Use standard execution speed and do not reduce verification for speed.
- Never print credentials, session state, database passwords, or object-store secrets.
- A real preproduction request with missing EXT-005 inputs exits `2`; local results remain `LOCAL_PROPORTIONAL_ONLY`.
- Use uniquely named local databases/directories and clean only exact namespaces.
- New defects must be registered before their fix; DEF-104 and DEF-105 cover this plan.

---

### Task 1: Private content-store contract and migration

**Files:**

- Create: Backend `src/main/java/com/cofco/qiqihar/graintrade/evidence/application/EvidenceContentStore.java`
- Create: Backend `src/main/java/com/cofco/qiqihar/graintrade/evidence/application/EvidenceContentEnvelope.java`
- Create: Backend `src/main/resources/db/migration/V116__externalize_private_evidence_content.sql`
- Modify: Backend `src/main/java/com/cofco/qiqihar/graintrade/evidence/application/EvidencePhotoRepository.java`
- Modify: Backend `src/main/java/com/cofco/qiqihar/graintrade/evidence/infrastructure/JdbcEvidencePhotoRepository.java`
- Test: Backend `src/test/java/com/cofco/qiqihar/graintrade/evidence/application/EvidenceContentEnvelopeTest.java`

**Interfaces:**

- Produces: `EvidenceContentStore.put(String, byte[])`, `get(String)`, `delete(String)`; `EvidenceContentEnvelope.encode(...)` and `decode(...)`; repository rows carrying `DATABASE` or `EXTERNAL` storage and a private key.

- [ ] **Step 1: Write envelope and migration-contract tests that fail because the types and V116 do not exist.**
- [ ] **Step 2: Run the focused JDK 21 tests and retain the missing-symbol/migration red result.**
- [ ] **Step 3: Implement the immutable checksummed envelope, storage port, V116 compatibility constraints, and JDBC mapping.**
- [ ] **Step 4: Run focused envelope and Flyway migration tests; expect all green.**

### Task 2: Local private store, transaction compensation, and controlled failures

**Files:**

- Create: Backend `src/main/java/com/cofco/qiqihar/graintrade/evidence/infrastructure/FilesystemEvidenceContentStore.java`
- Create: Backend `src/main/java/com/cofco/qiqihar/graintrade/evidence/application/EvidenceContentUnavailableException.java`
- Modify: Backend `src/main/java/com/cofco/qiqihar/graintrade/evidence/application/EvidencePhotoService.java`
- Modify: Backend `src/main/java/com/cofco/qiqihar/graintrade/shared/interfaceadapter/GlobalExceptionHandler.java`
- Modify: Backend `src/main/resources/application.yml`
- Test: Backend `src/test/java/com/cofco/qiqihar/graintrade/evidence/infrastructure/FilesystemEvidenceContentStoreTest.java`
- Test: Backend `src/test/java/com/cofco/qiqihar/graintrade/evidence/interfaceadapter/EvidencePhotoExternalStorageIntegrationTest.java`

**Interfaces:**

- Consumes: Task 1 content store, envelope, and storage-aware repository.
- Produces: atomic filesystem writes, exact rollback compensation, external upload/read, legacy read, fail-closed 503 response, and authorization-before-store access.

- [ ] **Step 1: Write focused tests for path confinement, atomic round-trip, store-down upload, store-down read, unauthorized read without store access, and metadata rollback compensation.**
- [ ] **Step 2: Run focused tests and retain the missing-behavior red results.**
- [ ] **Step 3: Implement configuration-selected database/filesystem modes, transaction synchronization, content integrity validation, and sanitized 503 handling.**
- [ ] **Step 4: Run all evidence tests and migration tests; expect no orphan metadata/object and no permission regression.**

### Task 3: Alibaba OSS production adapter and preproduction inputs

**Files:**

- Create: Backend `src/main/java/com/cofco/qiqihar/graintrade/evidence/infrastructure/OssEvidenceContentStore.java`
- Modify: Backend `pom.xml`
- Modify: Backend `src/main/resources/application.yml`
- Modify: Web `ops/alicloud-preproduction/config/preproduction.env.example`
- Modify: Web `ops/alicloud-preproduction/compose.yaml`
- Modify: Web `ops/alicloud-preproduction/scripts/materialize-secrets.sh`
- Test: Backend `src/test/java/com/cofco/qiqihar/graintrade/evidence/infrastructure/OssEvidenceContentStoreTest.java`
- Test: Web `scripts/preproduction-assets.spec.mjs`

**Interfaces:**

- Consumes: Task 1 content-store port.
- Produces: private OSS operations using workload identity, configured endpoint/bucket/prefix/KMS key reference, and startup failure for incomplete OSS configuration.

- [ ] **Step 1: Write mock-client adapter tests and preproduction asset tests for private bucket inputs, no public URL, and no static access-key configuration.**
- [ ] **Step 2: Run focused Java and Node tests and retain their red results.**
- [ ] **Step 3: Implement the OSS adapter and pass only non-secret configuration plus runtime credential-provider selection.**
- [ ] **Step 4: Run focused tests; expect private put/get/delete and configuration validation green without contacting Alibaba Cloud.**

### Task 4: Stage 7 profile, statistics, provenance, and evidence core

**Files:**

- Create: Web `ops/stage7-performance-resilience/profile.json`
- Create: Web `scripts/stage-seven-core.mjs`
- Create: Web `scripts/stage-seven-core.spec.mjs`
- Create: Web `scripts/run-stage-seven.mjs`
- Modify: Web `package.json`

**Interfaces:**

- Produces: `validateProfile`, `percentile`, `evaluateScenario`, `admitRun`, and `renderEvidence`; CLI modes `local`, `preproduction`, and `render`.

- [ ] **Step 1: Write Node tests for exact authoritative scale, p95/error/resource thresholds, workload coverage, percentile math, failure evaluation, provenance rejection, and missing-cloud exit `2`.**
- [ ] **Step 2: Run the Stage 7 Node test entry and retain the missing-module red result.**
- [ ] **Step 3: Implement the minimal pure core, checked-in profile, CLI admission, and deterministic four-document renderer.**
- [ ] **Step 4: Run the Stage 7 tests through both the focused and standard `npm test` entry; expect green.**

### Task 5: Isolated local load, concurrency, and fault replay

**Files:**

- Create: Web `scripts/stage-seven-local-runtime.mjs`
- Create: Web `scripts/stage-seven-load.mjs`
- Create: Web `scripts/stage-seven-local-runtime.spec.mjs`
- Create: Web `ops/stage7-performance-resilience/README.md`
- Modify: Web `scripts/run-stage-seven.mjs`

**Interfaces:**

- Consumes: Task 4 profile/evaluation/evidence; frozen backend artifact and local PostgreSQL.
- Produces: unique local runtime, weighted HTTP load, resource samples, 5,000-row sync and 5,001-row concurrent async import probes, correctness assertions, and recoverable app/database/event/content-store fault results.

- [ ] **Step 1: Write tests for unique namespace validation, exact cleanup targets, workload scheduling, recovery deadlines, and secret-free evidence.**
- [ ] **Step 2: Run tests and retain the missing-runtime red result.**
- [ ] **Step 3: Implement the isolated lifecycle, workload engine, resource sampler, scenario assertions, and fault controller.**
- [ ] **Step 4: Run a proportionally scaled local short test and require `LOCAL_PROPORTIONAL_ONLY` evidence with every non-cloud scenario evaluated.**

### Task 6: Standard verification, evidence, and supervision handoff

**Files:**

- Create: authority evidence directory with `SUMMARY.md`, `MATRIX.md`, `VERIFICATION.md`, `HANDOFF.md`, and `run.json`
- Modify: the execution-order, external-condition, and defect/prevention authority ledgers

**Interfaces:**

- Consumes: all preceding green tests and local run evidence.
- Produces: exact commits, ordinary pushes, clean/upstream-aligned repositories, `PENDING_SUPERVISOR_REVIEW + BLOCKED_EXTERNAL(EXT-005)` handoff.

- [ ] **Step 1: Run focused Backend tests, JDK 21 full test/package, Web Stage 7 tests, standard `npm test`, build, budget, and proportional local replay.**
- [ ] **Step 2: Run `git diff --check`, inspect complete diffs, and record exact commands/results in four evidence documents.**
- [ ] **Step 3: Mark DEF-104/105 `REGRESSION_PENDING / PENDING_SUPERVISOR_REVIEW`, keep EXT-005 blocked, and explicitly exclude the 24-hour gate and Stage 8.**
- [ ] **Step 4: Create precise commits, ordinary-push the authorized branches, and confirm all three repositories clean with HEAD/upstream 0/0.**
- [ ] **Step 5: Re-read all four authority documents and hand only to independent supervision; do not claim unconditional PASS or completion.**
