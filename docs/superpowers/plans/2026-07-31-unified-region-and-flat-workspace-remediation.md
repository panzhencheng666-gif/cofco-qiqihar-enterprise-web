# Unified Region and Flat Workspace Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the three-region business context, complete the selectable
geography, flatten operational layouts, and move persistent governance prose
out of daily workspaces.

**Architecture:** A shared typed region catalog supplies every workspace.
Region selection is controlled at the formal shell and passed to each business
workspace. Operational pages use one context row and table-led content; rules
remain enforced and are disclosed through collapsed help.

**Tech Stack:** React 19, TypeScript 5.9, Vitest, Testing Library, CSS.

## Global Constraints

- Do not fabricate township, administrative-village, supply-balance, or sample
  values.
- Do not display natural-village counts.
- Do not remove product, variety, quality, collection, review, reporting, or
  duty-audit functions.
- Do not modify unrelated dirty files outside the prototype and design docs.

---

### Task 1: Authoritative Region Catalog

**Files:**

- Create: `src/prototype/enterpriseRegions.ts`
- Create: `src/prototype/enterpriseRegions.spec.ts`

**Interfaces:**

- Produces: `EnterpriseRegionId`, `enterpriseRegionGroups`,
  `getEnterpriseRegion(id)`, and `getEnterpriseRegionOptions()`.

- [ ] **Step 1: Write the failing region-catalog test**

```ts
expect(getEnterpriseRegionOptions()).toEqual(
  expect.arrayContaining([
    expect.objectContaining({ label: "齐齐哈尔市全域" }),
    expect.objectContaining({ label: "黑河市全域" }),
    expect.objectContaining({ label: "呼伦贝尔指定范围" }),
  ]),
);
expect(getEnterpriseRegionOptions()).toHaveLength(29);
```

- [ ] **Step 2: Verify the test fails**

Run: `npm test -- src/prototype/enterpriseRegions.spec.ts`

Expected: FAIL because `enterpriseRegions.ts` does not exist.

- [ ] **Step 3: Implement the typed catalog**

Create grouped entries for 17 Qiqihar choices, 7 Heihe choices, and 5 Hulunbuir
choices. Store source status separately from the label.

- [ ] **Step 4: Verify the test passes**

Run: `npm test -- src/prototype/enterpriseRegions.spec.ts`

Expected: PASS.

### Task 2: Cross-Workspace Region Context

**Files:**

- Modify: `src/prototype/FormalEnterprisePrototype.tsx`
- Modify: `src/prototype/UnifiedWorkspacePrimitives.tsx`
- Modify: `src/prototype/ProductionMonitoringWorkspace.tsx`
- Modify: `src/prototype/MarketMonitoringWorkspace.tsx`
- Modify: `src/prototype/SupplyDemandWorkspace.tsx`
- Modify: `src/prototype/ReportCenterWorkspace.tsx`
- Test: `src/prototype/FormalEnterprisePrototype.spec.tsx`

**Interfaces:**

- Consumes: `EnterpriseRegionId`, `getEnterpriseRegionOptions()`.
- Produces: `WorkspaceRegionSelect` and controlled `regionId` props.

- [ ] **Step 1: Write failing integration tests**

Assert that the market and production pages expose a `业务地区` combobox, the
combobox contains Heihe and Hulunbuir groups, and changing it updates the
current business context.

- [ ] **Step 2: Verify the tests fail**

Run: `npm test -- src/prototype/FormalEnterprisePrototype.spec.tsx`

Expected: FAIL because the region context is hard-coded.

- [ ] **Step 3: Implement shell-owned region state**

Initialize `regionId` to `qiqihar-all`, pass it to all region-aware workspaces,
and render the same grouped selector through `WorkspaceRegionSelect`.

- [ ] **Step 4: Verify the tests pass**

Run: `npm test -- src/prototype/FormalEnterprisePrototype.spec.tsx`

Expected: PASS.

### Task 3: Complete Supply Availability

**Files:**

- Modify: `src/prototype/supplyBalanceScope.ts`
- Modify: `src/prototype/SupplyDemandWorkspace.tsx`
- Test: `src/prototype/SupplyDemandWorkspace.spec.tsx`

**Interfaces:**

- Consumes: `EnterpriseRegionId`.
- Produces: `getSupplyBalanceScopeForRegion(regionId)` returning an available
  account or an explicit unavailable state.

- [ ] **Step 1: Write failing supply tests**

Assert all 16 Qiqihar county-level rows are visible, Heihe and Hulunbuir are
selectable, and an unbuilt account renders `尚未建立正式供需账户` without numeric
balance values.

- [ ] **Step 2: Verify the tests fail**

Run: `npm test -- src/prototype/SupplyDemandWorkspace.spec.tsx`

Expected: FAIL because only five balance scopes are selectable.

- [ ] **Step 3: Implement availability-aware selection**

Map the five existing formal accounts to the shared region IDs. For every other
region return availability metadata and render an account-status table instead
of a fabricated equation.

- [ ] **Step 4: Verify the tests pass**

Run: `npm test -- src/prototype/SupplyDemandWorkspace.spec.tsx`

Expected: PASS.

### Task 4: Flat Operational Workspaces and Rule Disclosure

**Files:**

- Modify: `src/prototype/ProductionMonitoringWorkspace.tsx`
- Modify: `src/prototype/MarketMonitoringWorkspace.tsx`
- Modify: `src/prototype/ReportCenterWorkspace.tsx`
- Modify: `src/prototype/SupplyDemandWorkspace.tsx`
- Modify: `src/prototype/unified-workspaces.css`
- Test: `src/prototype/PortalWorkspaces.spec.tsx`
- Test: `src/prototype/ReportCenterWorkspace.spec.tsx`

**Interfaces:**

- Produces: operational pages without `WorkspaceSummaryStrip` and a collapsed
  `workspace-policy-details` disclosure for detailed rules.

- [ ] **Step 1: Write failing layout and disclosure tests**

Assert operational overview containers have no `.workspace-summary-strip`, and
the duty page contains a closed `details` element named `查看填报规则`.

- [ ] **Step 2: Verify the tests fail**

Run:
`npm test -- src/prototype/PortalWorkspaces.spec.tsx src/prototype/ReportCenterWorkspace.spec.tsx`

Expected: FAIL because summary strips and the permanent rule table exist.

- [ ] **Step 3: Flatten operational composition**

Move counts into table-toolbar notes, replace stacked product/quality bands with
compact filters and tables, and convert import/system metric cards to flat rows.
Move detailed policy copy into the closed disclosure.

- [ ] **Step 4: Verify focused tests pass**

Run:
`npm test -- src/prototype/PortalWorkspaces.spec.tsx src/prototype/ReportCenterWorkspace.spec.tsx`

Expected: PASS.

### Task 5: Verification and Commit

**Files:**

- Modify only files listed in Tasks 1–4 and the two design documents.

- [ ] **Step 1: Run complete verification**

Run:
`npm run format:check && npm run lint && npm run architecture && npm test && npm run build:prototype && npm run build && git diff --check`

Expected: all commands exit 0.

- [ ] **Step 2: Perform browser validation**

At 1280px verify market, production, supply, business reports, and duty
supervision have no horizontal overflow, expose all three region groups, and
show no expanded policy table.

- [ ] **Step 3: Review and commit**

Stage only the files listed by this plan and commit with:

```bash
git commit -m "feat: unify regional context and flatten workspaces"
```
