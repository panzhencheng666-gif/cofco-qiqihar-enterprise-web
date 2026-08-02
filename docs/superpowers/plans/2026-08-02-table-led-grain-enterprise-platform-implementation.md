# Table-Led Grain Enterprise Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `src/prototype` 整改为已批准的表格主导式粮食商情企业平台，完整覆盖产品化产情与市场填报、物流节点、供需自动计算、动态报告、四年同比以及平台个人中心。

**Architecture:** 保留现有领域模型、审核发布、权限、持久化和字段保全能力，以正式路由为唯一产品上下文，在其上增加分级地区、稳定业务树、紧凑查询和标准企业表格。业务列表只呈现高频列，完整字段进入按需对象详情和分区单据；供需、报告和同比继续消费已核定领域数据，不复制业务事实。

**Tech Stack:** React 19.2.8、TypeScript 5.9.3、Vite 8.1.5、Vitest 4.1.10、Testing Library 16.3.2；不新增运行时依赖。

## Scope Decision

设计覆盖多个业务域，但当前原型共用同一正式路由、授权范围、业务字段映射、工作状态和
持久化快照。将它们拆为并行计划会同时改动 `formalEnterpriseModel.ts`、
`FormalEnterprisePrototype.tsx` 和共享样式，产生无法独立合并的冲突。因此本计划保留
一个执行序列，并把产品路由、地区、平台框架、通用表格、领域工作台、供需、报告和比较
拆成可分别审查、测试和提交的任务。

## Global Constraints

- Node.js 必须满足 `>=24.15.0 <25`，npm 必须满足 `>=11.6.0 <12`。
- 实现文件只修改 `src/prototype/**` 及其中的直接测试；本计划和设计规范文件除外。
- 不暂存、不提交、不覆盖仓库中已有的其他用户改动。
- 不删除任何通过 `prototypeFieldPreservation.spec.ts` 审计的有效业务字段。
- 全部业务界面使用中文；不得显示内部编码、开发版本、组件名、接口名、模型名或环境名。
- 产品由左侧菜单确定时，内容区不得再次显示产品选择器；具体品种仍可筛选。
- 物流节点监测只属于市场监测，不创建重复顶部入口。
- 地区必须按地市、区县、乡镇、行政村逐级选择，不使用混合层级长下拉框。
- 主工作区以业务表格、台账和单据为主体，不使用驾驶舱卡片墙。
- 宽表只能在表格容器内部横向滚动；1920px 和 1440px 必须显示完整左侧目录。
- 每个实现任务遵循测试先行、最小实现、相关测试通过、精确路径提交的顺序。

## File and Responsibility Map

### New focused units

- `src/prototype/core/productWorkspaceContext.ts`：产品化菜单与正式路由之间的唯一映射。
- `src/prototype/core/productWorkspaceContext.spec.ts`：产品路由、标题和上下文映射测试。
- `src/prototype/data/enterpriseRegionHierarchy.ts`：授权行政层级及父子查询，不存业务事实。
- `src/prototype/data/enterpriseRegionHierarchy.spec.ts`：层级、授权裁剪和路径测试。
- `src/prototype/components/RegionCascadeSelector.tsx`：地市、区县、乡镇、行政村级联选择器。
- `src/prototype/components/RegionCascadeSelector.spec.tsx`：级联交互和禁用状态测试。
- `src/prototype/components/BusinessNavigationTree.tsx`：当前一级应用的稳定左侧业务树。
- `src/prototype/components/BusinessNavigationTree.spec.tsx`：产品菜单、选中和键盘导航测试。
- `src/prototype/components/CompactBusinessQuery.tsx`：最多六项常用条件和更多条件。
- `src/prototype/components/EnterpriseWorkTable.tsx`：分组表头、编辑列、状态、操作和分页。
- `src/prototype/components/EnterpriseWorkTable.spec.tsx`：表头、编辑、冻结语义和操作测试。
- `src/prototype/market/LogisticsMonitoringWorkspace.tsx`：铁路、公路、港口及装卸节点工作表。
- `src/prototype/market/LogisticsMonitoringWorkspace.spec.tsx`：物流筛选、列和状态测试。
- `src/prototype/core/supplyAccountEngine.ts`：试算、正式输入资格、核定调整和公式计算。
- `src/prototype/core/supplyAccountEngine.spec.ts`：供需公式、状态和不可覆盖正式结果测试。

### Existing units to refine

- `src/prototype/formalEnterpriseModel.ts`：增加产品化业务 section，保持路由类型安全。
- `src/prototype/formalEnterpriseData.ts`：六大一级应用、左侧菜单中文名称和个人菜单。
- `src/prototype/EnterpriseShell.tsx`：顶部搜索、待办、通知、帮助、设置和个人中心。
- `src/prototype/UnifiedWorkspacePrimitives.tsx`：停止使用平铺上下文条，接入新查询和地区组件。
- `src/prototype/ProductionMonitoringWorkspace.tsx`：产品化产情入口和工作表装配。
- `src/prototype/MarketMonitoringWorkspace.tsx`：产品化市场入口、物流入口和工作表装配。
- `src/prototype/production/ProductionDocumentWorkbench.tsx`：产情章节式完整单据。
- `src/prototype/market/MarketDocumentWorkbench.tsx`：市场章节式完整单据。
- `src/prototype/production/ProductionObjectRegistry.tsx`、`src/prototype/market/MarketObjectRegistry.tsx`：对象类型正确位置和按需详情。
- `src/prototype/SupplyDemandWorkspace.tsx`：公式结果、来源台账和试算／正式状态。
- `src/prototype/BusinessReportComposer.tsx`、`src/prototype/ReportCenterWorkspace.tsx`：九项动态报告参数和中文报告流程。
- `src/prototype/ExecutiveOverviewWorkspace.tsx`、`src/prototype/MyWorkWorkspace.tsx`：筛选台账替代卡片和责任状态条。
- `src/prototype/components/ComparisonCharts.tsx`、`src/prototype/components/AnnualComparisonTrack.tsx`：四年趋势与逐年同比。
- `src/prototype/formal-enterprise.css`、`src/prototype/unified-workspaces.css`、`src/prototype/market-monitoring.css`：最终企业框架和表格视觉。

---

### Task 1: Product-Owned Routes and Chinese Navigation

