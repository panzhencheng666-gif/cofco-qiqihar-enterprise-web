# Risk Warning Low-Fatigue Visual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the independent risk application from a high-contrast dark cockpit into a light, square, low-fatigue enterprise analysis terminal with restrained future-data details.

**Architecture:** Keep the existing React data flow and API calls unchanged. Centralize Ant Design visual tokens in a risk-only theme module, apply minimal presentation markup changes in `RiskWarningApplication.tsx`, and replace only the isolated risk stylesheet.

**Tech Stack:** React 19, TypeScript, Ant Design 6, CSS, Vitest, Vite.

## Global Constraints

- Only modify the independent `/risk/` visual layer and risk-only presentation markup.
- Do not change the portal, business workbench, routes, permissions, APIs, database, or state management.
- Do not add static metrics, mock events, decorative charts, or controls without persisted behavior.
- Preserve query, filter, refresh, detail, evidence, AI judgement, and human feedback behavior.
- Use a light white/gray canvas, one cold-blue interaction accent, semantic colors only for real states, and square 0–2px geometry.
- Support `prefers-reduced-motion` and responsive stacking below 980px and 720px.

---

### Task 1: Risk-only visual tokens

**Files:**

- Create: `src/risk/riskVisualTheme.ts`
- Create: `src/risk/riskVisualTheme.spec.ts`
- Modify: `src/risk/RiskWarningApplication.tsx`

**Interfaces:**

- Produces: `riskVisualTokens` and `riskAntTheme`, consumed by `RiskWarningApplication`.
- Preserves: all existing API types, filters, loaders, and feedback calls.

- [x] **Step 1: Write the failing token contract test**

```ts
import { describe, expect, it } from "vitest";
import { riskVisualTokens } from "./riskVisualTheme";

describe("risk visual theme", () => {
  it("uses a light low-fatigue canvas and a single interaction accent", () => {
    expect(riskVisualTokens.canvas).toBe("#ffffff");
    expect(riskVisualTokens.surface).toBe("#f4f6f8");
    expect(riskVisualTokens.primary).toBe("#0f62fe");
    expect(riskVisualTokens.text).toBe("#161616");
  });
});
```

- [x] **Step 2: Run the test and confirm missing module failure**

Run: `npm exec vitest run -- src/risk/riskVisualTheme.spec.ts`

Expected: FAIL because `riskVisualTheme` does not exist.

- [x] **Step 3: Add the token module and connect ConfigProvider**

Create a frozen token object with `canvas`, `surface`, `surfaceStrong`, `text`, `textMuted`, `hairline`, `primary`, `success`, `warning`, and `error`. Export an Ant Design `ThemeConfig` using 14px body text, 2px radius, white containers, light-gray controls, blue focus/primary states, and semantic status colors. Replace the inline dark theme in `RiskWarningApplication` with `theme={riskAntTheme}`.

- [x] **Step 4: Run focused test and type-aware lint**

Run: `npm exec vitest run -- src/risk/riskVisualTheme.spec.ts`

Expected: PASS.

Run: `npm run lint`

Expected: exit 0.

### Task 2: Low-fatigue application shell

**Files:**

- Modify: `src/risk/RiskWarningApplication.tsx`
- Modify: `src/risk/risk-warning.css`
- Test: `src/risk/riskVisualTheme.spec.ts`

**Interfaces:**

- Consumes: `riskAntTheme` from Task 1.
- Produces: risk-only CSS classes and responsive visual behavior; no new data behavior.

- [x] **Step 1: Add presentation-only state hooks**

Add `data-service-state={error ? "error" : "online"}` to the risk shell and `aria-label="风险研判工作区"` to the main workspace. Keep every existing event handler, request path, timer, filter value, and displayed field unchanged.

- [x] **Step 2: Replace the isolated stylesheet**

Implement CSS variables for the approved light palette. Use a 48px white header, 152px gray navigation rail, subtle grid in the title area, flat white panels, 48px table rows, a pale-blue selected row with a 2px left line, light code surfaces, clear keyboard focus, and responsive stacking at 980px/720px. Use no glow, glass effect, large shadow, or continuous error animation.

- [x] **Step 3: Verify the focused theme contract**

Run: `npm exec vitest run -- src/risk/riskVisualTheme.spec.ts src/business/workbenchNavigation.spec.tsx src/business/portalApplicationCatalog.spec.ts`

Expected: all test files pass and workbench/portal contracts remain unchanged.

### Task 3: Regression and visual acceptance

**Files:**

- Modify only if verification finds a visual-layer defect: `src/risk/RiskWarningApplication.tsx`, `src/risk/risk-warning.css`, `src/risk/riskVisualTheme.ts`

**Interfaces:**

- Produces: verified local `/risk/` view and a clean git checkpoint.

- [x] **Step 1: Run proportional automated verification**

Run: `npm exec vitest run -- src/risk/riskVisualTheme.spec.ts src/business/workbenchNavigation.spec.tsx src/business/portalApplicationCatalog.spec.ts src/business/EnterpriseBusinessApplication.spec.tsx`

Expected: all selected tests pass.

Run: `npm run lint && npm run build && git diff --check`

Expected: all commands exit 0.

- [x] **Step 2: Perform local browser acceptance**

Open `http://127.0.0.1:63183/risk/` and verify the independent header, light canvas, low-fatigue table/detail layout, truthful service error state, current-user state, and “返回应用中心” link. Confirm the business workbench contains no risk navigation entry.

- [x] **Step 3: Commit the implementation checkpoint**

```bash
git add src/risk/RiskWarningApplication.tsx src/risk/risk-warning.css src/risk/riskVisualTheme.ts src/risk/riskVisualTheme.spec.ts docs/superpowers/plans/2026-09-21-risk-warning-low-fatigue-implementation.md
git commit -m "style(risk): reduce visual fatigue"
```
