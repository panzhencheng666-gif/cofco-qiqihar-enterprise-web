# Market Monitoring Visual Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished, interactive market-monitoring vertical slice with a mature enterprise overview, unified monitoring-object registry, online/Excel/system collection workspace, review queue, and report entry points.

**Architecture:** Keep the existing formal enterprise shell and replace only the market application body. Add one market route state, one typed presentation model, and one focused workspace component; market subjects and logistics nodes share task, validation, responsibility, review, and report concepts without being collapsed into one universal form.

**Tech Stack:** React 19, TypeScript 5.9, Vite 8, Vitest 4, Testing Library, existing SVG/CSS enterprise shell; no new runtime dependency.

## Global Constraints

- The left market menu is exactly: 市场总览、监测对象、数据采集、审核发布、分析与报告.
- The sidebar remains 192px on desktop; body copy remains 12–13px and page titles remain 26–28px.
- One entity has one master record and may carry multiple business roles.
- Market subjects and logistics nodes share one workflow but remain distinct collection targets.
- Online entry, Excel import, and system ingestion use one validation and review path.
- Daily, weekly, and monthly reports are generated from approved detailed data and are not separately re-entered.
- Administrative-village totals use only the newest 2025 or 2026 official source; unresolved totals display 待核定 and are never replaced with older numbers.
- Do not show development, database, code, engine, lineage, or implementation-version language in the UI.
- Preserve all unrelated dirty worktree changes and stage only files listed in each task.

---

### Task 1: Market Route State

**Files:**

- Modify: `src/prototype/formalEnterpriseModel.ts`
- Modify: `src/prototype/formalEnterpriseModel.spec.ts`

**Interfaces:**

- Produces: `MarketSection`, `marketSections`, `FormalRoute.marketSection`.
- Produces: `readFormalRoute(search)` and `writeFormalRoute(route)` support `?page=market&section=collection`.
- Consumes: existing `FormalApplication`, `ReportingSection`, and route behavior.

- [ ] **Step 1: Write the failing route tests**

Add these cases to the existing route-model test:

```ts
expect(readFormalRoute("?page=market&section=collection")).toEqual({
  application: "market",
  reportingSection: "overview",
  marketSection: "collection",
});

expect(readFormalRoute("?page=market&section=unknown")).toEqual({
  application: "market",
  reportingSection: "overview",
  marketSection: "overview",
});

expect(
  writeFormalRoute({
    application: "market",
    reportingSection: "overview",
    marketSection: "collection",
  }),
).toBe("page=market&section=collection");
```

Update existing expected route objects to include `marketSection: "overview"`.

- [ ] **Step 2: Run the route tests and verify failure**

Run:

```bash
npm test -- src/prototype/formalEnterpriseModel.spec.ts
```

Expected: FAIL because `marketSection` and market section parsing do not exist.

- [ ] **Step 3: Add the typed route state**

Add:

```ts
export const marketSections = [
  "overview",
  "objects",
  "collection",
  "review",
  "reports",
] as const;

export type MarketSection = (typeof marketSections)[number];

export interface FormalRoute {
  application: FormalApplication;
  reportingSection: ReportingSection;
  marketSection: MarketSection;
}

function isMarketSection(value: string | null): value is MarketSection {
  return marketSections.some((section) => section === value);
}
```

Return `marketSection` from `readFormalRoute`:

```ts
marketSection:
  application === "market" && isMarketSection(sectionValue)
    ? sectionValue
    : "overview",
```

Write the market section only when it is not the overview:

```ts
if (route.application === "market" && route.marketSection !== "overview") {
  parameters.set("section", route.marketSection);
}
```

- [ ] **Step 4: Run the route tests and verify success**

Run:

```bash
npm test -- src/prototype/formalEnterpriseModel.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the route state**

```bash
git add src/prototype/formalEnterpriseModel.ts src/prototype/formalEnterpriseModel.spec.ts
git commit -m "feat: add market workspace routing"
```

---

### Task 2: Typed Market Presentation Model

**Files:**

- Create: `src/prototype/marketMonitoringModel.ts`
- Create: `src/prototype/marketMonitoringModel.spec.ts`
- Create: `src/prototype/marketMonitoringData.ts`

**Interfaces:**

- Produces: `MarketCollectionTarget`, `MarketCollectionMode`, `MarketRole`, `GrainKind`, `MarketTask`, `MarketFieldGroup`, `MarketRegionCoverage`.
- Produces: `getApplicableFieldGroups(role, grain)` and `getMarketCompletion(task)`.
- Consumes: no React and no browser APIs.

- [ ] **Step 1: Write failing model tests**

Create `marketMonitoringModel.spec.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  getApplicableFieldGroups,
  getMarketCompletion,
  type MarketTask,
} from "./marketMonitoringModel";

describe("market collection presentation model", () => {
  it("shows rice-mill purchase, quality, processing, inventory and sales together", () => {
    expect(
      getApplicableFieldGroups("rice-mill", "paddy").map((group) => group.key),
    ).toEqual(["purchase", "quality", "processing", "inventory", "sales"]);
  });

  it("keeps road logistics separate from subject prices", () => {
    expect(
      getApplicableFieldGroups("road-node", "corn").map((group) => group.key),
    ).toEqual(["movement", "evidence"]);
  });

  it("calculates completion from applicable fields only", () => {
    const task: MarketTask = {
      id: "task-1",
      target: "subject",
      targetName: "讷河恒泰米业",
      role: "rice-mill",
      grain: "paddy",
      region: "讷河市",
      owner: "王洋",
      deadline: "今天 17:00",
      status: "填写中",
      completedFields: 18,
      applicableFields: 24,
    };
    expect(getMarketCompletion(task)).toBe(75);
  });
});
```

- [ ] **Step 2: Run the model tests and verify failure**

Run:

```bash
npm test -- src/prototype/marketMonitoringModel.spec.ts
```

Expected: FAIL because the model module does not exist.

- [ ] **Step 3: Implement the model**

Create `marketMonitoringModel.ts` with these public types and mappings:

```ts
export type MarketCollectionTarget = "subject" | "logistics";
export type MarketCollectionMode = "online" | "excel" | "system";
export type GrainKind = "corn" | "soybean" | "paddy";
export type MarketRole =
  | "trader"
  | "corn-processor"
  | "soy-crusher"
  | "soy-protein"
  | "food-condiment"
  | "rice-mill"
  | "feed"
  | "livestock"
  | "reserve"
  | "wholesale-market"
  | "agri-dealer"
  | "rail-node"
  | "road-node";

export interface MarketFieldGroup {
  key:
    | "purchase"
    | "quality"
    | "processing"
    | "inventory"
    | "sales"
    | "movement"
    | "evidence";
  label: string;
}

export interface MarketTask {
  id: string;
  target: MarketCollectionTarget;
  targetName: string;
  role: MarketRole;
  grain: GrainKind;
  region: string;
  owner: string;
  deadline: string;
  status: "待填写" | "填写中" | "待审核" | "已退回" | "审核通过" | "逾期";
  completedFields: number;
  applicableFields: number;
}

export interface MarketRegionCoverage {
  label: string;
  detail: string;
  villageCount: string;
  sourceState: "已核定" | "待核定";
}

const labels: Record<MarketFieldGroup["key"], string> = {
  purchase: "收购与价格",
  quality: "质量条件",
  processing: "加工与开机",
  inventory: "库存",
  sales: "销售",
  movement: "流入流出",
  evidence: "运输依据",
};