**Files:**
- Create: `src/prototype/core/productWorkspaceContext.ts`
- Create: `src/prototype/core/productWorkspaceContext.spec.ts`
- Modify: `src/prototype/formalEnterpriseModel.ts`
- Modify: `src/prototype/formalEnterpriseData.ts`
- Test: `src/prototype/FormalEnterprisePrototype.spec.tsx`

**Interfaces:**
- Produces: `getProductWorkspaceContext(route: FormalRoute): ProductWorkspaceContext | null`。
- Produces: `ProductWorkspaceContext = { domain: "production" | "market" | "supply"; productId: "corn" | "soybean" | "paddy"; productLabel: string; titleStem: string }`。
- Consumed by: Tasks 3、5、6、8。

- [ ] **Step 1: Write failing product-route tests**

```ts
import { describe, expect, it } from "vitest";
import { createFormalRoute } from "../formalEnterpriseModel";
import { getProductWorkspaceContext } from "./productWorkspaceContext";

describe("productWorkspaceContext", () => {
  it.each([
    ["production", "corn-collection", "corn", "玉米产情填报"],
    ["production", "soybean-collection", "soybean", "大豆产情填报"],
    ["production", "rice-collection", "paddy", "水稻产情填报"],
    ["market", "corn-collection", "corn", "玉米市场采集"],
    ["market", "soybean-collection", "soybean", "大豆市场采集"],
    ["market", "paddy-collection", "paddy", "稻谷市场采集"],
    ["supply", "corn-balance", "corn", "玉米供需平衡"],
    ["supply", "soybean-balance", "soybean", "大豆供需平衡"],
    ["supply", "paddy-balance", "paddy", "稻谷供需平衡"],
  ] as const)("maps %s/%s", (application, section, productId, titleStem) => {
    expect(
      getProductWorkspaceContext(createFormalRoute(application, section)),
    ).toMatchObject({ productId, titleStem });
  });
});
```

- [ ] **Step 2: Run the test and confirm the missing route types fail**

Run: `npm test -- src/prototype/core/productWorkspaceContext.spec.ts`

Expected: FAIL because product sections and `getProductWorkspaceContext` do not exist.

- [ ] **Step 3: Add typed product sections and exact mapping**

```ts
export const formalSectionsByApplication = {
  work: ["tasks", "submitted", "review", "exceptions", "completed"],
  overview: ["operations", "risks", "duty", "releases"],
  production: [
    "corn-collection",
    "soybean-collection",
    "rice-collection",
    "tasks",
    "objects",
    "review",
    "analysis",
  ],
  market: [
    "corn-collection",
    "soybean-collection",
    "paddy-collection",
    "logistics",
    "tasks",
    "objects",
    "review",
    "analysis",
  ],
  supply: ["corn-balance", "soybean-balance", "paddy-balance", "records"],
  reporting: ["compose", "comprehensive", "review-distribution", "ledger"],
} as const;
```

```ts
const productContextByRoute = {
  "production:corn-collection": {
    domain: "production",
    productId: "corn",
    productLabel: "玉米",
    titleStem: "玉米产情填报",
  },
  "production:soybean-collection": {
    domain: "production",
    productId: "soybean",
    productLabel: "大豆",
    titleStem: "大豆产情填报",
  },
  "production:rice-collection": {
    domain: "production",
    productId: "paddy",
    productLabel: "水稻",
    titleStem: "水稻产情填报",
  },
  "market:corn-collection": {
    domain: "market",
    productId: "corn",
    productLabel: "玉米",
    titleStem: "玉米市场采集",
  },
  "market:soybean-collection": {
    domain: "market",
    productId: "soybean",
    productLabel: "大豆",
    titleStem: "大豆市场采集",
  },
  "market:paddy-collection": {
    domain: "market",
    productId: "paddy",
    productLabel: "稻谷",
    titleStem: "稻谷市场采集",
  },
  "supply:corn-balance": {
    domain: "supply",
    productId: "corn",
    productLabel: "玉米",
    titleStem: "玉米供需平衡",
  },
  "supply:soybean-balance": {
    domain: "supply",
    productId: "soybean",
    productLabel: "大豆",
    titleStem: "大豆供需平衡",
  },
  "supply:paddy-balance": {
    domain: "supply",
    productId: "paddy",
    productLabel: "稻谷",
    titleStem: "稻谷供需平衡",
  },
} as const;
```

`getProductWorkspaceContext` uses `${route.application}:${route.section}` to read this map and returns
`null` for work、overview、task、object、review、analysis、record and reporting routes.

- [ ] **Step 4: Replace navigation labels and remove duplicate logistics top-level semantics**

Update `formalApplicationDefinitions` so the six top applications are exactly:

```ts
["我的工作", "经营总览", "产情监测", "市场监测", "供需分析", "报表中心"]
```

Use the exact left labels from the approved design and ensure no navigation label contains `日报`、`版本`、`能力清单` or a second logistics application.

- [ ] **Step 5: Run route and prototype navigation tests**

Run: `npm test -- src/prototype/core/productWorkspaceContext.spec.ts src/prototype/FormalEnterprisePrototype.spec.tsx`

Expected: PASS with product routes writable and readable through the Chinese hash route.

- [ ] **Step 6: Commit only Task 1 files**

```bash
git add src/prototype/core/productWorkspaceContext.ts src/prototype/core/productWorkspaceContext.spec.ts src/prototype/formalEnterpriseModel.ts src/prototype/formalEnterpriseData.ts src/prototype/FormalEnterprisePrototype.spec.tsx
git commit -m "feat: add product-owned enterprise routes"
```

### Task 2: Authorized Administrative Region Cascade

**Files:**
- Create: `src/prototype/data/enterpriseRegionHierarchy.ts`
- Create: `src/prototype/data/enterpriseRegionHierarchy.spec.ts`
- Create: `src/prototype/components/RegionCascadeSelector.tsx`
- Create: `src/prototype/components/RegionCascadeSelector.spec.tsx`
- Modify: `src/prototype/enterpriseRegions.ts`
- Modify: `src/prototype/UnifiedWorkspacePrimitives.tsx`

**Interfaces:**
- Produces: `EnterpriseRegionNode` and `getAuthorizedRegionChildren(parentId, authorizedLeafIds)`。
- Produces: `<RegionCascadeSelector value onChange maxLevel authorizedRegionIds />`。
- Consumed by: Tasks 5、6、8、9、10。

- [ ] **Step 1: Write failing hierarchy and cascade tests**

