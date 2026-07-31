# Unified Enterprise Workspaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mixed old/new prototype with one coherent enterprise shell and complete workspaces for personal work, executive overview, production monitoring, market monitoring, supply-demand analysis, and report management.

**Architecture:** Keep the existing prototype entry point and report composer, but replace application-specific route fields and the generic `GeneralWorkspace` with a validated application/section route and focused workspace components. Share one compact visual system and one business context component while allowing every domain to own its page structure.

**Tech Stack:** React 19, TypeScript 5.9, Vite 8, Vitest 4, Testing Library, CSS.

## Global Constraints

- Ordinary users see six primary entries: 我的工作、经营总览、产情监测、市场监测、供需与态势、报表中心.
- Business entry belongs to production or market; My Work and reports never create a second source document.
- Market and production support online entry, Excel import, and authorized system collection through one validation and review flow.
- Supply-demand pages are read-only consumers of approved indicator versions.
- The shell is 64 px high and the desktop sidebar is 176 px wide.
- Body and table text use 12–13 px; page titles use 24–26 px.
- The prototype labels demo values as 演示环境·非生产数据.
- No technical status codes, implementation terms, or fabricated official administrative totals appear in business pages.
- Preserve unrelated working-tree changes and commit only prototype files and documents changed by this plan.

---

### Task 1: Unified Application and Section Routing

**Files:**
- Modify: `src/prototype/formalEnterpriseModel.ts`
- Modify: `src/prototype/formalEnterpriseModel.spec.ts`
- Modify: `src/prototype/formalEnterpriseData.ts`

**Interfaces:**
- Produces: `FormalApplication`, `FormalSection`, `FormalRoute`, `formalSectionsByApplication`, `readFormalRoute(search)`, `writeFormalRoute(route)`.
- Consumes: existing responsibility helpers without changing their signatures.

- [ ] **Step 1: Write failing route tests**

```ts
expect(readFormalRoute("?page=production&section=collection")).toEqual({
  application: "production",
  section: "collection",
});
expect(readFormalRoute("?page=supply&section=lineage")).toEqual({
  application: "supply",
  section: "lineage",
});
expect(readFormalRoute("?page=unknown&section=unknown")).toEqual({
  application: "work",
  section: "inbox",
});
expect(
  writeFormalRoute({ application: "reporting", section: "duty-reports" }),
).toBe("page=reporting&section=duty-reports");
```

- [ ] **Step 2: Run the route test and verify failure**

Run: `npm test -- src/prototype/formalEnterpriseModel.spec.ts`

Expected: FAIL because `FormalRoute` still contains `reportingSection` and `marketSection`.

- [ ] **Step 3: Implement the unified route**

```ts
export const formalSectionsByApplication = {
  work: ["inbox", "reporting", "review", "exception", "completed"],
  overview: ["overview"],
  production: ["overview", "objects", "collection", "review", "reports"],
  market: ["overview", "objects", "collection", "review", "reports"],
  supply: ["overview", "accounts", "regional", "lineage", "situation"],
  reporting: [
    "business-reports",
    "duty-reports",
    "review",
    "distribution",
    "versions",
  ],
} as const;

export interface FormalRoute {
  application: FormalApplication;
  section: FormalSection;
}
```

`readFormalRoute` must validate the section against the selected application and use that application's first section as the default. `writeFormalRoute` must omit the section only when it equals the application default.

- [ ] **Step 4: Replace the application definitions**

Define the six ordinary-user entries and their exact navigation labels from the confirmed design. Rename the user-facing reporting application to `报表中心`; keep the internal key `reporting` for compatibility with the report model.

- [ ] **Step 5: Run route and data tests**

Run: `npm test -- src/prototype/formalEnterpriseModel.spec.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/prototype/formalEnterpriseModel.ts src/prototype/formalEnterpriseModel.spec.ts src/prototype/formalEnterpriseData.ts
git commit -m "feat: unify enterprise workspace routing"
```

### Task 2: Shared Compact Workspace Primitives

**Files:**
- Create: `src/prototype/UnifiedWorkspacePrimitives.tsx`
- Create: `src/prototype/unified-workspaces.css`
- Create: `src/prototype/UnifiedWorkspacePrimitives.spec.tsx`
- Modify: `src/prototype/main.tsx`

