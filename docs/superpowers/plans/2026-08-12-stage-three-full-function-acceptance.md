# Stage Three Full-Function Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. This task must remain single-agent because the governing handoff names one execution task and all three repositories share one working boundary.

**Goal:** Produce current-candidate evidence for S3-1 through S3-4 using an isolated real PostgreSQL database, real HTTP boundaries, and Chromium, while fixing only technical gaps exposed by the stage-three matrix.

**Architecture:** Extend the existing `e2e/live` stack instead of creating another acceptance system. A stage-three runner records database-catalog boundaries, runs the current live workflows plus stage-three-only scenarios, and proves teardown removed the namespaced database. Runtime control discovery fails when a visible action has no evidence mapping; write actions are covered by dedicated domain workflows with HTTP and database assertions.

**Tech Stack:** Java 21, Spring Boot, Flyway, PostgreSQL, React 19, TypeScript, Vite, Playwright Chromium, Vitest.

## Global Constraints

- Only the three runtime repositories may be modified; Desktop repositories are forbidden.
- Do not enter stage four identity implementation or any cloud, performance, security, backup, UAT, release, or 24-hour work.
- Local E2E identities must never be described as enterprise IdP identities.
- The acceptance database is `qiqihar_enterprise_e2e`; it must be created for one run and dropped during teardown.
- All test markers use the `S3C-20260812-` namespace.
- Existing stage 3A/3B full gates must not be rerun without new stage-three evidence.
- No force push, main push, tag, release, or destructive operation against shared databases.

---

### Task 1: Stage-Three HTTP and Database Boundary

**Files:**
- Modify: `vite.live-e2e.config.ts`
- Modify: `vite.live-e2e.config.spec.ts`
- Modify: `playwright.live.config.ts`
- Modify: `e2e/live/fixtures.ts`
- Create: `scripts/run-stage-three-acceptance.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces fixed local previews for two operators, reviewer, reporter, publisher, outside-region operator, anonymous session, and unavailable backend.
- Produces a stage-three runner that records database names before and after Playwright and fails unless `qiqihar_enterprise_e2e` is absent after teardown.

- [ ] Add failing Vitest cases for anonymous proxy mode and fixed-actor mode.
- [ ] Run the config test and confirm the anonymous case fails because the mode is not implemented.
- [ ] Implement the smallest proxy/config change that strips browser identity and either injects one fixed actor or sends no actor.
- [ ] Add stage-three preview endpoints and account constants.
- [ ] Implement the runner and package command; keep evidence under `test-results/stage-three` until copied to the permanent evidence directory.
- [ ] Run the focused Vitest config test and confirm it passes.

### Task 2: Three-Domain Void Terminal State

**Files:**
- Create: Backend `src/main/resources/db/migration/V99__add_voided_business_record_state.sql`
- Modify: Backend production, market, and logistics status/domain/action-policy/service/controller/repository projection files.
- Modify: Backend production, market, logistics domain and REST integration tests.
- Modify: Web realtime repository types and production/market/logistics operation panels.
- Modify: Focused Web component tests for each operation panel.
- Create: `e2e/live/stage-three-void.e2e.ts`

**Interfaces:**
- Adds `POST /api/v1/{production|market|logistics}-records/{id}/void` with optimistic version input.
- Allows a locally authorized business-update operator to void only `DRAFT` or `RETURNED`; `VOIDED` is terminal, read-only, excluded from actionable work, and recorded in audit/outbox. Creator ownership is deliberately not asserted because that identity rule belongs to stage four.

- [ ] Add failing backend domain tests for voiding draft/returned records and rejecting pending/approved/voided records.
- [ ] Run focused domain tests and confirm the missing state/action failures.
- [ ] Add failing REST tests for HTTP transition, database status, audit/outbox, allowed actions, and stale/forbidden transitions.
- [ ] Implement migration, enums, domain transitions, services, controllers, persistence/action projection, and work projection minimally.
- [ ] Run focused backend tests until green.
- [ ] Add failing Web tests for visible `作废` action and terminal read-only rendering.
- [ ] Implement repository calls, labels, action buttons, and terminal rendering minimally.
- [ ] Run focused Web tests until green.
- [ ] Add the real PostgreSQL/HTTP/Chromium void flow for all three domains.

### Task 3: Runtime Menu, Visible-Action, and Failure Matrix

**Files:**
- Create: `e2e/live/stage-three-contract.ts`
- Create: `e2e/live/stage-three-visible-actions.e2e.ts`
- Create: `e2e/live/stage-three-failure-modes.e2e.ts`

**Interfaces:**
- Consumes the 28 formal routes and current runtime controls.
- Produces one machine-readable row per visible control with route, role, control name, enabled state, evidence scenario, and status.

- [ ] Define exact route and action-evidence contracts; unmatched visible controls fail the test.
- [ ] Exercise navigation, tabs, search, filters, reset, sorting, pagination, downloads, dialogs, details, and safe read-only actions across all routes.
- [ ] Add real HTTP scenarios for empty data, partial data, invalid manual input, invalid XLSX row, backend unavailable, anonymous session, outside-region permission denial, and console/page errors.
- [ ] Attach the runtime action matrix and failure matrix to Playwright evidence.
- [ ] Run only these stage-three tests and resolve local failures using systematic debugging.

### Task 4: Post-Commit Consumer Reconciliation

**Files:**
- Create: `e2e/live/stage-three-consumers.e2e.ts`
- Reuse without weakening: existing production, market, logistics, XLSX, notification, overview, analysis, supply, and report live tests.

**Interfaces:**
- Uses one `S3C-20260812-` approved dataset and proves its database row/audit/outbox identity reaches every required consumer.

- [ ] Create manual and XLSX records in production, market, and logistics using the namespace.
- [ ] Complete submit/return/resubmit/approve flows with distinct operator and reviewer contexts.
- [ ] Verify list, work queue, durable notification, overview, analysis, supply balance, and scoped report consumers against the same identifiers and approved-only semantics.
- [ ] Verify all participating pages have zero console and page errors.

### Task 5: Evidence, Cleanup, and Handoff

**Files:**
- Create permanent evidence directory under the ledger `evidence/` tree.
- Modify permanent ledger `2026-08-11-compressed-go-live-execution-order.md`.
- Create evidence `SUMMARY.md`, `MATRIX.md`, `VERIFICATION.md`, `DATABASE-DIFF.md`, `VISIBLE-ACTIONS.json`, and `HANDOFF.md`.

**Interfaces:**
- Produces conservative `PASS / FAIL / BLOCKED_EXTERNAL / NOT_EVIDENCED` rows for S3-1 through S3-4 and records exact candidate SHAs.

- [ ] Run the stage-three acceptance command once from a clean candidate and immediately collect its result.
- [ ] Confirm the E2E database is absent, the shared database catalog is unchanged, and shared databases contain no `S3C-20260812-` marker.
- [ ] Run proportionate focused unit/integration tests, builds for changed repositories, and `git diff --check` for all three repositories.
- [ ] Record enterprise IdP accounts/parameters as `BLOCKED_EXTERNAL` without promoting local test identities.
- [ ] Commit and ordinary-push each changed private branch; verify clean HEAD equals upstream.
- [ ] Update the permanent ledger with status, SHAs, evidence, and next cursor; write the structured handoff and stop before stage four.