```ts
expect(getEnterpriseRegionPath("qiqihar-nehe-tongyi").map(({ label }) => label))
  .toEqual(["黑龙江省", "齐齐哈尔市", "讷河市", "同义镇"]);
expect(getAuthorizedRegionChildren("qiqihar", ["qiqihar-nehe"]))
  .toEqual(expect.arrayContaining([expect.objectContaining({ id: "qiqihar-nehe" })]));
```

```tsx
render(
  <RegionCascadeSelector
    authorizedRegionIds={["qiqihar-nehe"]}
    maxLevel="village"
    value={{ cityId: "qiqihar" }}
    onChange={onChange}
  />,
);
expect(screen.getByLabelText("区县")).toBeInTheDocument();
expect(screen.queryByRole("option", { name: "黑河市全域" })).not.toBeInTheDocument();
```

- [ ] **Step 2: Run and verify the flat-region implementation fails**

Run: `npm test -- src/prototype/data/enterpriseRegionHierarchy.spec.ts src/prototype/components/RegionCascadeSelector.spec.tsx`

Expected: FAIL because the hierarchy and cascade component do not exist.

- [ ] **Step 3: Implement the region node contract without inventing unknown business counts**

```ts
export type EnterpriseAdministrativeLevel =
  | "province"
  | "prefecture"
  | "county"
  | "township"
  | "village";

export interface EnterpriseRegionNode {
  id: string;
  label: string;
  level: EnterpriseAdministrativeLevel;
  parentId: string | null;
  sourceStatus: "已核定" | "待核定";
}
```

Preserve all current authorized city and county IDs. Add only township and village nodes already represented by current fixtures; mark unverified lower-level catalog coverage as `待核定` and never fill missing counts with guessed numbers.

- [ ] **Step 4: Implement four linked native selects**

The component renders visible `地市`、`区县`、`乡镇`、`行政村` labels up to `maxLevel`. Changing an upper level clears invalid lower values before calling `onChange`. A lower select is disabled until its parent is selected.

- [ ] **Step 5: Replace `WorkspaceRegionSelect` on operational pages through a compatibility adapter**

Keep `WorkspaceRegionSelect` exported for unaffected callers, but implement it through the hierarchy helpers and remove the visible option `全部已授权范围`. For pages that need more than one level, use `RegionCascadeSelector` directly.

- [ ] **Step 6: Run region and scope tests**

Run: `npm test -- src/prototype/data/enterpriseRegionHierarchy.spec.ts src/prototype/components/RegionCascadeSelector.spec.tsx src/prototype/useFormalEnterpriseLocation.spec.tsx src/prototype/formalEnterpriseModel.spec.ts`

Expected: PASS; unauthorized region values remain rejected and no raw ID is displayed.

- [ ] **Step 7: Commit only region files**

```bash
git add src/prototype/data/enterpriseRegionHierarchy.ts src/prototype/data/enterpriseRegionHierarchy.spec.ts src/prototype/components/RegionCascadeSelector.tsx src/prototype/components/RegionCascadeSelector.spec.tsx src/prototype/enterpriseRegions.ts src/prototype/UnifiedWorkspacePrimitives.tsx
git commit -m "feat: add authorized region cascade"
```

### Task 3: Enterprise Shell, Utility Center, and Business Tree

**Files:**
- Create: `src/prototype/components/BusinessNavigationTree.tsx`
- Create: `src/prototype/components/BusinessNavigationTree.spec.tsx`
- Modify: `src/prototype/EnterpriseShell.tsx`
- Modify: `src/prototype/EnterpriseShell.spec.tsx`
- Modify: `src/prototype/formalEnterpriseData.ts`
- Modify: `src/prototype/formal-enterprise.css`

**Interfaces:**
- Consumes: `FormalApplicationDefinition.navigation` and Task 1 product routes。
- Produces: accessible top utilities and one left navigation tree per current application。
- Consumed by: all later workspace tasks。

- [ ] **Step 1: Add failing shell expectations**

```tsx
expect(screen.getByRole("searchbox", { name: "全局搜索" })).toBeInTheDocument();
expect(screen.getByRole("button", { name: /待办/ })).toHaveTextContent("12");
expect(screen.getByRole("button", { name: /通知/ })).toHaveTextContent("3");
expect(screen.getByRole("button", { name: "系统设置" })).toBeInTheDocument();
await user.click(screen.getByRole("button", { name: /王洋/ }));
expect(screen.getByText("组织、岗位与责任范围")).toBeInTheDocument();
expect(screen.getByText("代理与工作交接")).toBeInTheDocument();
expect(screen.getByText("账号安全与登录设备")).toBeInTheDocument();
```

Add a separate permission test asserting an identity without system-management permission does not render `系统设置`.

- [ ] **Step 2: Run shell tests and verify they fail**

Run: `npm test -- src/prototype/EnterpriseShell.spec.tsx src/prototype/components/BusinessNavigationTree.spec.tsx`

Expected: FAIL for the missing tree and top utility content.

- [ ] **Step 3: Implement the business tree**

