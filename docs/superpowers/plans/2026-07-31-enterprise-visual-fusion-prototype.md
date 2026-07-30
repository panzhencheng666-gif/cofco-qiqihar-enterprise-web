# Enterprise Visual Fusion Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade prototype variant A into a reference-grade enterprise operating workspace while preserving the approved production, market, and supply-demand business boundaries.

**Architecture:** Keep the isolated `prototype.html` entry and in-memory data. Replace only variant A’s shell and first-screen composition with a formal enterprise header, page-specific sidebar, compact responsibility/version context, operational lifecycle, exception panel, filter bar, and working table; keep variants B and C unchanged for comparison.

**Tech Stack:** React 19, TypeScript 5.9, Vite 8, plain CSS, local Chinese system fonts.

## Global Constraints

- The written design source is `docs/superpowers/specs/2026-07-31-enterprise-visual-fusion-design.md`.
- Variant A becomes “正式融合型”; variants B and C remain available and unchanged.
- The prototype remains read-only, in memory, disconnected from databases, APIs, authentication, export, calculation, and publishing services.
- Every page displays “界面样板｜非正式数据”.
- The four representative pages remain `work`, `production`, `market`, and `supply`.
- Production, market, and supply-demand facts retain the approved domain boundaries.
- The responsibility/version context and the operational lifecycle remain two different visual structures.
- Ordinary business UI contains no framework language, internal English code, API route, JSON, stack trace, or development identifier.
- The shared base palette remains navy `#0B2A3B`, teal `#167C74`, canvas `#F3F6F8`, white `#FFFFFF`, separator `#D6E0E6`, and amber `#B88318`.
- The primary review viewport is 1440 × 900.
- The first screen shows the page title, business context, metrics, lifecycle, exceptions, and the detail-table header.
- Per the disposable prototype workflow, verification is formatting, lint, TypeScript compilation, isolated build, existing tests, browser interaction, console inspection, and screenshots rather than a new component test suite.

## File Structure

- Modify `src/prototype/EnterpriseArchitecturePrototype.tsx`: formal fusion metadata, SVG utility icons, enterprise header, page-specific sidebar, compact context band, lifecycle, filter bar, and rebuilt `VariantA`.
- Modify `src/prototype/prototype.css`: `prototype-fusion-*` token usage, shell layout, component states, responsive behavior, and screenshot composition.
- Modify `docs/superpowers/plans/2026-07-31-enterprise-visual-prototype.md`: record that A was superseded by the approved formal fusion direction and point to this plan.

---

### Task 1: Add formal-fusion business metadata and enterprise shell

**Files:**

- Modify: `src/prototype/EnterpriseArchitecturePrototype.tsx`
- Modify: `src/prototype/prototype.css`

**Interfaces:**

- Consumes: `PrototypePage`, `PageDefinition`, `PageContent`, `pages`, `contentByPage`, and `secondaryNavigation`.
- Produces: page-specific titles, actions, lifecycle states, `FusionGlobalHeader`, and `FusionSidebar`.

- [ ] **Step 1: Add page-specific fusion metadata**

Add these exact interfaces and shape:

