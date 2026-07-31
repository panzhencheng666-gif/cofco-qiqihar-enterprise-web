# Table-Centric Enterprise Shell Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the remaining dashboard-style prototype presentation with one dark L-shaped enterprise shell and continuous table-led workbenches across all six business applications without removing approved business capabilities.

**Architecture:** `FormalEnterprisePrototype` remains the single composition root. `FormalEnterprisePrototype.tsx` owns only the global shell and route composition; `UnifiedWorkspacePrimitives.tsx` owns reusable flat workbench structures; each business workspace owns its business-specific tables, forms, filters, and state. Existing domain models and business data remain authoritative, while visual structure is consolidated through `formal-enterprise.css`, `unified-workspaces.css`, and the existing market-specific stylesheet.

**Tech Stack:** React 19.2.8, TypeScript 5.9.3, Vite 8.1.5, Vitest 4.1.10, Testing Library 16.3.2, CSS, inline SVG icons

## Global Constraints

- The global header is exactly one 44px dark-blue navigation row.
- The expanded sidebar is 152px; the collapsed sidebar is 48px.
- The six applications remain `我的工作｜经营总览｜产情监测｜市场监测｜供需与态势｜报表中心`.
- Production and market each keep five stable sidebar entries; sub-businesses use in-page tabs or professional tables instead of more sidebar levels.
- Ordinary business pages do not use multi-column metric-card grids, card nesting, or large floating shadows.
- Executive overview may show at most four values in one continuous summary strip.
- Main business actions use icon plus text; irreversible actions and row actions never use icon-only controls.
- Generic tools may use icon-only controls only when they have an accessible name and visible hover/focus explanation.
- Online entry, Excel import, and authorized system intake remain inside production or market monitoring and write to the same business workflow.
- Corn, soybean, and paddy varieties, prices, quality, quantities, inventory, processing, and logistics remain visible and test-covered.
- Supply pages always show region, product, period, adopted version, one core equation, account rows, and source traceability.
- Business and duty reports retain explicit business, region, product/topic, period, version, responsibility, and status filters.
- No new runtime dependency is allowed for this visual redesign.
- Existing unrelated dirty-worktree changes must not be staged or overwritten.
- Target Node version remains `>=24.15.0 <25`; target npm version remains `>=11.6.0 <12`.

---

## File Structure

### New file

- `src/prototype/EnterpriseIcon.tsx`
  - Defines the closed icon-name union and the single inline-SVG renderer used by the shell and workbench actions.

### Shell files

- `src/prototype/FormalEnterprisePrototype.tsx`
  - Replaces the current organization and application selector boxes with the single-row application navigation.
  - Owns sidebar collapse state, global application switching, and section switching.
- `src/prototype/formalEnterpriseData.ts`
  - Retains six applications and five consolidated internal sections per business.
- `src/prototype/formal-enterprise.css`
  - Owns all L-shell dimensions, dark header, dark sidebar, active states, focus states, and responsive collapse behavior.
- `src/prototype/FormalEnterprisePrototype.spec.tsx`
  - Locks down the six-application header, non-repeating sidebar, icon accessibility, canonical routing, and business preservation.

### Shared workbench files

- `src/prototype/UnifiedWorkspacePrimitives.tsx`
  - Adds flat tabs, filters, summary, toolbar, and pagination primitives.
  - Converts metric and panel primitives from card presentation to continuous workbench presentation.
- `src/prototype/UnifiedWorkspacePrimitives.spec.tsx`
  - Locks down semantics and action accessibility.
- `src/prototype/unified-workspaces.css`
  - Owns continuous content layout, flat section boundaries, table density, forms, responsive behavior, and business-specific workbench refinements.

### Business workspace files

- `src/prototype/MyWorkWorkspace.tsx`
- `src/prototype/ExecutiveOverviewWorkspace.tsx`
- `src/prototype/PortalWorkspaces.spec.tsx`
- `src/prototype/ProductionMonitoringWorkspace.tsx`
- `src/prototype/ProductionMonitoringWorkspace.spec.tsx`
- `src/prototype/MarketMonitoringWorkspace.tsx`
- `src/prototype/MarketMonitoringWorkspace.spec.tsx`
- `src/prototype/market-monitoring.css`
- `src/prototype/SupplyDemandWorkspace.tsx`
- `src/prototype/SupplyDemandWorkspace.spec.tsx`
- `src/prototype/ReportCenterWorkspace.tsx`
- `src/prototype/ReportCenterWorkspace.spec.tsx`
- `src/prototype/BusinessReportComposer.tsx`
- `src/prototype/BusinessReportComposer.spec.tsx`

### Formal entry files

- `src/prototype/main.tsx`
  - Mounts `FormalEnterprisePrototype` directly.
- `prototype.html`
  - Uses the formal platform title and removes “界面样板” language.

---

### Task 0: Preserve the Verified Report-Selector Baseline

**Files:**

- Modify already present: `src/prototype/ReportCenterWorkspace.tsx`
- Modify already present: `src/prototype/ReportCenterWorkspace.spec.tsx`
- Modify already present: `src/prototype/unified-workspaces.css`

**Interfaces:**

- Preserves: explicit business, region, product/topic, period, and version selectors
- Preserves: explicit duty business, region, period, and state selectors
- Produces: a clean baseline commit before shell CSS changes begin

- [ ] **Step 1: Inspect only the existing report-selector diff**

Run:

```bash
git diff -- src/prototype/ReportCenterWorkspace.tsx src/prototype/ReportCenterWorkspace.spec.tsx src/prototype/unified-workspaces.css
```

Expected: the diff contains the previously completed report filters, selector tests, and responsive report-filter CSS; it does not contain unrelated application-shell work.

- [ ] **Step 2: Re-run the focused tests and prototype build**

Run:

```bash
npm test -- src/prototype/ReportCenterWorkspace.spec.tsx
npm run build:prototype
git diff --check -- src/prototype/ReportCenterWorkspace.tsx src/prototype/ReportCenterWorkspace.spec.tsx src/prototype/unified-workspaces.css
```

Expected: all commands exit with code 0.

- [ ] **Step 3: Commit only the verified baseline**

```bash
git add src/prototype/ReportCenterWorkspace.tsx src/prototype/ReportCenterWorkspace.spec.tsx src/prototype/unified-workspaces.css
git commit -m "feat: add explicit enterprise report filters"
```

---

### Task 1: Build the Single-Row Enterprise Shell

**Files:**

- Create: `src/prototype/EnterpriseIcon.tsx`
- Modify: `src/prototype/FormalEnterprisePrototype.tsx`
- Modify: `src/prototype/formalEnterpriseData.ts`
- Modify: `src/prototype/FormalEnterprisePrototype.spec.tsx`
- Modify: `src/prototype/formal-enterprise.css`
- Modify: `src/prototype/unified-workspaces.css`

**Interfaces:**

