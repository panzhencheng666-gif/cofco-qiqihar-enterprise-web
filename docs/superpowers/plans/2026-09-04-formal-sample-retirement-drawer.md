# Formal Sample Retirement Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the routed all-purpose formal-sample detail drawer with a focused retirement confirmation drawer while preserving the mature ledger behind it and the existing retirement/realtime contract.

**Architecture:** Keep `formal-sample-view` as the existing routed retirement entry used by the mature market and production ledgers, but hydrate it with the existing `RETIRE` intent. Render a retirement-only branch inside `FormalSamplePointLedger`; reuse the existing repository method and authoritative requery instead of adding a new API or data model.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, CSS, Vite.

## Global Constraints

- Do not change the existing sample ledger layout, filters, table, row density, or overview map architecture.
- The retirement drawer has exactly two business actions: “返回台账” and “确认淘汰该样本点”.
- Retirement preserves history and is not physical deletion.
- Do not perform a destructive browser acceptance against a real sample point.

---

### Task 1: Lock the retirement interaction contract

**Files:**

- Modify: `src/business/formal-sample/ExistingSampleObservationPanel.spec.tsx`
- Modify: `src/business/market/ProductMarketCollectionWorkspace.spec.tsx`
- Modify: `src/business/production/ProductProductionCollectionWorkspace.spec.tsx`

**Interfaces:**

- Consumes: `FormalSelection`, `RealtimeBusinessRepository.retireFormalSamplePoint`.
- Produces: failing assertions for a retirement-only routed drawer, its two actions, standardized audit reason, requery, and `onSaved` callback.

- [ ] **Step 1: Add focused failing assertions**

Assert that the routed retirement region is labelled “淘汰现有样本点”, contains the warning and four summary fields, excludes edit/assign/delete controls, and contains only the return and confirmation buttons.

- [ ] **Step 2: Verify the focused test fails**

Run: `npm test -- --run src/business/formal-sample/ExistingSampleObservationPanel.spec.tsx src/business/market/ProductMarketCollectionWorkspace.spec.tsx src/business/production/ProductProductionCollectionWorkspace.spec.tsx`

Expected: FAIL because the current routed drawer is the all-purpose detail shell.

### Task 2: Implement the focused drawer and existing data flow

**Files:**

- Modify: `src/business/formal-sample/FormalSamplePointLedger.tsx`
- Modify: `src/business/formal-sample/ExistingSampleObservationPanel.tsx`
- Modify: `src/business/market-monitoring.css`

**Interfaces:**

- Consumes: `loadDetail(id, "RETIRE")`, `retireFormalSamplePoint(id, version, reason)`, `query(pageNumber)`, `onChanged()`.
- Produces: retirement-only enterprise drawer with a standardized audit reason and authoritative post-write refresh.

- [ ] **Step 1: Route the mature-ledger retirement selection to RETIRE intent**

Treat the routed `formal-sample-view` maintenance selection as retirement intent; keep embedded “查看” behavior unchanged.

- [ ] **Step 2: Render the retirement-only drawer**

When `retiringId === detail.id`, render only the approved identity, warning, four-field summary, return action, and danger confirmation action. Keep the existing detail branch for non-retirement embedded workflows.

- [ ] **Step 3: Preserve the repository contract**

Pass the constant reason `现有样本点不再使用，由维护人在业务台账执行淘汰` to the existing endpoint. On success, requery, call `onChanged`, and return to the formal-sample list.

- [ ] **Step 4: Style only the new drawer branch**

Add namespaced `.formal-sample-retirement__*` rules under the existing 540px drawer. Use the existing blue, border, spacing, sticky footer, and a red confirmation button.

- [ ] **Step 5: Run focused verification**

Run the three focused test files, then `npm run format:check`, `npm run lint`, `npm run typecheck`, and `npm run build` using the repository's available scripts.

Expected: all commands pass without modifying the mature ledger structure.

### Task 3: Publish and accept the real runtime

**Files:**

- Modify only generated `dist` in the deployment candidate/runtime, never commit it unless the repository already tracks it.

**Interfaces:**

- Consumes: Web PR #30, required `Node 24 / npm verify`, protected `main`, runtime 63182.
- Produces: one pushed PR head, successful PR CI, merge commit, successful main CI, recoverable 63182 deployment, and non-destructive browser evidence.

- [ ] **Step 1: Commit and push the bounded source change once**

Confirm the worktree diff contains only the spec, plan, focused tests, retirement drawer implementation, and namespaced CSS. Commit on `codex/20260904-enterprise-ledger-ui-refinement` and push once.

- [ ] **Step 2: Wait for the unique PR CI and merge**

Do not rerun while it is in progress. Merge only after the required check passes; then wait for the unique main CI for the merge SHA.

- [ ] **Step 3: Deploy main to 63182 recoverably**

Back up the existing runtime, build from the merged main SHA, atomically align source/dist/release manifest, and verify port 63182 health.

- [ ] **Step 4: Perform non-destructive browser acceptance**

Verify that the populated market and production ledgers remain visible behind the drawer; inspect both actions and copy; return without confirming a real retirement. Confirm no console error and no unexpected 8090/63200 regression.
