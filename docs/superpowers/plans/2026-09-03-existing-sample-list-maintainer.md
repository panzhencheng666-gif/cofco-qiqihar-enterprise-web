# Existing Sample List Maintainer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move formal-sample maintenance and period-data editing into the existing market, production, and logistics lists while preserving their visual architecture and closing account responsibility plus overview realtime synchronization.

**Architecture:** Keep stable sample identity, single current maintainer, and period observations as separate authoritative concepts. The three existing business lists become sample-centric projections enriched with the latest applicable observation; mutations reuse the formal-sample and formal-observation APIs, while overview consumes only current effective business projections and refreshes from business events. Design samples remain reference-only and never inherit formal prices or inventory.

**Tech Stack:** Java 21, Spring Boot, PostgreSQL/Flyway, React 19, TypeScript, Vitest, Playwright, SSE, npm 11/Node 24.

## Global Constraints

- Do not change the current market, production, or logistics page architecture, navigation, filter placement, table visual grammar, or responsive shell.
- Remove the fill-status filter, photo action, returned-record correction workbook, and correction-result import UI from all three business lists.
- Add address, current maintainer, edit, and protected delete to the existing lists; retain record history.
- One sample has exactly one current maintainer; that authenticated account is the only ordinary account allowed to write the sample's period data.
- Keep stable sample data separate from period prices, inventory, volume, and production facts.
- Market object types include authoritative `AGRICULTURAL_INPUT_STORE` / `农资店`.
- Formal business updates refresh all overview surfaces through the existing event contract; design samples synchronize reference fields only.
- Wu Yutong's current privileged account is an acceptance-only condition. Do not change production/cloud authorization until the code, CI, local runtime, browser, and deployment preflight gates are complete.
- Use the smallest focused local test set first. Remote PR CI supplies the repository full gate.

---

### Task 1: Lock the Backend sample-centric list and responsibility contract

**Files:**

- Modify: `cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/formalsampleobservation/application/EligibleFormalSample.java`
- Modify: `cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/formalsampleobservation/infrastructure/JdbcFormalSampleObservationRepository.java`
- Modify only if the existing contract lacks a required filter: `cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/formalsampleobservation/interfaceadapter/FormalSampleObservationController.java`
- Test: `cofco-qiqihar-enterprise-backend/src/test/java/com/cofco/qiqihar/graintrade/formalsampleobservation/interfaceadapter/FormalSampleObservationRestIntegrationTest.java`
- Test: `cofco-qiqihar-enterprise-backend/src/test/java/com/cofco/qiqihar/graintrade/formalsamplepoint/interfaceadapter/FormalSamplePointRestIntegrationTest.java`

**Interfaces:**

- Consumes: `registry.sample_point`, `registry.formal_sample_point_profile`, current employee authorization, latest `platform.formal_sample_observation`.
- Produces: `EligibleFormalSample` rows containing `samplePointId`, stable `address`, current maintainer identity, latest observation id/time/values, and delete-blocking counts.

- [ ] **Step 1: Write failing integration assertions for the enriched row**

```java
mockMvc.perform(get("/api/v1/formal-sample-observations/eligible-samples")
        .param("domain", "MARKET")
        .param("productCode", "CORN")
        .param("year", "2026")
        .param("observedAt", "2026-09-03T08:00:00Z")
        .with(user(maintainer)))
    .andExpect(status().isOk())
    .andExpect(jsonPath("$.data[0].address").value("龙沙区详细地址"))
    .andExpect(jsonPath("$.data[0].maintainerSubjectId").value(maintainer))
    .andExpect(jsonPath("$.data[0].maintainerDisplayName").value("样本维护员"));
```

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `./scripts/mvn-jdk21.sh -Dtest=FormalSampleObservationRestIntegrationTest,FormalSamplePointRestIntegrationTest test`

Expected: the new address/responsibility assertion fails before implementation; existing authorization and deletion tests remain green.

- [ ] **Step 3: Add only the missing projection fields or filter**