**Interfaces:**
- Produces: `WorkspaceHeader`, `BusinessContextBar`, `WorkspaceStatus`, `CompactMetricStrip`, `WorkspacePanel`, `WorkspaceTable`, `CollectionModeSwitch`.
- Consumes: React children and plain business labels only.

- [ ] **Step 1: Write failing primitive tests**

```tsx
render(
  <BusinessContextBar
    items={[
      ["组织", "东北区域经营中心"],
      ["地区", "齐齐哈尔指定范围"],
      ["期间", "2026 年第 31 周"],
    ]}
    state="本期采集中"
  />,
);
expect(screen.getByText("齐齐哈尔指定范围")).toBeVisible();
expect(screen.getByText("本期采集中")).toBeVisible();
```

- [ ] **Step 2: Run the primitive test and verify failure**

Run: `npm test -- src/prototype/UnifiedWorkspacePrimitives.spec.tsx`

Expected: FAIL because the new module does not exist.

- [ ] **Step 3: Implement the primitives**

Use semantic `header`, `section`, `table`, `button`, and status elements. `WorkspaceTable` must wrap only its own table in an overflow container. `CollectionModeSwitch` must expose `aria-pressed` for online, Excel, and system modes.

- [ ] **Step 4: Implement the shared visual tokens**

Define:

```css
.formal-enterprise {
  --workspace-navy: #082f43;
  --workspace-teal: #0f837a;
  --workspace-text: #18384a;
  --workspace-muted: #718896;
  --workspace-line: #d6e1e6;
  --workspace-bg: #edf3f5;
}

.formal-shell {
  grid-template-columns: 176px minmax(0, 1fr);
}
```

Set the global header to 64 px, use 24–26 px page titles, 12–13 px body text, 36–40 px table rows, restrained borders, and no decorative gradients.

- [ ] **Step 5: Import the unified stylesheet**

Add `import "./unified-workspaces.css";` after the existing prototype styles in `main.tsx` so the unified system consistently overrides old shell dimensions.

- [ ] **Step 6: Run primitive tests and prototype build**

Run: `npm test -- src/prototype/UnifiedWorkspacePrimitives.spec.tsx && npm run build:prototype`

Expected: PASS and a successful prototype build.

- [ ] **Step 7: Commit**

```bash
git add src/prototype/UnifiedWorkspacePrimitives.tsx src/prototype/UnifiedWorkspacePrimitives.spec.tsx src/prototype/unified-workspaces.css src/prototype/main.tsx
git commit -m "feat: add unified enterprise workspace primitives"
```

### Task 3: My Work and Executive Overview

**Files:**
- Create: `src/prototype/MyWorkWorkspace.tsx`
- Create: `src/prototype/ExecutiveOverviewWorkspace.tsx`
- Create: `src/prototype/PortalWorkspaces.spec.tsx`

**Interfaces:**
- Produces: `MyWorkWorkspace({ section, onOpenBusiness })`, `ExecutiveOverviewWorkspace({ onOpenApplication })`.
- Consumes: `weeklyTasks`, shared workspace primitives, and route callbacks.

- [ ] **Step 1: Write failing portal tests**