```tsx
export function BusinessNavigationTree({
  application,
  currentRoute,
  onNavigate,
}: {
  application: FormalApplicationDefinition;
  currentRoute: FormalRoute;
  onNavigate: (route: FormalRoute) => void;
}) {
  return (
    <nav aria-label={`${application.label}业务目录`}>
      {application.navigation.map((item) => (
        <button
          aria-current={
            item.route.application === currentRoute.application &&
            item.route.section === currentRoute.section
              ? "page"
              : undefined
          }
          key={`${item.route.application}:${item.route.section}`}
          onClick={() => onNavigate(item.route)}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 4: Recompose the top header**

Keep current global-search authorization filtering. Render utilities in this order: `全局搜索`、`待办`、`通知`、`帮助`、permission-gated `系统设置`、avatar. The avatar menu must render the exact six Chinese outcomes from the design and close on Escape or outside click.

- [ ] **Step 5: Apply the approved desktop shell CSS**

Set the desktop left tree to a stable 220–240px range, the top bar to one continuous blue surface, and the content to a light neutral surface. At 1440px the left tree remains visible; only table containers may scroll horizontally.

- [ ] **Step 6: Run shell and navigation tests**

Run: `npm test -- src/prototype/EnterpriseShell.spec.tsx src/prototype/components/BusinessNavigationTree.spec.tsx src/prototype/FormalEnterprisePrototype.spec.tsx`

Expected: PASS including keyboard navigation and authorization-filtered search.

- [ ] **Step 7: Commit shell files**

```bash
git add src/prototype/components/BusinessNavigationTree.tsx src/prototype/components/BusinessNavigationTree.spec.tsx src/prototype/EnterpriseShell.tsx src/prototype/EnterpriseShell.spec.tsx src/prototype/formalEnterpriseData.ts src/prototype/formal-enterprise.css
git commit -m "feat: rebuild enterprise shell utilities"
```

### Task 4: Compact Query and Standard Enterprise Work Table

**Files:**
- Create: `src/prototype/components/CompactBusinessQuery.tsx`
- Create: `src/prototype/components/EnterpriseWorkTable.tsx`
- Create: `src/prototype/components/EnterpriseWorkTable.spec.tsx`
- Modify: `src/prototype/UnifiedWorkspacePrimitives.tsx`
- Modify: `src/prototype/UnifiedWorkspacePrimitives.spec.tsx`
- Modify: `src/prototype/unified-workspaces.css`

**Interfaces:**
- Produces: `EnterpriseWorkTableColumn<Row>` and `<EnterpriseWorkTable />`。
- Produces: `<CompactBusinessQuery primaryFields moreFields actions />`。
- Consumed by: Tasks 5、6、8、9、10。

- [ ] **Step 1: Write failing grouped-table tests**

```tsx
type Row = { id: string; objectName: string; price: string; state: string };
render(
  <EnterpriseWorkTable<Row>
    ariaLabel="玉米市场采集表"
    columns={[
      { key: "objectName", title: "采集对象", frozen: true },
      { key: "price", title: "采购价", group: "采购与质量", editable: true },
      { key: "state", title: "状态" },
    ]}
    getRowId={(row) => row.id}
    rows={[{ id: "1", objectName: "龙江北方粮贸有限公司", price: "2410", state: "待审核" }]}
  />,
);
expect(screen.getByRole("columnheader", { name: "采购与质量" })).toBeInTheDocument();
expect(screen.getByRole("cell", { name: "2410" })).toHaveAttribute("data-editable", "true");
```

- [ ] **Step 2: Run and verify the components are missing**

Run: `npm test -- src/prototype/components/EnterpriseWorkTable.spec.tsx src/prototype/UnifiedWorkspacePrimitives.spec.tsx`

Expected: FAIL for missing exports.

- [ ] **Step 3: Implement the table contracts**

```ts
export interface EnterpriseWorkTableColumn<Row> {
  key: keyof Row & string;
  title: string;
  group?: string;
  frozen?: boolean;
  editable?: boolean;
  align?: "left" | "center" | "right";
  render?: (row: Row) => ReactNode;
}

