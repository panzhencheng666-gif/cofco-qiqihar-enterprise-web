# Operational Workspaces Business Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the prototype shell, production, market, and supply workspaces around the approved real organization and table-led business model.

**Architecture:** Keep the existing React prototype entry and region context. Replace repeated supply sections with one canonical statement plus version history, enrich production and market domain models, and expose detail through the existing workspace primitives instead of new top-level pages.

**Tech Stack:** React 19, TypeScript 5.9, Vitest, Testing Library, Vite, CSS.

## Global Constraints

- Modify only `src/prototype`, its tests, and the approved design/plan documents.
- Preserve unrelated dirty worktree changes.
- Use real organization names: 齐齐哈尔经营部、经营部本部、讷河库、克山库、克东库、龙镇库、成吉思汗库.
- Keep current organization separate from business/statistical region.
- No developer vocabulary or long calculation instructions in the visible UI.
- Use table-led layouts and compact summaries; do not add dashboard cards.
- Every behavior change begins with a failing Vitest test.

---

### Task 1: Enterprise shell organization and account entry

**Files:**
- Modify: `src/prototype/FormalEnterprisePrototype.spec.tsx`
- Modify: `src/prototype/FormalEnterprisePrototype.tsx`
- Modify: `src/prototype/formal-enterprise.css`

**Interfaces:**
- Consumes: existing `FormalGlobalHeader` route handling.
- Produces: labeled current-work-unit button and a fixed personal account button.

- [ ] **Step 1: Write the failing shell test**