- Produces: `EnterpriseIconName`
- Produces: `EnterpriseIcon({ name, className? }: { name: EnterpriseIconName; className?: string })`
- Consumes: `formalApplicationDefinitions`, `FormalApplication`, `FormalSection`
- Preserves: `FormalEnterprisePrototype({ initialSearch? })`

- [ ] **Step 1: Add failing shell tests**

Add these cases to `src/prototype/FormalEnterprisePrototype.spec.tsx`:

```tsx
it("uses one enterprise application bar and a non-repeating sidebar", () => {
  const { container } = render(
    <FormalEnterprisePrototype initialSearch="?page=market&section=collection" />,
  );

  const applications = screen.getByRole("navigation", {
    name: "业务应用",
  });
  expect(within(applications).getAllByRole("button")).toHaveLength(6);
  expect(
    within(applications).getByRole("button", { name: "市场监测" }),
  ).toHaveAttribute("aria-current", "page");
  expect(screen.queryByText("当前业务应用")).not.toBeInTheDocument();
  expect(screen.queryByText("统一业务与数据运营平台")).not.toBeInTheDocument();
  expect(screen.queryByText("演示环境 · 非生产数据")).not.toBeInTheDocument();
  expect(container.querySelector(".formal-sidebar-description")).toBeNull();
  expect(container.querySelector(".formal-enterprise-shell")).not.toBeNull();
});

it("collapses the 152px sidebar without hiding business names from assistive technology", async () => {
  const user = userEvent.setup();
  const { container } = render(
    <FormalEnterprisePrototype initialSearch="?page=production&section=collection" />,
  );

  await user.click(screen.getByRole("button", { name: "收起左侧导航" }));
  expect(container.querySelector(".formal-enterprise")).toHaveClass(
    "is-sidebar-collapsed",
  );
  expect(
    screen.getByRole("navigation", { name: "产情监测模块" }),
  ).toHaveTextContent("数据采集");
  expect(screen.getByRole("button", { name: "展开左侧导航" })).toBeVisible();
});
```

- [ ] **Step 2: Run the shell tests and confirm they fail**

Run:

```bash
npm test -- src/prototype/FormalEnterprisePrototype.spec.tsx
```

Expected: FAIL because the current shell exposes an application selector menu, repeated application description, 64px header, and no sidebar collapse control.

- [ ] **Step 3: Create the closed icon renderer**

Create `src/prototype/EnterpriseIcon.tsx` with this public shape:

```tsx
export type EnterpriseIconName =
  | "apps"
  | "home"
  | "work"
  | "overview"
  | "production"
  | "market"
  | "supply"
  | "report"
  | "search"
  | "task"
  | "bell"
  | "help"
  | "collapse"
  | "expand"
  | "list"
  | "entry"
  | "review"
  | "exception"
  | "history"
  | "refresh"
  | "columns"
  | "density"
  | "download"
  | "upload"
  | "plus";

const paths: Record<EnterpriseIconName, readonly string[]> = {
  apps: [
    "M5 5h3v3H5z",
    "M10.5 5h3v3h-3z",
    "M16 5h3v3h-3z",
    "M5 10.5h3v3H5z",
    "M10.5 10.5h3v3h-3z",
    "M16 10.5h3v3h-3z",
    "M5 16h3v3H5z",
    "M10.5 16h3v3h-3z",
    "M16 16h3v3h-3z",
  ],
  home: ["M3 21h18", "M5 21V8l7-5 7 5v13", "M9 21v-6h6v6"],
  work: ["M5 4h14v16H5z", "m8 11 2 2 5-5"],
  overview: ["M4 19V9", "M10 19V5", "M16 19v-7", "M2 19h20"],
  production: [
    "M12 21V9",
    "M12 14c-5 0-7-3-7-7 5 0 7 3 7 7Z",
    "M12 12c5 0 7-3 7-7-5 0-7 3-7 7Z",
  ],
  market: ["M4 19V8h16v11", "M7 8V5h10v3", "M8 12h8"],
  supply: ["M4 7h16", "M4 12h16", "M4 17h16", "m17 4 3 3-3 3"],
  report: ["M6 3h9l3 3v15H6z", "M9 10h6", "M9 14h6", "M9 18h4"],
  search: ["M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z", "m20 20-4-4"],
  task: ["M6 4h12v16H6z", "M9 9h6", "M9 13h6", "M9 17h4"],
  bell: ["M5 17h14l-2-3v-4a5 5 0 0 0-10 0v4Z", "M10 20h4"],
  help: [
    "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z",
    "M10 9a2.4 2.4 0 1 1 3.5 2.1c-1 .6-1.5 1.1-1.5 2.2",
    "M12 17h.01",
  ],
  collapse: ["m14 6-6 6 6 6", "M20 4v16"],
  expand: ["m10 6 6 6-6 6", "M4 4v16"],
  list: [
    "M8 6h12",
    "M8 12h12",
    "M8 18h12",
    "M4 6h.01",
    "M4 12h.01",
    "M4 18h.01",
  ],
  entry: ["M5 4h14v16H5z", "M8 8h8", "M8 12h8", "M8 16h5"],
  review: ["m5 12 4 4L19 6", "M4 21h16"],
  exception: ["M12 3 2 15h-4Z", "M12 21h.01"],
  history: ["M4 12a8 8 0 1 0 2-5.3", "M4 4v5h5", "M12 8v5l3 2"],
  refresh: [
    "M20 6v5h-5",
    "M4 18v-5h5",
    "M18 9a7 7 0 0 0-12-2L4 11",
    "M6 15a7 7 0 0 0 12 2l2-4",
  ],
  columns: [
    "M4 6h16",
    "M4 12h16",
    "M4 18h16",
    "M8 4v4",
    "M15 10v4",
    "M11 16v4",
  ],
  density: ["M4 7h16", "M4 12h16", "M4 17h16"],
  download: ["M12 3v12", "m7 10 5 5 5-5", "M4 20h16"],
  upload: ["M12 15V3", "m7 8 5-5 5 5", "M4 20h16"],
  plus: ["M12 5v14", "M5 12h14"],
};

export function EnterpriseIcon({
  name,
  className = "",
}: {
  name: EnterpriseIconName;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={`enterprise-icon ${className}`.trim()}
      viewBox="0 0 24 24"
    >
      {paths[name].map((path) => (
        <path d={path} key={path} />
      ))}
    </svg>
  );
}
```

- [ ] **Step 4: Replace selector-based shell composition**

In `FormalEnterprisePrototype.tsx`:

- delete the local `FormalIcon`;
- delete `menuOpen` and `formal-app-menu`;
- render one `<nav aria-label="业务应用">` containing six buttons;
- add `sidebarCollapsed` state;
- remove `formal-sidebar-app`, `formal-sidebar-description`, and sidebar status copy;
- render icon plus label for each internal navigation button;
- keep `changeRoute` as the only application and section navigation writer.
- initialize `sidebarCollapsed` with `window.matchMedia("(max-width: 1280px)").matches`;
- keep later user collapse/expand choices in component state instead of forcing them through CSS.

