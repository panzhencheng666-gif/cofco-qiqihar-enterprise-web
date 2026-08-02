# Unified Ledger Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify production, market, supply, logistics, analysis, and report pages into a responsive table-led workbench whose filters never overlap or overflow.

**Architecture:** Keep the existing business models and data selectors intact. Standardize presentation through the existing `enterprise-ledger-query` and `CompactBusinessQuery` primitives, then remove duplicate analysis/report scaffolding so every page follows query → ledger → row action or expanded analysis.

**Tech Stack:** React 19, TypeScript 5.9, CSS Grid/Flexbox, Vitest, Testing Library, Vite.

## Global Constraints

- Modify only files under `src/prototype`.
- Preserve every effective business field, authorization rule, dataset selector, report generator, and export action.
- Do not expose internal codes, development versions, or technical status labels to business users.
- Do not stage, commit, revert, or overwrite pre-existing dirty implementation files.
- Use table-led workspaces; do not add dashboard cards.

---

### Task 1: Standardize the shared query toolbar

**Files:**
- Modify: `src/prototype/unified-workspaces.css`
- Test: `src/prototype/UnifiedWorkspacePrimitives.spec.tsx`
- Test: `src/prototype/ProductionMonitoringWorkspace.spec.tsx`
- Test: `src/prototype/MarketMonitoringWorkspace.spec.tsx`

**Interfaces:**
- Consumes: existing `.enterprise-ledger-query`, `.region-cascade-selector`, and `.enterprise-ledger-query__actions` markup.
- Produces: one shared width and wrapping contract for production, market, logistics, supply, and report queries.

- [ ] **Step 1: Add failing contract assertions**

```ts
expect(css).toContain("--enterprise-query-control-width: 176px");
expect(css).toContain("--enterprise-query-region-width: 220px");
expect(css).toMatch(/\.enterprise-ledger-query__actions\s*\{[^}]*margin-inline-start:\s*auto/s);
expect(css).not.toMatch(/enterprise-ledger-query--production\s*\{[^}]*170px 280px/s);
```

- [ ] **Step 2: Run the focused tests and confirm the new contract is absent**

Run: `npm test -- src/prototype/UnifiedWorkspacePrimitives.spec.tsx src/prototype/ProductionMonitoringWorkspace.spec.tsx src/prototype/MarketMonitoringWorkspace.spec.tsx`

Expected: FAIL only on the new query-layout assertions.

- [ ] **Step 3: Replace page-specific fixed grids with shared field units**

```css
.enterprise-ledger-query {
  --enterprise-query-control-width: 176px;
  --enterprise-query-region-width: 220px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
}

.enterprise-ledger-query > label {
  display: grid;
  grid-template-columns: max-content var(--enterprise-query-control-width);
  align-items: center;
  gap: 8px;
}

.enterprise-ledger-query > .region-cascade-selector {
  display: grid;
  grid-template-columns: max-content var(--enterprise-query-region-width);
  align-items: center;
  gap: 8px;
}

.enterprise-ledger-query__actions {
  margin-inline-start: auto;
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
}
```

At narrow breakpoints, set the action group to `width: 100%`, keep all three buttons together, and right-align it. Do not assign independent fixed column lists to individual business pages.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/prototype/UnifiedWorkspacePrimitives.spec.tsx src/prototype/ProductionMonitoringWorkspace.spec.tsx src/prototype/MarketMonitoringWorkspace.spec.tsx`

Expected: PASS.

- [ ] **Step 5: Check the CSS diff without staging user changes**

Run: `git diff --check -- src/prototype/unified-workspaces.css src/prototype/UnifiedWorkspacePrimitives.spec.tsx src/prototype/ProductionMonitoringWorkspace.spec.tsx src/prototype/MarketMonitoringWorkspace.spec.tsx`

Expected: no output.

### Task 2: Unify production and market analysis

**Files:**
- Modify: `src/prototype/production/ProductionAnalysisWorkspace.tsx`
- Modify: `src/prototype/market/MarketAnalysisWorkspace.tsx`
- Modify: `src/prototype/unified-workspaces.css`
- Modify: `src/prototype/market-monitoring.css`
- Test: `src/prototype/ProductionMonitoringWorkspace.spec.tsx`
- Test: `src/prototype/MarketMonitoringWorkspace.spec.tsx`

**Interfaces:**
- Consumes: `OperationalScope`, `BusinessCoordinates`, existing comparison queries, `QuickReportExportMenu`, and selected metric state.
- Produces: identical analysis-page order: header → compact filters → single result state → four-year ledger → selected-metric charts.

- [ ] **Step 1: Add failing structure assertions**

```ts
expect(screen.getByRole("region", { name: "产情分析查询条件" })).toBeVisible();
expect(screen.getByRole("table", { name: "产情四年指标台账" })).toBeVisible();
expect(screen.queryByRole("region", { name: "产情分析结果摘要" })).not.toBeInTheDocument();

expect(screen.getByRole("region", { name: "市场分析查询条件" })).toBeVisible();
expect(screen.getByRole("table", { name: "市场四年指标台账" })).toBeVisible();
expect(screen.queryByRole("region", { name: "市场分析结果摘要" })).not.toBeInTheDocument();
expect(screen.queryByText(/数据状态：正式发布数据/)).not.toBeInTheDocument();
```

- [ ] **Step 2: Run both focused suites and confirm the old duplicate layers fail the assertions**

Run: `npm test -- src/prototype/ProductionMonitoringWorkspace.spec.tsx src/prototype/MarketMonitoringWorkspace.spec.tsx`

Expected: FAIL on summary/status-layer assertions.

- [ ] **Step 3: Keep four primary filters and move traceability fields under one progressive disclosure**

Production primary fields remain business classification, region, product/crop, and analysis period. Market primary fields use the same order. Specific cultivar, official data status, and adopted approved dataset are rendered under the existing single “更多条件” control; adopted data remains required before querying.

```tsx
<CompactBusinessQuery
  ariaLabel="市场分析查询条件"
  primaryFields={[classificationField, regionField, productField, periodField]}
  moreFields={[cultivarField, adoptedDatasetField]}
  actions={<button className="is-primary" type="button">查询</button>}