```java
public record EligibleFormalSample(
        UUID samplePointId,
        String sampleName,
        String address,
        String objectTypeCode,
        String objectTypeName,
        FormalSampleObservationDomain domain,
        String productCode,
        String regionCode,
        String regionName,
        String maintainerSubjectId,
        String maintainerDisplayName,
        BigDecimal latitude,
        BigDecimal longitude,
        LocalDate effectiveFrom,
        LocalDate effectiveTo,
        long version,
        long annualObservationCount,
        long networkMembershipCount,
        String latestObservationId,
        Instant latestObservedAt,
        Map<String, String> latestValues) {}
```

Use the existing versioned formal-sample delete and maintainer endpoints. Do not create a second responsibility table when `registry.sample_point.maintainer_subject_id` is already authoritative.

- [ ] **Step 4: Verify responsibility, agricultural-store, and protected-delete behavior**

Run: `./scripts/mvn-jdk21.sh -Dtest=FormalSampleObservationRestIntegrationTest,FormalSamplePointRestIntegrationTest test`

Expected: zero failures; maintainer can save, non-maintainer is denied, `AGRICULTURAL_INPUT_STORE` is eligible for market, unreferenced/no-history deletion succeeds, protected deletion has no side effects.

- [ ] **Step 5: Commit the Backend checkpoint**

```bash
git add src/main/java/com/cofco/qiqihar/graintrade/formalsampleobservation src/test/java/com/cofco/qiqihar/graintrade/formalsampleobservation src/test/java/com/cofco/qiqihar/graintrade/formalsamplepoint
git commit -m "feat: enrich formal sample business list contract"
```

### Task 2: Replace the separate collection ledger with existing-list row actions

**Files:**

- Modify: `cofco-qiqihar-enterprise-web/src/platform/api/realtimeBusinessRepository.ts`
- Modify: `cofco-qiqihar-enterprise-web/src/business/formal-sample/ExistingSampleObservationPanel.tsx`
- Modify: `cofco-qiqihar-enterprise-web/src/business/production/ProductProductionCollectionWorkspace.tsx`
- Modify: `cofco-qiqihar-enterprise-web/src/business/market/ProductMarketCollectionWorkspace.tsx`
- Modify: `cofco-qiqihar-enterprise-web/src/business/market/LogisticsMonitoringWorkspace.tsx`
- Modify: `cofco-qiqihar-enterprise-web/src/business/EnterpriseBusinessApplication.tsx`
- Test: matching `*.spec.tsx` files for the four components above.

**Interfaces:**

- Consumes: enriched `EligibleFormalSample`, `saveFormalSampleObservation`, `listFormalSampleObservationHistory`, `updateFormalSamplePoint`, `deleteFormalSamplePoint`.
- Produces: existing business lists with stable sample columns plus current-period business values and authorized row mutations.

- [ ] **Step 1: Write RED component tests for the immutable page shell and new row contract**

```tsx
expect(screen.queryByLabelText("填报状态")).not.toBeInTheDocument();
expect(screen.getByRole("columnheader", { name: "详细地址" })).toBeVisible();
expect(
  screen.getByRole("columnheader", { name: "样本点维护人" }),
).toBeVisible();
expect(within(row).getByText("龙沙区详细地址")).toBeVisible();
expect(within(row).getByText("样本维护员")).toBeVisible();
expect(within(row).queryByRole("button", { name: "查看照片" })).toBeNull();
expect(within(row).getByRole("button", { name: "查看记录" })).toBeVisible();
expect(within(row).getByRole("button", { name: "编辑" })).toBeVisible();
expect(within(row).getByRole("button", { name: "删除" })).toBeVisible();
```

Also assert the existing workspace heading, query controls, table class names, and navigation route are unchanged.

- [ ] **Step 2: Run only the affected Web specs and confirm RED**

