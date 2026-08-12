# Stage Seven Supervisor Rejection Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This execution remains inline because the controlling task forbids subagents.

**Goal:** Close the local implementation gaps DEF-122, DEF-123, and DEF-124 without claiming production-equivalent evidence or entering any later gate.

**Architecture:** Strengthen the pure Stage 7 admission/evidence core with typed, candidate-bound validation and a deterministic preproduction replay plan. Extend the local runtime boundary so its exact temporary namespace is always the final best-effort cleanup step, and replace the reused correctness result with six independent HTTP/database scenarios whose evidence has distinct records and semantics.

**Tech Stack:** Node.js 24, npm 11, Node test runner, PostgreSQL-backed local Stage 7 runner, Markdown/JSON evidence.

## Global Constraints

- Modify only the Web repository at `/Users/federal/Library/Application Support/COFCO Qiqihar Enterprise/runtime/cofco-qiqihar-enterprise-web`; Backend and Frontend remain read-only.
- Keep standard execution speed. Do not use subagents, cloud plan/apply, SSH/SCP, KMS/RDS writes, Docker daemon/images/containers, the final 24-hour gate, or Stage 8.
- Missing EXT-005 input through the checked-in blank template must produce exactly one `BLOCKED_EXTERNAL(EXT-005)` line and exit `2`.
- Positive preproduction verification is structural/orchestration-only in this task and must not connect to a target.
- Existing supervisor-preserved `cofco-stage7-*` directories are audit material and must not be removed.
- DEF-122 through DEF-124 end as `REGRESSION_PENDING / PENDING_SUPERVISOR_REVIEW`, never `CLOSED`.

---

### Task 1: Fail-closed admission, evidence, and replay entry

**Files:**

- Modify: `scripts/stage-seven-core.spec.mjs`
- Modify: `scripts/stage-seven-core.mjs`
- Modify: `scripts/run-stage-seven.mjs`
- Create: `scripts/stage-seven-preproduction-runtime.mjs`
- Create: `scripts/stage-seven-preproduction-runtime.spec.mjs`
- Modify: `ops/stage7-performance-resilience/preproduction-admission.json`
- Create: `ops/stage7-performance-resilience/README.md`
- Modify: `package.json`

**Interfaces:**

- `admitRun(request, expected)` accepts only a public HTTPS origin, exact current candidate commits, the current profile SHA-256, immutable artifact digests, approved preproduction topology, strict RDS/private OSS/monitoring inputs, and approval evidence digests.
- `buildPreproductionReplayPlan(admission, profile)` returns a deterministic plan binding candidate verification, all load profiles, every correctness/database/fault scenario, resource sampling, and evidence rendering.
- `executePreproductionReplay(...)` verifies the admitted manifest before load and requires candidate/profile-bound execution receipts for every workload, correctness, database, fault, and resource phase.
- `renderEvidence(rawRun)` rejects contradictory provenance/boolean/status combinations and duplicate or semantically reused correctness rows.

- [x] **Step 1: Add admission and evidence regression tests.** Added single-character/all-`x` rejection, candidate/profile mismatch, exact admission, dirty-candidate rejection, replay coverage, contradictory provenance rejection, duplicate scenario rejection, forged-receipt rejection, and distinct correctness assertions.
- [x] **Step 2: Run the focused tests and retain the expected failures.** Preserved failures for fake input admission, contradictory evidence, and the missing preproduction runtime module before implementation.
- [x] **Step 3: Implement the minimal strict validators and replay-plan builder.** Admission failures remain `StageSevenAdmissionError` exit `2`; evidence validation fails closed after a run object exists.
- [x] **Step 4: Connect the standard CLI structurally.** `admit`, `replay-plan`, and `replay` bind clean repository HEADs and the profile digest. This task exercised only injected orchestration and dry-run structure; no target was contacted.
- [x] **Step 5: Re-run the focused test and the blank-template CLI.** Final focused result is 27/27; all three checked-in blank-template commands produce the exact EXT-005 line and exit `2`.

### Task 2: Exact runtime namespace cleanup

