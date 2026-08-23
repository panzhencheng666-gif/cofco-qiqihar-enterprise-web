# Sample Network Map and Governance UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make township design coverage visible without opening a village drawer, replace the card-stacked governance page with a table-led enterprise workspace, and keep all sample-network surfaces synchronized through the existing 8090 event stream.

**Architecture:** The frontend owns one map-level sample-network layer model whose state survives region selection and realtime refresh; the detail drawer consumes that model but does not control it. The Web app exposes a dedicated sample-governance work section with four mutually exclusive table-led tabs. Backend audit events for annual sample-network changes carry region and year scope so the existing SSE stream invalidates the frontend and Web queries.

**Tech Stack:** React 19, TypeScript 5.9, Vitest 4, Testing Library, CSS, Java 21, Spring Boot 4.1, PostgreSQL 17, Maven, Node 24.

## Global Constraints

- Continue only on `feature/20260823-sample-network-comparison` in all three repositories.
- Do not merge `main`, deploy cloud or production, copy databases, or fabricate coordinates.
- 63182 and 63200 read authoritative business results from 8090.
- Design references, stable sample identity, annual membership, and monthly business records remain separate.
- Existing production and market sample icons remain unchanged.
- Governance UI must be table-led and must not use card grids, card nesting, or long stacked panels.
- Run only change-proportional tests before the final repository gates.

---

### Task 1: Persistent township sample-network map layers

**Files:**

- Create: `../cofco-qiqihar-enterprise-frontend/src/modules/overview/ui/hooks/useOverviewSampleNetworkLayers.ts`
- Create: `../cofco-qiqihar-enterprise-frontend/src/modules/overview/ui/components/OverviewSampleNetworkToolbar.tsx`
- Create: `../cofco-qiqihar-enterprise-frontend/src/modules/overview/ui/components/OverviewSampleNetworkToolbar.spec.tsx`
- Modify: `../cofco-qiqihar-enterprise-frontend/src/modules/overview/ui/pages/OverviewPage.tsx`
- Modify: `../cofco-qiqihar-enterprise-frontend/src/modules/overview/ui/pages/OverviewPage.spec.tsx`
- Modify: `../cofco-qiqihar-enterprise-frontend/src/modules/overview/ui/components/OverviewCommandCenter.tsx`
- Modify: `../cofco-qiqihar-enterprise-frontend/src/modules/overview/ui/components/OverviewCommandCenter.spec.tsx`
- Modify: `../cofco-qiqihar-enterprise-frontend/src/modules/overview/ui/components/OverviewSamplePointPanel.tsx`
- Modify: `../cofco-qiqihar-enterprise-frontend/src/modules/overview/ui/components/OverviewSamplePointPanel.spec.tsx`
- Modify: `../cofco-qiqihar-enterprise-frontend/src/app/styles/global.css`

**Interfaces:**

- Consumes: `OverviewSamplePointRepository.comparison`, `sampleNetworkLayerIcons`, `SampleNetworkLayerMode`, `samplePointSequence`, `mapContextRegion`, and the selected region.
- Produces: `useOverviewSampleNetworkLayers(input): { mode; setMode; icons; comparison; state; issue; showExactDesignLocations; setShowExactDesignLocations }` and a toolbar that can render without the details drawer.

- [ ] **Step 1: Write failing township-entry and state-preservation tests**

Add tests that enter a township without selecting a village and assert that the comparison request uses the township code, the toolbar defaults to `comparison`, and all village coverage badges are published. Rerender with a village selection and a larger `refreshSequence`; assert the chosen mode remains unchanged and non-selected villages remain present.

```tsx
expect(
  await screen.findByRole("group", { name: "样本网络图层" }),
).toBeVisible();
expect(screen.getByRole("button", { name: "对照显示" })).toHaveAttribute(
  "aria-pressed",
  "true",
);
expect(repository.comparison).toHaveBeenCalledWith({
  productCode: "CORN",
  regionCode: "230202997",
  year: 2026,
});
expect(lastIcons()).toEqual(
  expect.arrayContaining([
    expect.objectContaining({ samplePointId: "design-coverage:230202997001" }),
    expect.objectContaining({ samplePointId: "design-coverage:230202997002" }),
  ]),
);
```

