# Enterprise Reporting Visual Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mature, restrained enterprise visual prototype that restores the old shell’s polish, adds the integrated “报送与报告” application, and demonstrates weekly unique responsibility, no proxy entry, overdue snapshots, and weekly/monthly responsibility reports.

**Architecture:** Keep the deliverable isolated under `src/prototype`. Replace Variant A with a focused formal shell composed from a pure route/domain model, an enterprise frame, and business workspace sections. Keep production, market, supply, work, and reporting on one shared shell; reporting subviews use `?page=reporting&section=` so one application owns responsibility, weekly tasks, duty reports, business reports, and report versions.

**Tech Stack:** React 19, TypeScript 5.9, CSS, Vitest 4, Testing Library, Vite prototype build, in-app browser visual QA.

## Global Constraints

- Preserve full functionality; remove only duplicate calculations, duplicate authoritative records, and prototype-only decoration.
- Weekly reporting is generated once per region and has one locked responsible person.
- Non-responsible users, reviewers, and administrators cannot fill or submit on behalf of the responsible person.
- Deadline snapshots are immutable; late completion never removes the overdue record.
- Responsibility changes apply from the next weekly period and do not rewrite the active or historical obligation.
- Duty weekly/monthly reports aggregate fixed responsibility snapshots; business reports read published business versions and do not recalculate metrics.
- Expanded sidebar width is 208–216 px; regular body/navigation text is 14 px and auxiliary text is at least 12 px.
- Do not expose APIs, variables, database details, programming languages, debug identifiers, or implementation copy.
- Preserve all unrelated dirty-worktree changes.

---

### Task 1: Formal prototype route and responsibility model

**Files:**

- Create: `src/prototype/formalEnterpriseModel.ts`
- Test: `src/prototype/formalEnterpriseModel.spec.ts`

**Interfaces:**

- Produces: `FormalApplication`, `ReportingSection`, `FormalRoute`, `readFormalRoute(search)`, `writeFormalRoute(route)`, `canFillWeeklyTask(task, userId)`, and `summarizeDutyMonth(snapshots)`.
- Consumes: URL query values and immutable sample responsibility snapshots.

- [ ] **Step 1: Write failing route and responsibility tests**

```ts
expect(readFormalRoute("?page=reporting&section=responsibility")).toEqual({
  application: "reporting",
  reportingSection: "responsibility",
});
expect(canFillWeeklyTask(task, "user-qqhr")).toBe(true);
expect(canFillWeeklyTask(task, "regional-admin")).toBe(false);
expect(summarizeDutyMonth(snapshots)).toMatchObject({
  expected: 4,
  onTime: 2,
  overdue: 1,
  missing: 1,
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npx vitest run src/prototype/formalEnterpriseModel.spec.ts`

Expected: FAIL because `formalEnterpriseModel.ts` does not exist.

- [ ] **Step 3: Implement the pure model**

```ts
export type FormalApplication =
  "work" | "production" | "market" | "supply" | "reporting";

export type ReportingSection =
  | "overview"
  | "responsibility"
  | "weekly"
  | "records"
  | "overdue"
  | "duty-weekly"
  | "duty-monthly"
  | "business-reports"
  | "versions";

export interface FormalRoute {
  application: FormalApplication;
  reportingSection: ReportingSection;
}

export function canFillWeeklyTask(
  task: { responsibleUserId: string; status: string },
  userId: string,
) {
  return (
    task.responsibleUserId === userId &&
    !["审核通过", "免报"].includes(task.status)
  );
}
```

Implement defensive URL fallbacks and monthly aggregation from fixed snapshot statuses.

- [ ] **Step 4: Run the focused test and verify pass**

Run: `npx vitest run src/prototype/formalEnterpriseModel.spec.ts`

Expected: PASS.

### Task 2: Enterprise application and reporting sample data

**Files:**

- Create: `src/prototype/formalEnterpriseData.ts`
- Modify: `src/prototype/formalEnterpriseModel.spec.ts`

**Interfaces:**

- Consumes: model types from Task 1.
- Produces: `formalApplications`, `formalWorkspaceByApplication`, `reportingNavigation`, `weeklyTasks`, `responsibilityAssignments`, `dutyWeeklyRows`, `dutyMonthlyRows`, and `businessReportRows`.