```tsx
interface FusionPageMeta {
  application: string;
  applicationNote: string;
  breadcrumb: readonly string[];
  workspaceTitle: string;
  workspaceSummary: string;
  actions: readonly string[];
  tabs: readonly string[];
  lifecycle: readonly {
    label: string;
    detail: string;
    state: "done" | "current" | "warning" | "open";
  }[];
  context: readonly { label: string; value: string }[];
  filters: readonly string[];
}

const fusionMetaByPage: Record<PrototypePage, FusionPageMeta> = {
  work: {
    application: "我的工作",
    applicationNote: "统一处理跨业务责任、审核、异常和发布事项",
    breadcrumb: ["经营工作", "我的工作"],
    workspaceTitle: "我的经营工作台",
    workspaceSummary: "聚合当前岗位必须处理、审核、解释和跟踪的经营事项。",
    actions: ["批量领取", "转交规则"],
    tabs: ["待我处理", "待我审核", "异常与逾期", "待发布", "已办跟踪"],
    lifecycle: [
      { label: "责任到岗", detail: "12 项", state: "done" },
      { label: "任务受理", detail: "9 项处理中", state: "current" },
      { label: "质量复核", detail: "3 项阻断", state: "warning" },
      { label: "业务审核", detail: "7 项待办", state: "open" },
      { label: "正式发布", detail: "4 项受影响", state: "open" },
    ],
    context: [],
    filters: ["全部业务域", "全部状态", "今日及逾期"],
  },
  production: {
    application: "产情监测",
    applicationNote: "管理生产事实、调查采集、质量审核和正式发布",
    breadcrumb: ["产情运营", "产情监测", "种植生产"],
    workspaceTitle: "种植生产运营工作区",
    workspaceSummary:
      "从样本对象、调查采集到分级审核与正式发布的统一作业入口。",
    actions: ["导入调查结果", "导出当前视图", "更多", "新建调查任务"],
    tabs: [
      "运营总览",
      "样本对象",
      "采集任务",
      "审核与发布",
      "数据质量",
      "来源与版本",
    ],
    lifecycle: [
      { label: "任务下达", detail: "428 份", state: "done" },
      { label: "调查采集", detail: "395 已提交", state: "done" },
      { label: "规则校验", detail: "5 项阻断", state: "warning" },
      { label: "分级审核", detail: "37 项待办", state: "current" },
      { label: "正式发布", detail: "生成事实版本", state: "open" },
    ],
    context: [],
    filters: ["齐齐哈尔全域", "全部来源类型", "全部状态"],
  },
  market: {
    application: "市场监测",
    applicationNote: "治理主体报送、市场事实、质量审核和指标发布",
    breadcrumb: ["市场运营", "市场监测", "市场总览"],
    workspaceTitle: "市场运行监测工作区",
    workspaceSummary: "统一组织报价、交易、库存、加工和物流事实的采集与审核。",
    actions: ["导入主体报送", "导出当前视图", "更多", "新建采集任务"],
    tabs: [
      "运营总览",
      "市场主体",
      "采集任务",
      "审核与发布",
      "数据质量",
      "来源与版本",
    ],
    lifecycle: [
      { label: "任务下达", detail: "86 家", state: "done" },
      { label: "主体报送", detail: "79 家已报", state: "done" },
      { label: "事实匹配", detail: "3 项待解释", state: "warning" },
      { label: "业务审核", detail: "7 项待办", state: "current" },
      { label: "指标发布", detail: "本周未发布", state: "open" },
    ],
    context: [],
    filters: ["全部县区", "全部事实类型", "全部状态"],
  },
  supply: {
    application: "供需平衡",
    applicationNote: "管理产品账户、采用指标、账户勾稽和版本发布",
    breadcrumb: ["决策分析", "供需平衡", "玉米产品账户"],
    workspaceTitle: "玉米供需账户工作区",
    workspaceSummary: "使用已发布事实与指标完成账户计算、差额解释和版本审核。",
    actions: ["比较版本", "查看口径", "更多", "新建测算草案"],
    tabs: ["供需总览", "产品账户", "账户勾稽", "采用指标", "版本与血缘"],
    lifecycle: [
      { label: "版本创建", detail: "第 4 版", state: "done" },
      { label: "指标采用", detail: "1 项待审核", state: "warning" },
      { label: "账户计算", detail: "计算完成", state: "done" },
      { label: "差额解释", detail: "差额 1.7 万吨", state: "current" },
      { label: "审核发布", detail: "尚未发布", state: "open" },
    ],
    context: [],
    filters: ["玉米", "2026/27 年度", "第 4 版"],
  },
};
```

Populate each `context` at render time from the active page period and cutoff so the displayed responsibility/version chain cannot become stale.

- [ ] **Step 2: Add restrained inline SVG utility icons**

