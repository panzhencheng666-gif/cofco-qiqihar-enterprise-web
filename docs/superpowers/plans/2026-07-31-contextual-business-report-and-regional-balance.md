# Contextual Business Report and Regional Balance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add context-aware daily, weekly, and monthly business report export; make regional supply-balance scope explicit; remove implementation-oriented copy; and expand the content area with a 192px sidebar.

**Architecture:** Keep business calculations in the existing business workspaces and add a pure report-definition layer that reads the current application context without recalculating metrics. A focused report composer handles period selection, narrative preview, and PDF/Word/Excel output. Supply balance gets its own geographic-scope registry so city consolidation and county drill-down remain explicit and testable.

**Tech Stack:** React 19, TypeScript 5.9, Vitest, Testing Library, browser Blob/download APIs, Vite, CSS.

## Global Constraints

- Business reports use already approved values and do not recalculate indicators during export.
- Business reports and responsibility reports remain separate.
- PDF opens a print-ready document, Word downloads an editable `.doc`, and Excel downloads a UTF-8 CSV data attachment.
- The formal interface must not contain prototype, demo, AI, model, interface, component, state-machine, fact-table, or data-lineage language.
- Desktop sidebar width is exactly 192px.
- Current business, crop, geographic scope, period, data cutoff, and adopted version remain visible.
- City supply balance eliminates county-to-county internal flows; county balances expose coverage and are not silently promoted to official city totals.
- Preserve unrelated dirty-worktree changes and stage only files listed by the task being committed.

---

### Task 1: Pure business-report definition and export model

**Files:**
- Create: `src/prototype/businessReportModel.ts`
- Create: `src/prototype/businessReportModel.spec.ts`

**Interfaces:**
- Consumes: `FormalApplication` from `src/prototype/formalEnterpriseModel.ts`.
- Produces:
  - `ReportableApplication`
  - `BusinessReportFrequency`
  - `BusinessReportFormat`
  - `BusinessReportContext`
  - `BusinessReportDraft`
  - `createBusinessReportDraft(context, frequency)`
  - `createBusinessReportArtifact(draft, format)`

- [ ] **Step 1: Write failing report-model tests**

```ts
import { describe, expect, it } from "vitest";
import {
  createBusinessReportArtifact,
  createBusinessReportDraft,
  type BusinessReportContext,
} from "./businessReportModel";

const marketContext: BusinessReportContext = {
  application: "market",
  applicationLabel: "市场监测",
  product: "玉米",
  region: "齐齐哈尔市全域",
  period: "2026 年第 31 周",
  dataCutoff: "2026-07-31 17:00",
  dataVersion: "市场监测第 31 周审核版",
  author: "王洋",
  reviewer: "赵晨",
};

describe("business report model", () => {
  it("creates a weekly report from the selected business context", () => {
    const draft = createBusinessReportDraft(marketContext, "周报");
    expect(draft.title).toBe("齐齐哈尔市全域玉米市场监测周报");
    expect(draft.summary).toContain("2,346 元/吨");
    expect(draft.summary).toContain("96 元/吨");
    expect(draft.frequency).toBe("周报");
  });

  it("uses the selected frequency without changing the adopted data version", () => {
    const daily = createBusinessReportDraft(marketContext, "日报");
    const monthly = createBusinessReportDraft(marketContext, "月报");
    expect(daily.dataVersion).toBe(marketContext.dataVersion);
    expect(monthly.dataVersion).toBe(marketContext.dataVersion);
  });

  it("builds deterministic Word and Excel artifacts", () => {
    const draft = createBusinessReportDraft(marketContext, "周报");
    expect(createBusinessReportArtifact(draft, "Word").filename).toMatch(
      /市场监测-玉米-周报/,
    );
    expect(createBusinessReportArtifact(draft, "Excel").content).toContain(
      "指标,本期值,说明",
    );
  });
});
```

- [ ] **Step 2: Run the tests and verify failure**

Run:

```bash
npx vitest run src/prototype/businessReportModel.spec.ts
```

Expected: FAIL because `businessReportModel.ts` does not exist.