Run: `npx vitest run src/business/formal-sample/ExistingSampleObservationPanel.spec.tsx src/business/production/ProductProductionCollectionWorkspace.spec.tsx src/business/market/ProductMarketCollectionWorkspace.spec.tsx src/business/market/LogisticsMonitoringWorkspace.spec.tsx`

Expected: new column/action/removal assertions fail before implementation.

- [ ] **Step 3: Add the enriched TypeScript contract**

```ts
export interface EligibleFormalSample {
  samplePointId: string;
  sampleName: string;
  address: string;
  maintainerSubjectId: string | null;
  maintainerDisplayName: string | null;
  version: number;
  annualObservationCount: number;
  networkMembershipCount: number;
  latestObservationId: string;
  latestObservedAt: string;
  latestValues: Record<string, string>;
  // retain existing domain/product/region/object/location fields
}
```

- [ ] **Step 4: Render sample-centric rows inside the existing tables**

Load eligible samples for the current domain/product/period. Map stable fields from the sample row and operational cells from `latestValues`. Do not match rows by name or coordinates; use `samplePointId`.

Wire actions as follows:

```ts
onViewHistory(sample.samplePointId);
onEditObservation(sample.samplePointId);
onDeleteSample(sample.samplePointId, sample.version);
```

The edit action reuses the period-data form. It must not navigate to the retired standalone collection ledger.

- [ ] **Step 5: Remove the standalone ledger route and verify old deep links resolve to the existing business list**

Keep compatibility parsing only where required to redirect saved links. Remove the visible title, toolbar, and navigation entry that produce the separate “采集台账” page.

- [ ] **Step 6: Run focused tests and TypeScript**

Run the Step 2 Vitest command, then `npx tsc -b --pretty false` and `git diff --check`.

Expected: all commands exit zero.

- [ ] **Step 7: Commit the Web list-integration checkpoint**

```bash
git add src/platform/api/realtimeBusinessRepository.ts src/business/formal-sample src/business/production/ProductProductionCollectionWorkspace.tsx src/business/market/ProductMarketCollectionWorkspace.tsx src/business/market/LogisticsMonitoringWorkspace.tsx src/business/EnterpriseBusinessApplication.tsx
git commit -m "feat: maintain formal samples in existing business lists"
```

### Task 3: Remove obsolete status, photo, and returned-correction controls

**Files:**

- Modify: `cofco-qiqihar-enterprise-web/src/business/production/ProductProductionCollectionWorkspace.tsx`
- Modify: `cofco-qiqihar-enterprise-web/src/business/market/ProductMarketCollectionWorkspace.tsx`
- Modify: `cofco-qiqihar-enterprise-web/src/business/market/LogisticsMonitoringWorkspace.tsx`
- Test: matching three workspace specs.

**Interfaces:**

- Consumes: normal import and ordinary record history remain unchanged.
- Produces: no fill-status filter, no photo row action, and no returned-record correction workflow in any of the three pages.

- [ ] **Step 1: Add RED removal assertions**

```tsx
expect(screen.queryByLabelText("填报状态")).toBeNull();
expect(screen.queryByRole("button", { name: "查看照片" })).toBeNull();
expect(screen.queryByRole("button", { name: "下载退回记录修正表" })).toBeNull();
expect(screen.queryByText("批量导入修正结果")).toBeNull();
```

- [ ] **Step 2: Remove controls, query parameters, callbacks, and component-local correction state**

Delete only the returned-correction UI path. Keep normal imports and existing backend compatibility endpoints untouched unless static analysis proves they are private and unused.

- [ ] **Step 3: Run the three focused specs and commit**

Run: `npx vitest run src/business/production/ProductProductionCollectionWorkspace.spec.tsx src/business/market/ProductMarketCollectionWorkspace.spec.tsx src/business/market/LogisticsMonitoringWorkspace.spec.tsx`

Expected: zero failures.

```bash
git add src/business/production src/business/market
git commit -m "refactor: simplify existing sample list controls"
```

### Task 4: Align account authorization with sample responsibility

**Files:**