```tsx
render(<MyWorkWorkspace section="reporting" onOpenBusiness={openBusiness} />);
await user.click(screen.getByRole("button", { name: "进入市场填报" }));
expect(openBusiness).toHaveBeenCalledWith("market", "collection");

render(<ExecutiveOverviewWorkspace onOpenApplication={openApplication} />);
expect(screen.getByText("产情正式指标")).toBeVisible();
expect(screen.getByText("市场运行态势")).toBeVisible();
expect(screen.queryByRole("button", { name: "维护经营数字" })).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the tests and verify failure**

Run: `npm test -- src/prototype/PortalWorkspaces.spec.tsx`

Expected: FAIL because the workspaces do not exist.

- [ ] **Step 3: Implement My Work**

Render responsibility identity, current week, nearest deadline, a priority-sorted task table, exception rail, and completed records. Every entry action must invoke `onOpenBusiness` with a production or market section; no business-value input exists in this component.

- [ ] **Step 4: Implement Executive Overview**

Render read-only production, market, supply, coverage, risk, and latest-report summaries with drill-down actions. Mark values as approved, preliminary, or pending verification. Do not provide a data-entry action.

- [ ] **Step 5: Run portal tests**

Run: `npm test -- src/prototype/PortalWorkspaces.spec.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/prototype/MyWorkWorkspace.tsx src/prototype/ExecutiveOverviewWorkspace.tsx src/prototype/PortalWorkspaces.spec.tsx
git commit -m "feat: add work and executive portal workspaces"
```

### Task 4: Complete Production Monitoring Workspace

**Files:**
- Create: `src/prototype/productionMonitoringModel.ts`
- Create: `src/prototype/productionMonitoringData.ts`
- Create: `src/prototype/ProductionMonitoringWorkspace.tsx`
- Create: `src/prototype/ProductionMonitoringWorkspace.spec.tsx`

**Interfaces:**
- Produces: `ProductionMonitoringWorkspace({ section, onSectionChange, onComposeReport })`, `getProductionFieldGroups(objectType, crop)`.
- Consumes: `BusinessReportContext`, shared primitives, and route section callbacks.

- [ ] **Step 1: Write failing production tests**

```tsx
render(
  <ProductionMonitoringWorkspace
    section="overview"
    onSectionChange={changeSection}
    onComposeReport={composeReport}
  />,
);
expect(screen.getByText("德美亚3号")).toBeVisible();
expect(screen.getByText("黑农84")).toBeVisible();
expect(screen.getByText("龙粳31")).toBeVisible();
expect(screen.getByText("样本结果")).toBeVisible();
expect(screen.getByText("区域估计")).toBeVisible();