export interface EnterpriseWorkTableProps<Row> {
  ariaLabel: string;
  columns: readonly EnterpriseWorkTableColumn<Row>[];
  rows: readonly Row[];
  getRowId: (row: Row) => string;
  emptyText: string;
  footer?: ReactNode;
}
```

Render true two-row grouped headers, `data-editable="true"`, semantic row headers for object names, an internal `.enterprise-work-table__scroll` wrapper, and no outer card chrome.

- [ ] **Step 4: Implement the compact query contract**

Render at most six primary fields before an optional `更多条件` disclosure. Actions must appear once at the end and preserve native label associations.

- [ ] **Step 5: Replace context-bar primitives with non-card table scaffolding**

Keep old exports temporarily for unchanged callers, but stop rendering `BusinessContextBar` and `WorkspaceScopeBar` in newly converted pages. Add a deprecation comment and tests that converted pages have no `当前状态` banner.

- [ ] **Step 6: Run component tests**

Run: `npm test -- src/prototype/components/EnterpriseWorkTable.spec.tsx src/prototype/UnifiedWorkspacePrimitives.spec.tsx`

Expected: PASS for grouped headers, editable cells, keyboard focus and internal overflow.

- [ ] **Step 7: Commit shared worktable files**

```bash
git add src/prototype/components/CompactBusinessQuery.tsx src/prototype/components/EnterpriseWorkTable.tsx src/prototype/components/EnterpriseWorkTable.spec.tsx src/prototype/UnifiedWorkspacePrimitives.tsx src/prototype/UnifiedWorkspacePrimitives.spec.tsx src/prototype/unified-workspaces.css
git commit -m "feat: add standard enterprise work table"
```

### Task 5: Product-Specific Production Worktables

**Files:**
- Modify: `src/prototype/ProductionMonitoringWorkspace.tsx`
- Modify: `src/prototype/ProductionMonitoringWorkspace.spec.tsx`
- Modify: `src/prototype/production/ProductionTaskWorkspace.tsx`
- Modify: `src/prototype/production/ProductionDocumentWorkbench.tsx`
- Modify: `src/prototype/data/productionDocumentFixtures.ts`
- Modify: `src/prototype/productionMonitoringData.ts`
- Modify: `src/prototype/unified-workspaces.css`

**Interfaces:**
- Consumes: `getProductWorkspaceContext`、`RegionCascadeSelector`、`CompactBusinessQuery`、`EnterpriseWorkTable`。
- Produces: one production collection worktable per crop and a sectioned full document。

- [ ] **Step 1: Add failing approved-structure tests**

```tsx
renderProduction({ section: "corn-collection" });
expect(screen.getByRole("heading", { name: "玉米产情调查表" })).toBeInTheDocument();
expect(screen.queryByLabelText("产品或作物")).not.toBeInTheDocument();
expect(screen.getByLabelText("区县")).toBeInTheDocument();
expect(screen.getByLabelText("乡镇")).toBeInTheDocument();
expect(screen.getByRole("columnheader", { name: /播种面积/ })).toBeInTheDocument();
expect(screen.getByRole("columnheader", { name: /预计单产/ })).toBeInTheDocument();
expect(screen.getByRole("columnheader", { name: /预计总产/ })).toBeInTheDocument();
expect(screen.getByRole("columnheader", { name: /上年同比/ })).toBeInTheDocument();
```

- [ ] **Step 2: Run and confirm the old generic task layout fails**

Run: `npm test -- src/prototype/ProductionMonitoringWorkspace.spec.tsx`

Expected: FAIL because the product section and approved table columns are absent.

- [ ] **Step 3: Project existing work items into production rows**

Define a local `ProductionCollectionRow` with `workId`、`objectName`、region path、cultivar、planting area、yield、output、quality summary、status and actions. Derive values from existing fixtures and field maps; do not introduce duplicate facts.

- [ ] **Step 4: Render product-owned query and table**

Use product context from the route. Primary query fields are `调查期`、`地市`、`区县`、`乡镇`、`行政村`、`任务状态`; specific cultivar belongs in `更多条件`. The visible table title is `${productLabel}产情调查表`.

- [ ] **Step 5: Recompose the document into business sections**

Use visible sections `种植与面积`、`长势与灾情`、`单产与总产`、`质量调查`、`余粮与销售`、`种植意愿`、`成本与保障`、`来源与校验`. Filter fields with the existing applicability model; do not render `本单据不适用` and render one section-level responsibility confirmation instead of one per field.

- [ ] **Step 6: Run production and field-preservation tests**

Run: `npm test -- src/prototype/ProductionMonitoringWorkspace.spec.tsx src/prototype/data/productionDocumentFixtures.spec.ts src/prototype/prototypeFieldPreservation.spec.ts`

Expected: PASS; all audited production fields remain reachable.

- [ ] **Step 7: Commit production files**

```bash
git add src/prototype/ProductionMonitoringWorkspace.tsx src/prototype/ProductionMonitoringWorkspace.spec.tsx src/prototype/production/ProductionTaskWorkspace.tsx src/prototype/production/ProductionDocumentWorkbench.tsx src/prototype/data/productionDocumentFixtures.ts src/prototype/productionMonitoringData.ts src/prototype/unified-workspaces.css
git commit -m "feat: rebuild product production worktables"
```

### Task 6: Product-Specific Market and Logistics Worktables

**Files:**
- Create: `src/prototype/market/LogisticsMonitoringWorkspace.tsx`
- Create: `src/prototype/market/LogisticsMonitoringWorkspace.spec.tsx`
- Modify: `src/prototype/MarketMonitoringWorkspace.tsx`
- Modify: `src/prototype/MarketMonitoringWorkspace.spec.tsx`
- Modify: `src/prototype/market/MarketTaskWorkspace.tsx`
- Modify: `src/prototype/market/MarketDocumentWorkbench.tsx`
- Modify: `src/prototype/data/marketDocumentFixtures.ts`
- Modify: `src/prototype/marketMonitoringData.ts`
- Modify: `src/prototype/market-monitoring.css`

**Interfaces:**
- Consumes: Task 1 product context and Task 4 table components。
- Produces: market collection rows and logistics node rows eligible for Task 8 supply inputs。

- [ ] **Step 1: Add failing market and logistics tests**

```tsx
renderMarket({ section: "corn-collection" });
expect(screen.getByRole("heading", { name: "玉米市场采集表" })).toBeInTheDocument();
expect(screen.queryByLabelText("产品")).not.toBeInTheDocument();
expect(screen.getByRole("columnheader", { name: "采购与质量" })).toBeInTheDocument();
expect(screen.getByRole("columnheader", { name: /库存与交易/ })).toBeInTheDocument();
```

```tsx
render(<LogisticsMonitoringWorkspace {...authorizedProps} />);
expect(screen.getByRole("heading", { name: "粮食物流节点监测表" })).toBeInTheDocument();
expect(screen.getByRole("option", { name: "铁路站点" })).toBeInTheDocument();
expect(screen.getByRole("columnheader", { name: /流入量/ })).toBeInTheDocument();
expect(screen.getByRole("columnheader", { name: /流出量/ })).toBeInTheDocument();
```

- [ ] **Step 2: Run and verify both worktables fail**

Run: `npm test -- src/prototype/MarketMonitoringWorkspace.spec.tsx src/prototype/market/LogisticsMonitoringWorkspace.spec.tsx`

Expected: FAIL for missing product sections and logistics workspace.

- [ ] **Step 3: Build the product-owned market collection projection**

Use existing object types and document drafts. A row contains object, county, cultivar, purchase price, water, test weight, moldy kernel rate, inventory, transaction volume, review／quality status and action. Keep full quote, settlement, packaging, delivery, processing, sales and agricultural-input facts in the object document sections.

- [ ] **Step 4: Build the logistics workspace**

Filter existing market objects by railway、road and port／handling roles. Render date, city, county, node type, direction and submission state. The table columns are node, type, region, inflow, outflow, main direction, freight rate, average transit time, responsible person, state and action.

- [ ] **Step 5: Recompose market documents into applicable sections**

Use `报价与成交`、`质量`、`库存与仓储`、`加工与转化`、`直接使用`、`销售`、`物流与流向`、`农资`、`来源与校验`. Hide non-applicable sections and preserve the complete governed document draft.

- [ ] **Step 6: Run market, logistics and preservation tests**

Run: `npm test -- src/prototype/MarketMonitoringWorkspace.spec.tsx src/prototype/market/LogisticsMonitoringWorkspace.spec.tsx src/prototype/market/MarketDocumentWorkbench.spec.tsx src/prototype/data/marketDocumentFixtures.spec.ts src/prototype/prototypeFieldPreservation.spec.ts`

Expected: PASS with no internal key or implementation wording visible.

- [ ] **Step 7: Commit market and logistics files**

```bash
git add src/prototype/market/LogisticsMonitoringWorkspace.tsx src/prototype/market/LogisticsMonitoringWorkspace.spec.tsx src/prototype/MarketMonitoringWorkspace.tsx src/prototype/MarketMonitoringWorkspace.spec.tsx src/prototype/market/MarketTaskWorkspace.tsx src/prototype/market/MarketDocumentWorkbench.tsx src/prototype/data/marketDocumentFixtures.ts src/prototype/marketMonitoringData.ts src/prototype/market-monitoring.css
git commit -m "feat: rebuild market and logistics worktables"
```

### Task 7: On-Demand Object Detail and Sectioned Documents

**Files:**
- Modify: `src/prototype/production/ProductionObjectRegistry.tsx`
- Modify: `src/prototype/market/MarketObjectRegistry.tsx`
- Modify: `src/prototype/ProductionMonitoringWorkspace.spec.tsx`
- Modify: `src/prototype/MarketMonitoringWorkspace.spec.tsx`
- Modify: `src/prototype/production/ProductionDocumentWorkbench.tsx`
- Modify: `src/prototype/market/MarketDocumentWorkbench.tsx`
- Modify: `src/prototype/unified-workspaces.css`

**Interfaces:**
- Consumes: existing `MonitoringObject` identity、role、capability and document state。
- Produces: selected-object detail only after explicit `查看`; returns to unchanged list scope when closed。

- [ ] **Step 1: Write failing detail-behavior tests**

```tsx
expect(screen.queryByRole("region", { name: "对象详情" })).not.toBeInTheDocument();
await user.click(screen.getAllByRole("button", { name: "查看" })[0]);
expect(screen.getByRole("region", { name: "对象详情" })).toBeInTheDocument();
expect(screen.getByText("身份与业务角色")).toBeInTheDocument();
expect(screen.getByText("附件与来源凭证")).toBeInTheDocument();
expect(screen.queryByText("业务对象能力清单")).not.toBeInTheDocument();
await user.click(screen.getByRole("button", { name: "关闭详情" }));
expect(screen.getByText("第 1 页")).toBeInTheDocument();
```

- [ ] **Step 2: Run registry tests and verify current always-visible detail fails**

Run: `npm test -- src/prototype/ProductionMonitoringWorkspace.spec.tsx src/prototype/MarketMonitoringWorkspace.spec.tsx`

Expected: FAIL where the old registry exposes capabilities or detail before selection.

- [ ] **Step 3: Move object type to the correct surfaces**

Keep object type in create／edit required fields, registry query, table column and identity section. Keep capability templates internal; selected detail shows only currently applicable business roles and their effective dates.

- [ ] **Step 4: Preserve list state around detail**

Use the existing controlled `FormalSelection` for the selected object. Closing clears only the selection, not filters, sorting or page number.

- [ ] **Step 5: Verify document chapter behavior**

Add tests that hidden inapplicable fields remain present in the field-preservation map but do not render as disabled rows. Verify attachments, validation, audit opinion and change history remain reachable.

- [ ] **Step 6: Run registry, document and field audits**

Run: `npm test -- src/prototype/ProductionMonitoringWorkspace.spec.tsx src/prototype/MarketMonitoringWorkspace.spec.tsx src/prototype/market/MarketDocumentWorkbench.spec.tsx src/prototype/prototypeFieldPreservation.spec.ts`

Expected: PASS with no permanent detail panel and no field loss.

- [ ] **Step 7: Commit detail and document files**

```bash
git add src/prototype/production/ProductionObjectRegistry.tsx src/prototype/market/MarketObjectRegistry.tsx src/prototype/ProductionMonitoringWorkspace.spec.tsx src/prototype/MarketMonitoringWorkspace.spec.tsx src/prototype/production/ProductionDocumentWorkbench.tsx src/prototype/market/MarketDocumentWorkbench.tsx src/prototype/unified-workspaces.css
git commit -m "feat: add on-demand business object details"
```

### Task 8: Supply Trial, Formal Calculation, and Source Ledger

**Files:**
- Create: `src/prototype/core/supplyAccountEngine.ts`
- Create: `src/prototype/core/supplyAccountEngine.spec.ts`
- Modify: `src/prototype/data/supplyAccountSnapshot.ts`
- Modify: `src/prototype/data/supplyAccountSnapshot.spec.ts`
- Modify: `src/prototype/SupplyDemandWorkspace.tsx`
- Modify: `src/prototype/SupplyDemandWorkspace.spec.tsx`
- Modify: `src/prototype/supplyBalanceScope.ts`
- Modify: `src/prototype/supplyBalanceScope.spec.ts`
- Modify: `src/prototype/unified-workspaces.css`

**Interfaces:**
- Produces: `calculateSupplyAccount(input: SupplyAccountInput): SupplyAccountCalculation`。
- Produces: `resolveSupplyResultState(inputs: readonly SupplyInputRelease[], publishApproved: boolean): SupplyResultState`。
- Consumes: approved production, market, logistics and inventory input rows。

- [ ] **Step 1: Write failing exact-formula tests**

```ts
const result = calculateSupplyAccount({
  openingInventory: 126.4,
  localProduction: 512.8,
  externalInflow: 118.7,
  imports: 5.2,
  otherSupply: 0,
  foodUse: 32.4,
  feedUse: 176.8,
  seedUse: 7.6,
  processingUse: 321.7,
  loss: 18.6,
  externalOutflow: 95.1,
  exports: 6,
  otherUse: 1,
  approvedAdjustment: 1.2,
  surveyedEndingInventory: 105.6,
});
expect(result.totalSupply).toBe(763.1);
expect(result.totalUse).toBe(659.2);
expect(result.calculatedEndingInventory).toBe(103.9);
expect(result.adoptedEndingInventory).toBe(105.1);
expect(result.bookDifference).toBe(-0.5);
```

Add a state test proving a changed draft recalculates a trial result but does not mutate an existing formal snapshot.

- [ ] **Step 2: Run and verify engine tests fail**

Run: `npm test -- src/prototype/core/supplyAccountEngine.spec.ts`

Expected: FAIL because the independent engine does not exist.

- [ ] **Step 3: Implement decimal-safe one-decimal formulas**

```ts
export interface SupplyAccountInput {
  openingInventory: number;
  localProduction: number;
  externalInflow: number;
  imports: number;
  otherSupply: number;
  foodUse: number;
  feedUse: number;
  seedUse: number;
  processingUse: number;
  loss: number;
  externalOutflow: number;
  exports: number;
  otherUse: number;
  approvedAdjustment: number;
  surveyedEndingInventory: number;
}