/>
```

- [ ] **Step 4: Remove duplicate context and summary layers**

Delete the market data-status paragraph, filter chips that restate the selected values, and both analysis summary strips. Keep authorization, cultivar mismatch, unmapped data, and invalid metric errors, but render only the applicable message. Keep one empty-state sentence inside the ledger region.

- [ ] **Step 5: Preserve ledger and metric expansion behavior**

```tsx
<button type="button" onClick={() => onScopeChange({ selectedMetricId: metric.id })}>
  分析{metric.label}
</button>
```

The existing comparison tables and charts remain the only analytical output; no card summary is introduced.

- [ ] **Step 6: Run both analysis suites**

Run: `npm test -- src/prototype/ProductionMonitoringWorkspace.spec.tsx src/prototype/MarketMonitoringWorkspace.spec.tsx`

Expected: PASS.

### Task 3: Convert business reports to one compact generation path

**Files:**
- Modify: `src/prototype/ReportCenterWorkspace.tsx`
- Modify: `src/prototype/unified-workspaces.css`
- Test: `src/prototype/ReportCenterWorkspace.spec.tsx`
- Test: `src/prototype/BusinessReportComposer.spec.tsx`

**Interfaces:**
- Consumes: approved report datasets, report authorization, `buildReportContext`, `QuickReportExportMenu`, and the existing report workflow.
- Produces: one query surface with six primary coordinates, four progressive fields, one generate action, and one report ledger.

- [ ] **Step 1: Replace fieldset-count expectations with one compact-query expectation**

```ts
const query = screen.getByRole("region", { name: "业务报告生成条件" });
expect(within(query).getByRole("combobox", { name: "业务类型" })).toBeVisible();
expect(within(query).getByLabelText("选择地区")).toBeVisible();
expect(within(query).getByRole("combobox", { name: "产品或专题" })).toBeVisible();
expect(within(query).getByRole("combobox", { name: "报告频率" })).toBeVisible();
expect(within(query).getByRole("combobox", { name: "报告期间" })).toBeVisible();
expect(within(query).getByRole("combobox", { name: "采用数据" })).toBeVisible();
expect(screen.queryByRole("group", { name: "报告范围" })).not.toBeInTheDocument();
```

- [ ] **Step 2: Run report tests and confirm the old fieldset layout fails**

Run: `npm test -- src/prototype/ReportCenterWorkspace.spec.tsx src/prototype/BusinessReportComposer.spec.tsx`

Expected: FAIL on compact-layout assertions.

- [ ] **Step 3: Render the existing fields through `CompactBusinessQuery`**

```tsx
<CompactBusinessQuery
  ariaLabel="业务报告生成条件"
  primaryFields={[
    applicationField,
    regionField,
    productField,
    frequencyField,
    periodField,
    adoptedDatasetField,
  ]}
  moreFields={[
    classificationField,
    cultivarField,
    templateField,
    reportChapterField,
  ]}
  actions={
    <>
      <button className="is-primary" disabled={!canCompose} type="button" onClick={composeReport}>
        生成报告
      </button>
      <QuickReportExportMenu request={quickReportRequest} exportAllowed={canExport} onExport={onQuickExport} />
    </>
  }
/>
```

Display the data cutoff as supporting text beside adopted data after selection. Remove the separate cutoff container, standalone export toolbar, and repeated selection summary while retaining all dependent selections and report validation.

- [ ] **Step 4: Keep one report ledger below the query**

The existing “待继续编辑” and report-history rows remain accessible through their current table/tabs. Generation blockers appear once near the generate action and are never duplicated under the table.

- [ ] **Step 5: Run report tests**

Run: `npm test -- src/prototype/ReportCenterWorkspace.spec.tsx src/prototype/BusinessReportComposer.spec.tsx`

Expected: PASS, including all five governed export kinds.

### Task 4: Verify the integrated prototype

**Files:**
- Verify only: `src/prototype/**`

**Interfaces:**
- Consumes: completed query, analysis, and report workspaces.
- Produces: evidence that the approved architecture works at the actual desktop viewport.

- [ ] **Step 1: Run prototype-focused tests**

Run: `npm test -- src/prototype`

Expected: all prototype tests PASS.

- [ ] **Step 2: Run type and build checks**

Run: `npx tsc -b --pretty false`

Expected: exit code 0.

Run: `npm run build:prototype`

Expected: exit code 0. The existing Node engine warning for local Node 24.14 versus required 24.15 is informational only if the build succeeds.

- [ ] **Step 3: Inspect the four critical routes in the in-app browser**

Verify production collection, market collection, production/market analysis, and business report routes at the actual application viewport. For each route confirm:

- no label overlaps another control;
- all query actions remain inside the white query surface;
- the page has one visible query path and one ledger/empty state;
- the region selector and one non-region filter respond to interaction;
- the browser console contains no new warnings or errors.

- [ ] **Step 4: Save final screenshots outside the repository**

Save screenshots under `/tmp/qiqihar-unified-ledger-workbench/` so no generated artifacts modify the repository.

- [ ] **Step 5: Check the final scoped diff**

Run: `git diff --check -- src/prototype`

Expected: no output. Stop after this check; do not run unrelated repository-wide validation.