const roleGroups: Record<MarketRole, MarketFieldGroup["key"][]> = {
  trader: ["purchase", "quality", "inventory", "sales"],
  "corn-processor": ["purchase", "quality", "processing", "inventory"],
  "soy-crusher": ["purchase", "quality", "processing", "inventory"],
  "soy-protein": ["purchase", "quality", "processing", "inventory"],
  "food-condiment": ["purchase", "quality", "processing", "inventory"],
  "rice-mill": ["purchase", "quality", "processing", "inventory", "sales"],
  feed: ["purchase", "quality", "processing", "inventory"],
  livestock: ["purchase", "quality", "inventory"],
  reserve: ["inventory"],
  "wholesale-market": ["sales", "quality"],
  "agri-dealer": ["sales", "inventory"],
  "rail-node": ["movement", "purchase", "evidence"],
  "road-node": ["movement", "evidence"],
};

export function getApplicableFieldGroups(
  role: MarketRole,
  _grain: GrainKind,
): MarketFieldGroup[] {
  return roleGroups[role].map((key) => ({ key, label: labels[key] }));
}

export function getMarketCompletion(task: MarketTask): number {
  if (task.applicableFields === 0) return 0;
  return Math.round((task.completedFields / task.applicableFields) * 100);
}
```

- [ ] **Step 4: Add realistic prototype data**

Create `marketMonitoringData.ts` exporting:

```ts
import type { MarketRegionCoverage, MarketTask } from "./marketMonitoringModel";

export const marketRegionCoverage: readonly MarketRegionCoverage[] = [
  {
    label: "齐齐哈尔指定范围",
    detail: "梅里斯区、8县、讷河市",
    villageCount: "2025—2026最新口径核验中",
    sourceState: "待核定",
  },
  {
    label: "黑河市全域",
    detail: "全市县区与乡镇样本网络",
    villageCount: "2025—2026最新口径核验中",
    sourceState: "待核定",
  },
  {
    label: "呼伦贝尔指定范围",
    detail: "扎兰屯、阿荣旗、莫旗、鄂伦春旗",
    villageCount: "2025—2026最新口径核验中",
    sourceState: "待核定",
  },
];

export const marketTasks: readonly MarketTask[] = [
  {
    id: "MK-2026-31018",
    target: "subject",
    targetName: "讷河恒泰米业",
    role: "rice-mill",
    grain: "paddy",
    region: "讷河市",
    owner: "王洋",
    deadline: "今天 17:00",
    status: "填写中",
    completedFields: 18,
    applicableFields: 24,
  },
  {
    id: "MK-2026-31027",
    target: "logistics",
    targetName: "齐齐哈尔铁路货运站",
    role: "rail-node",
    grain: "corn",
    region: "齐齐哈尔市",
    owner: "王洋",
    deadline: "今天 17:00",
    status: "待填写",
    completedFields: 0,
    applicableFields: 12,
  },
];
```

- [ ] **Step 5: Run model tests and commit**

Run:

```bash
npm test -- src/prototype/marketMonitoringModel.spec.ts
```

Expected: PASS.

```bash
git add src/prototype/marketMonitoringModel.ts src/prototype/marketMonitoringModel.spec.ts src/prototype/marketMonitoringData.ts
git commit -m "feat: model unified market collection"
```

---

### Task 3: Market Navigation and Overview

**Files:**

- Create: `src/prototype/MarketMonitoringWorkspace.tsx`
- Create: `src/prototype/MarketMonitoringWorkspace.spec.tsx`
- Modify: `src/prototype/formalEnterpriseData.ts`
- Modify: `src/prototype/FormalEnterprisePrototype.tsx`
- Modify: `src/prototype/FormalEnterprisePrototype.spec.tsx`

**Interfaces:**

- Consumes: `MarketSection`, `marketRegionCoverage`, `marketTasks`.
- Produces: `<MarketMonitoringWorkspace section onSectionChange onComposeReport />`.
- Preserves: `<GeneralWorkspace>` for work, production, and supply.

- [ ] **Step 1: Write failing workspace tests**

Create `MarketMonitoringWorkspace.spec.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarketMonitoringWorkspace } from "./MarketMonitoringWorkspace";

afterEach(cleanup);