- [ ] **Step 3: Implement the pure report model**

Define exact report types and a domain-copy registry:

```ts
export type ReportableApplication = "production" | "market" | "supply";
export type BusinessReportFrequency = "日报" | "周报" | "月报";
export type BusinessReportFormat = "PDF" | "Word" | "Excel";

export interface BusinessReportContext {
  application: ReportableApplication;
  applicationLabel: string;
  product: string;
  region: string;
  period: string;
  dataCutoff: string;
  dataVersion: string;
  author: string;
  reviewer: string;
}

export interface BusinessReportDraft extends BusinessReportContext {
  frequency: BusinessReportFrequency;
  title: string;
  reportNumber: string;
  summary: string;
  chapters: readonly { title: string; body: string }[];
  indicators: readonly { label: string; value: string; note: string }[];
}

export interface BusinessReportArtifact {
  filename: string;
  mimeType: string;
  content: string;
  action: "download" | "print";
}
```

Use explicit human-edited copy for production, market, and supply. The market weekly summary must include the current `2,346 元/吨` price, `0.8%` weekly change, `96 元/吨` regional spread, and affected northern counties. Supply copy must state the current region and whether it is a city consolidation or county account.

`createBusinessReportArtifact()` returns:

- PDF: print-ready HTML and `action: "print"`;
- Word: Word-compatible HTML, MIME `application/msword`, and `.doc`;
- Excel: BOM-prefixed CSV, MIME `text/csv;charset=utf-8`, and `.csv`.

- [ ] **Step 4: Run report-model tests**

Run:

```bash
npx vitest run src/prototype/businessReportModel.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit report model**

```bash
git add -- src/prototype/businessReportModel.ts src/prototype/businessReportModel.spec.ts
git commit -m "feat: add contextual business report model"
```

---

### Task 2: Regional supply-balance scope model

**Files:**
- Create: `src/prototype/supplyBalanceScope.ts`
- Create: `src/prototype/supplyBalanceScope.spec.ts`

**Interfaces:**
- Produces:
  - `SupplyBalanceScope`
  - `supplyBalanceScopes`
  - `getSupplyBalanceScope(scopeKey)`
  - `getSupplyBalanceMetrics(scopeKey)`

- [ ] **Step 1: Write failing regional-scope tests**

```ts
import { describe, expect, it } from "vitest";
import {
  getSupplyBalanceMetrics,
  getSupplyBalanceScope,
} from "./supplyBalanceScope";

describe("supply balance scope", () => {
  it("uses the city consolidated account by default", () => {
    const scope = getSupplyBalanceScope("qiqihar");
    expect(scope.label).toBe("齐齐哈尔市全域");
    expect(scope.level).toBe("市级合并");
    expect(scope.internalFlowElimination).toBe("42.6 万吨");
  });

  it("distinguishes county coverage from city consolidation", () => {
    const scope = getSupplyBalanceScope("nehe");
    expect(scope.level).toBe("县级账户");
    expect(scope.coverage).toBe("12 / 14 项已核定");
  });

  it("returns scope-specific balance metrics", () => {
    expect(getSupplyBalanceMetrics("qiqihar")[0].value).toBe("763.1");
    expect(getSupplyBalanceMetrics("nehe")[0].value).not.toBe("763.1");
  });
});
```

- [ ] **Step 2: Run the tests and verify failure**

Run:

```bash
npx vitest run src/prototype/supplyBalanceScope.spec.ts
```

Expected: FAIL because `supplyBalanceScope.ts` does not exist.

- [ ] **Step 3: Implement supply-balance scopes**

Create city and county entries with exact fields:

```ts
export interface SupplyBalanceScope {
  key: "qiqihar" | "nehe" | "longjiang" | "gannan" | "tailai";
  label: string;
  level: "市级合并" | "县级账户";
  coverage: string;
  internalFlowElimination: string;
  version: string;
  status: "已核定" | "待补数据";
}
```

The city entry uses:

- label `齐齐哈尔市全域`;
- coverage `16 / 16 个县区`;
- internal-flow elimination `42.6 万吨`;
- version `2026/27 年度第 4 版`;
- status `已核定`.

County entries use distinct supply, use, ending-stock, and balance-difference metrics. At least one county must use status `待补数据` so the interface can demonstrate coverage control.

- [ ] **Step 4: Run regional-scope tests**

Run:

```bash
npx vitest run src/prototype/supplyBalanceScope.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit regional model**