**Files:**

- Modify: `scripts/stage-seven-local-runtime.spec.mjs`
- Modify: `scripts/stage-seven-local-runtime.mjs`
- Modify: `scripts/run-stage-seven-local.mjs`

**Interfaces:**

- `removeExactStageSevenRuntimeDirectory(path)` removes only a direct child of the host temporary directory whose basename matches the unique `cofco-stage7-*` namespace.
- The local runner passes this removal as the final independent step to `runCleanupSteps`, after preview, backend, and database cleanup.

- [x] **Step 1: Add success and earlier-cleanup-failure lifecycle tests.** The current exact namespace disappears while the preserved sibling remains.
- [x] **Step 2: Run the focused runtime test and retain the missing-helper failure.** Preserved the missing-export red result before implementation.
- [x] **Step 3: Implement confined removal and wire it last in `finally`.** Removal validates the absolute real parent, basename, directory type, and non-symlink boundary; all cleanup errors aggregate.
- [x] **Step 4: Re-run focused tests and a controlled early-failure child-process probe.** Early failure, smoke, and full replay all left the original 11-directory set byte-for-byte unchanged.

### Task 3: Independent dynamic correctness scenarios

**Files:**

- Modify: `scripts/run-stage-seven-local.mjs`
- Modify: `scripts/stage-seven-core.spec.mjs`
- Modify: `scripts/stage-seven-core.mjs`

**Interfaces:**

- Each of `duplicate-click-idempotency`, `client-retry-idempotency`, `concurrent-edit`, `optimistic-lock`, `no-silent-overwrite`, and `no-duplicate-business-effect` owns a unique production record and request sequence.
- Evidence includes unique `recordId`, execution order, actors, distinct proposed content where applicable, the stable conflict code, persisted winner/content ownership, and exact audit/outbox effects.

- [x] **Step 1: Extend evidence tests to reject a shared record/result across semantic rows.** Evidence requires unique record IDs and scenario-specific semantics.
- [x] **Step 2: Run the focused core test and retain the reused-evidence failure.** Preserved the reused-record rejection before replacing the runner behavior.
- [x] **Step 3: Implement six separate HTTP/database scenarios.** Two seeded operators and distinct content proposals prove winner ownership, sequential retry, version conflict, and action-specific audit/outbox effects.
- [x] **Step 4: Run focused tests and local smoke/full replays.** Both replays produced 28/28 with six distinct correctness records and no new runtime namespace.

### Task 4: Proportional verification, evidence, ledgers, and handoff

**Files:**

- Modify: the existing four Stage 7 authority evidence Markdown files and `run.json`
- Modify: the three permanent ledgers in `docs/wayfinder/enterprise-go-live-readiness`

**Interfaces:**

- Produces final `LOCAL_PROPORTIONAL_ONLY`, `productionEquivalent=false`, `BLOCKED_EXTERNAL(EXT-005)` evidence and a supervisor-only handoff.

- [x] **Step 1: Run Node 24/npm 11 Stage 7 focused and complete Web verification.** Stage 7 is 27/27 and the final full Web `npm run verify` passed.
- [x] **Step 2: Run the necessary local proportional replay.** The pre-commit full run was 28/28, 5,000 + 2×5,001 imports, 38 resource samples, 2.306-second maximum recovery, and preserved the same 11 audit directories. A clean committed-candidate rerun is still required before evidence publication.
- [x] **Step 3: Update four evidence artifacts and three ledgers.** Recorded the clean candidate run, red/green evidence, cleanup counts, exclusions, and `REGRESSION_PENDING / PENDING_SUPERVISOR_REVIEW` for DEF-122 through DEF-124.
- [x] **Step 4: Review the exact diff and commit once.** Implementation commit `272c6e14d3dfdf1c36e1a0b9fd9f875bb36b7ae2` was ordinarily pushed; one final evidence-only commit follows the clean-candidate replay.
- [ ] **Step 5: Re-read all authority documents and verify the three-repository boundary.** Require three clean worktrees, `HEAD=upstream`, and 0/0 before structured supervisor handoff.