- [ ] **Step 2: Run the focused frontend tests and confirm failure**

Run with Node 24:

```bash
npm exec vitest run src/modules/overview/ui/pages/OverviewPage.spec.tsx src/modules/overview/ui/components/OverviewSampleNetworkToolbar.spec.tsx src/modules/overview/ui/components/OverviewSamplePointPanel.spec.tsx
```

Expected: failures show that the layer control is absent until a region drawer mounts and that the default mode is `actual`.

- [ ] **Step 3: Implement one map-level layer model**

Move comparison loading, layer mode, exact-location toggle and visible icon projection into `useOverviewSampleNetworkLayers`. Initialize the mode once as `comparison`; do not reset it when region, product, year or realtime sequences change. Compute the active layer region from the current township map context, falling back to the selected village's parent township.

```ts
export interface OverviewSampleNetworkLayerInput {
  productCode: string;
  refreshSequence: number;
  region?: {
    code: string;
    level: RegionLevel;
    name: string;
    parentCode?: string;
  };
  repository: OverviewSamplePointRepository;
  year: number;
  actualIcons: readonly OverviewSamplePointIcon[];
}
```

`OverviewPage` renders `OverviewSampleNetworkToolbar` through a new `sampleNetworkControls` slot on `OverviewCommandCenter`. `OverviewSamplePointPanel` receives the shared comparison model for its detail copy and no longer renders global layer buttons.

- [ ] **Step 4: Implement restrained map toolbar styling**

Place one compact segmented control beside the existing map navigation. Use a single translucent surface, 1px border and no nested panels. Extend the legend with design coverage and verified design position symbols.

- [ ] **Step 5: Run focused tests and commit**

Expected: all focused tests pass and existing exact-coordinate fail-closed tests remain green.

```bash
git add src/modules/overview/ui src/app/styles/global.css
git commit -m "fix(overview): keep township sample network layers visible"
```

---

### Task 2: Table-led sample-governance workspace

**Files:**

- Create: `src/business/samplepoint/SamplePointGovernanceWorkspace.tsx`
- Create: `src/business/samplepoint/SamplePointGovernanceWorkspace.spec.tsx`
- Modify: `src/business/samplepoint/AnnualSampleNetworkPanel.tsx`
- Modify: `src/business/samplepoint/AnnualSampleNetworkPanel.spec.tsx`
- Modify: `src/business/samplepoint/SamplePointCoordinateGovernancePanel.tsx`
- Modify: `src/business/samplepoint/SamplePointCoordinateGovernancePanel.spec.tsx`
- Modify: `src/business/samplepoint/SamplePointIdentityGovernancePanel.tsx`
- Modify: `src/business/samplepoint/SamplePointIdentityGovernancePanel.spec.tsx`
- Modify: `src/business/formalEnterpriseModel.ts`
- Modify: `src/business/formalEnterpriseData.ts`
- Modify: `src/business/EnterpriseBusinessApplication.tsx`
- Modify: `src/business/EnterpriseBusinessApplication.spec.tsx`
- Modify: `src/business/MyWorkWorkspace.tsx`
- Modify: `src/app/styles/global.css`

**Interfaces:**

- Consumes: existing annual-network, coordinate-correction and identity-governance repository methods and `CurrentSession` permissions.
- Produces: a dedicated `work/sample-governance` section and `SamplePointGovernanceWorkspace` with tabs `registry | design | annual | review`.

- [ ] **Step 1: Write failing navigation and layout tests**

Assert that sample governance is no longer rendered inside `已办事项`, that the dedicated route renders one continuous workspace, and that only one tab panel is mounted at a time.