```bash
git add -- src/prototype/supplyBalanceScope.ts src/prototype/supplyBalanceScope.spec.ts
git commit -m "feat: model regional supply balance scopes"
```

---

### Task 3: Business report composer

**Files:**
- Create: `src/prototype/BusinessReportComposer.tsx`
- Create: `src/prototype/BusinessReportComposer.spec.tsx`
- Modify: `src/prototype/formal-enterprise.css`

**Interfaces:**
- Consumes `BusinessReportContext`, `BusinessReportFrequency`, `BusinessReportFormat`, `createBusinessReportDraft`, and `createBusinessReportArtifact`.
- Produces `BusinessReportComposer` with:

```ts
interface BusinessReportComposerProps {
  context: BusinessReportContext;
  onClose: () => void;
  onExport?: (
    format: BusinessReportFormat,
    artifact: BusinessReportArtifact,
  ) => void;
}
```

- [ ] **Step 1: Write failing composer tests**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { BusinessReportComposer } from "./BusinessReportComposer";

it("inherits context and switches daily weekly monthly report copy", async () => {
  const user = userEvent.setup();
  render(<BusinessReportComposer context={marketContext} onClose={vi.fn()} />);
  expect(screen.getByText("市场监测 · 玉米")).toBeVisible();
  expect(screen.getByText("齐齐哈尔市全域")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "月报" }));
  expect(screen.getByRole("heading", { name: /市场监测月报/ })).toBeVisible();
});