export interface SupplyAccountCalculation {
  totalSupply: number;
  totalUse: number;
  calculatedEndingInventory: number;
  approvedAdjustment: number;
  adoptedEndingInventory: number;
  surveyedEndingInventory: number;
  bookDifference: number;
}

export interface SupplyInputRelease {
  source: string;
  approvalStatus: "draft" | "approved";
  qualityStatus: "passed" | "warning" | "blocking";
  required: boolean;
}

export type SupplyResultState = "trial" | "formal-candidate" | "formal";

export function resolveSupplyResultState(
  inputs: readonly SupplyInputRelease[],
  publishApproved: boolean,
): SupplyResultState;
```

Use the existing fixed-decimal helpers or the established one-decimal rounding function consistently. `bookDifference` follows the approved design: adopted ending inventory minus surveyed ending inventory.

- [ ] **Step 4: Add input qualification and immutable formal snapshots**

All required source inputs must be approved and non-blocking before state becomes `formal`. A formal snapshot is copied into a new immutable record; later drafts create a new trial record only.

- [ ] **Step 5: Rebuild the supply workspace around result and source tables**

Product is owned by the selected supply menu. Query contains region, marketing year, result state and cutoff. Render one continuous result line, then the supply table with business segment, item, current, previous, change, Chinese source, source status and `查看来源`. Do not display account IDs or source version codes.

- [ ] **Step 6: Run supply tests**

Run: `npm test -- src/prototype/core/supplyAccountEngine.spec.ts src/prototype/data/supplyAccountSnapshot.spec.ts src/prototype/SupplyDemandWorkspace.spec.tsx src/prototype/supplyBalanceScope.spec.ts`

Expected: PASS for formulas, permission gates, source drill-down and internal table scrolling.

- [ ] **Step 7: Commit supply files**

```bash
git add src/prototype/core/supplyAccountEngine.ts src/prototype/core/supplyAccountEngine.spec.ts src/prototype/data/supplyAccountSnapshot.ts src/prototype/data/supplyAccountSnapshot.spec.ts src/prototype/SupplyDemandWorkspace.tsx src/prototype/SupplyDemandWorkspace.spec.tsx src/prototype/supplyBalanceScope.ts src/prototype/supplyBalanceScope.spec.ts src/prototype/unified-workspaces.css
git commit -m "feat: add governed supply calculation ledger"
```

### Task 9: Dynamic Chinese Report Composition

**Files:**
- Modify: `src/prototype/businessReportModel.ts`
- Modify: `src/prototype/businessReportModel.spec.ts`
- Modify: `src/prototype/BusinessReportComposer.tsx`
- Modify: `src/prototype/BusinessReportComposer.spec.tsx`
- Modify: `src/prototype/ReportCenterWorkspace.tsx`
- Modify: `src/prototype/ReportCenterWorkspace.spec.tsx`
- Modify: `src/prototype/data/businessReportDatasets.ts`
- Modify: `src/prototype/data/businessReportDatasets.spec.ts`
- Modify: `src/prototype/unified-workspaces.css`

**Interfaces:**
- Consumes: approved dataset labels, Task 2 region cascade and selected business context。
- Produces: report request with business type、region、product、cultivar、period、frequency、cutoff、approved data and sections。

- [ ] **Step 1: Add failing nine-parameter report tests**

```tsx
expect(screen.getByLabelText("报告类型")).toBeInTheDocument();
expect(screen.getByLabelText("地区范围")).toBeInTheDocument();
expect(screen.getByLabelText("产品或作物")).toBeInTheDocument();
expect(screen.getByLabelText("具体品种")).toBeInTheDocument();
expect(screen.getByLabelText("报告期间")).toBeInTheDocument();
expect(screen.getByLabelText("报告频率")).toBeInTheDocument();
expect(screen.getByLabelText("数据截止")).toBeInTheDocument();
expect(screen.getByLabelText("采用数据")).toBeInTheDocument();
expect(screen.getByLabelText("报告章节")).toBeInTheDocument();
expect(screen.getByRole("button", { name: "生成预览" })).toBeDisabled();
```

Add an assertion that rendered text and exported filename contain no internal dataset ID or ASCII version token.

- [ ] **Step 2: Run report tests and verify any hard-coded scope fails**

Run: `npm test -- src/prototype/BusinessReportComposer.spec.tsx src/prototype/ReportCenterWorkspace.spec.tsx`

Expected: FAIL until all parameters are explicit and linked.

- [ ] **Step 3: Normalize report parameter types**

```ts
export interface BusinessReportRequest {
  reportType: "产情报告" | "市场报告" | "物流报告" | "供需报告" | "综合经营报告" | "履责报告";
  regionId: string;
  productId: string;
  cultivarId: string | null;
  periodKey: string;
  frequency: "日" | "周" | "月" | "年度" | "专题";
  cutoff: string;
  approvedDatasetId: string;
  sectionKeys: readonly string[];
}
```

The internal dataset ID remains in the request but is never rendered. UI uses `businessDataBatchLabel` and Chinese source time.

- [ ] **Step 4: Recompose report pages**

Use one parameter query, one report preview and one report ledger. Frequency is a parameter rather than separate menus. The workflow remains save draft, submit, review, publish, revise and export.

- [ ] **Step 5: Run report and workflow tests**

Run: `npm test -- src/prototype/businessReportModel.spec.ts src/prototype/BusinessReportComposer.spec.tsx src/prototype/ReportCenterWorkspace.spec.tsx src/prototype/businessReportWorkflow.spec.ts src/prototype/data/businessReportDatasets.spec.ts`

Expected: PASS including authorization, storage recovery, publication and revision behavior.

- [ ] **Step 6: Commit report files**

```bash
git add src/prototype/businessReportModel.ts src/prototype/businessReportModel.spec.ts src/prototype/BusinessReportComposer.tsx src/prototype/BusinessReportComposer.spec.tsx src/prototype/ReportCenterWorkspace.tsx src/prototype/ReportCenterWorkspace.spec.tsx src/prototype/data/businessReportDatasets.ts src/prototype/data/businessReportDatasets.spec.ts src/prototype/unified-workspaces.css
git commit -m "feat: add dynamic Chinese report composition"
```

### Task 10: Four-Year Comparisons, Overview Ledger, and My Work

**Files:**
- Modify: `src/prototype/components/AnnualComparisonTrack.tsx`
- Modify: `src/prototype/components/AnnualComparisonTrack.spec.tsx`
- Modify: `src/prototype/components/ComparisonCharts.tsx`
- Modify: `src/prototype/components/ComparisonCharts.spec.tsx`
- Modify: `src/prototype/core/metricComparisonViewModel.ts`
- Modify: `src/prototype/core/metricComparisonViewModel.spec.ts`
- Modify: `src/prototype/ExecutiveOverviewWorkspace.tsx`
- Modify: `src/prototype/MyWorkWorkspace.tsx`
- Modify: `src/prototype/PortalWorkspaces.spec.tsx`
- Modify: `src/prototype/formal-enterprise.css`
- Modify: `src/prototype/unified-workspaces.css`

**Interfaces:**
- Consumes: existing `ComparisonSet` and published metric catalog。
- Produces: four-year values, three year-over-year rates, explicit non-comparability and filtered overview ledgers。

- [ ] **Step 1: Add failing comparison and no-card tests**

```tsx
expect(screen.getByRole("columnheader", { name: "2023" })).toBeInTheDocument();
expect(screen.getByRole("columnheader", { name: "2024同比" })).toBeInTheDocument();
expect(screen.getByRole("columnheader", { name: "2025同比" })).toBeInTheDocument();
expect(screen.getByRole("columnheader", { name: "2026同比" })).toBeInTheDocument();
expect(screen.getByRole("img", { name: /四年数值趋势/ })).toBeInTheDocument();
```

```tsx
expect(container.querySelector(".unified-metric-card")).not.toBeInTheDocument();
expect(screen.getByRole("table", { name: "经营运行台账" })).toBeInTheDocument();
expect(screen.queryByText("责任岗位有效")).not.toBeInTheDocument();
```

- [ ] **Step 2: Run and verify old overview or comparison surfaces fail**

Run: `npm test -- src/prototype/components/AnnualComparisonTrack.spec.tsx src/prototype/components/ComparisonCharts.spec.tsx src/prototype/PortalWorkspaces.spec.tsx`

Expected: FAIL for the final table labels or removed context strip.

- [ ] **Step 3: Expose current and previous three years without technical wording**

Use the existing comparability engine. Render 2023–2026 values and 2024／2023、2025／2024、2026／2025 rates. If a pair is not comparable, render the Chinese reason from `businessComparisonReason` and no percentage.

- [ ] **Step 4: Rebuild overview as filtered ledgers**

Use `业务域`、`地区`、`期间`、`产品／作物`、`具体品种`、`风险状态` as query fields. Render the four views `经营运行`、`风险事项`、`履责监督`、`发布成果` as standard tables; no default Qiqihar cards.

- [ ] **Step 5: Rebuild My Work as an action queue**

Remove the `责任岗位有效` context strip. Keep current organization, post and responsibility scope in the avatar menu. The work page table is ordered by deadline and risk and supports `待我处理`、`待我填报`、`待我审核`、`退回与异常`、`已办事项` views.

- [ ] **Step 6: Run comparison and portal tests**

Run: `npm test -- src/prototype/components/AnnualComparisonTrack.spec.tsx src/prototype/components/ComparisonCharts.spec.tsx src/prototype/core/metricComparisonViewModel.spec.ts src/prototype/PortalWorkspaces.spec.tsx src/prototype/FormalEnterprisePrototype.spec.tsx`

Expected: PASS with no card wall and no invented comparison rate.

- [ ] **Step 7: Commit comparison and portal files**

```bash
git add src/prototype/components/AnnualComparisonTrack.tsx src/prototype/components/AnnualComparisonTrack.spec.tsx src/prototype/components/ComparisonCharts.tsx src/prototype/components/ComparisonCharts.spec.tsx src/prototype/core/metricComparisonViewModel.ts src/prototype/core/metricComparisonViewModel.spec.ts src/prototype/ExecutiveOverviewWorkspace.tsx src/prototype/MyWorkWorkspace.tsx src/prototype/PortalWorkspaces.spec.tsx src/prototype/formal-enterprise.css src/prototype/unified-workspaces.css
git commit -m "feat: finish ledger-led enterprise views"
```

### Task 11: Chinese Display Audit, Field Preservation, and Full Verification

**Files:**
- Modify: `src/prototype/core/businessDisplayPolicy.ts`
- Modify: `src/prototype/core/businessDisplayPolicy.spec.ts`
- Modify: `src/prototype/prototypeFieldPreservation.spec.ts`
- Modify: `src/prototype/FormalEnterprisePrototype.spec.tsx`
- Modify: `src/prototype/PortalWorkspaces.spec.tsx`
- Modify: `src/prototype/formal-enterprise.css`
- Modify: `src/prototype/unified-workspaces.css`

**Interfaces:**
- Consumes: all prior task outputs。
- Produces: final source-level and rendered-surface acceptance evidence。

- [ ] **Step 1: Add a rendered forbidden-language test**

```ts
const forbidden = [
  /METRIC-/i,
  /VERSION-/i,
  /指标数据版本/,
  /采用版本/,
  /数据层/,
  /业务对象能力清单/,
  /工作项生命周期/,
  /本单据不适用/,
  /责任人已确认/,
  /调查片区/,
  /样本户组/,
];
for (const pattern of forbidden) expect(screen.queryByText(pattern)).toBeNull();
```

- [ ] **Step 2: Run the audit test and fix every rendered violation**

Run: `npm test -- src/prototype/core/businessDisplayPolicy.spec.ts src/prototype/FormalEnterprisePrototype.spec.tsx src/prototype/PortalWorkspaces.spec.tsx`

Expected before fixes: FAIL if any internal wording remains. Replace visible text through shared display policies rather than deleting internal governance data.

- [ ] **Step 3: Run field-preservation and focused prototype tests**

Run: `npm test -- src/prototype/prototypeFieldPreservation.spec.ts src/prototype/EnterpriseShell.spec.tsx src/prototype/ProductionMonitoringWorkspace.spec.tsx src/prototype/MarketMonitoringWorkspace.spec.tsx src/prototype/SupplyDemandWorkspace.spec.tsx src/prototype/ReportCenterWorkspace.spec.tsx`

Expected: PASS with every audited field reachable.

- [ ] **Step 4: Run formatting, lint, architecture and full unit tests**

Run: `npm run format:check && npm run lint && npm run architecture && npm test`

Expected: all commands exit 0. If formatting alone fails, run Prettier only on exact modified files and rerun the four commands.

- [ ] **Step 5: Build the formal prototype**

Run: `npm run build:prototype`

Expected: Vite build completes without TypeScript or bundle errors.

- [ ] **Step 6: Inspect desktop rendering at 1920px, 1440px and 1280px**

Run: `npm run prototype -- --host 127.0.0.1 --port 63180`

Verify these routes in the browser:

```text
#/市场监测/玉米市场采集
#/产情监测/玉米产情填报
#/市场监测/物流节点监测
#/供需分析/玉米供需平衡
#/报表中心/业务报告
#/经营总览/经营运行
```

Expected: full left menu at 1920px and 1440px; only business tables scroll at 1280px; no page content crosses behind the left menu.

- [ ] **Step 7: Run the final verification suite**

Run: `npm run verify`

Expected: format, lint, architecture, unit tests, build, bundle budget and preview E2E all pass.

- [ ] **Step 8: Commit final audit fixes only**

```bash
git add src/prototype/core/businessDisplayPolicy.ts src/prototype/core/businessDisplayPolicy.spec.ts src/prototype/prototypeFieldPreservation.spec.ts src/prototype/FormalEnterprisePrototype.spec.tsx src/prototype/PortalWorkspaces.spec.tsx src/prototype/formal-enterprise.css src/prototype/unified-workspaces.css
git commit -m "test: verify final enterprise redesign"
```