Create `FusionIcon` with the exact names `"apps" | "home" | "search" | "task" | "bell" | "help" | "chevron" | "download" | "plus"`. Each icon renders a 16 × 16 SVG with `aria-hidden="true"` and uses `currentColor`.

- [ ] **Step 3: Implement `FusionGlobalHeader`**

Render, in order:

```text
应用入口 → 品牌 → 当前组织 → 当前应用 → 全局搜索
→ 样板环境 → 任务 → 通知 → 帮助 → 用户与岗位
```

The current application label comes from `fusionMetaByPage[page].application`. Task and notification buttons show numeric badges. The header is 72 px high at the 1440 × 900 review viewport.

- [ ] **Step 4: Implement `FusionSidebar`**

Render the current application name and description above `secondaryNavigation[page]`. Only the first work area is active in the prototype. Remove the duplicated four-page navigation from the sidebar; page switching remains available through the global current-application control and prototype URL.

- [ ] **Step 5: Run static verification**

Run:

```bash
npx prettier --check src/prototype/EnterpriseArchitecturePrototype.tsx src/prototype/prototype.css
npx eslint src/prototype --max-warnings 0
npx tsc -b
```

Expected: all commands exit 0.

### Task 2: Rebuild variant A as a continuous operating workspace

**Files:**

- Modify: `src/prototype/EnterpriseArchitecturePrototype.tsx`
- Modify: `src/prototype/prototype.css`

**Interfaces:**

- Consumes: `FusionPageMeta`, `PageContent`, `MetricStrip`, `BusinessTable`, `AttentionList`, and `DomainStory`.
- Produces: compact business context, lifecycle workbench, exception panel, filter bar, and page-specific first screen.

- [ ] **Step 1: Implement `FusionContextBand`**

Render seven compact segments:

```text
当前责任上下文
组织
责任区域
业务期间
业务对象
数据范围与截止
质量 / 审核 / 发布版本
```

The first segment uses navy; normal confirmed segments use white with teal state markers; quality or review warnings use amber text and an explicit warning label.

- [ ] **Step 2: Implement `FusionLifecyclePanel`**

Render five lifecycle stages from `FusionPageMeta.lifecycle`, with completed, current, warning, and open states. Under the stages render four business facts:

```text
当前责任组织
工作版本
质量规则
发布窗口
```

For `production`, `market`, and `supply`, insert the existing `DomainStory` below the lifecycle stages. For `work`, omit the duplicate workflow story.

- [ ] **Step 3: Implement `FusionFilterBar`**

Render the section title and page-specific explanation on the left. On the right render three in-memory filter buttons, “列设置”, and a refresh control. Buttons do not mutate or claim to export formal data.

- [ ] **Step 4: Replace `VariantA`**

The new DOM order is:

```tsx
<FusionGlobalHeader />
<div className="prototype-fusion-shell">
  <FusionSidebar />
  <main>
    <FusionPageHeader />
    <FusionContextBand />
    <FusionTabs />
    <MetricStrip />
    <div className="prototype-fusion-focus-grid">
      <FusionLifecyclePanel />
      <AttentionList />
    </div>
    <FusionFilterBar />
    <BusinessTable />
  </main>
</div>
```

Use the formal page names and actions from the design spec. Variant A’s prototype switcher label becomes `A — 正式融合型`.

- [ ] **Step 5: Preserve four-page navigation**

Add a current-application menu to the global header that displays the four page buttons in an in-memory popover. Selecting a page updates `page` and the URL through the existing `onSelectPage`.

- [ ] **Step 6: Verify critical content**

For all four pages, confirm the DOM contains one page heading, one sample-data badge, one lifecycle heading, one “需要立即处理” heading, and one table.

### Task 3: Raise visual completion to reference-grade quality

**Files:**

- Modify: `src/prototype/prototype.css`

**Interfaces:**

- Consumes: `prototype-fusion-*` class names.
- Produces: a complete 1440 × 900 enterprise operating workspace without horizontal overflow.

- [ ] **Step 1: Build the global shell**