- [ ] **Step 1: Add failing data-integrity tests**

```ts
expect(
  new Set(
    responsibilityAssignments.map(
      (item) => `${item.region}:${item.businessItem}:${item.effectivePeriod}`,
    ),
  ).size,
).toBe(responsibilityAssignments.length);
expect(weeklyTasks.every((task) => task.responsibleUserId)).toBe(true);
expect(reportingNavigation.map((item) => item.key)).toContain("duty-monthly");
```

- [ ] **Step 2: Run the test and verify failure**

Run: `npx vitest run src/prototype/formalEnterpriseModel.spec.ts`

Expected: FAIL because formal sample data is not implemented.

- [ ] **Step 3: Add complete Chinese enterprise sample data**

Use the fixed scenario:

- 2026 年第 31 周；
- one responsible person per region;
- statuses covering on-time, overdue-unsubmitted, overdue-supplemented, returned, and approved;
- weekly and monthly duty rows;
- business daily/weekly/monthly report versions;
- production, market, and supply workspaces referencing published versions.

Do not include technical placeholders or lorem ipsum.

- [ ] **Step 4: Run the focused test**

Run: `npx vitest run src/prototype/formalEnterpriseModel.spec.ts`

Expected: PASS.

### Task 3: Formal enterprise shell

**Files:**

- Create: `src/prototype/FormalEnterprisePrototype.tsx`
- Create: `src/prototype/FormalEnterprisePrototype.spec.tsx`
- Modify: `src/prototype/EnterpriseArchitecturePrototype.tsx`
- Modify: `src/prototype/main.tsx`

**Interfaces:**

- Consumes: route/model/data from Tasks 1–2.
- Produces: `FormalEnterprisePrototype`, application switcher, 216 px grouped sidebar, breadcrumb/title/actions, responsibility context band, and accessible application/section navigation.

- [ ] **Step 1: Write failing shell tests**

```tsx
render(<FormalEnterprisePrototype initialSearch="?page=reporting" />);
expect(screen.getByText("齐齐哈尔粮食商情企业平台")).toBeVisible();
expect(
  screen.getByRole("heading", { name: "报送与报告运营工作区" }),
).toBeVisible();
expect(
  screen.getByRole("navigation", { name: "报送与报告模块" }),
).toBeVisible();
expect(screen.queryByLabelText("界面方案切换")).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the focused component test**

Run: `npx vitest run src/prototype/FormalEnterprisePrototype.spec.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the formal shell**

Build:

- restrained 72 px global header;
- app launcher and current organization;
- application selector;
- global search;
- task, notification, help, and user controls;
- 216 px current-application sidebar;
- grouped reporting navigation;
- 30–32 px page title;
- 14 px navigation/body text and 12 px metadata;
- no quick-app duplication in the sidebar;
- no floating Variant A switcher.

Variant B and C remain addressable by query but are not presented inside the formal Variant A page.

- [ ] **Step 4: Run the focused component test**

Run: `npx vitest run src/prototype/FormalEnterprisePrototype.spec.tsx`

Expected: PASS.

### Task 4: Complete reporting and responsibility workspaces

**Files:**

- Modify: `src/prototype/FormalEnterprisePrototype.tsx`
- Modify: `src/prototype/FormalEnterprisePrototype.spec.tsx`

**Interfaces:**

- Consumes: formal data and `canFillWeeklyTask`.
- Produces: reporting overview, responsibility assignment table, weekly task workspace, records/overdue views, duty weekly/monthly reports, business reports, and versions.

- [ ] **Step 1: Add failing behavior tests**

```tsx
expect(screen.getByText("一人一区 · 本周责任已锁定")).toBeVisible();
expect(screen.getByRole("button", { name: "填写本周报送" })).toBeDisabled();
expect(screen.getByText("逾期后补填不消除逾期记录")).toBeVisible();
expect(screen.getByRole("button", { name: "导出责任周报" })).toBeVisible();
expect(screen.getByRole("button", { name: "导出责任月报" })).toBeVisible();
```

- [ ] **Step 2: Run the component test and verify failure**

Run: `npx vitest run src/prototype/FormalEnterprisePrototype.spec.tsx`

Expected: FAIL for the missing reporting sections.

- [ ] **Step 3: Implement the reporting sections**

Each section must use one clear primary job:

- overview: current week status, deadline, completion, overdue risks, recent reports;
- responsibility: unique region/person assignment, effective period, reviewer, and change history;
- weekly: responsibility-locked task table and no-proxy explanation;
- records/overdue: immutable submission and deadline snapshot history;
- duty weekly/monthly: supervision metrics, responsibility rows, export actions;
- business reports: daily/weekly/monthly definitions and published-version references;
- versions: immutable report versions and replacement relationships.

- [ ] **Step 4: Run the component test**

Run: `npx vitest run src/prototype/FormalEnterprisePrototype.spec.tsx`

Expected: PASS.

### Task 5: Refined old-shell visual system

**Files:**

- Create: `src/prototype/formal-enterprise.css`
- Modify: `src/prototype/main.tsx`

**Interfaces:**

- Consumes: semantic class names from Task 3–4.
- Produces: a responsive, mature desktop layout with accessible states.

- [ ] **Step 1: Implement the approved visual tokens**

Use:

```css
:root {
  --formal-navy: #0a3045;
  --formal-navy-deep: #062536;
  --formal-teal: #167c74;
  --formal-gold: #b78319;
  --formal-danger: #a84c43;
  --formal-canvas: #edf3f5;
  --formal-panel: #ffffff;
  --formal-line: #d4dee4;
  --formal-text: #17394a;
  --formal-muted: #667f8d;
}
```

Apply the exact proportions in Global Constraints. Prefer large cohesive panels, restrained separators, and deliberate whitespace over many small cards.

- [ ] **Step 2: Add responsive and accessibility states**

At widths below 1180 px, stack secondary panels; below 860 px, replace the sidebar with a horizontal module strip. Add visible focus states and reduced-motion handling.

- [ ] **Step 3: Run static gates**

Run:

```bash
npx prettier --check src/prototype
npx eslint src/prototype --max-warnings 0
npx tsc -b
npm run build:prototype
```

Expected: all commands exit 0.

### Task 6: Browser QA and demonstration images

**Files:**

- Modify only if QA exposes a defect: files from Tasks 1–5.
- Create outside repository: final JPG screenshots in the thread visualization directory.

**Interfaces:**

- Consumes: live prototype at `http://127.0.0.1:63182/prototype.html?variant=A`.
- Produces: interactive demo and reviewed screenshots.

- [ ] **Step 1: Verify application and section navigation**

Check these exact routes:

```text
?variant=A&page=work
?variant=A&page=reporting&section=overview
?variant=A&page=reporting&section=responsibility
?variant=A&page=reporting&section=weekly
?variant=A&page=reporting&section=duty-weekly
?variant=A&page=reporting&section=duty-monthly
?variant=A&page=production
?variant=A&page=market
?variant=A&page=supply
```

Verify headings, current navigation state, no horizontal overflow, and zero console errors.

- [ ] **Step 2: Verify critical responsibility semantics**

Confirm visually and in the accessible tree:

- one person per region;
- non-responsible users cannot fill;
- overdue remains recorded after supplementation;
- weekly/monthly exports exist;
- business reports cite formal versions.

- [ ] **Step 3: Capture final screenshots**

Capture at least:

- reporting overview;
- responsibility assignment;
- weekly reporting;
- duty weekly report;
- duty monthly report;
- production;
- market;
- supply.

- [ ] **Step 4: Run the full test suite**

Run:

```bash
npx vitest run src/prototype/formalEnterpriseModel.spec.ts \
  src/prototype/FormalEnterprisePrototype.spec.tsx
npm test
git diff --check
```

Expected: all tests pass and no whitespace errors.

- [ ] **Step 5: Commit only prototype-scope files**

```bash
git add \
  src/prototype/formalEnterpriseModel.ts \
  src/prototype/formalEnterpriseModel.spec.ts \
  src/prototype/formalEnterpriseData.ts \
  src/prototype/FormalEnterprisePrototype.tsx \
  src/prototype/FormalEnterprisePrototype.spec.tsx \
  src/prototype/formal-enterprise.css \
  src/prototype/EnterpriseArchitecturePrototype.tsx \
  src/prototype/main.tsx \
  docs/superpowers/plans/2026-07-31-enterprise-reporting-visual-prototype.md
git commit -m "feat: add formal enterprise reporting prototype"
```