- Modify: `cofco-qiqihar-enterprise-web/src/business/identity/IdentityGovernancePanel.tsx`
- Modify: `cofco-qiqihar-enterprise-web/src/platform/api/realtimeBusinessRepository.ts`
- Test: `cofco-qiqihar-enterprise-web/src/business/identity/IdentityGovernancePanel.spec.tsx`
- Test: `cofco-qiqihar-enterprise-web/src/platform/api/realtimeBusinessRepository.spec.ts`
- Modify Backend only if the existing paged query cannot efficiently supply assignments: `FormalSamplePointController.java`, `JdbcFormalSamplePointRepository.java`, and their existing integration tests.

**Interfaces:**

- Consumes: employee directory, formal sample list, `assignFormalSampleMaintainer`.
- Produces: one authoritative assignment displayed both by employee and by sample.

- [ ] **Step 1: Write RED tests for employee responsibility visibility and assignment**

```tsx
expect(screen.getByRole("columnheader", { name: "负责样本点" })).toBeVisible();
await user.click(
  within(employeeRow).getByRole("button", { name: "调整负责样本点" }),
);
await user.selectOptions(screen.getByLabelText("选择负责样本点"), ["sample-1"]);
await user.type(screen.getByLabelText("维护责任调整原因"), "正式分工");
await user.click(screen.getByRole("button", { name: "保存样本责任" }));
expect(repository.assignFormalSampleMaintainer).toHaveBeenCalledWith(
  "sample-1",
  expect.objectContaining({ maintainerSubjectId: "employee-1" }),
);
```

- [ ] **Step 2: Implement an inverse view, not a duplicate responsibility store**

Group formal samples by `maintainerSubjectId` for the employee table. Assignment still writes through `assignFormalSampleMaintainer`; after success, requery employees and samples. Filter candidates to active employees with compatible region scope.

- [ ] **Step 3: Subscribe to formal-sample responsibility events**

On formal-sample create/update/delete/maintainer events, requery the current employee responsibility view. Do not mutate cached rows by hand.

- [ ] **Step 4: Run identity/repository specs and commit**

Run: `npx vitest run src/business/identity/IdentityGovernancePanel.spec.tsx src/platform/api/realtimeBusinessRepository.spec.ts`

Expected: zero failures.

```bash
git add src/business/identity/IdentityGovernancePanel.tsx src/business/identity/IdentityGovernancePanel.spec.tsx src/platform/api/realtimeBusinessRepository.ts src/platform/api/realtimeBusinessRepository.spec.ts
git commit -m "feat: align accounts with sample responsibility"
```

### Task 5: Prove overview and design-sample synchronization boundaries

**Files:**

- Test first: `cofco-qiqihar-enterprise-backend/src/test/java/com/cofco/qiqihar/graintrade/overview/interfaceadapter/OverviewSamplePointRestIntegrationTest.java`
- Test first: the existing Backend formal-observation integration test covering synchronized modules.
- Modify only if the RED test exposes a gap: current overview repository/projection or business-event publication file identified by the failing test.
- Test: existing Frontend overview page/SSE specs under `cofco-qiqihar-enterprise-frontend/src/modules/overview`.
- Modify only if needed: current Frontend overview event invalidation hook/component identified by those tests.

**Interfaces:**

- Consumes: approved/current-effective formal business facts and business events.
- Produces: one authoritative overview result across map, count, sidebar/list, detail, category filters, and reload; design references have no fabricated business values.

- [ ] **Step 1: Write a Backend RED contract with arbitrary old/new values**

```java
var before = overviewPrice(sampleId);
saveApprovedFormalObservation(sampleId, "MKT_PURCHASE_PRICE", "350.00");
var after = overviewPrice(sampleId);
assertThat(after).isEqualByComparingTo("350.00");
assertThat(after).isNotEqualByComparingTo(before);
assertBusinessEventPublishedFor(sampleId);
```

Use test-generated values; do not encode the user's illustrative 300/350 as a product rule.

- [ ] **Step 2: Assert design samples remain reference-only**