Update the production and market labels in `formalEnterpriseData.ts` without
adding more sidebar entries:

```tsx
navigation: [
  { key: "overview", label: "监测总览" },
  { key: "objects", label: "监测对象" },
  { key: "collection", label: "数据采集" },
  { key: "review", label: "审核与发布" },
  { key: "reports", label: "分析与报告" },
],
```

The application navigation must follow this structure:

```tsx
<nav aria-label="业务应用" className="formal-application-nav">
  {formalApplicationDefinitions.map((item) => (
    <button
      aria-current={item.key === route.application ? "page" : undefined}
      className={item.key === route.application ? "is-active" : undefined}
      key={item.key}
      type="button"
      onClick={() =>
        changeRoute({
          application: item.key,
          section: getDefaultFormalSection(item.key),
        })
      }
    >
      {item.label}
    </button>
  ))}
</nav>
```

The root and collapse control must follow this structure:

```tsx
<div
  className={`formal-enterprise${sidebarCollapsed ? " is-sidebar-collapsed" : ""}`}
>
  <FormalGlobalHeader
    route={route}
    onApplicationChange={(application) =>
      changeRoute({
        application,
        section: getDefaultFormalSection(application),
      })
    }
  />
  <div className="formal-enterprise-shell">
    <FormalSidebar
      collapsed={sidebarCollapsed}
      route={route}
      onCollapse={() => setSidebarCollapsed((value) => !value)}
      onSectionChange={(section) =>
        changeRoute({ application: route.application, section })
      }
    />
    <main className="formal-main">{renderWorkspace()}</main>
  </div>
</div>
```

- [ ] **Step 5: Implement exact shell dimensions and visual ownership**

Move all `.formal-*` shell overrides out of the beginning of `unified-workspaces.css` and make `formal-enterprise.css` authoritative.

Use these declarations:

```css
.formal-header {
  height: 44px;
  min-height: 44px;
  background: #072f43;
  border-bottom: 1px solid #234d60;
  box-shadow: none;
}

.formal-enterprise-shell {
  min-height: calc(100vh - 44px);
  display: grid;
  grid-template-columns: 152px minmax(0, 1fr);
}

.formal-enterprise.is-sidebar-collapsed .formal-enterprise-shell {
  grid-template-columns: 48px minmax(0, 1fr);
}

.formal-sidebar {
  top: 44px;
  height: calc(100vh - 44px);
  color: #b8c8cf;
  background: #102d3d;
  border-right: 1px solid #284653;
}

.formal-nav-group > button {
  min-height: 35px;
  border-left: 3px solid transparent;
  border-radius: 0;
  color: #aebfc7;
}

.formal-nav-group > button.is-active {
  border-left-color: #43b3a6;
  color: #fff;
  background: rgb(255 255 255 / 7%);
}
```

At `max-width: 1280px`, the React initial state collapses the sidebar. CSS hides the full search input behind its labeled icon button and keeps all six application labels visible. When the user explicitly expands the sidebar, the state-driven root class wins.

- [ ] **Step 6: Run shell tests**

Run:

```bash
npm test -- src/prototype/FormalEnterprisePrototype.spec.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit the shell**

```bash
git add src/prototype/EnterpriseIcon.tsx src/prototype/FormalEnterprisePrototype.tsx src/prototype/formalEnterpriseData.ts src/prototype/FormalEnterprisePrototype.spec.tsx src/prototype/formal-enterprise.css src/prototype/unified-workspaces.css
git commit -m "feat: add compact enterprise application shell"
```

---

### Task 2: Add Flat Workbench Primitives

**Files:**

- Modify: `src/prototype/UnifiedWorkspacePrimitives.tsx`
- Modify: `src/prototype/UnifiedWorkspacePrimitives.spec.tsx`
- Modify: `src/prototype/unified-workspaces.css`

**Interfaces:**

- Produces: `WorkspaceTab`
- Produces: `WorkspaceTabs({ label, tabs, active, onChange })`
- Produces: `WorkspaceFilterBar({ label, children, actions? })`
- Produces: `WorkspaceSummaryStrip({ items, label? })`
- Produces: `WorkspaceTableToolbar({ title, note?, actions? })`
- Produces: `WorkspacePagination({ total, start, end, page, pages })`
- Preserves: `WorkspaceHeader`, `BusinessContextBar`, `WorkspaceStatus`, `WorkspaceTable`, `CollectionModeSwitch`

- [ ] **Step 1: Add failing primitive tests**

Add to `UnifiedWorkspacePrimitives.spec.tsx`:

```tsx
it("renders one continuous table workbench sequence", async () => {
  const user = userEvent.setup();
  const onTabChange = vi.fn();
  render(
    <>
      <WorkspaceTabs
        active="current"
        label="任务状态"
        tabs={[
          { key: "current", label: "本期报送" },
          { key: "overdue", label: "逾期记录" },
        ]}
        onChange={onTabChange}
      />
      <WorkspaceFilterBar
        actions={<button type="button">查询</button>}
        label="任务筛选"
      >
        <label>
          地区
          <select aria-label="地区">
            <option>齐齐哈尔市</option>
          </select>
        </label>
      </WorkspaceFilterBar>
      <WorkspaceSummaryStrip
        items={[
          { label: "应报", value: "428" },
          { label: "逾期", value: "6", tone: "danger" },
        ]}
      />
      <WorkspaceTableToolbar title="报送任务清单" />
    </>,
  );

  await user.click(screen.getByRole("tab", { name: "逾期记录" }));
  expect(onTabChange).toHaveBeenCalledWith("overdue");
  expect(screen.getByRole("region", { name: "任务筛选" })).toBeVisible();
  expect(screen.getByLabelText("业务状态摘要")).toHaveTextContent("应报428");
  expect(screen.getByRole("toolbar", { name: "报送任务清单" })).toBeVisible();
});
```

- [ ] **Step 2: Run the primitive tests and confirm they fail**

Run:

```bash
npm test -- src/prototype/UnifiedWorkspacePrimitives.spec.tsx
```

Expected: FAIL because the new workbench primitives are not exported.

- [ ] **Step 3: Implement the new primitive contracts**

Add these types and components to `UnifiedWorkspacePrimitives.tsx`:

```tsx
export interface WorkspaceTab {
  key: string;
  label: string;
  count?: string;
}

export interface WorkspaceSummaryItem {
  label: string;
  value: string;
  note?: string;
  tone?: WorkspaceTone;
}