Use a 72 px navy header, 248 px light sidebar, and `minmax(0, 1fr)` content canvas. Give the application launcher, brand, selectors, search, environment, notification, and user areas distinct but quiet boundaries.

- [ ] **Step 2: Improve readable density**

Use these ranges:

```text
Page title: 28–32 px
Section title: 16–18 px
Body: 12–14 px
Table: 12 px minimum
Utility labels: 10–11 px
Metric values: 32–38 px
```

Do not use text below 10 px for operational content.

- [ ] **Step 3: Finish controls and states**

Style default, hover, focus-visible, active, warning, and blocked states. Use 4–8 px radii. Use shadows only on the sticky header, application popover, and prototype switcher.

- [ ] **Step 4: Compose the first screen**

At 1440 × 900, keep the top of the detail table visible. Let the lifecycle panel and exception panel share one row. Make the metric region operational rather than decorative by pairing each value with its qualification or trend.

- [ ] **Step 5: Add responsive behavior**

Below 1180 px, move exceptions below lifecycle. Below 860 px, collapse the sidebar into a horizontal work-area bar and allow tables to scroll. Preserve visible keyboard focus and reduced-motion behavior.

### Task 4: Verify, capture, and present the four pages

**Files:**

- Modify only if review finds defects: `src/prototype/EnterpriseArchitecturePrototype.tsx`
- Modify only if review finds defects: `src/prototype/prototype.css`
- Modify: `docs/superpowers/plans/2026-07-31-enterprise-visual-prototype.md`

**Interfaces:**

- Consumes: `http://127.0.0.1:63182/prototype.html?variant=A&page=<page>`.
- Produces: a browser-reviewed prototype and four 1440 × 900 JPG screenshots.

- [ ] **Step 1: Run all static gates**

Run:

```bash
npx prettier --check package.json prototype.html vite.prototype.config.ts tsconfig.app.json src/prototype
npx eslint vite.prototype.config.ts src/prototype --max-warnings 0
npx tsc -b
npm run build:prototype
npm test
```

Expected: formatting, lint, TypeScript, isolated build, and all existing tests pass.

- [ ] **Step 2: Review the four formal-fusion pages**

Open:

```text
?variant=A&page=work
?variant=A&page=production
?variant=A&page=market
?variant=A&page=supply
```

Confirm no horizontal overflow, readable table text, distinct page actions, correct lifecycle labels, and one sample-data badge.

- [ ] **Step 3: Verify interaction and console**

Use the current-application menu to change pages, use the prototype switcher to reach B and C, use an arrow key to cycle variants, and confirm the browser console contains no errors.

- [ ] **Step 4: Capture the four final screenshots**

Save:

```text
enterprise-prototype/fusion-work.jpg
enterprise-prototype/fusion-production.jpg
enterprise-prototype/fusion-market.jpg
enterprise-prototype/fusion-supply.jpg
```

Each screenshot uses the existing `capture=1` mode and the 1440 × 900 viewport.

- [ ] **Step 5: Record the superseded direction**

Add this note to the original prototype plan:

```markdown
## Superseded Recommendation

Variant A’s initial responsibility-rail presentation was superseded after
visual comparison. The approved recommendation is now the formal fusion
direction defined in
`docs/superpowers/specs/2026-07-31-enterprise-visual-fusion-design.md`
and implemented through
`docs/superpowers/plans/2026-07-31-enterprise-visual-fusion-prototype.md`.
```

- [ ] **Step 6: Commit only prototype-scope changes**

Stage the two prototype source files and two plan documents explicitly. Do not stage any pre-existing application changes.

```bash
git add -- \
  src/prototype/EnterpriseArchitecturePrototype.tsx \
  src/prototype/prototype.css \
  docs/superpowers/plans/2026-07-31-enterprise-visual-prototype.md \
  docs/superpowers/plans/2026-07-31-enterprise-visual-fusion-prototype.md
git commit -m "feat: refine enterprise visual fusion prototype"
```
