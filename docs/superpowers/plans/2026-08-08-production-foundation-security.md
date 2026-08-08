# Production Foundation and Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the secure, production-owned foundation on which all approved field, workflow, reporting, overview, and cloud work can safely build.

**Architecture:** Keep the backend as a modular monolith and enforce authorization inside application services and repository queries, not only at a global HTTP interceptor. Make the business web and overview web explicit views of one system, fail closed without authenticated identity, and reserve idempotent imports before side effects.

**Tech Stack:** Java 21, Spring Boot 4.1, Spring Security OAuth2 Resource Server, Spring Modulith, PostgreSQL 17/PostGIS, Flyway, React 19, TypeScript 5.9, Vite 8, Vitest, Playwright, Docker Compose.

## Global Constraints

- Do not alter the approved business visual shell in this package.
- Do not introduce a second business application or any production fixture fallback.
- Local development identity is allowed only on loopback under the explicit `local` profile.
- Every list and detail read must intersect with the authenticated principal's assigned regions.
- Every import must have bounded bytes, rows, columns, cell length, plain-decimal syntax, and atomic idempotency.
- Preserve existing user changes outside the exact files named by each task.

---

### Task 1: Lock Runtime Ownership and Quality Gates

**Files:**

- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-infrastructure/README.md`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-infrastructure/docs/architecture/adr/0001-greenfield-system-boundaries.md`
- Create: `/Users/federal/Desktop/cofco-qiqihar-enterprise-infrastructure/scripts/verify-runtime-ownership.sh`
- Test: `/Users/federal/Desktop/cofco-qiqihar-enterprise-infrastructure/scripts/verify-runtime-ownership.sh`

**Interfaces:**

- Consumes: approved design `docs/superpowers/specs/2026-08-08-enterprise-production-system-design.md`.
- Produces: one machine-checkable runtime ownership contract: business view=`enterprise-web`, overview view=`enterprise-frontend`, API=`enterprise-backend`, deployment=`enterprise-infrastructure`.

- [ ] **Step 1: Write the failing ownership check**

```bash
#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
rg -q 'business view.*cofco-qiqihar-enterprise-web' "$root/README.md"
rg -q 'overview view.*cofco-qiqihar-enterprise-frontend' "$root/README.md"
! rg -q '既有原型：只读保留' "$root/README.md"
```

- [ ] **Step 2: Run it and verify the old prototype ownership fails**

Run: `bash scripts/verify-runtime-ownership.sh`
Expected: non-zero because the current README still calls the business platform a read-only prototype.

- [ ] **Step 3: Update the ADR and README**

Document exactly these runtime roles and state that they are views of one logical system. Record that production fixture imports and mock gateways are forbidden from runtime entrypoints.

- [ ] **Step 4: Run the ownership check**

Run: `bash scripts/verify-runtime-ownership.sh`
Expected: exit 0.

- [ ] **Step 5: Commit only ownership files**

```bash
git add -- README.md docs/architecture/adr/0001-greenfield-system-boundaries.md scripts/verify-runtime-ownership.sh
git commit -m "docs: lock enterprise runtime ownership"
```

### Task 2: Enforce Region Scope on Every Business Read

**Files:**

- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/shared/security/application/AccessControl.java`
- Create: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/shared/security/application/AuthorizedReadScope.java`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/production/application/ProductionRecordService.java`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/production/domain/ProductionRecordQuery.java`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/production/application/ProductionRecordRepository.java`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/production/infrastructure/JdbcProductionRecordRepository.java`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/market/application/MarketMonitoringService.java`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/market/domain/MarketRecordQuery.java`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/market/application/MarketMonitoringRepository.java`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/market/infrastructure/JdbcMarketMonitoringRepository.java`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/logistics/application/LogisticsService.java`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/logistics/application/LogisticsRepository.java`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/logistics/infrastructure/JdbcLogisticsRepository.java`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/supply/application/SupplyAccountService.java`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/supply/application/SupplyAccountRepository.java`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/supply/infrastructure/JdbcSupplyAccountRepository.java`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/workflow/application/DefaultWorkItemReader.java`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/workflow/domain/WorkItemQuery.java`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/workflow/application/WorkItemRepository.java`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/workflow/infrastructure/JdbcWorkItemRepository.java`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/overview/application/OverviewService.java`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/overview/application/OverviewRepository.java`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/overview/infrastructure/JdbcOverviewRepository.java`
- Test: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/test/java/com/cofco/qiqihar/graintrade/shared/security/interfaceadapter/BusinessReadRegionIsolationIntegrationTest.java`