Create or update a design point and assert its reference fields refresh while no formal price/inventory metric is synthesized for it.

- [ ] **Step 3: Run the smallest Backend and Frontend overview tests**

Backend: `./scripts/mvn-jdk21.sh -Dtest=OverviewSamplePointRestIntegrationTest,FormalSampleObservationRestIntegrationTest test`

Frontend: `npx vitest run src/modules/overview/infrastructure/http/HttpOverviewSamplePointRepository.spec.ts src/modules/overview/ui/pages/OverviewPage.spec.tsx src/modules/overview/ui/hooks/useOverviewSampleNetworkLayers.spec.ts src/modules/overview/ui/components/BoundaryMap.spec.tsx src/modules/overview/ui/components/OverviewSelectedSamplePointDetails.spec.tsx src/modules/overview/ui/components/OverviewSamplePointPanel.spec.tsx`.

Expected: zero failures. If already green, do not change production code.

- [ ] **Step 4: Repair only the failing contract seam and rerun RED/GREEN**

Allowed repairs are authoritative projection invalidation, missing event matching, or stale-query revalidation. Do not add a parallel overview store.

- [ ] **Step 5: Commit repository-specific overview tests or fixes**

Commit Backend and Frontend separately with focused messages. Keep each worktree clean before moving to PR publication.

### Task 6: CI, local runtime, browser closure, and deployment preflight

**Files:**

- Update only generated release evidence required by existing repository scripts.
- Save user-facing reports/screenshots under the supervisor task's `outputs/` directory.

**Interfaces:**

- Consumes: clean Backend, Frontend, and Web branches plus their required CI workflows.
- Produces: merged main SHAs, verified local runtime, real-browser evidence, cleanup evidence, and a production-deployment go/no-go report.

- [ ] **Step 1: Run proportional local gates**

Run focused tests from Tasks 1–5, TypeScript builds for changed frontend repositories, and `git diff --check`. Do not run unrelated full matrices locally when remote CI is mandatory.

- [ ] **Step 2: Push repository branches and close PR CI serially**

For each changed repository: push, open PR, wait for required CI, apply only evidence-backed fixes, merge, wait for main CI, then synchronize the local checkout to exact `origin/main`.

- [ ] **Step 3: Publish managed local runtime with an exact release manifest**

Use the repositories' existing release scripts. Record source SHA, image/artifact digest, runtime asset hash, service health, and rollback path. Keep local candidate and production claims separate.

- [ ] **Step 4: Perform real browser acceptance on 63182 and overview 63200**

Use authoritative Backend data and exact temporary names. Verify:

1. Existing market, production, and logistics page shell/style unchanged.
2. No fill-status filter, photo action, or returned-correction UI.
3. Address and maintainer columns visible.
4. Agricultural-input store visible in market object types.
5. Assigned maintainer can edit; another ordinary account cannot.
6. Unreferenced/no-history sample deletes; protected sample remains with an explanation.
7. A period value update persists after reload and appears on all applicable overview surfaces after SSE without manual refresh.
8. A design-point reference update refreshes reference surfaces without acquiring a fake price/inventory value.
9. Desktop and 390px have no page-level horizontal overflow.
10. Console has no relevant errors or warnings.

- [ ] **Step 5: Clean temporary browser/API/database data**

Resolve exact temporary IDs first, delete only those IDs, then prove zero by API and database queries. Do not delete pre-existing business records.

- [ ] **Step 6: Preflight production authorization and deployment**

Confirm the target environment, backup/rollback readiness, final manifest, and current Wu Yutong grants. Prepare the exact revocation and least-privilege checks, but do not mutate production until every prior gate is green and the supervisor records a go decision.

- [ ] **Step 7: Revoke acceptance privilege and validate the production role matrix at deployment time**

Verify administrator assignment, assigned-maintainer edit, non-maintainer denial, audit, persistence/requery, and overview realtime behavior in the official environment. Any failure is a no-go and triggers rollback; do not report production completion from local evidence.