describe("market monitoring workspace", () => {
  it("shows a clear overview and current administrative-source state", () => {
    render(
      <MarketMonitoringWorkspace
        section="overview"
        onComposeReport={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "粮食市场监测总览" }),
    ).toBeVisible();
    expect(screen.getByText("三大监测区域")).toBeVisible();
    expect(screen.getAllByText("待核定").length).toBeGreaterThan(0);
    expect(screen.getByText("玉米")).toBeVisible();
    expect(screen.getByText("大豆")).toBeVisible();
    expect(screen.getByText("稻谷")).toBeVisible();
  });

  it("enters collection from the primary action", async () => {
    const user = userEvent.setup();
    const onSectionChange = vi.fn();
    render(
      <MarketMonitoringWorkspace
        section="overview"
        onSectionChange={onSectionChange}
        onComposeReport={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "进入数据采集" }));
    expect(onSectionChange).toHaveBeenCalledWith("collection");
  });
});
```

- [ ] **Step 2: Run the workspace test and verify failure**

Run:

```bash
npm test -- src/prototype/MarketMonitoringWorkspace.spec.tsx
```

Expected: FAIL because the workspace component does not exist.

- [ ] **Step 3: Implement the overview component**

The component must render:

```tsx
export interface MarketMonitoringWorkspaceProps {
  section: MarketSection;
  onSectionChange?: (section: MarketSection) => void;
  onComposeReport: (context: BusinessReportContext) => void;
}

export function MarketMonitoringWorkspace({
  section,
  onSectionChange,
  onComposeReport,
}: MarketMonitoringWorkspaceProps) {
  if (section === "collection") return <MarketCollectionWorkspace />;
  if (section === "objects") return <MarketObjectRegistry />;
  if (section === "review") return <MarketReviewWorkspace />;
  if (section === "reports") {
    return <MarketReportWorkspace onComposeReport={onComposeReport} />;
  }
  return (
    <MarketOverview
      onCollect={() => onSectionChange?.("collection")}
      onComposeReport={onComposeReport}
    />
  );
}
```

`MarketOverview` must contain one page header, one compact context strip, one crop switch, one five-metric strip, a two-column trend/task area, the three regional coverage rows, and a bottom subject/task table. Do not render the generic lifecycle panel.

- [ ] **Step 4: Wire market navigation**

Change the market navigation definition to:

```ts
navigation: [
  { key: "overview", label: "市场总览" },
  { key: "objects", label: "监测对象" },
  { key: "collection", label: "数据采集" },
  { key: "review", label: "审核发布" },
  { key: "reports", label: "分析与报告" },
],
```

Add `onMarketSectionChange` to `FormalSidebar`, use `route.marketSection` for the active market item, and call:

```ts
changeRoute({
  application: "market",
  reportingSection: "overview",
  marketSection,
});
```

In the main content branch:

```tsx
{
  route.application === "market" ? (
    <MarketMonitoringWorkspace
      section={route.marketSection}
      onSectionChange={(marketSection) =>
        changeRoute({
          application: "market",
          reportingSection: "overview",
          marketSection,
        })
      }
      onComposeReport={setReportContext}
    />
  ) : (
    <GeneralWorkspace
      application={route.application}
      onComposeReport={setReportContext}
    />
  );
}
```

Every constructed `FormalRoute` must include `marketSection: "overview"`.

- [ ] **Step 5: Run the focused tests and commit**

Run:

```bash
npm test -- src/prototype/marketMonitoringModel.spec.ts src/prototype/MarketMonitoringWorkspace.spec.tsx src/prototype/formalEnterpriseModel.spec.ts src/prototype/FormalEnterprisePrototype.spec.tsx
```

Expected: PASS.

```bash
git add src/prototype/MarketMonitoringWorkspace.tsx src/prototype/MarketMonitoringWorkspace.spec.tsx src/prototype/formalEnterpriseData.ts src/prototype/FormalEnterprisePrototype.tsx src/prototype/FormalEnterprisePrototype.spec.tsx
git commit -m "feat: add market monitoring overview"
```

---

### Task 4: Unified Collection Workbench

**Files:**

- Modify: `src/prototype/MarketMonitoringWorkspace.tsx`
- Modify: `src/prototype/MarketMonitoringWorkspace.spec.tsx`

**Interfaces:**

- Consumes: `marketTasks`, `getApplicableFieldGroups`.
- Produces: target tabs `市场主体填报` and `物流节点填报`.
- Produces: mode tabs `在线填报`, `Excel批量导入`, and `系统接入记录`.

- [ ] **Step 1: Write failing interaction tests**

Append:

```tsx
it("keeps subject and logistics collection in one workbench", async () => {
  const user = userEvent.setup();
  render(
    <MarketMonitoringWorkspace
      section="collection"
      onComposeReport={vi.fn()}
    />,
  );

  expect(screen.getByRole("button", { name: "市场主体填报" })).toBeVisible();
  expect(screen.getByRole("button", { name: "物流节点填报" })).toBeVisible();
  expect(screen.getByText("讷河恒泰米业")).toBeVisible();
  expect(screen.getByText("收购与价格")).toBeVisible();
  expect(screen.getByText("质量条件")).toBeVisible();

  await user.click(screen.getByRole("button", { name: "物流节点填报" }));
  expect(screen.getByText("齐齐哈尔铁路货运站")).toBeVisible();
  expect(screen.getByText("流入流出")).toBeVisible();
});