**Interfaces:**

- Produces: `AccessControl.requireReadScope(): AuthorizedReadScope`.
- Produces: `AuthorizedReadScope.requireRegion(String)` and immutable `regionCodes()`.
- Repository list operations consume the authorized region set; detail services validate the persisted record region after loading and before returning.

- [ ] **Step 1: Write a two-subject failing integration test**

Create two enabled subjects with `BUSINESS_READ` and disjoint region scopes. Insert approved production, market, logistics, supply, work-item, and overview material for both regions. Assert subject A receives `403 ACCESS_REGION_DENIED` for subject B detail IDs and never sees B rows in lists or aggregates.

```java
mockMvc.perform(get("/api/v1/production-records/{id}", regionBRecord)
        .principal(() -> "reader-a"))
    .andExpect(status().isForbidden())
    .andExpect(jsonPath("$.error.code").value("ACCESS_REGION_DENIED"));
```

- [ ] **Step 2: Run the isolation test**

Run: `JAVA_HOME=/opt/homebrew/opt/openjdk@21 mvn -Dtest=BusinessReadRegionIsolationIntegrationTest test`
Expected: FAIL because the current interceptor calls `require("BUSINESS_READ", null)` and services do not constrain reads.

- [ ] **Step 3: Add the authorized read-scope value object**

```java
public record AuthorizedReadScope(String subjectId, Set<String> regionCodes) {
    public AuthorizedReadScope {
        regionCodes = Set.copyOf(regionCodes);
    }

    public void requireRegion(String regionCode) {
        if (!regionCodes.contains(regionCode)) {
            throw new AccessDeniedException(
                    "ACCESS_REGION_DENIED", "Data region is outside the assigned scope");
        }
    }
}
```

Add `requireReadScope()` to `AccessControl`; it resolves the principal with `BUSINESS_READ` and returns the scope. Keep `require(permission, region)` for writes.

- [ ] **Step 4: Thread scope through list and detail reads**

For every business list, add authorized regions to its query and SQL predicate. For details, load the record, call `scope.requireRegion(record.regionCode())`, then map the response. Logistics validates both origin and destination according to the approved access rule. Supply, workflow, and overview reject requested regions outside scope and constrain unrestricted queries.

- [ ] **Step 5: Run all security and domain integration tests**

Run: `JAVA_HOME=/opt/homebrew/opt/openjdk@21 mvn test`
Expected: all tests pass with zero cross-region rows.

- [ ] **Step 6: Commit the region-isolation slice**

Stage only the shared-security files, touched domain service/repository files, and the new integration test; commit with:

```bash
git commit -m "fix: enforce region scope on business reads"
```

### Task 3: Replace Production Header Trust with Authenticated Principal

**Files:**

- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/pom.xml`
- Create: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/shared/security/interfaceadapter/ProductionSecurityConfiguration.java`
- Create: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/shared/security/interfaceadapter/SecurityStartupInvariant.java`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/resources/application.yml`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/resources/application-local.yml`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/scripts/start-local.sh`
- Test: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/test/java/com/cofco/qiqihar/graintrade/shared/security/interfaceadapter/SecurityStartupInvariantTest.java`

**Interfaces:**

- Production consumes `QIQIHAR_OIDC_ISSUER_URI` and JWT `sub` through Spring Security.
- Local profile binds `server.address=127.0.0.1`; its development actor cannot be enabled on a non-loopback address.

- [ ] **Step 1: Write failing startup-invariant tests**

Assert startup rejects: local profile on `0.0.0.0`, non-local profile with a nonblank trusted-subject header, and missing OIDC issuer in production. Assert local+loopback is accepted.

- [ ] **Step 2: Run the tests**

Run: `JAVA_HOME=/opt/homebrew/opt/openjdk@21 mvn -Dtest=SecurityStartupInvariantTest test`
Expected: FAIL because no invariant exists.

- [ ] **Step 3: Add Spring Security resource-server dependencies and configuration**

Add `spring-boot-starter-security` and `spring-boot-starter-oauth2-resource-server`. Require authentication for `/api/v1/**`, permit `/actuator/health`, and use JWT subject as the servlet principal. Do not translate client-supplied identity headers in production.

- [ ] **Step 4: Bind local backend to loopback**

Set `server.address: 127.0.0.1` in `application-local.yml`. Keep the local development actor profile-gated and make `scripts/start-local.sh` verify the backend listener is loopback-only.

- [ ] **Step 5: Run focused and full tests**

Run: `JAVA_HOME=/opt/homebrew/opt/openjdk@21 mvn test`
Expected: tests use explicit principals or the protected test security configuration; unauthenticated business requests fail closed.

- [ ] **Step 6: Commit only authentication-boundary files**

```bash
git commit -m "fix: require authenticated production identity"
```

### Task 4: Make CSV Import Atomic and Structurally Bounded

**Files:**

- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/importing/application/ImportJobRepository.java`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/importing/application/ProductionImportService.java`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/importing/domain/CsvTable.java`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/importing/infrastructure/JdbcImportJobRepository.java`
- Create: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/resources/db/migration/V58__reserve_atomic_import_jobs.sql`
- Test: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/test/java/com/cofco/qiqihar/graintrade/importing/interfaceadapter/ProductionImportConcurrencyIntegrationTest.java`
- Test: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/test/java/com/cofco/qiqihar/graintrade/importing/domain/CsvTableLimitTest.java`

**Interfaces:**

- Produces: `ImportReservation reserve(subjectId, domainCode, key, digest, workUnit, now)`.
- Limits: `MAX_BYTES=2 MiB`, `MAX_ROWS=5_000`, exact template column count, `MAX_CELL_CHARACTERS=500`.

- [ ] **Step 1: Write concurrent and amplification tests**

Use two threads and a barrier to submit the same unused idempotency key. Assert exactly one import job and one set of production records. Build a CSV with 5,001 rows and assert `400 IMPORT_ROW_LIMIT_EXCEEDED` before any production insert.

- [ ] **Step 2: Run both tests and verify failure**

Run: `JAVA_HOME=/opt/homebrew/opt/openjdk@21 mvn -Dtest=ProductionImportConcurrencyIntegrationTest,CsvTableLimitTest test`
Expected: duplicate production records or missing row-limit rejection.

- [ ] **Step 3: Add reservation schema and repository API**

Insert a `PENDING` job first using the existing unique subject/domain/key constraint. `INSERT ... ON CONFLICT DO NOTHING` identifies the owner. A conflicting digest returns `IMPORT_IDEMPOTENCY_KEY_CONFLICT`; the same digest returns the existing job state.

- [ ] **Step 4: Wrap reservation, production inserts, row outcomes, completion, and audit in one transaction**

Annotate the application boundary with `@Transactional`. Existing production transactions join the outer transaction. If the request loses reservation, it performs no production write.

- [ ] **Step 5: Enforce structural limits during parsing**

Stop parsing immediately after the row, column, or cell limit is exceeded. Do not allocate header-keyed maps for rows beyond the limit.

- [ ] **Step 6: Run tests and empty-database Flyway replay**

Run: `JAVA_HOME=/opt/homebrew/opt/openjdk@21 mvn verify`
Expected: all tests pass and Flyway replays through V58.

- [ ] **Step 7: Commit the atomic import slice**

```bash
git commit -m "fix: make production imports atomic and bounded"
```

### Task 5: Reject Pathological Decimal and Oversized JSON Inputs

**Files:**

- Create: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/shared/application/PlainDecimal.java`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/production/interfaceadapter/ProductionRecordController.java`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/importing/application/ProductionImportService.java`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/market/interfaceadapter/MarketMonitoringCommandController.java`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/logistics/application/LogisticsDraft.java`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/supply/interfaceadapter/SupplyAccountController.java`
- Create: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/shared/interfaceadapter/RequestBodyLimitFilter.java`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/resources/application.yml`
- Test: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/test/java/com/cofco/qiqihar/graintrade/production/interfaceadapter/ProductionInputLimitIntegrationTest.java`

**Interfaces:**

- Produces: `PlainDecimal.parse(String value, int integerDigits, int fractionDigits, String code)`.
- JSON limit defaults: 1 MiB body, 256 map entries, 500 characters per business text value.

- [ ] **Step 1: Write failing hostile-input tests**

Assert `1E999999999`, more than 256 fact entries, a text value over 500 characters, and a JSON body over 1 MiB return deterministic `400` or `413` without creating records.

- [ ] **Step 2: Run focused tests**

Run: `JAVA_HOME=/opt/homebrew/opt/openjdk@21 mvn -Dtest=ProductionInputLimitIntegrationTest test`
Expected: at least the exponent and aggregate-size cases fail.

- [ ] **Step 3: Implement bounded plain-decimal parsing**

```java
private static final Pattern PLAIN = Pattern.compile("(?:0|[1-9][0-9]{0,17})(?:\\.[0-9]{1,4})?");

public static BigDecimal parse(String value, int integerDigits, int fractionDigits, String code) {
    if (value == null || !PLAIN.matcher(value).matches()) {
        throw new ClientRequestException(code, "Decimal value is invalid");
    }
    BigDecimal decimal = new BigDecimal(value);
    if (decimal.precision() - decimal.scale() > integerDigits || decimal.scale() > fractionDigits) {
        throw new ClientRequestException(code, "Decimal value is outside the allowed range");
    }
    return decimal;
}
```

Parameterize the exact precision per field; do not call `setScale` before lexical, precision, and scale validation.

- [ ] **Step 4: Add early request and collection limits**

Reject declared or streamed JSON bodies over the configured byte limit before controller binding. Validate map/list cardinality before per-entry decimal conversion.

- [ ] **Step 5: Run full backend verification**

Run: `JAVA_HOME=/opt/homebrew/opt/openjdk@21 mvn verify`
Expected: `BUILD SUCCESS`, no failed tests.

- [ ] **Step 6: Commit the input-hardening slice**

```bash
git commit -m "fix: bound business request inputs"
```

### Task 6: Restore Business-Web Quality Gate Without Hiding Errors

**Files:**

- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-web/src/vite-env.d.ts`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-web/src/platform/api/realtimeApiClient.ts`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-web/src/platform/api/realtimeApiClient.spec.ts`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-web/src/platform/api/realtimeBusinessRepository.spec.ts`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-web/src/prototype/FormalEnterprisePrototype.tsx`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-web/src/prototype/MyWorkWorkspace.tsx`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-web/src/prototype/SupplyDemandWorkspace.tsx`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-web/src/prototype/realtime/RealtimeBusinessOperationsPanel.tsx`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-web/src/prototype/realtime/RealtimeBusinessOperationsPanel.spec.tsx`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-web/src/prototype/realtime/RealtimeLogisticsOperationsPanel.tsx`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-web/src/prototype/realtime/RealtimeLogisticsOperationsPanel.spec.tsx`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-web/src/prototype/realtime/RealtimeSupplyBalancePanel.tsx`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-web/src/prototype/realtime/RealtimeSupplyBalancePanel.spec.tsx`
- Test: `/Users/federal/Desktop/cofco-qiqihar-enterprise-web/src/platform/api/realtimeApiClient.spec.ts`
- Test: `/Users/federal/Desktop/cofco-qiqihar-enterprise-web/src/platform/api/realtimeBusinessRepository.spec.ts`
- Test: `/Users/federal/Desktop/cofco-qiqihar-enterprise-web/src/prototype/FormalEnterprisePrototype.spec.tsx`
- Test: `/Users/federal/Desktop/cofco-qiqihar-enterprise-web/src/prototype/realtime/RealtimeBusinessOperationsPanel.spec.tsx`
- Test: `/Users/federal/Desktop/cofco-qiqihar-enterprise-web/src/prototype/realtime/RealtimeLogisticsOperationsPanel.spec.tsx`
- Test: `/Users/federal/Desktop/cofco-qiqihar-enterprise-web/src/prototype/realtime/RealtimeSupplyBalancePanel.spec.tsx`

**Interfaces:**

- Produces: a green `npm run verify` baseline before feature work.
- Does not relax lint rules or exclude production source files.

- [ ] **Step 1: Run the current full gate**

Run: `npm run verify`
Expected: fail at the first real lint, test, build, budget, or E2E defect; capture the exact output.

- [ ] **Step 2: Fix each reported defect with the smallest typed change**

Use typed environment access, `mockResolvedValue` instead of `async` mocks without awaits, stable hook dependencies, and async state transitions. Do not add broad ESLint disables.

- [ ] **Step 3: Run focused tests for every changed component**

Run: `npx vitest run <changed-spec-files>`
Expected: all focused tests pass.

- [ ] **Step 4: Run the complete gate**

Run: `npm run verify`
Expected: format, lint, architecture, unit tests, build, budget, and preview E2E all pass.

- [ ] **Step 5: Commit only verified quality-gate fixes**

```bash
git commit -m "fix: restore business web quality gate"
```

### Task 7: Verify the Foundation as One Local System

**Files:**

- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/scripts/verify-local-links.sh`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/scripts/healthcheck-local.sh`
- Test: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/scripts/verify-desktop-launcher-contract.sh`

**Interfaces:**

- Verifies business view `63182`, overview view `63200`, loopback API `8090`, authenticated read behavior, and absence of legacy dashboard references.

- [ ] **Step 1: Add failing security and ownership checks**

Assert the backend socket is loopback-only, the business and overview views respond, production-style unauthenticated API reads fail closed, and no launcher/runtime script references a dashboard repository.

- [ ] **Step 2: Run the checks**

Run: `bash scripts/verify-desktop-launcher-contract.sh && bash scripts/verify-local-links.sh && bash scripts/healthcheck-local.sh`
Expected before final fixes: at least the new authentication or binding assertion fails.

- [ ] **Step 3: Apply only required launcher/script corrections**

Keep the enterprise screen session and exact business/overview URLs. Do not restore deleted dashboard artifacts.

- [ ] **Step 4: Run backend and both frontend gates plus local health checks**

Expected: all commands exit 0; browser console has no errors; no legacy process or listener exists.

- [ ] **Step 5: Commit local-system verification files**

```bash
git commit -m "test: verify secure enterprise local runtime"
```

## Package Completion Evidence

- [ ] Region-isolation integration tests cover list, detail, workflow, supply, and overview reads.
- [ ] Production identity comes from authenticated principal; local identity is loopback-only.
- [ ] Concurrent same-key imports create one durable effect.
- [ ] CSV and JSON amplification cases fail early and deterministically.
- [ ] Backend, business web, and overview web full verification commands pass.
- [ ] Runtime-ownership check names exactly one business view, one overview view, one API, and one deployment repository.