it("offers PDF Word and Excel output", () => {
  render(<BusinessReportComposer context={marketContext} onClose={vi.fn()} />);
  expect(screen.getByRole("button", { name: "导出 PDF" })).toBeVisible();
  expect(screen.getByRole("button", { name: "导出 Word" })).toBeVisible();
  expect(screen.getByRole("button", { name: "导出 Excel 附件" })).toBeVisible();
});
```

- [ ] **Step 2: Run the tests and verify failure**

Run:

```bash
npx vitest run src/prototype/BusinessReportComposer.spec.tsx
```

Expected: FAIL because the composer does not exist.

- [ ] **Step 3: Implement the composer**

Build an accessible modal with:

- heading `编制业务报告`;
- business context summary;
- segmented 日报 / 周报 / 月报 controls;
- report title and report number;
- data cutoff and adopted version;
- editable summary textarea;
- chapter preview;
- author and reviewer;
- export actions.

Default export behavior:

```ts
function exportArtifact(artifact: BusinessReportArtifact) {
  if (artifact.action === "print") {
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    printWindow?.document.write(artifact.content);
    printWindow?.document.close();
    printWindow?.print();
    return;
  }
  const url = URL.createObjectURL(
    new Blob([artifact.content], { type: artifact.mimeType }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = artifact.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
```

Use restrained modal styling: 760px width, clear two-column metadata, no gradient, no decorative animation, and visible keyboard focus.

- [ ] **Step 4: Run composer tests**

Run:

```bash
npx vitest run src/prototype/BusinessReportComposer.spec.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit composer**

```bash
git add -- src/prototype/BusinessReportComposer.tsx src/prototype/BusinessReportComposer.spec.tsx src/prototype/formal-enterprise.css
git commit -m "feat: add business report composer"
```

---

### Task 4: Integrate report composition and regional supply accounts

**Files:**
- Modify: `src/prototype/FormalEnterprisePrototype.tsx`
- Modify: `src/prototype/FormalEnterprisePrototype.spec.tsx`
- Modify: `src/prototype/formalEnterpriseData.ts`
- Modify: `src/prototype/formal-enterprise.css`

**Interfaces:**
- Consumes `BusinessReportComposer`, report context types, and supply-scope functions.
- `GeneralWorkspace` adds `onComposeReport(context)` and maintains selected supply scope.

- [ ] **Step 1: Add failing integration tests**

Add tests that:

```tsx
it("opens a report composer from the selected market workspace", async () => {
  const user = userEvent.setup();
  render(<FormalEnterprisePrototype initialSearch="?page=market" />);
  await user.click(screen.getByRole("button", { name: "编制业务报告" }));
  expect(screen.getByRole("dialog", { name: "编制业务报告" })).toBeVisible();
  expect(screen.getByText("市场监测 · 玉米")).toBeVisible();
});

it("shows city consolidation and allows county drill-down", async () => {
  const user = userEvent.setup();
  render(<FormalEnterprisePrototype initialSearch="?page=supply" />);
  expect(screen.getByText("齐齐哈尔市全域")).toBeVisible();
  expect(screen.getByText("内部流转抵销 42.6 万吨")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "讷河市" }));
  expect(screen.getByText("县级账户")).toBeVisible();
  expect(screen.getByText("12 / 14 项已核定")).toBeVisible();
});
```

- [ ] **Step 2: Run integration tests and verify failure**

Run:

```bash
npx vitest run src/prototype/FormalEnterprisePrototype.spec.tsx
```

Expected: FAIL because the new controls are absent.

- [ ] **Step 3: Integrate the report composer**

In `FormalEnterprisePrototype`:

- keep `reportContext` state;
- open the composer only for production, market, and supply;
- derive application label, product, region, period, cutoff, data version, author, and reviewer;
- close the composer without changing the business route.

Change page action labels:

- production: `导入调查结果`, `编制业务报告`;
- market: `导入主体报送`, `编制业务报告`;
- supply: `比较版本`, `编制业务报告`.

Do not add three separate frequency buttons to the page header.

- [ ] **Step 4: Add regional supply-balance panel**

For the supply workspace:

- default to `qiqihar`;
- show `当前平衡范围`, scope level, coverage, internal-flow elimination, and version;
- provide compact buttons for city and county scopes;
- replace the supply metric grid with scope-specific metrics;
- pass the selected region into the report composer;
- show a warning when a county scope is `待补数据`.

- [ ] **Step 5: Run integration tests**

Run:

```bash
npx vitest run src/prototype/FormalEnterprisePrototype.spec.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit integration**

```bash
git add -- src/prototype/FormalEnterprisePrototype.tsx src/prototype/FormalEnterprisePrototype.spec.tsx src/prototype/formalEnterpriseData.ts src/prototype/formal-enterprise.css
git commit -m "feat: integrate reports and regional supply balance"
```

---

### Task 5: Formal copy and 192px enterprise shell

**Files:**
- Modify: `src/prototype/formalEnterpriseData.ts`
- Modify: `src/prototype/FormalEnterprisePrototype.tsx`
- Modify: `src/prototype/formal-enterprise.css`
- Modify: `src/prototype/FormalEnterprisePrototype.spec.tsx`

**Interfaces:**
- No new public interface.

- [ ] **Step 1: Add copy and layout assertions**

Assert:

```tsx
expect(screen.queryByText(/事实|血缘|运行实例|重新计算/)).not.toBeInTheDocument();
expect(screen.getByText("业务台账")).toBeVisible();
expect(screen.getByText("本期数据已核定")).toBeVisible();
```

Browser structural QA later verifies `.formal-sidebar` is exactly `192px`.

- [ ] **Step 2: Replace implementation-oriented copy**

Use these exact replacements:

- `生产事实治理` → `生产监测数据管理`;
- `物流事实` → `物流信息`;
- `事实发布` → `监测结果发布`;
- `事实匹配` → `数据核对`;
- `事实资格` → `数据状态`;
- `版本与血缘` → `数据来源与版本`;
- `血缘` risk label → `来源`;
- `统一业务记录` → `业务台账`;
- `正式结果只生成一次` → `本期数据已核定`;
- `追加发布 · 不覆盖` → `修订留痕 · 原记录保留`;
- `业务报告运行` → `业务报告`;
- `新建报告运行` → `编制业务报告`;
- `业务报告定义与生成运行` → `业务报告编制与归档`;
- `统一结果引用` → `采用核定数据`;
- `引用正式版本` → `采用数据版本`;
- `报告运行时锁定截止时点` → `数据截止时间已确认`.

Rewrite scope notes from architecture language into user language:

- production: `按品种查看面积、长势、产量和调查对象`;
- market: `按品种查看主体报价、库存、交易和物流`;
- supply: `账户采用已核定的产情和市场数据`.

- [ ] **Step 3: Tighten the enterprise shell**

Apply:

```css
.formal-shell {
  grid-template-columns: 192px minmax(0, 1fr);
}

.formal-sidebar-app {
  min-height: 78px;
  padding: 0 14px;
}

.formal-sidebar-description {
  padding: 11px 14px;
}

.formal-sidebar-navigation {
  padding: 12px 8px 20px;
}

.formal-nav-group > span {
  font-size: 11px;
}

.formal-nav-group > button {
  min-height: 40px;
  padding: 0 9px;
  font-size: 13px;
}

.formal-main {
  padding-right: 24px;
  padding-left: 24px;
}
```

Keep 14px body text and 13px table text. Do not shrink business content to compensate for density.

- [ ] **Step 4: Run component, type, and style tests**

Run:

```bash
npx prettier --check src/prototype
npx eslint src/prototype --max-warnings 0
npx tsc -b
npx vitest run src/prototype
```

Expected: all commands pass.

- [ ] **Step 5: Commit copy and layout**

```bash
git add -- src/prototype/formalEnterpriseData.ts src/prototype/FormalEnterprisePrototype.tsx src/prototype/formal-enterprise.css src/prototype/FormalEnterprisePrototype.spec.tsx
git commit -m "refactor: refine formal enterprise shell and copy"
```

---

### Task 6: Browser verification, screenshots, and full quality gate

**Files:**
- Verify only; do not stage unrelated workspace files.

**Interfaces:**
- No new public interface.

- [ ] **Step 1: Run full automated verification**

Run:

```bash
npx prettier --check package.json prototype.html vite.prototype.config.ts tsconfig.app.json src/prototype
npx eslint vite.prototype.config.ts src/prototype --max-warnings 0
npx tsc -b
npm run build:prototype
npm test
git diff --check
```

Expected: formatting, lint, typecheck, prototype build, all tests, and diff check pass.

- [ ] **Step 2: Verify browser structure**

At 1366px or wider, verify:

- `.formal-sidebar` computed width is `192px`;
- `documentElement.scrollWidth - documentElement.clientWidth` is `0`;
- page title, context, crop scope, metric grid, and report action are visible;
- no console errors.

- [ ] **Step 3: Verify report workflow**

For production, market, and supply:

1. open the application;
2. select `编制业务报告`;
3. confirm application, product, region, period, cutoff, and data version;
4. switch 日报, 周报, 月报;
5. invoke Word and Excel downloads;
6. verify PDF opens the print-ready view;
7. close the composer and confirm the route is unchanged.

- [ ] **Step 4: Verify regional supply balance**

On supply:

1. confirm default `齐齐哈尔市全域`;
2. confirm `市级合并`;
3. confirm `内部流转抵销 42.6 万吨`;
4. choose `讷河市`;
5. confirm `县级账户`;
6. confirm metrics change and coverage is visible;
7. open report composer and confirm its region is `讷河市`.

- [ ] **Step 5: Capture final screenshots**

Save:

- `formal-production-report-composer.jpg`;
- `formal-market-report-composer.jpg`;
- `formal-supply-city-balance.jpg`;
- `formal-supply-county-balance.jpg`;
- `formal-business-report-management.jpg`.

- [ ] **Step 6: Inspect and commit only intended files**

Run:

```bash
git status --short
git diff --check
git log --oneline -8
```

Expected: all implementation commits are present; unrelated pre-existing dirty files remain unstaged.