it("supports Excel precheck without creating a second workflow", async () => {
  const user = userEvent.setup();
  render(
    <MarketMonitoringWorkspace
      section="collection"
      onComposeReport={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Excel批量导入" }));
  expect(screen.getByText("上传后先预检，不直接提交")).toBeVisible();
  expect(
    screen.getByRole("button", { name: "下载当前任务模板" }),
  ).toBeVisible();
  expect(screen.getByText("错误定位到工作表、行和列")).toBeVisible();
});
```

- [ ] **Step 2: Run the tests and verify failure**

Run:

```bash
npm test -- src/prototype/MarketMonitoringWorkspace.spec.tsx
```

Expected: FAIL because collection mode switching is incomplete.

- [ ] **Step 3: Implement the three-pane workbench**

Use local state:

```ts
const [target, setTarget] = useState<MarketCollectionTarget>("subject");
const [mode, setMode] = useState<MarketCollectionMode>("online");
const task =
  marketTasks.find((item) => item.target === target) ?? marketTasks[0];
const groups = getApplicableFieldGroups(task.role, task.grain);
```

The online layout is:

```tsx
<div className="market-collection-layout">
  <aside className="market-task-list">
    {/* task identity and completion */}
  </aside>
  <section className="market-entry-panel">
    {/* rice-mill or logistics field groups; visible labels, units and data status */}
  </section>
  <aside className="market-validation-panel">
    {/* required checks, warnings, evidence and owner lock */}
  </aside>
</div>
```

The fixed footer contains exactly:

```tsx
<footer className="market-collection-footer">
  <span>当前任务仅责任人王洋可编辑</span>
  <button type="button">保存草稿</button>
  <button type="button">检查数据</button>
  <button className="is-primary" type="button">
    提交审核
  </button>
</footer>
```

The Excel panel contains download-template, drag/upload, precheck summary, and export-error-detail actions. The system panel contains source, last received time, accepted/warning/failed counts, and exception handling; neither creates a separate approval path.

- [ ] **Step 4: Run the collection tests and commit**

Run:

```bash
npm test -- src/prototype/MarketMonitoringWorkspace.spec.tsx
```

Expected: PASS.

```bash
git add src/prototype/MarketMonitoringWorkspace.tsx src/prototype/MarketMonitoringWorkspace.spec.tsx
git commit -m "feat: add unified market collection workbench"
```

---

### Task 5: Enterprise Visual System, Verification, and Captures

**Files:**

- Create: `src/prototype/market-monitoring.css`
- Modify: `src/prototype/main.tsx`
- Modify: `src/prototype/formal-enterprise.css`
- Modify: `src/prototype/FormalEnterprisePrototype.spec.tsx`

**Interfaces:**

- Consumes: semantic class names from `MarketMonitoringWorkspace.tsx`.
- Produces: desktop layout at 1920×1080 and usable compact layout at 1440×900.
- Preserves: existing formal shell and other application pages.

- [ ] **Step 1: Add visual-contract assertions**

Add to `FormalEnterprisePrototype.spec.tsx`:

```tsx
it("uses the compact five-item market architecture", () => {
  render(<FormalEnterprisePrototype initialSearch="?page=market" />);
  const navigation = screen.getByRole("navigation", { name: "市场监测模块" });
  expect(within(navigation).getAllByRole("button")).toHaveLength(5);
  expect(within(navigation).getByText("市场总览")).toBeVisible();
  expect(within(navigation).getByText("数据采集")).toBeVisible();
  expect(screen.queryByText("业务生命周期")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Implement the market visual layer**

Import the new stylesheet from `main.tsx`:

```ts
import "./market-monitoring.css";
```

The stylesheet must use:

```css
.market-workspace {
  --market-ink: #17394a;
  --market-muted: #667f8d;
  --market-line: #d4dee4;
  --market-teal: #167c74;
  --market-canvas: #edf3f5;
  color: var(--market-ink);
  font-size: 13px;
}

.market-overview-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(300px, 1fr);
  gap: 14px;
}

.market-collection-layout {
  display: grid;
  grid-template-columns: 228px minmax(560px, 1fr) 268px;
  min-height: 580px;
  border: 1px solid var(--market-line);
  background: #fff;
}

@media (max-width: 1380px) {
  .market-collection-layout {
    grid-template-columns: 210px minmax(520px, 1fr) 244px;
  }
}
```

Complete the component styles using the existing formal navy/teal palette, 6–8px radii, 1px dividers, restrained shadows, strong table hierarchy, and no decorative gradients.

If visual inspection confirms crowding, reduce `.formal-page-header h1` to `26px`; do not reduce body text below `12px`.

- [ ] **Step 3: Run focused and full automated verification**

Run:

```bash
npm test -- src/prototype/marketMonitoringModel.spec.ts src/prototype/MarketMonitoringWorkspace.spec.tsx src/prototype/formalEnterpriseModel.spec.ts src/prototype/FormalEnterprisePrototype.spec.tsx
npm run build:prototype
npm test
```

Expected:

- Focused tests PASS.
- Prototype TypeScript/Vite build PASS.
- Full Vitest suite PASS with no existing regression.

- [ ] **Step 4: Inspect and capture the three deliverables**

Open:

```text
http://127.0.0.1:63182/prototype.html?variant=A&page=market
http://127.0.0.1:63182/prototype.html?variant=A&page=market&section=collection
```

At 1920×1080 and 1440×900, verify:

- No page-level horizontal scrollbar.
- Sidebar width is 192px and labels do not wrap.
- The overview has one dominant analytical area and one task/exception rail.
- The online workbench visibly shows task list, form, validation rail, and fixed actions.
- Switching to logistics changes the task and fields without navigating to another application.
- Excel mode states that upload is prechecked before submission.
- No UI text contains 事实、血缘、计算引擎、代码、开发 or 系统版本.
- Administrative-village totals are either sourced from 2025/2026 or displayed as 待核定.

Capture:

```text
/Users/federal/Desktop/cofco-qiqihar-enterprise-web/artifacts/market-overview-1920.png
/Users/federal/Desktop/cofco-qiqihar-enterprise-web/artifacts/market-subject-entry-1920.png
/Users/federal/Desktop/cofco-qiqihar-enterprise-web/artifacts/market-logistics-entry-1920.png
```

- [ ] **Step 5: Commit the visual layer**

```bash
git add src/prototype/market-monitoring.css src/prototype/main.tsx src/prototype/formal-enterprise.css src/prototype/FormalEnterprisePrototype.spec.tsx
git commit -m "feat: finish enterprise market monitoring prototype"
```