```tsx
expect(screen.getByRole("heading", { name: "样本点管理" })).toBeVisible();
expect(screen.getByRole("tablist", { name: "样本点治理模块" })).toBeVisible();
expect(screen.getByRole("tab", { name: "年度在网样本" })).toHaveAttribute(
  "aria-selected",
  "true",
);
expect(screen.queryByText("已办事项")).not.toBeInTheDocument();
expect(screen.getAllByRole("table")).toHaveLength(1);
```

- [ ] **Step 2: Run focused Web tests and confirm failure**

```bash
npm exec vitest run src/business/samplepoint/SamplePointGovernanceWorkspace.spec.tsx src/business/EnterpriseBusinessApplication.spec.tsx src/business/MyWorkWorkspace.spec.tsx
```

Expected: the dedicated route and workspace do not yet exist.

- [ ] **Step 3: Add the dedicated work section**

Add `sample-governance` to the formal work sections and navigation label it `样本点管理`. In the `work` application switch, render `SamplePointGovernanceWorkspace` directly for that section. Remove the expandable governance block from `FormalMyWorkWorkspace`; task queues remain task queues.

- [ ] **Step 4: Compose one table-led workspace**

The workspace owns the active tab and renders this fixed skeleton:

```tsx
<main className="sample-governance-workspace">
  <WorkspaceHeader eyebrow="平台运营管理部 / 数据治理" title="样本点管理" />
  <SampleGovernanceStatusStrip />
  <SampleGovernanceTabs />
  <section className="sample-governance-main-table">{activeModule}</section>
</main>
```

Default to `annual`. Keep four summary values in one `<dl>` strip. Existing panels gain a `mode` prop so history and review tables are rendered only in their corresponding tab, not stacked below one another.

- [ ] **Step 5: Replace card CSS with enterprise table structure**

Remove nested rounded container and grid declarations for the sample-governance surface. Use one white work surface, 36–40px toolbar rows, border-separated table rows and a fixed right-side drawer for object detail. Keep action text explicit.

- [ ] **Step 6: Run focused tests and commit**

```bash
git add src/business src/app/styles/global.css
git commit -m "feat(sample-network): add table-led governance workspace"
```

---

### Task 3: Publish scoped annual-network realtime events

**Files:**

- Modify: `../cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/samplepoint/network/application/AnnualSampleNetworkService.java`
- Modify: `../cofco-qiqihar-enterprise-backend/src/test/java/com/cofco/qiqihar/graintrade/samplepoint/network/application/AnnualSampleNetworkServiceTest.java`
- Modify: `../cofco-qiqihar-enterprise-backend/src/test/java/com/cofco/qiqihar/graintrade/samplepoint/network/interfaceadapter/AnnualSampleNetworkRestIntegrationTest.java`
- Modify: `../cofco-qiqihar-enterprise-frontend/src/modules/overview/application/ports/OverviewRealtimeStream.ts`
- Modify: `../cofco-qiqihar-enterprise-frontend/src/modules/overview/infrastructure/realtime/BrowserOverviewRealtimeStream.ts`
- Modify: `../cofco-qiqihar-enterprise-frontend/src/modules/overview/infrastructure/realtime/BrowserOverviewRealtimeStream.spec.ts`
- Modify: `../cofco-qiqihar-enterprise-frontend/src/modules/overview/ui/hooks/useOverviewRealtimeRefresh.ts`
- Modify: `../cofco-qiqihar-enterprise-frontend/src/modules/overview/ui/hooks/useOverviewRealtimeRefresh.spec.tsx`
- Modify: `src/business/samplepoint/SamplePointGovernanceWorkspace.tsx`
- Modify: `src/business/samplepoint/SamplePointGovernanceWorkspace.spec.tsx`

**Interfaces:**

- Consumes: `BusinessAuditRecorder`, `/api/v1/business-events/stream`, and current frontend/Web SSE subscriptions.
- Produces: sample-network events containing `surveyYear`, affected `regionCodes` and `actionCode`, plus scoped query invalidation without resetting UI context.

- [ ] **Step 1: Write failing backend event tests**

Capture the audit detail for create, membership decision, submit, publish and return. Assert valid JSON contains the network year and authorized affected regions rather than `{}`.