render(
  <ProductionMonitoringWorkspace
    section="collection"
    onSectionChange={changeSection}
    onComposeReport={composeReport}
  />,
);
expect(screen.getByRole("button", { name: "在线填报" })).toBeVisible();
expect(screen.getByRole("button", { name: "Excel批量导入" })).toBeVisible();
expect(screen.getByText("质量与检验依据")).toBeVisible();
```

- [ ] **Step 2: Run production tests and verify failure**

Run: `npm test -- src/prototype/ProductionMonitoringWorkspace.spec.tsx`

Expected: FAIL because the production workspace does not exist.

- [ ] **Step 3: Implement the production model and data**

Define object types for farmers, family farms, cooperatives, agricultural stations, village ledgers, and field plots. Define crop-specific variety, area, growth, yield, stock, sale, intention, cost-support, and quality groups. Keep crop varieties as editable source names with confirmation states.

- [ ] **Step 4: Implement the five production sections**

The overview shows crop scope and separates sample observations from regional estimates. Objects show one record per monitoring object. Collection supports online, Excel, and system modes in one task flow. Review shows separate document, quality, duty, and publication states. Reports create a production report context from approved data.

- [ ] **Step 5: Run production tests and build**

Run: `npm test -- src/prototype/ProductionMonitoringWorkspace.spec.tsx && npm run build:prototype`

Expected: PASS and a successful build.

- [ ] **Step 6: Commit**

```bash
git add src/prototype/productionMonitoringModel.ts src/prototype/productionMonitoringData.ts src/prototype/ProductionMonitoringWorkspace.tsx src/prototype/ProductionMonitoringWorkspace.spec.tsx
git commit -m "feat: complete production monitoring workspace"
```

### Task 5: Explainable Supply-Demand Workspace

**Files:**
- Modify: `src/prototype/supplyBalanceScope.ts`
- Modify: `src/prototype/supplyBalanceScope.spec.ts`
- Create: `src/prototype/SupplyDemandWorkspace.tsx`
- Create: `src/prototype/SupplyDemandWorkspace.spec.tsx`

**Interfaces:**
- Produces: `SupplyDemandWorkspace({ section, onComposeReport })`, `getSupplyBalanceEquation(scopeKey)`.
- Consumes: `supplyBalanceScopes`, shared primitives, and `BusinessReportContext`.

- [ ] **Step 1: Write failing account tests**

```ts
expect(getSupplyBalanceEquation("qiqihar")).toEqual(
  expect.objectContaining({
    totalSupply: "763.1",
    totalUse: "659.2",
    bookEnding: "103.9",
    surveyEnding: "105.6",
    inventoryDifference: "1.7",
  }),
);
```

```tsx
render(
  <SupplyDemandWorkspace
    section="overview"
    onComposeReport={composeReport}
  />,
);
expect(screen.getByText("调整前账面期末")).toBeVisible();
expect(screen.getByText("库存平衡差额")).toBeVisible();
expect(screen.getByText("调查汇总期末 − 调整前账面期末")).toBeVisible();
```

- [ ] **Step 2: Run supply tests and verify failure**

Run: `npm test -- src/prototype/supplyBalanceScope.spec.ts src/prototype/SupplyDemandWorkspace.spec.tsx`

Expected: FAIL because the account equation and workspace do not exist.

- [ ] **Step 3: Expand the supply account model**

Store the supply components, use components, book ending, approved adjustment, adopted ending, survey ending, inventory difference, input version, and publication status separately. Preserve missing values as missing or pending instead of zero.

- [ ] **Step 4: Implement the five supply sections**

Overview explains the account at a glance. Product accounts separate corn, soybean, paddy, and rice. Regional balance switches city and authorized counties. Indicator lineage shows source, cutoff, quality, approval, and version. Situation analysis separates preliminary explanatory indicators from formal account quantities.

- [ ] **Step 5: Run supply tests and build**

Run: `npm test -- src/prototype/supplyBalanceScope.spec.ts src/prototype/SupplyDemandWorkspace.spec.tsx && npm run build:prototype`

Expected: PASS and a successful build.

- [ ] **Step 6: Commit**

```bash
git add src/prototype/supplyBalanceScope.ts src/prototype/supplyBalanceScope.spec.ts src/prototype/SupplyDemandWorkspace.tsx src/prototype/SupplyDemandWorkspace.spec.tsx
git commit -m "feat: add explainable supply demand workspace"
```

### Task 6: Consolidated Report Center and Market Deduplication

**Files:**
- Create: `src/prototype/ReportCenterWorkspace.tsx`
- Create: `src/prototype/ReportCenterWorkspace.spec.tsx`
- Modify: `src/prototype/MarketMonitoringWorkspace.tsx`
- Modify: `src/prototype/MarketMonitoringWorkspace.spec.tsx`

**Interfaces:**
- Produces: `ReportCenterWorkspace({ section, onComposeReport })`.
- Consumes: `businessReportRows`, responsibility assignments, duty snapshots, report composer, and shared primitives.

- [ ] **Step 1: Write failing report-center tests**

```tsx
render(
  <ReportCenterWorkspace
    section="duty-reports"
    onComposeReport={composeReport}
  />,
);
expect(screen.getByRole("button", { name: "导出责任周报" })).toBeVisible();
expect(screen.getByRole("button", { name: "导出责任月报" })).toBeVisible();
expect(screen.getByText("逾期补填保留原逾期记录")).toBeVisible();
```

Update the market report test to assert that `导出责任周报` and `导出责任月报` are absent from the market workspace.

- [ ] **Step 2: Run report tests and verify failure**

Run: `npm test -- src/prototype/ReportCenterWorkspace.spec.tsx src/prototype/MarketMonitoringWorkspace.spec.tsx`

Expected: FAIL because the report center does not exist and market still contains duty exports.

- [ ] **Step 3: Implement report center sections**

Business reports select business, region, product, period, frequency, and approved version. Duty reports include responsibility coverage, immutable deadline snapshots, weekly and monthly exports, and an authorized responsibility-management entry. Review, distribution, and versions preserve reviewer, recipients, replacement relation, and download history.

- [ ] **Step 4: Remove duplicate duty reporting from market**

Keep market business report generation, supply adoption, and approved-data explanation. Remove the market duty report panel so one duty result exists only in the report center.

- [ ] **Step 5: Run report and market tests**

Run: `npm test -- src/prototype/ReportCenterWorkspace.spec.tsx src/prototype/MarketMonitoringWorkspace.spec.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/prototype/ReportCenterWorkspace.tsx src/prototype/ReportCenterWorkspace.spec.tsx src/prototype/MarketMonitoringWorkspace.tsx src/prototype/MarketMonitoringWorkspace.spec.tsx
git commit -m "feat: consolidate enterprise report center"
```

### Task 7: Integrate the Six Workspaces into One Shell

**Files:**
- Modify: `src/prototype/FormalEnterprisePrototype.tsx`
- Modify: `src/prototype/FormalEnterprisePrototype.spec.tsx`
- Modify: `src/prototype/formal-enterprise.css`

**Interfaces:**
- Consumes: all workspace components and unified route callbacks.
- Produces: one shell whose sidebar and URL route every visible menu item.

- [ ] **Step 1: Write failing shell integration tests**

```tsx
render(
  <FormalEnterprisePrototype initialSearch="?page=production&section=collection" />,
);
expect(
  screen.getByRole("heading", { name: "产情数据采集工作台" }),
).toBeVisible();

