# Risk Warning Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a separately built `/risk/` application and a peer platform navigation entry without changing existing workbench behavior.

**Architecture:** Keep the current workbench entry unchanged. Add a Vite multi-page entry for the risk application, isolate its React/CSS files under `src/risk`, and make the shared platform header accept a new `risk` active section.

**Tech Stack:** React 19, TypeScript 5.9, Vite 8, Vitest, Testing Library, CSS.

## Global Constraints

- Do not change existing business routes, data writes, permissions, or formal records.
- Do not show fixtures, mock alerts, fabricated metrics, fake model versions, or internal identifiers.
- Implement only the first-stage shell and honest unavailable state.
- Preserve the original checkout's untracked research document and all unrelated repositories.
- Use test-first changes and commit a bounded checkpoint.

---

### Task 1: Peer platform navigation

**Files:**
- Modify: `src/business/EnterprisePlatformHeader.tsx`
- Modify: `src/business/workbenchNavigation.ts`
- Test: `src/business/workbenchNavigation.spec.tsx`

**Interfaces:**
- Produces: `RISK_WARNING_URL = "/risk/"`
- Produces: `activeSection` union member `"risk"`

- [ ] Add a failing test asserting a “风险研判预警” link points to `/risk/` and becomes current only when `activeSection="risk"`.
- [ ] Run `npm exec vitest run -- src/business/workbenchNavigation.spec.tsx` and confirm failure because the link and union member do not exist.
- [ ] Add the URL constant, header link, and active-state handling.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Independent risk entry

**Files:**
- Create: `risk/index.html`
- Create: `src/risk/main.tsx`
- Create: `src/risk/RiskWarningApplication.tsx`
- Create: `src/risk/RiskWarningApplication.spec.tsx`
- Create: `src/risk/risk-warning.css`
- Modify: `vite.config.ts`

**Interfaces:**
- Produces: `RiskWarningApplication(): JSX.Element`
- Produces: physical build entry `dist/risk/index.html`

- [ ] Write a failing component test for the independent title, nine navigation items, honest empty state, and the absence of invented risk/model results.
- [ ] Run `npm exec vitest run -- src/risk/RiskWarningApplication.spec.tsx` and confirm failure because the component does not exist.
- [ ] Implement the minimal semantic React surface and responsive CSS matching the approved concept.
- [ ] Add the `risk` Vite build input and independent HTML mount.
- [ ] Re-run the component test and confirm it passes.

### Task 3: Regression and visual acceptance

**Files:**
- Modify only if a defect is found in Task 1 or Task 2 files.

**Interfaces:**
- Consumes: `/risk/` build entry and platform navigation contract.
- Produces: verified bounded checkpoint.

- [ ] Run focused tests for risk application, platform navigation, and enterprise business application.
- [ ] Run `npm run build`, `npm run lint`, and `npm run architecture`.
- [ ] Start the local Vite server and use the in-app browser to verify `/risk/` at desktop and mobile widths.
- [ ] Capture the rendered screen and compare it with `docs/design/risk-warning-primary-screen-concept.png` using `view_image`.
- [ ] Confirm `/workbench/` still opens the existing application and the only visible change is the additive peer link.
- [ ] Commit the bounded phase checkpoint.