```tsx
expect(screen.getByRole("button", { name: /当前工作单位.*经营部本部/ })).toBeVisible();
expect(screen.getByRole("button", { name: /个人账户.*王洋/ })).toBeVisible();
expect(screen.queryByText("东北区域经营中心")).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the shell test and verify the expected failure**

Run: `npm test -- src/prototype/FormalEnterprisePrototype.spec.tsx`

Expected: FAIL because the old fictional organization remains and the user block is not a button.

- [ ] **Step 3: Implement the real organization hierarchy entry**

Change the selector copy to `齐齐哈尔经营部 / 经营部本部`, retain the organization icon, and render the user identity as a labeled button at the far right.

- [ ] **Step 4: Run the shell test**

Run: `npm test -- src/prototype/FormalEnterprisePrototype.spec.tsx`

Expected: PASS.

### Task 2: Complete production cost and protection data

**Files:**
- Modify: `src/prototype/ProductionMonitoringWorkspace.spec.tsx`
- Modify: `src/prototype/productionMonitoringModel.ts`
- Modify: `src/prototype/ProductionMonitoringWorkspace.tsx`
- Modify: `src/prototype/unified-workspaces.css`

**Interfaces:**
- Consumes: selected production object and existing crop-specific field groups.
- Produces: one visible `成本与保障` field group with the approved expense, insurance, and subsidy rows.

- [ ] **Step 1: Write failing production field tests**

```tsx
for (const field of ["土地租金", "种子费用", "化肥费用", "农药费用", "灌溉费用", "人工费用", "机械作业费用", "保费总额", "财政保费补贴", "农户自缴保费", "保险赔款", "种植补贴应收", "种植补贴实收"]) {
  expect(screen.getByRole("textbox", { name: field })).toBeVisible();
}
```

- [ ] **Step 2: Run the production test and verify the expected failure**

Run: `npm test -- src/prototype/ProductionMonitoringWorkspace.spec.tsx`

Expected: FAIL on the first missing detailed cost field.

- [ ] **Step 3: Add the complete cost rows and compact derived summary**

Replace the three generic values with the approved expense, insurance, subsidy, applicable-area, and derived-total rows. Keep them in the same online-entry workbench.

- [ ] **Step 4: Run the production tests**

Run: `npm test -- src/prototype/ProductionMonitoringWorkspace.spec.tsx`

Expected: PASS.

### Task 3: Make market object capabilities complete and explicit

**Files:**
- Modify: `src/prototype/MarketMonitoringWorkspace.spec.tsx`
- Modify: `src/prototype/marketMonitoringModel.ts`
- Modify: `src/prototype/marketMonitoringData.ts`
- Modify: `src/prototype/MarketMonitoringWorkspace.tsx`

**Interfaces:**
- Consumes: `MarketRole`, `MarketCapability`, selected task and grain.
- Produces: capability coverage table and role-appropriate entry fields without separate role pages.

- [ ] **Step 1: Write failing capability and field tests**

Assert that the object registry shows all approved roles and that online entry exposes quote/transaction separation, price conditions, inventory ownership/batch, processing input/output/loss, and rail/road package-specific movement fields.

- [ ] **Step 2: Run the market test and verify the expected failure**

Run: `npm test -- src/prototype/MarketMonitoringWorkspace.spec.tsx`

Expected: FAIL on the newly required capability and field labels.

- [ ] **Step 3: Extend the model and render only applicable capability sections**

Add `quote`, `trade`, `inventory-detail`, `processing-output`, and package/delivery terms to the relevant role mappings. Keep subject and logistics collection in the existing single workbench.

- [ ] **Step 4: Run the market tests**

Run: `npm test -- src/prototype/MarketMonitoringWorkspace.spec.tsx`

Expected: PASS.

### Task 4: Replace repeated supply pages with the canonical balance statement

**Files:**
- Modify: `src/prototype/formalEnterpriseModel.spec.ts`
- Modify: `src/prototype/formalEnterpriseModel.ts`
- Modify: `src/prototype/formalEnterpriseData.ts`
- Modify: `src/prototype/SupplyDemandWorkspace.spec.tsx`
- Modify: `src/prototype/SupplyDemandWorkspace.tsx`
- Modify: `src/prototype/FormalEnterprisePrototype.tsx`
- Modify: `src/prototype/unified-workspaces.css`

**Interfaces:**
- Consumes: shared enterprise region context and selected product account/year/version.
- Produces: `statement` and `versions` supply routes, a full balance-row model, and row-level source actions.

- [ ] **Step 1: Write failing route and statement tests**

Assert exactly two supply navigation buttons, absence of the five old labels, all canonical supply/use/ending rows, source business/version columns, full-region and county region options, and a row-level source detail action.

- [ ] **Step 2: Run the supply tests and verify the expected failure**

Run: `npm test -- src/prototype/formalEnterpriseModel.spec.ts src/prototype/SupplyDemandWorkspace.spec.tsx`

Expected: FAIL because the old five-section route and incomplete repeated workspaces remain.

- [ ] **Step 3: Implement the statement and version history**

Use a single filter row and grouped table. Compute only the three disclosed arithmetic results from row values; keep missing values distinct from zero. Show concise source labels in the table and reveal source records on row action.

- [ ] **Step 4: Run the supply tests**

Run: `npm test -- src/prototype/formalEnterpriseModel.spec.ts src/prototype/SupplyDemandWorkspace.spec.tsx`

Expected: PASS.

### Task 5: Regression, build, and visual verification

**Files:**
- Modify as required by verified regressions only.
- Create: `artifacts/final-enterprise-prototype/business-clarity-*.png`

**Interfaces:**
- Consumes: all completed workspace slices.
- Produces: reproducible tests, builds, and screenshots for user review.

- [ ] **Step 1: Run focused prototype tests**

Run: `npm test -- src/prototype`

Expected: all prototype tests pass.

- [ ] **Step 2: Run static verification**

Run: `npm run format:check && npm run lint && npm run architecture`

Expected: each command exits 0.

- [ ] **Step 3: Run both builds**

Run: `npm run build:prototype && npm run build`

Expected: both builds exit 0.

- [ ] **Step 4: Capture and inspect the shell, production, market, and supply pages**

Use the running prototype with desktop viewport 2048×1152. Confirm the avatar is right-aligned, the sidebars are compact, the main tables fit without clipped primary actions, and no old supply labels remain.

- [ ] **Step 5: Stage only scoped files and commit**

Run `git add` with explicit prototype and documentation paths, inspect `git diff --cached`, then create one implementation commit.