export function WorkspaceTabs({
  label,
  tabs,
  active,
  onChange,
}: {
  label: string;
  tabs: readonly WorkspaceTab[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div aria-label={label} className="workspace-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          aria-selected={active === tab.key}
          className={active === tab.key ? "is-active" : undefined}
          key={tab.key}
          role="tab"
          type="button"
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
          {tab.count && <span>{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function WorkspaceFilterBar({
  label,
  children,
  actions,
}: {
  label: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section aria-label={label} className="workspace-filter-bar">
      <div className="workspace-filter-fields">{children}</div>
      {actions && <div className="workspace-filter-actions">{actions}</div>}
    </section>
  );
}

export function WorkspaceSummaryStrip({
  items,
  label = "业务状态摘要",
}: {
  items: readonly WorkspaceSummaryItem[];
  label?: string;
}) {
  return (
    <div aria-label={label} className="workspace-summary-strip">
      {items.map((item) => (
        <span className={`is-${item.tone ?? "normal"}`} key={item.label}>
          {item.label}
          <strong>{item.value}</strong>
          {item.note && <small>{item.note}</small>}
        </span>
      ))}
    </div>
  );
}

export function WorkspaceTableToolbar({
  title,
  note,
  actions,
}: {
  title: string;
  note?: string;
  actions?: ReactNode;
}) {
  return (
    <div aria-label={title} className="workspace-table-toolbar" role="toolbar">
      <strong>{title}</strong>
      {note && <span>{note}</span>}
      {actions && <div>{actions}</div>}
    </div>
  );
}

export function WorkspacePagination({
  total,
  start,
  end,
  page,
  pages,
}: {
  total: number;
  start: number;
  end: number;
  page: number;
  pages: number;
}) {
  return (
    <nav aria-label="表格分页" className="workspace-pagination">
      <span>{`共 ${total} 条 · 当前 ${start}–${end}`}</span>
      <button aria-label="上一页" disabled={page === 1} type="button">
        ‹
      </button>
      <strong>{page}</strong>
      <span>/ {pages}</span>
      <button aria-label="下一页" disabled={page === pages} type="button">
        ›
      </button>
    </nav>
  );
}
```

- [ ] **Step 4: Flatten the existing primitives**

Change:

- `CompactMetricStrip` to render compact `<span>` values in one 38–44px summary band;
- `WorkspacePanel` to use square 2–4px corners, no shadow, and no outer margin when adjacent to a toolbar or table;
- `WorkspaceTable` to use 38–42px rows, solid header cells, zebra hover only, and fixed visual boundaries;
- `BusinessContextBar` to become a compact scope strip rather than a large dark first card.

Use these CSS anchors:

```css
.workspace-tabs,
.workspace-filter-bar,
.workspace-summary-strip,
.workspace-table-toolbar,
.unified-table-scroll,
.workspace-pagination {
  border-radius: 0;
  box-shadow: none;
}

.workspace-tabs {
  display: flex;
  min-height: 36px;
  border-bottom: 1px solid var(--workspace-line-strong);
}

.workspace-filter-bar {
  display: flex;
  align-items: end;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--workspace-line);
}

.workspace-summary-strip {
  min-height: 38px;
  display: flex;
  align-items: center;
  gap: 22px;
  border-bottom: 1px solid var(--workspace-line);
}

.workspace-table-toolbar {
  min-height: 42px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 10px;
  background: #fff;
}
```

- [ ] **Step 5: Run primitive tests**

Run:

```bash
npm test -- src/prototype/UnifiedWorkspacePrimitives.spec.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit the workbench primitives**

```bash
git add src/prototype/UnifiedWorkspacePrimitives.tsx src/prototype/UnifiedWorkspacePrimitives.spec.tsx src/prototype/unified-workspaces.css
git commit -m "feat: add flat enterprise workbench primitives"
```

---

### Task 3: Convert My Work and Executive Overview

**Files:**

- Modify: `src/prototype/MyWorkWorkspace.tsx`
- Modify: `src/prototype/ExecutiveOverviewWorkspace.tsx`
- Modify: `src/prototype/PortalWorkspaces.spec.tsx`
- Modify: `src/prototype/FormalEnterprisePrototype.spec.tsx`
- Modify: `src/prototype/unified-workspaces.css`

**Interfaces:**

- Consumes: workbench primitives from Task 2
- Preserves: `onOpenBusiness(application, section)`
- Preserves: `onOpenApplication(application, section)`

- [ ] **Step 1: Add failing portal layout tests**

Add:

```tsx
it("presents My Work as one task-led table instead of a dashboard grid", () => {
  const { container } = render(
    <MyWorkWorkspace section="inbox" onOpenBusiness={vi.fn()} />,
  );

  expect(screen.getByRole("table", { name: "本人责任任务" })).toBeVisible();
  expect(screen.getByRole("table", { name: "今日重点事项" })).toBeVisible();
  expect(container.querySelector(".unified-two-column")).toBeNull();
  expect(container.querySelector(".unified-attention-panel")).toBeNull();
});

it("limits executive overview to one summary strip and operational tables", () => {
  const { container } = render(
    <ExecutiveOverviewWorkspace onOpenApplication={vi.fn()} />,
  );

  expect(screen.getByLabelText("经营核心摘要").children).toHaveLength(4);
  expect(screen.getByRole("table", { name: "业务运行摘要" })).toBeVisible();
  expect(screen.getByRole("table", { name: "经营风险清单" })).toBeVisible();
  expect(container.querySelector(".unified-three-column")).toBeNull();
});
```

- [ ] **Step 2: Run portal tests and confirm they fail**

Run:

```bash
npm test -- src/prototype/PortalWorkspaces.spec.tsx src/prototype/FormalEnterprisePrototype.spec.tsx
```

Expected: FAIL because My Work still uses a two-column attention panel and the overview still uses three domain cards.

- [ ] **Step 3: Rebuild My Work as a task table sequence**

In `MyWorkWorkspace.tsx`:

- keep the canonical task table and row actions;
- replace `CompactMetricStrip` with `WorkspaceSummaryStrip`;
- replace the right-side reminder panel with a second table named `今日重点事项`;
- add `WorkspaceTableToolbar` before each table;
- use `WorkspacePagination` after the task table;
- keep responsibility coordinates in the compact context strip.

The top sequence must be:

```tsx
<WorkspaceHeader
  actions={
    <>
      <button type="button">查看本人责任</button>
      <button className="is-primary" type="button">刷新任务</button>
    </>
  }
  eyebrow="统一工作门户 / 我的工作"
  summary={titles[section][1]}
  title={titles[section][0]}
/>
<BusinessContextBar
  items={[
    ["当前人员", "王洋 · 区域数据管理员"],
    ["责任范围", "齐齐哈尔指定范围"],
    ["当前期间", "2026 年第 31 周"],
    ["最近截止", "今天 17:00"],
  ]}
  state="责任岗位有效"
/>
<WorkspaceSummaryStrip
  label="本人工作摘要"
  items={[
    { label: "待我填报", value: "3项", note: "仅本人具有填写权限", tone: "warning" },
    { label: "待我审核", value: "7项", note: "最早截止今天 14:00" },
    { label: "异常与逾期", value: "2项", note: "逾期记录不可覆盖", tone: "danger" },
    { label: "本月按时率", value: "96.8%", note: "按固定截止快照统计", tone: "good" },
  ]}
/>
<WorkspaceTableToolbar title="统一任务清单" note="进入任务后打开所属业务的同一份单据" />
<WorkspaceTable
  columns={[
    "任务与业务",
    "责任区域",
    "截止",
    "履责状态",
    "单据状态",
    "质量状态",
    "操作",
  ]}
  label="本人责任任务"
  rows={visibleTasks.map((task) => [
    <div key={`${task.title}-title`}>
      <strong>{task.title}</strong>
      <p>{task.business}</p>
    </div>,
    task.region,
    task.deadline,
    <WorkspaceStatus key={`${task.title}-duty`} tone={toneFor(task.duty)}>
      {task.duty}
    </WorkspaceStatus>,
    <WorkspaceStatus key={`${task.title}-document`} tone={toneFor(task.document)}>
      {task.document}
    </WorkspaceStatus>,
    <WorkspaceStatus key={`${task.title}-quality`} tone={toneFor(task.quality)}>
      {task.quality}
    </WorkspaceStatus>,
    <button
      className="unified-table-action"
      key={`${task.title}-action`}
      type="button"
      onClick={() => onOpenBusiness(...task.destination)}
    >
      {task.action}
    </button>,
  ])}
/>
<WorkspacePagination total={12} start={1} end={visibleTasks.length} page={1} pages={3} />
<WorkspaceTableToolbar title="今日重点事项" />
<WorkspaceTable
  columns={["事项", "说明", "状态"]}
  label="今日重点事项"
  rows={[
    ["讷河市稻谷质量依据待补", "出米率检验单缺失，今天 16:00 前补充", <WorkspaceStatus key="quality" tone="danger">阻断</WorkspaceStatus>],
    ["甘南县库存周报已记录逾期", "补填后保留原截止未提交记录", <WorkspaceStatus key="overdue" tone="danger">逾期</WorkspaceStatus>],
    ["龙江县市场报送等待审核", "价格、数量和质量条件已完成校验", <WorkspaceStatus key="review" tone="warning">待审核</WorkspaceStatus>],
  ]}
/>
```

- [ ] **Step 4: Rebuild executive overview as summary plus tables**

In `ExecutiveOverviewWorkspace.tsx`:

- render one `WorkspaceSummaryStrip` with four values;
- replace three `WorkspacePanel` domain cards with one `WorkspaceTable` named `业务运行摘要`;
- keep domain drill-down as text buttons in the operation column;
- retain the existing `经营风险清单`;
- add a `最近正式发布` table if the page otherwise has no published-result list.

The domain table columns are:

```tsx
["业务", "核心结果", "地区与期间", "数据状态", "风险或缺口", "操作"];
```

- [ ] **Step 5: Run portal tests**

Run:

```bash
npm test -- src/prototype/PortalWorkspaces.spec.tsx src/prototype/FormalEnterprisePrototype.spec.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit portal conversion**

```bash
git add src/prototype/MyWorkWorkspace.tsx src/prototype/ExecutiveOverviewWorkspace.tsx src/prototype/PortalWorkspaces.spec.tsx src/prototype/FormalEnterprisePrototype.spec.tsx src/prototype/unified-workspaces.css
git commit -m "feat: convert enterprise portals to table workbenches"
```

---

### Task 4: Convert Production Monitoring Without Losing Varieties or Quality

**Files:**

- Modify: `src/prototype/ProductionMonitoringWorkspace.tsx`
- Modify: `src/prototype/ProductionMonitoringWorkspace.spec.tsx`
- Modify: `src/prototype/unified-workspaces.css`

**Interfaces:**

- Consumes: `WorkspaceSummaryStrip`, `WorkspaceTableToolbar`, `WorkspaceFilterBar`, `WorkspacePagination`
- Preserves: `ProductionMonitoringWorkspaceProps`
- Preserves: online, Excel, and system collection modes
- Preserves: crop profile and conditional quality-field models

- [ ] **Step 1: Add failing production structure tests**

Add:

```tsx
it("uses a continuous production workbench with one summary and table-led detail", () => {
  const { container } = render(
    <ProductionMonitoringWorkspace
      section="overview"
      onComposeReport={vi.fn()}
      onSectionChange={vi.fn()}
    />,
  );

  expect(screen.getByLabelText("产情业务摘要")).toBeVisible();
  expect(screen.getByRole("table", { name: "产情调查任务" })).toBeVisible();
  expect(
    screen.getByRole("table", { name: "样本结果与区域估计" }),
  ).toBeVisible();
  expect(container.querySelector(".production-estimate-grid")).toBeNull();
  expect(container.querySelector(".unified-two-column")).toBeNull();
});

it("keeps crop-specific variety and quality fields in one collection document", async () => {
  const user = userEvent.setup();
  render(
    <ProductionMonitoringWorkspace
      section="collection"
      onComposeReport={vi.fn()}
      onSectionChange={vi.fn()}
    />,
  );

  expect(screen.getByRole("textbox", { name: "具体品种" })).toHaveValue(
    "德美亚3号",
  );
  expect(screen.getByRole("textbox", { name: "水分" })).toBeVisible();
  expect(screen.getByRole("textbox", { name: "容重" })).toBeVisible();
  await user.selectOptions(
    screen.getByRole("combobox", { name: "作物" }),
    "soybean",
  );
  expect(screen.getByRole("textbox", { name: "具体品种" })).toHaveValue(
    "黑农84",
  );
  expect(screen.getByRole("textbox", { name: "蛋白" })).toBeVisible();
  await user.selectOptions(
    screen.getByRole("combobox", { name: "作物" }),
    "paddy",
  );
  expect(screen.getByRole("textbox", { name: "具体品种" })).toHaveValue(
    "龙粳31",
  );
  expect(screen.getByRole("textbox", { name: "出米率" })).toBeVisible();
});
```

- [ ] **Step 2: Run production tests and confirm structural failure**

Run:

```bash
npm test -- src/prototype/ProductionMonitoringWorkspace.spec.tsx
```

Expected: the business-field case remains green; the continuous-workbench case fails because the overview still uses a metric grid and two-column panels.

- [ ] **Step 3: Flatten the production overview**

In `ProductionOverview`:

- retain crop selection and registered varieties;
- use one compact crop/quality scope row;
- replace `CompactMetricStrip` with `WorkspaceSummaryStrip`;
- convert sample result and regional estimate articles into a two-row table;
- convert publication conditions into a second table or append them to the task table;
- keep the survey task table as the dominant surface.

Use:

```tsx
<WorkspaceTable
  columns={["口径", "结果", "样本或权重", "质量状态", "用途"]}
  label="样本结果与区域估计"
  rows={[
    [
      "样本结果",
      profile.sampleResult,
      "554 个有效样本",
      <WorkspaceStatus>调查观测</WorkspaceStatus>,
      "支持区域估计",
    ],
    [
      "区域估计",
      profile.regionalEstimate,
      "分层权重第 7 版",
      <WorkspaceStatus tone="good">正式估计</WorkspaceStatus>,
      "正式发布候选",
    ],
  ]}
/>
```

- [ ] **Step 4: Flatten production object, collection, review, and report pages**

For every production section:

- keep one page header;
- keep one compact context strip;
- place controls in tabs, filters, or table toolbars;
- remove panel grids and independent report cards;
- preserve the three collection modes and the same validation/review workflow;
- preserve report generation from approved data.

The online form remains a full page because it is a complex business document. Its sections use hairline dividers rather than separate floating cards.

- [ ] **Step 5: Run production tests**

Run:

```bash
npm test -- src/prototype/ProductionMonitoringWorkspace.spec.tsx src/prototype/FormalEnterprisePrototype.spec.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit production conversion**

```bash
git add src/prototype/ProductionMonitoringWorkspace.tsx src/prototype/ProductionMonitoringWorkspace.spec.tsx src/prototype/unified-workspaces.css
git commit -m "feat: convert production monitoring to table workflow"
```

---

### Task 5: Convert Market Monitoring and Preserve the Full Business Fact

**Files:**

- Modify: `src/prototype/MarketMonitoringWorkspace.tsx`
- Modify: `src/prototype/MarketMonitoringWorkspace.spec.tsx`
- Modify: `src/prototype/market-monitoring.css`
- Modify: `src/prototype/unified-workspaces.css`

**Interfaces:**

- Preserves: `MarketMonitoringWorkspaceProps`
- Preserves: `MarketTask`, `MarketCollectionTarget`, grain and quality models
- Preserves: subject and logistics collection in one workbench
- Preserves: online, Excel, and system collection modes

- [ ] **Step 1: Add failing market layout tests**

Add:

```tsx
it("shows market facts in one table-led overview instead of metric cards", () => {
  const { container } = render(
    <MarketMonitoringWorkspace section="overview" onComposeReport={vi.fn()} />,
  );

  expect(screen.getByLabelText("市场业务摘要")).toBeVisible();
  expect(screen.getByRole("table", { name: "市场运行事实" })).toBeVisible();
  expect(screen.getByRole("table", { name: "市场报送任务" })).toBeVisible();
  expect(container.querySelector(".market-metric-grid")).toBeNull();
  expect(container.querySelector(".market-overview-grid")).toBeNull();
});

it("keeps price quality quantity inventory processing and logistics connected", () => {
  render(
    <MarketMonitoringWorkspace
      section="collection"
      onComposeReport={vi.fn()}
    />,
  );

  expect(screen.getByText("收购与价格")).toBeVisible();
  expect(screen.getByText("质量条件")).toBeVisible();
  expect(screen.getByText(/库存|加工|流入流出/)).toBeVisible();
  expect(screen.getByDisplayValue("德美亚3号")).toBeVisible();
});
```

- [ ] **Step 2: Run market tests and confirm the new structure fails**

Run:

```bash
npm test -- src/prototype/MarketMonitoringWorkspace.spec.tsx
```

Expected: existing business assertions pass; new workbench assertions fail because the overview still uses market metric and grid sections.

- [ ] **Step 3: Rebuild the overview around grain scope and fact tables**

Keep the corn, soybean, and paddy selector as a compact in-page switch. Replace the current metric cards with:

```tsx
<WorkspaceSummaryStrip
  label="市场业务摘要"
  items={grainMetrics[grain]
    .slice(0, 4)
    .map(([label, value, unit, note, tone]) => ({
      label,
      value: `${value}${unit}`,
      note,
      tone: tone as WorkspaceTone,
    }))}
/>
```

Create `市场运行事实` with columns:

```tsx
[
  "业务事实",
  "当前结果",
  "品种或商品形态",
  "对应质量",
  "数量或库存",
  "数据状态",
];
```

Create `市场报送任务` from the current `marketTasks` rows. The table must make business object, region, crop/variety, current task, quality state, responsibility, and operation visible together.

- [ ] **Step 4: Flatten registry, collection, review, and report sections**

- Object registry remains one filter bar plus one table.
- Collection remains one task list plus one continuous editable document.
- Subject/logistics and online/Excel/system stay as tabs inside collection.
- Price, quality, quantity, inventory, processing, and logistics fields stay in the same task/document coordinate.
- Review becomes one queue table plus one detail/release region.
- Reports become one report filter row plus one report list; daily, weekly, and monthly buttons remain visible.
- Agricultural input topics remain excluded from grain supply quantities.

- [ ] **Step 5: Replace market-specific card styling**

In `market-monitoring.css`:

- remove large radii and shadows;
- replace `.market-metric-grid`, `.market-overview-grid`, and report-card grids with continuous rows or tables;
- keep professional wide-form horizontal scrolling only inside its local table container;
- keep selected grain and quality scope visually connected.

- [ ] **Step 6: Run market tests**

Run:

```bash
npm test -- src/prototype/MarketMonitoringWorkspace.spec.tsx src/prototype/FormalEnterprisePrototype.spec.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit market conversion**

```bash
git add src/prototype/MarketMonitoringWorkspace.tsx src/prototype/MarketMonitoringWorkspace.spec.tsx src/prototype/market-monitoring.css src/prototype/unified-workspaces.css
git commit -m "feat: convert market monitoring to fact-led tables"
```

---

### Task 6: Convert Supply and Situation to One Equation and Traceable Tables

**Files:**

- Modify: `src/prototype/SupplyDemandWorkspace.tsx`
- Modify: `src/prototype/SupplyDemandWorkspace.spec.tsx`
- Modify: `src/prototype/unified-workspaces.css`

**Interfaces:**

- Preserves: `SupplyDemandWorkspace({ section, onComposeReport })`
- Preserves: `getSupplyBalanceScope`, `getSupplyBalanceEquation`
- Preserves: city and county drill-down

- [ ] **Step 1: Add failing supply presentation tests**

Add:

```tsx
it("uses one equation and account tables without a duplicate metric grid", () => {
  const { container } = render(
    <SupplyDemandWorkspace section="overview" onComposeReport={vi.fn()} />,
  );

  expect(screen.getByRole("region", { name: "供需核心等式" })).toBeVisible();
  expect(screen.getByRole("table", { name: "供需账户构成" })).toBeVisible();
  expect(screen.getByRole("table", { name: "库存差异解释" })).toBeVisible();
  expect(container.querySelector(".unified-metric-strip")).toBeNull();
  expect(container.querySelectorAll(".supply-equation")).toHaveLength(1);
});
```

- [ ] **Step 2: Run supply tests and confirm they fail**

Run:

```bash
npm test -- src/prototype/SupplyDemandWorkspace.spec.tsx
```

Expected: FAIL because the current overview repeats the equation values in a metric strip and article cards.

- [ ] **Step 3: Convert the supply overview**

- Keep product, region, period, version, and status in one compact scope area.
- Remove the four-item metric strip.
- Render one `aria-label="供需核心等式"` line:

```tsx
<section aria-label="供需核心等式" className="supply-equation-line">
  <span>
    总供给 <strong>{equation.totalSupply}</strong> 万吨
  </span>
  <b>−</b>
  <span>
    总使用 <strong>{equation.totalUse}</strong> 万吨
  </span>
  <b>=</b>
  <span>
    账面期末 <strong>{equation.bookEnding}</strong> 万吨
  </span>
</section>
```

- Put opening inventory, production, inflow, use, processing, loss, outflow, and other items into `供需账户构成`.
- Put survey ending, approved adjustment, adopted ending, inventory difference, formula, and status into `库存差异解释`.

- [ ] **Step 4: Flatten all supply sections**

- Product accounts: scope controls, account table, transformation relationship table.
- Regional balance: one region switch, county account table, issue column.
- Lineage: source table first, compact flow text second.
- Situation analysis: selected result, trend table/chart only when it supports a decision, and linked detail rows.
- Do not render version definitions or formula implementation details as visual modules.

- [ ] **Step 5: Run supply tests**

Run:

```bash
npm test -- src/prototype/SupplyDemandWorkspace.spec.tsx src/prototype/FormalEnterprisePrototype.spec.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit supply conversion**

```bash
git add src/prototype/SupplyDemandWorkspace.tsx src/prototype/SupplyDemandWorkspace.spec.tsx src/prototype/unified-workspaces.css
git commit -m "feat: simplify supply accounts into equation and tables"
```

---

### Task 7: Convert Report Center and Responsibility Supervision

**Files:**

- Modify: `src/prototype/ReportCenterWorkspace.tsx`
- Modify: `src/prototype/ReportCenterWorkspace.spec.tsx`
- Modify: `src/prototype/BusinessReportComposer.tsx`
- Modify: `src/prototype/BusinessReportComposer.spec.tsx`
- Modify: `src/prototype/unified-workspaces.css`

**Interfaces:**

- Preserves: `ReportCenterWorkspace({ section, onComposeReport })`
- Preserves: `BusinessReportComposer({ context, onClose })`
- Preserves: `buildReportContext`
- Preserves: daily, weekly, and monthly generation

- [ ] **Step 1: Add failing report-workbench tests**

Add:

```tsx
it("uses one filter row and one report ledger without metric cards", () => {
  const { container } = render(
    <ReportCenterWorkspace
      section="business-reports"
      onComposeReport={vi.fn()}
    />,
  );

  const filters = screen.getByRole("region", { name: "业务报告生成条件" });
  expect(
    within(filters).getByRole("combobox", { name: "业务类型" }),
  ).toBeVisible();
  expect(
    within(filters).getByRole("combobox", { name: "报告地区" }),
  ).toBeVisible();
  expect(
    within(filters).getByRole("combobox", { name: "产品或专题" }),
  ).toBeVisible();
  expect(
    within(filters).getByRole("combobox", { name: "报告期间" }),
  ).toBeVisible();
  expect(
    within(filters).getByRole("combobox", { name: "采用数据版本" }),
  ).toBeVisible();
  expect(screen.getByRole("table", { name: "业务报告清单" })).toBeVisible();
  expect(container.querySelector(".unified-metric-strip")).toBeNull();
});

it("keeps duty rules and supervision in one ledger", () => {
  render(
    <ReportCenterWorkspace section="duty-reports" onComposeReport={vi.fn()} />,
  );

  expect(screen.getByText("一人一责区")).toBeVisible();
  expect(screen.getByText("他人无权代填")).toBeVisible();
  expect(screen.getByText("每周填报一次")).toBeVisible();
  expect(screen.getByText("逾期补填保留原逾期记录")).toBeVisible();
  expect(screen.getByRole("table", { name: "填报履责记录" })).toBeVisible();
});
```

- [ ] **Step 2: Run report tests and confirm the layout assertion fails**

Run:

```bash
npm test -- src/prototype/ReportCenterWorkspace.spec.tsx src/prototype/BusinessReportComposer.spec.tsx
```

Expected: explicit selector and responsibility assertions remain green; the no-metric-grid assertion fails.

- [ ] **Step 3: Flatten business reports**

- Convert `report-context-composer` into `WorkspaceFilterBar`.
- Keep all five explicit selectors.
- Place `生成日报`, `生成周报`, and `生成月报` in the filter action group.
- Replace `CompactMetricStrip` with one `WorkspaceSummaryStrip`.
- Put report counts into the summary and keep the ledger dominant.
- Use `WorkspaceTableToolbar` and `WorkspacePagination`.

- [ ] **Step 4: Flatten duty, review, distribution, and version pages**

- Duty: rule summary line, filter bar, weekly/monthly tabs, one responsibility ledger.
- Review: report queue table plus selected report detail.
- Distribution: distribution list table plus controlled publish action.
- Versions: version ledger only; no version cards.
- Keep the distinction between business reports and duty reports in labels, filters, and export actions.

- [ ] **Step 5: Simplify the report composer**

The composer remains a modal dialog because it is a focused document-building task. Inside it:

- use one header;
- show business coordinate as a compact definition row;
- use one report type selector;
- show source sections as a continuous ordered list;
- keep preview, export, save draft, and send for review as text-bearing actions;
- remove decorative document cards and any machine-generated or development wording.

- [ ] **Step 6: Run report tests**

Run:

```bash
npm test -- src/prototype/ReportCenterWorkspace.spec.tsx src/prototype/BusinessReportComposer.spec.tsx src/prototype/FormalEnterprisePrototype.spec.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit report conversion**

```bash
git add src/prototype/ReportCenterWorkspace.tsx src/prototype/ReportCenterWorkspace.spec.tsx src/prototype/BusinessReportComposer.tsx src/prototype/BusinessReportComposer.spec.tsx src/prototype/unified-workspaces.css
git commit -m "feat: convert reports and duty supervision to ledgers"
```

---

### Task 8: Promote the Formal System as the Only Prototype Entry

**Files:**

- Modify: `src/prototype/main.tsx`
- Modify: `prototype.html`
- Create: `src/prototype/FormalPrototypeEntry.spec.ts`

**Interfaces:**

- Produces: one formal prototype entry
- Removes from runtime: variant A/B/C switching and prototype comparison chrome

- [ ] **Step 1: Add a failing formal-entry test**

Create `src/prototype/FormalPrototypeEntry.spec.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("formal prototype entry", () => {
  it("mounts only the approved formal enterprise system", () => {
    const mainSource = readFileSync(
      new URL("./main.tsx", import.meta.url),
      "utf8",
    );
    const htmlSource = readFileSync(
      new URL("../../prototype.html", import.meta.url),
      "utf8",
    );

    expect(mainSource).toContain('from "./FormalEnterprisePrototype"');
    expect(mainSource).not.toContain("EnterpriseArchitecturePrototype");
    expect(mainSource).not.toContain("./prototype.css");
    expect(htmlSource).toContain("<title>齐齐哈尔粮食商情企业平台</title>");
    expect(htmlSource).not.toContain("界面样板");
  });
});
```

- [ ] **Step 2: Run the formal prototype test**

Run:

```bash
npm test -- src/prototype/FormalPrototypeEntry.spec.ts
```

Expected: FAIL because the runtime entry still imports `EnterpriseArchitecturePrototype` and the HTML title still says `界面样板`.

- [ ] **Step 3: Mount the formal system directly**

Replace `src/prototype/main.tsx` with:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FormalEnterprisePrototype } from "./FormalEnterprisePrototype";
import "./formal-enterprise.css";
import "./market-monitoring.css";
import "./unified-workspaces.css";

const mount = document.getElementById("prototype-root");
if (!mount) throw new Error("缺少系统挂载节点");

createRoot(mount).render(
  <StrictMode>
    <FormalEnterprisePrototype />
  </StrictMode>,
);
```

Change the document title in `prototype.html` to:

```html
<title>齐齐哈尔粮食商情企业平台</title>
```

Keep `EnterpriseArchitecturePrototype.tsx` and `prototype.css` out of the runtime import graph. Do not delete them in this task because they are historical comparison artifacts and deleting them is not required to deliver the approved system.

- [ ] **Step 4: Run prototype build and entry test**

Run:

```bash
npm test -- src/prototype/FormalPrototypeEntry.spec.ts src/prototype/FormalEnterprisePrototype.spec.tsx
npm run build:prototype
```

Expected: both commands PASS.

- [ ] **Step 5: Commit the formal entry**

```bash
git add src/prototype/main.tsx prototype.html src/prototype/FormalPrototypeEntry.spec.ts
git commit -m "feat: promote formal enterprise system entry"
```

---

### Task 9: Responsive, Accessibility, Copy, and Full-System Verification

**Files:**

- Modify: `src/prototype/formal-enterprise.css`
- Modify: `src/prototype/unified-workspaces.css`
- Modify: `src/prototype/market-monitoring.css`
- Modify: relevant `src/prototype/*.tsx` only when a verification failure identifies a missing accessible name or inappropriate interface copy

**Interfaces:**

- Verifies all earlier tasks
- Does not create a new business workflow

- [ ] **Step 1: Add accessibility assertions to shell and primitive tests**

Add:

```tsx
it("labels every icon-only shell tool", () => {
  render(<FormalEnterprisePrototype initialSearch="?page=market" />);
  expect(screen.getByRole("button", { name: /任务中心/ })).toBeVisible();
  expect(screen.getByRole("button", { name: /通知/ })).toBeVisible();
  expect(screen.getByRole("button", { name: "帮助" })).toBeVisible();
  expect(screen.getByRole("button", { name: "收起左侧导航" })).toBeVisible();
});
```

For any icon-only refresh, columns, density, search, expand, or pagination control, assert its accessible name in the owning workspace test.

- [ ] **Step 2: Run all prototype tests**

Run:

```bash
npm test -- src/prototype
```

Expected: PASS.

- [ ] **Step 3: Run forbidden-copy and old-layout scans**

Run:

```bash
if rg -n "演示环境|非生产数据|方案比较|界面样板|原型组合|当前业务应用|统一业务与数据运营平台" src/prototype/FormalEnterprisePrototype.tsx src/prototype/MyWorkWorkspace.tsx src/prototype/ExecutiveOverviewWorkspace.tsx src/prototype/ProductionMonitoringWorkspace.tsx src/prototype/MarketMonitoringWorkspace.tsx src/prototype/SupplyDemandWorkspace.tsx src/prototype/ReportCenterWorkspace.tsx prototype.html; then exit 1; fi
if rg -n "unified-two-column|unified-three-column|market-metric-grid|market-overview-grid|production-estimate-grid" src/prototype/MyWorkWorkspace.tsx src/prototype/ExecutiveOverviewWorkspace.tsx src/prototype/ProductionMonitoringWorkspace.tsx src/prototype/MarketMonitoringWorkspace.tsx src/prototype/SupplyDemandWorkspace.tsx src/prototype/ReportCenterWorkspace.tsx; then exit 1; fi
```

Expected: both commands return no matches. Approved business terms such as `数据版本` and `正式版本` are valid and must remain.

- [ ] **Step 4: Run engineering verification**

Run:

```bash
npm run format:check
npm run lint
npm run architecture
npm test
npm run build:prototype
npm run build
git diff --check
```

Expected: every command exits with code 0.

- [ ] **Step 5: Perform browser visual verification**

Start the prototype:

```bash
npm run prototype -- --host 127.0.0.1
```

Inspect these exact routes at 1920px, 1440px, and 1280px widths:

```text
/prototype.html?page=work
/prototype.html?page=overview
/prototype.html?page=production
/prototype.html?page=production&section=collection
/prototype.html?page=market
/prototype.html?page=market&section=collection
/prototype.html?page=supply
/prototype.html?page=supply&section=lineage
/prototype.html?page=reporting&section=business-reports
/prototype.html?page=reporting&section=duty-reports
```

For every route confirm:

- the 44px header and 152px sidebar form one dark L;
- no old light sidebar or selector header appears;
- no card grid remains;
- title, tabs, filters, summary, toolbar, table, and pagination read in order;
- no page-level horizontal overflow exists, except inside a designated professional wide-table scroller;
- the current region, product, period, version, task status, and next action are identifiable;
- online entry, Excel import, and system intake remain reachable in production and market;
- report selectors remain visible;
- row actions remain text-bearing.

- [ ] **Step 6: Commit final verification fixes**

Stage only the listed implementation files that actually changed:

```bash
git add src/prototype/formal-enterprise.css src/prototype/unified-workspaces.css src/prototype/market-monitoring.css src/prototype/FormalEnterprisePrototype.tsx src/prototype/MyWorkWorkspace.tsx src/prototype/ExecutiveOverviewWorkspace.tsx src/prototype/ProductionMonitoringWorkspace.tsx src/prototype/MarketMonitoringWorkspace.tsx src/prototype/SupplyDemandWorkspace.tsx src/prototype/ReportCenterWorkspace.tsx src/prototype/BusinessReportComposer.tsx
git commit -m "fix: complete enterprise workbench visual verification"
```

If no file changed after verification, do not create an empty commit.

---

## Completion Gate

Implementation is complete only after:

1. Tasks 0–9 are completed in order;
2. all six applications use the same dark L-shaped shell;
3. no reachable page uses the previous shell or a dashboard card grid;
4. production and market business-field assertions pass;
5. supply scope and equation assertions pass;
6. business and duty report selector assertions pass;
7. full unit tests and both builds pass;
8. browser verification passes at 1920px, 1440px, and 1280px;
9. unrelated dirty-worktree changes remain unstaged and unmodified.