render(
  <FormalEnterprisePrototype initialSearch="?page=supply&section=lineage" />,
);
expect(
  screen.getByRole("heading", { name: "指标与来源追溯" }),
).toBeVisible();

render(
  <FormalEnterprisePrototype initialSearch="?page=overview" />,
);
expect(screen.getByText("演示环境·非生产数据")).toBeVisible();
```

- [ ] **Step 2: Run shell tests and verify failure**

Run: `npm test -- src/prototype/FormalEnterprisePrototype.spec.tsx`

Expected: FAIL because the shell still renders `GeneralWorkspace`.

- [ ] **Step 3: Replace generic workspace rendering**

Remove `GeneralWorkspace`, the generic lifecycle panel, and obsolete reporting page dispatch. Render each focused workspace using `route.application` and `route.section`. Use a single `changeRoute({ application, section })` callback for the header selector, sidebar, task deep links, and workspace actions.

- [ ] **Step 4: Unify sidebar behavior**

Every navigation button calls the route callback. Use the six confirmed application definitions. Show the demo environment label in the header. Keep data governance and system management out of the ordinary-user navigation.

- [ ] **Step 5: Run the full prototype test suite**

Run: `npm test -- src/prototype`

Expected: all prototype tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/prototype/FormalEnterprisePrototype.tsx src/prototype/FormalEnterprisePrototype.spec.tsx src/prototype/formal-enterprise.css
git commit -m "feat: integrate unified enterprise workspace shell"
```

### Task 8: Full Verification and Visual Acceptance

**Files:**
- Create: `docs/superpowers/verification/2026-07-31-unified-enterprise-workspaces.md`
- Create screenshots under: `artifacts/`

**Interfaces:**
- Consumes: the completed prototype.
- Produces: verification evidence and six primary acceptance screenshots.

- [ ] **Step 1: Run focused formatting and lint checks**

Run:

```bash
npx prettier --check src/prototype docs/superpowers/specs/2026-07-31-unified-enterprise-workspace-redesign-design.md docs/superpowers/plans/2026-07-31-unified-enterprise-workspaces.md
npx eslint src/prototype --max-warnings 0
```

Expected: PASS.

- [ ] **Step 2: Run tests and build**

Run:

```bash
npm test
npm run build:prototype
```

Expected: all tests PASS and the prototype build succeeds.

- [ ] **Step 3: Inspect six primary routes at 1920×1080 and 1440×900**

Open:

```text
?variant=A&page=work
?variant=A&page=overview
?variant=A&page=production
?variant=A&page=market
?variant=A&page=supply
?variant=A&page=reporting
```

For each route verify:

- no page-level horizontal overflow;
- visible application and section title;
- correct region, product, period, and state context;
- compact 176 px sidebar at desktop width;
- no technical or development language in business content;
- all visible navigation buttons change the route and content.

- [ ] **Step 4: Inspect critical subpages**

Verify production collection, market collection, supply indicator lineage, and duty reports. Confirm online/Excel/system modes share one workflow and no duty export remains in market.

- [ ] **Step 5: Save screenshots and verification record**

Save:

```text
artifacts/unified-work-1920.png
artifacts/unified-overview-1920.png
artifacts/unified-production-1920.png
artifacts/unified-market-1920.png
artifacts/unified-supply-1920.png
artifacts/unified-reports-1920.png
```

Record exact commands, results, viewport checks, and screenshot paths in the verification document.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/verification/2026-07-31-unified-enterprise-workspaces.md
git commit -m "docs: verify unified enterprise workspaces"
```