```java
assertThat(detail).contains("\"surveyYear\":2026");
assertThat(detail).contains("\"regionCodes\"");
```

- [ ] **Step 2: Write failing frontend/Web refresh tests**

Assert that an SSE event with `aggregateType: "SAMPLE_NETWORK_YEAR"` and `surveyYear: 2026` increments sample-network refresh even when the selected township is represented by an ancestor region in the event. Assert active map mode and active governance tab remain unchanged.

- [ ] **Step 3: Emit scoped event detail**

Build audit detail with a JSON serializer or a small tested value object; do not concatenate unescaped user data. Include only network year and authorized region codes required for event delivery. Preserve existing audit action codes.

- [ ] **Step 4: Classify sample-network events in the clients**

Extend `OverviewBusinessChange` with optional `aggregateType` and `actionCode`. Parse both fields. Treat `SAMPLE_NETWORK_YEAR` and approved sample-coordinate changes as sample-network invalidations for the matching year, while ordinary business events retain existing product/region filtering.

- [ ] **Step 5: Run focused tests and commit each repository**

```bash
JAVA_HOME=/opt/homebrew/opt/openjdk@21 mvn -Dtest=AnnualSampleNetworkServiceTest,AnnualSampleNetworkRestIntegrationTest test
git add src/main/java src/test/java
git commit -m "fix(sample-network): publish scoped realtime changes"
```

```bash
npm exec vitest run src/modules/overview/infrastructure/realtime/BrowserOverviewRealtimeStream.spec.ts src/modules/overview/ui/hooks/useOverviewRealtimeRefresh.spec.tsx
git add src/modules/overview
git commit -m "fix(overview): refresh sample networks from scoped events"
```

```bash
npm exec vitest run src/business/samplepoint/SamplePointGovernanceWorkspace.spec.tsx
git add src/business/samplepoint
git commit -m "fix(sample-network): preserve governance context on realtime refresh"
```

---

### Task 4: Proportional gates, managed runtime publish and browser acceptance

**Files:**

- Modify if required by inventory gate: `docs/production-readiness/stage-one-ui-inventory.json`

**Interfaces:**

- Consumes: repository verification scripts and the existing managed runtime publishers.
- Produces: source commits, clean feature branches, SHA-256 parity and browser evidence on 63182/63200/8090.

- [ ] **Step 1: Run repository gates with Node 24 and JDK 21**

Run backend `mvn verify`, frontend `npm run verify`, and Web `npm run verify`. If the Web inventory is the only failure, regenerate it once, review the focused diff, and rerun the inventory check.

- [ ] **Step 2: Publish managed local runtime copies**

Use the existing backend local-runtime installer and Web `npm run publish:local-runtime`. Do not copy databases. Verify source/runtime tracked-file hashes and the formal Web manifest.

- [ ] **Step 3: Verify services**

Require HTTP 200 and ownership checks for 8090, 63182 and 63200.

- [ ] **Step 4: Run browser acceptance**

Validate this exact flow:

```text
63182 总揽监测 → 富裕县 → 任一乡镇 → 未点击行政村即出现全部设计覆盖
→ 切换现有/设计/对照 → 点击行政村 → 当前村突出且其他标识保留
→ 63200 样本点管理 → 切换四个治理模块 → 单一主表无卡片堆叠
```

Verify page identity, nonblank DOM, no framework overlay, no relevant console warning/error, screenshot evidence and interaction state. Do not perform database-writing actions merely for visual acceptance.

- [ ] **Step 5: Push feature branches and update existing PRs**

Push only `feature/20260823-sample-network-comparison`. Wait for all three GitHub checks to pass. Do not merge `main`.

## Plan self-review

- Every design requirement maps to Tasks 1–4.
- The map layer and drawer responsibilities are separated.
- Governance navigation, table-led structure and realtime preservation are explicit.
- Exact coordinates remain fail-closed and existing business icons remain unchanged.
- No cloud, production, database-copy or `main` operation is included.
