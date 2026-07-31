# Enterprise Platform Information Architecture Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the formal enterprise prototype into the approved stable domain-application architecture, including unambiguous supply accounting, distinct task/object/analysis workspaces, parameterized reports, and current-period-plus-three-year comparable analytics.

**Architecture:** Keep the six stable user applications and add governance/system entries in the launcher. Put business rules in focused `core/` modules, typed fixtures in `data/`, reusable analytical visuals in `components/`, and thin domain workspaces in `production/` and `market/`. Components consume one typed source of truth; released values, comparison results, supply verdicts, and report inputs are never recalculated independently inside pages.

**Tech Stack:** React 19.2, TypeScript 5.9, Vite 8.1, Vitest 4.1, Testing Library 16.3, semantic HTML, CSS, and accessible lightweight SVG. No new runtime dependency.

## Global Constraints

- Work only in `/Users/federal/Desktop/cofco-qiqihar-enterprise-web` on branch `2026-07-31-enterprise-platform-architecture-redesign`.
- Allowed implementation paths are `src/prototype/**` and this plan. Do not edit, format, stage, restore, or delete any other user-owned file.
- Capture the pre-implementation repository status and SHA-256 of every dirty file outside allowed paths in `/tmp`; compare the same manifest after every task.
- Never use `git add .` or `git add -A`; stage only the exact files listed by a task.
- Preserve every field mapped in `docs/superpowers/specs/2026-07-31-enterprise-platform-information-architecture-redesign-design.md` section 15.
- Keep `EnterpriseArchitecturePrototype.tsx` and `prototype.css` untouched; they are not imported by the formal entry and may contain user-owned historical content.
- Do not add a chart library. Render tables, trend lines, comparison bars, and waterfall shapes with semantic HTML, CSS, and accessible SVG.
- Components must not embed business values, Qiqihar defaults, people, periods, report conclusions, or supply rules. Put demo values in typed `data/` fixtures.
- Default business scope is `authorized-all` (“全部授权范围”). A work unit in the header is not a statistical region.
- Missing, not collected, not applicable, rejected, provisional, and zero remain distinct.
- Use fixed-point scaled integers/`bigint` for comparison and supply arithmetic; use `number` only for bounded SVG geometry after the authoritative result exists.
- Follow strict TDD: add or replace one behavior test, run it and observe the expected failure, write the minimum production code, run it green, then refactor.
- Current baseline is 14 prototype test files and 76 passing tests. A changed test that encoded rejected behavior must first fail against the old implementation for the newly approved expectation.
- All user-facing copy is concise Chinese business language. Actions retain the same verb through button, confirmation, status, and completion feedback.
- Visual foreground/background pairs meet WCAG AA; `#4D8D87` and `#C9952E` are not white-background body text colors.
- Visual evidence is written to `/tmp`, never to the existing user-owned `artifacts/` directory.

## File and Responsibility Map

| Path                                                 | Responsibility                                                                           |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/prototype/core/operationalScope.ts`             | Explicit work unit, authorized business scope, URL filter parsing, and saved-view values |
| `src/prototype/core/businessClassification.ts`       | Governed domain/subtype catalog shared by filters, tasks, metrics, and reports           |
| `src/prototype/core/metricCatalog.ts`                | Indicator definitions, fixed-point values, display metadata, and comparison modes        |
| `src/prototype/core/comparableSeries.ts`             | Per-point and per-pair comparability, deltas, YoY, percentage points, and CAGR           |
| `src/prototype/core/executiveLedger.ts`              | Filtered operating, risk, duty, and release read models                                  |
| `src/prototype/core/businessWork.ts`                 | One work-item source for My Work and domain task projections                             |
| `src/prototype/core/monitoringRegistry.ts`           | Stable objects, effective roles, types, sources, and domain projections                  |
| `src/prototype/core/supplyAccount.ts`                | Supply equations, rule selection, reconciliation, and publication verdicts               |
| `src/prototype/core/reportRun.ts`                    | Report templates, parameter compatibility, version locking, preview, and lifecycle       |
| `src/prototype/data/*.ts`                            | Typed prototype fixtures; the only home for demo values and narrative inputs             |
| `src/prototype/components/AnnualComparisonTrack.tsx` | Table-friendly four-year comparison rail                                                 |
| `src/prototype/components/ComparisonCharts.tsx`      | Selected-metric level trend and three policy-aware annual-change bars                    |
| `src/prototype/production/*.tsx`                     | Production task, registry, document, and analysis workspaces                             |
| `src/prototype/market/*.tsx`                         | Market task, registry, document, and analysis workspaces                                 |
| `src/prototype/application/*.ts`                     | Route-aware navigation/search projections that own no business facts                     |
| Existing top-level workspace files                   | Thin application-level orchestration and backward-compatible public exports              |

---

### Task 1: Repository Protection Baseline, Typed Navigation, and Explicit Operational Scope

**Files:**

- Create: `src/prototype/core/operationalScope.ts`
- Create: `src/prototype/core/operationalScope.spec.ts`
- Create: `src/prototype/core/businessClassification.ts`
- Create: `src/prototype/core/businessClassification.spec.ts`
- Create: `src/prototype/useFormalEnterpriseLocation.ts`
- Create: `src/prototype/useFormalEnterpriseLocation.spec.tsx`
- Create: `src/prototype/EnterpriseShell.tsx`
- Create: `src/prototype/EnterpriseShell.spec.tsx`
- Create: `src/prototype/EnterpriseApplicationLauncher.tsx`
- Create: `src/prototype/EnterpriseApplicationLauncher.spec.tsx`
- Create: `src/prototype/tsconfig.json`
- Modify: `src/prototype/formalEnterpriseModel.ts`
- Modify: `src/prototype/formalEnterpriseModel.spec.ts`
- Modify: `src/prototype/formalEnterpriseData.ts`
- Modify: `src/prototype/FormalEnterprisePrototype.tsx`
- Modify: `src/prototype/FormalEnterprisePrototype.spec.tsx`
- Modify: `src/prototype/MyWorkWorkspace.tsx`
- Modify: `src/prototype/ExecutiveOverviewWorkspace.tsx`
- Modify: `src/prototype/ProductionMonitoringWorkspace.tsx`
- Modify: `src/prototype/MarketMonitoringWorkspace.tsx`
- Modify: `src/prototype/SupplyDemandWorkspace.tsx`
- Modify: `src/prototype/ReportCenterWorkspace.tsx`
- Modify: `src/prototype/enterpriseRegions.ts`
- Modify: `src/prototype/enterpriseRegions.spec.ts`
- Modify: `src/prototype/UnifiedWorkspacePrimitives.tsx`
- Modify: `src/prototype/UnifiedWorkspacePrimitives.spec.tsx`

**Interfaces:**

- Produces: `FormalRoute`, `SectionFor<A>`, `FormalSelection`, `FormalLocation`, `OperationalScope`, `readFormalLocation()`, `writeFormalLocation()`, and `useFormalEnterpriseLocation()`.
- Produces: six stable business applications plus read-only `governance` and `system` launcher entries.
- Consumed by: every later workspace, search result, report seed, and field-preservation test.

- [ ] **Step 1: Capture the external-change baseline**

Run this exact read-only baseline capture. It writes only to a new `/tmp` directory:

```bash
baseline_dir="$(mktemp -d /tmp/qiqihar-enterprise-baseline.XXXXXX)"
printf '%s\n' "$baseline_dir" > /tmp/qiqihar-enterprise-baseline-path
git status --porcelain=v1 -z > "$baseline_dir/status.z"
git status --porcelain=v1 | perl -ne '
  my $path = substr($_, 3);
  chomp $path;
  next if $path =~ m{\Asrc/prototype/};
  next if $path =~ m{\Adocs/superpowers/plans/2026-07-31-enterprise-platform-information-architecture-redesign\.md\z};
  print;
' > "$baseline_dir/external-status.txt"
{
  git diff --name-only -z
  git diff --cached --name-only -z
  git ls-files --others --exclude-standard -z
} | perl -0ne '
  chomp;
  next if m{\Asrc/prototype/};
  next if $_ eq "docs/superpowers/plans/2026-07-31-enterprise-platform-information-architecture-redesign.md";
  print "$_\0" unless $seen{$_}++;
' > "$baseline_dir/external-paths.z"
while IFS= read -r -d '' external_file; do
  if [[ -f "$external_file" ]]; then
    shasum -a 256 "$external_file"
  else
    printf 'MISSING  %s\n' "$external_file"
  fi
done < "$baseline_dir/external-paths.z" > "$baseline_dir/external-sha256.txt"
```

After every task, run the same external status/path/hash capture into a fresh `/tmp/qiqihar-enterprise-current.XXXXXX` directory, then require all three comparisons to succeed:

```bash
baseline_dir="$(< /tmp/qiqihar-enterprise-baseline-path)"
cmp "$baseline_dir/external-status.txt" "$current_dir/external-status.txt"
cmp "$baseline_dir/external-paths.z" "$current_dir/external-paths.z"
cmp "$baseline_dir/external-sha256.txt" "$current_dir/external-sha256.txt"
```

Here `current_dir` is the fresh directory populated by repeating the Task 1 capture commands with `current_dir` in place of `baseline_dir`. Any mismatch stops the task; do not restore or rewrite the user's external file.

Expected: `src/prototype` has no pre-existing changes; unrelated dirty files are recorded but not altered.

- [ ] **Step 2: Write failing route and scope tests**

Import `readFormalRoute` and `createFormalRoute` from `formalEnterpriseModel.ts`, and import `readOperationalScope` from `core/operationalScope.ts`. Add these exact expectations:

```ts
expect(readFormalRoute("?page=production&section=objects")).toEqual({
  application: "production",
  section: "objects",
});
expect(readFormalRoute("?page=supply&section=analysis")).toEqual({
  application: "supply",
  section: "calculation",
});
expect(
  readOperationalScope("?region=authorized-all&product=corn&period=2026-W31", {
    workUnit: {
      organizationId: "qiqihar-operation",
      unitId: "operation-hq",
      label: "齐齐哈尔经营部本部",
    },
    identity: { userId: "wang-yang", postId: "regional-data-admin" },
    authorization: {
      authorizedRegionIds: ["qiqihar-all", "qiqihar-nehe"],
      authorizedBusinessClassificationIds: ["production.planting-production"],
      authorizedProductIds: ["corn"],
      authorizedCultivarIds: ["jingke-968"],
      authorizedReleaseVersionIds: ["METRIC-2026-W31-V3"],
      permissionKeys: ["prototype:read"],
    },
  }).scope.coordinates,
).toEqual({
  regionId: "authorized-all",
  productId: "corn",
  periodKey: "2026-W31",
});
const invalidScope = readOperationalScope("?region=not-authorized", {
  workUnit: {
    organizationId: "qiqihar-operation",
    unitId: "operation-hq",
    label: "齐齐哈尔经营部本部",
  },
  identity: { userId: "wang-yang", postId: "regional-data-admin" },
  authorization: {
    authorizedRegionIds: ["qiqihar-all", "qiqihar-nehe"],
    authorizedBusinessClassificationIds: ["production.planting-production"],
    authorizedProductIds: ["corn"],
    authorizedCultivarIds: ["jingke-968"],
    authorizedReleaseVersionIds: ["METRIC-2026-W31-V3"],
    permissionKeys: ["prototype:read"],
  },
});
expect(invalidScope.scope.coordinates).toEqual({ regionId: "authorized-all" });
expect(invalidScope.issues).toEqual([
  { code: "unknown-or-unauthorized-region", value: "not-authorized" },
]);
expect(invalidScope.queryAllowed).toBe(false);
```

Add a type-level route construction test that calls:

```ts
createFormalRoute("reporting", "compose");
createFormalRoute("overview", "duty");
```

and marks `createFormalRoute("supply", "operations")` with `// @ts-expect-error`.

Add a full location round-trip test for:

```ts
const location: FormalLocation = {
  route: createFormalRoute("production", "tasks"),
  coordinates: {
    regionId: "qiqihar-nehe",
    regionLevel: "county",
    businessSubtypeId: "planting-production",
    productId: "corn",
    cultivarId: "jingke-968",
    periodKey: "2026-W31",
    dataCutoff: "2026-07-31T17:00:00+08:00",
    dataLayer: "official",
    releaseVersion: "METRIC-2026-W31-V3",
    riskState: "all",
    selectedMetricId: "production.total-output",
  },
  selection: { type: "work-item", id: "PROD-W31-002" },
};
expect(
  readFormalLocation(writeFormalLocation(location), authorization),
).toEqual({
  location,
  issues: [],
});
```

- [ ] **Step 3: Run the tests and verify RED**

Run:

```bash
npx vitest run src/prototype/formalEnterpriseModel.spec.ts src/prototype/core/operationalScope.spec.ts src/prototype/core/businessClassification.spec.ts
npx tsc -p src/prototype/tsconfig.json --pretty false
```

Expected: FAIL because the new sections, `OperationalScope`, and type-safe constructor do not exist.

- [ ] **Step 4: Implement the route and scope contracts**

Use this exact section map and discriminated route shape:

```ts
export const formalSectionsByApplication = {
  work: ["tasks"],
  overview: ["operations", "risks", "duty", "releases"],
  production: ["tasks", "objects", "analysis"],
  market: ["tasks", "objects", "analysis"],
  supply: ["calculation", "comparison", "versions"],
  reporting: ["compose", "review-distribution", "ledger"],
} as const;

export type FormalApplication = keyof typeof formalSectionsByApplication;
export type SectionFor<A extends FormalApplication> =
  (typeof formalSectionsByApplication)[A][number];
export type FormalRoute = {
  [A in FormalApplication]: { application: A; section: SectionFor<A> };
}[FormalApplication];

export function createFormalRoute<A extends FormalApplication>(
  application: A,
  section: SectionFor<A>,
): Extract<FormalRoute, { application: A }> {
  return { application, section } as Extract<FormalRoute, { application: A }>;
}
```

Create one shared classification catalog; components and fixtures reference IDs from it rather than inventing subtype strings:

```ts
export type BusinessClassificationDomain =
  "production" | "market" | "supply" | "operations" | "reporting";

export interface BusinessClassification {
  id: (typeof requiredBusinessClassificationIds)[number];
  domain: BusinessClassificationDomain;
  label: string;
  productDimension: "none" | "crop" | "commodity" | "product-account";
  taskEnabled: boolean;
  analysisEnabled: boolean;
  reportEnabled: boolean;
}

export const requiredBusinessClassificationIds = [
  "production.planting-production",
  "production.cost-support",
  "production.farmer-stock-sales",
  "production.planting-intention",
  "production.quality-survey",
  "market.quote-trade",
  "market.quality",
  "market.inventory",
  "market.processing",
  "market.consumption-use",
  "market.sales",
  "market.logistics",
  "market.agricultural-input",
  "supply.supply",
  "supply.use-outflow",
  "supply.results",
  "supply.auxiliary",
  "operations.obligation-performance",
  "operations.data-quality",
  "reporting.production",
  "reporting.market",
  "reporting.supply",
  "reporting.cross-business",
  "reporting.duty",
] as const;
```

The catalog test proves each design-spec section-4 classification appears exactly once and is used as the option source by work items, executive filters, production/market analysis, supply analysis, and report compatibility fixtures. `operations.*` are explicit internal classifications for cross-domain coverage/on-time/quality indicators. The seven concrete supply product accounts remain in the separate Task 7 product-account catalog; they are not business subtypes. `businessComparisonCoverage` in Task 2 keys its rows to this catalog.

Define selection separately from filters:

```ts
export type FormalSelection = {
  type:
    | "work-item"
    | "object"
    | "document"
    | "exception"
    | "report"
    | "release-version";
  id: string;
};

export interface FormalLocation {
  route: FormalRoute;
  coordinates: BusinessCoordinates;
  selection?: FormalSelection;
  savedViewId?: string;
}
```

Define URL/business coordinates separately from runtime operational scope:

```ts
export interface BusinessCoordinates {
  regionId: string;
  regionLevel?: "city" | "county" | "township" | "village" | "custom";
  businessDomainId?: string;
  businessSubtypeId?: string;
  productId?: string;
  cultivarId?: string;
  periodKey?: string;
  dataCutoff?: string;
  dataLayer?: "preliminary" | "official";
  releaseVersion?: string;
  riskState?: "all" | "warning" | "blocking";
  selectedMetricId?: string;
}

export interface OperationalScope {
  workUnit: {
    organizationId: string;
    unitId: string;
    label: string;
  };
  identity: {
    userId: string;
    postId: string;
  };
  authorization: {
    authorizedRegionIds: readonly EnterpriseRegionId[];
    authorizedBusinessClassificationIds: readonly BusinessClassification["id"][];
    authorizedProductIds: readonly string[];
    authorizedCultivarIds: readonly string[];
    authorizedReleaseVersionIds: readonly string[];
    permissionKeys: readonly string[];
  };
  coordinates: BusinessCoordinates;
  savedView: {
    id: string;
    label: string;
    coordinates: BusinessCoordinates;
    columnIds: readonly string[];
    sort: readonly { field: string; direction: "asc" | "desc" }[];
  } | null;
}
```

Return parsing outcomes through:

```ts
export interface OperationalScopeIssue {
  code:
    | "unknown-or-unauthorized-region"
    | "unknown-or-unauthorized-business-subtype"
    | "unknown-or-unauthorized-product"
    | "unknown-or-unauthorized-cultivar"
    | "unknown-or-unauthorized-release-version"
    | "invalid-data-layer";
  value: string;
}

export interface OperationalScopeReadResult {
  scope: OperationalScope;
  issues: readonly OperationalScopeIssue[];
  queryAllowed: boolean;
}
```

Unknown or unauthorized scope values return an explicit issue, `queryAllowed: false`, and the visible `authorized-all` scope; they never become `qiqihar-all` and no workspace may query authorized-all data until the invalid coordinate is reset or corrected. Tests cover invalid region, subtype, product, cultivar, layer, and version on every application default route.

Create `src/prototype/tsconfig.json` so type-level route assertions are actually checked:

```json
{
  "extends": "../../tsconfig.app.json",
  "compilerOptions": {
    "composite": false,
    "noEmit": true
  },
  "include": ["./**/*.ts", "./**/*.tsx"]
}
```

- [ ] **Step 5: Write and verify failing location-hook tests**

The hook test must assert that `popstate` updates the rendered route/selection and that changing `regionId`, `productId`, and `periodKey` writes them to the URL while preserving `page`, `section`, and `variant=A`. Application/section/record navigation uses `pushState`; same-page filter and saved-view changes use `replaceState`. Back/Forward must restore route, selection, and filters.

Run:

```bash
npx vitest run src/prototype/useFormalEnterpriseLocation.spec.tsx
```

Expected: FAIL because the hook is absent.

- [ ] **Step 6: Implement shell orchestration and the launcher**

Move location ownership out of `FormalEnterprisePrototype` into `useFormalEnterpriseLocation()`. Extract the global frame, header, primary navigation, search slot, and workspace outlet into `EnterpriseShell`; it receives location/navigation callbacks and owns no business facts. Make the prototype pass page-owned scope props instead of a global region that silently follows the user between domains. Add an application-launcher dialog containing:

```ts
export const managementApplications = [
  {
    key: "governance",
    label: "数据治理",
    description: "主数据、指标、公式、可比规则、质量与血缘",
    permission: "治理管理员",
  },
  {
    key: "system",
    label: "系统管理",
    description: "组织、岗位、权限、接入、运行配置与审计",
    permission: "系统管理员",
  },
] as const;
```

The launcher is read-only for these two entries and says “当前原型仅展示架构入口”. Replace `BusinessContextBar` on non-action pages with a `WorkspaceScopeBar` that has no generic responsibility status.

- [ ] **Step 7: Run the focused shell tests GREEN**

Run:

```bash
npx vitest run src/prototype/formalEnterpriseModel.spec.ts src/prototype/core/operationalScope.spec.ts src/prototype/core/businessClassification.spec.ts src/prototype/useFormalEnterpriseLocation.spec.tsx src/prototype/EnterpriseShell.spec.tsx src/prototype/EnterpriseApplicationLauncher.spec.tsx src/prototype/FormalEnterprisePrototype.spec.tsx src/prototype/enterpriseRegions.spec.ts src/prototype/UnifiedWorkspacePrimitives.spec.tsx
npx tsc -p src/prototype/tsconfig.json --pretty false
```

Expected: all listed test files pass. Verify the old five-section production/market assertions and the old implicit cross-application region assertion have been replaced, not merely deleted.

- [ ] **Step 8: Verify isolation and commit Task 1**

Compare the external SHA-256 manifest with its baseline. Then run:

```bash
git add src/prototype/core/operationalScope.ts src/prototype/core/operationalScope.spec.ts src/prototype/core/businessClassification.ts src/prototype/core/businessClassification.spec.ts src/prototype/useFormalEnterpriseLocation.ts src/prototype/useFormalEnterpriseLocation.spec.tsx src/prototype/EnterpriseShell.tsx src/prototype/EnterpriseShell.spec.tsx src/prototype/EnterpriseApplicationLauncher.tsx src/prototype/EnterpriseApplicationLauncher.spec.tsx src/prototype/tsconfig.json src/prototype/formalEnterpriseModel.ts src/prototype/formalEnterpriseModel.spec.ts src/prototype/formalEnterpriseData.ts src/prototype/FormalEnterprisePrototype.tsx src/prototype/FormalEnterprisePrototype.spec.tsx src/prototype/MyWorkWorkspace.tsx src/prototype/ExecutiveOverviewWorkspace.tsx src/prototype/ProductionMonitoringWorkspace.tsx src/prototype/MarketMonitoringWorkspace.tsx src/prototype/SupplyDemandWorkspace.tsx src/prototype/ReportCenterWorkspace.tsx src/prototype/enterpriseRegions.ts src/prototype/enterpriseRegions.spec.ts src/prototype/UnifiedWorkspacePrimitives.tsx src/prototype/UnifiedWorkspacePrimitives.spec.tsx
git diff --cached --check
git commit -m "feat: establish stable enterprise prototype navigation"
```

Expected: the commit contains only the listed `src/prototype` files.

---

### Task 2: Fixed-Point Metric Catalog and Four-Year Comparison Engine

**Files:**

- Create: `src/prototype/core/fixedDecimal.ts`
- Create: `src/prototype/core/fixedDecimal.spec.ts`
- Create: `src/prototype/core/metricCatalog.ts`
- Create: `src/prototype/core/metricCatalog.spec.ts`
- Create: `src/prototype/core/comparableSeries.ts`
- Create: `src/prototype/core/comparableSeries.spec.ts`
- Create: `src/prototype/core/metricComparisonViewModel.ts`
- Create: `src/prototype/core/metricComparisonViewModel.spec.ts`
- Create: `src/prototype/data/enterpriseMetricFixtures.ts`
- Create: `src/prototype/data/enterpriseMetricFixtures.spec.ts`
- Create: `src/prototype/data/businessComparisonCoverage.ts`
- Create: `src/prototype/data/businessComparisonCoverage.spec.ts`
- Create: `src/prototype/prototypeFieldMap.ts`
- Create: `src/prototype/prototypeFieldPreservation.spec.ts`

**Interfaces:**

- Consumes: `OperationalScope` from Task 1.
- Produces: `FixedDecimal`, `MetricDefinition`, `PublishedMetricPoint`, `ComparisonPair`, `ComparisonSet`, `MetricComparisonViewModel`, and `queryPrototypeMetricComparisons()`.
- Consumed by: annual comparison components, executive ledger, production/market analysis, supply comparison, and report preview.

- [ ] **Step 1: Write failing exact-decimal tests**

Use exact public behavior:

```ts
expect(
  addFixedDecimal(fixedDecimal("9007199254740993.00"), fixedDecimal("0.01")),
).toBe("9007199254740993.01");
expect(roundHalfUp(fixedDecimal("1.005"), 2)).toBe("1.01");
expect(roundHalfUp(fixedDecimal("-1.005"), 2)).toBe("-1.01");
expect(() => fixedDecimal("1e3")).toThrow("十进制格式无效");
expect(() => percentageChange(fixedDecimal("1"), fixedDecimal("0"), 1)).toThrow(
  "基期不能为零",
);
```

- [ ] **Step 2: Run the decimal test and verify RED**

Run:

```bash
npx vitest run src/prototype/core/fixedDecimal.spec.ts
```

Expected: FAIL because `core/fixedDecimal.ts` does not exist.

- [ ] **Step 3: Implement the fixed-decimal API**

Export exactly:

```ts
export type FixedDecimal = string & {
  readonly __fixedDecimal: unique symbol;
};

export function fixedDecimal(input: string): FixedDecimal;
export function addFixedDecimal(
  left: FixedDecimal,
  right: FixedDecimal,
): FixedDecimal;
export function subtractFixedDecimal(
  left: FixedDecimal,
  right: FixedDecimal,
): FixedDecimal;
export function compareFixedDecimal(
  left: FixedDecimal,
  right: FixedDecimal,
): -1 | 0 | 1;
export function absFixedDecimal(value: FixedDecimal): FixedDecimal;
export function roundHalfUp(
  value: FixedDecimal,
  displayScale: number,
): FixedDecimal;
export function formatFixedDecimal(
  value: FixedDecimal,
  displayScale: number,
): string;
export function percentageChange(
  current: FixedDecimal,
  baseline: FixedDecimal,
  displayScale: number,
): FixedDecimal;
export function cagrPercent(
  current: FixedDecimal,
  baseline: FixedDecimal,
  years: number,
  displayScale: number,
): FixedDecimal;
```

Parse strings into `{ coefficient: bigint; scale: number }`; `FixedDecimal` is always a canonical numeric value with trailing zeros removed. Only `formatFixedDecimal()` adds display-scale zeros. Reject scientific notation, `NaN`, infinities, empty strings, and division by zero. `ROUND_HALF_UP` moves exact half values away from zero.

For CAGR, accept only positive current/baseline values and a positive integer year count. Compute the decimal nth root with scaled-integer iteration and at least `displayScale + 8` guard digits, then apply one final `ROUND_HALF_UP`; never convert the authoritative values to `number`. Tests include a non-perfect cube, an endpoint beyond `Number.MAX_SAFE_INTEGER`, and a result whose final retained digit is a half-up boundary.

- [ ] **Step 4: Run the decimal test GREEN**

Run:

```bash
npx vitest run src/prototype/core/fixedDecimal.spec.ts
```

Expected: all decimal tests pass.

- [ ] **Step 5: Write failing catalog and comparison tests**

Define the wished-for model with these required fields:

```ts
export interface MetricDefinition {
  metricId: string;
  label: string;
  domain: "production" | "market" | "supply" | "operations";
  businessSubtype: BusinessClassification["id"];
  measureType:
    | "quantity"
    | "amount"
    | "price"
    | "ratio"
    | "percentage"
    | "signed-difference";
  formula: string;
  unit: string;
  aggregation:
    | "sum"
    | "weighted-average"
    | "median"
    | "ratio-of-aggregates"
    | "ending-balance"
    | "rule-derived";
  definitionVersionId: string;
  displayScale: number;
  trendDirection:
    "higher-is-better" | "lower-is-better" | "neutral" | "rule-derived";
  comparisonPolicy: {
    relativeChange: "allowed" | "absolute-only" | "percentage-points";
    cagr: "allowed" | "not-applicable";
    comparabilityRuleVersionId: string;
  };
  anomalyRuleVersionId: string;
}
```

Use this complete coordinate and comparison contract; a displayed value without these coordinates is not a comparable metric point:

```ts
export interface RequestedMetricCoordinate {
  metricId: string;
  regionId: string;
  regionBoundaryVersionId: string;
  cropId: string | null;
  commodityId: string | null;
  productFormId: string | null;
  productAccountId: string | null;
  cultivarId: string | null;
  qualityConditionId: string | null;
  priceConditionId: string | null;
  deliveryConditionId: string | null;
  populationOrSampleId: string;
  unitDefinitionVersionId: string;
  inventoryNatureId: string | null;
  statisticalMomentId: string;
  consolidationMatrixVersionId: string | null;
  domainDimensions:
    | {
        domain: "production";
        areaBasisId: string;
        yieldMethodId: string | null;
        growthStageId: string | null;
        surveyRoundId: string | null;
        costAllocationRuleId: string | null;
      }
    | {
        domain: "market";
        statisticId: string;
        currency: string | null;
        taxTreatmentId: string | null;
        packagingConditionId: string | null;
        settlementConditionId: string | null;
        logisticsRouteId: string | null;
        processingConversionBasisId: string | null;
      }
    | {
        domain: "supply";
        accountStandardVersionId: string;
        consolidationScopeId: string;
        ruleComparabilityVersionId: string;
        marketingYearStageKey: string;
      }
    | {
        domain: "operations";
        obligationSetVersionId: string;
        eligiblePopulationId: string;
      };
  period: {
    year: number;
    granularity: "year" | "marketing-year" | "month" | "week";
    periodKey: string;
    samePeriodKey: string;
    cutoff: string;
  };
  dataLayer: "preliminary" | "official";
}

export interface ReleasedMetricCoordinate extends RequestedMetricCoordinate {
  inputReleaseVersionIds: readonly string[];
  metricReleaseVersionId: string;
  releaseLineage:
    | {
        kind: "standard-metric";
      }
    | {
        kind: "supply-result";
        supplyAccountVersionId: string;
        ruleVersionId: string;
        resultReleaseVersionId: string;
      };
}

export type PublishedMetricPoint =
  | {
      availability: "available";
      coordinate: ReleasedMetricCoordinate;
      value: FixedDecimal;
      unit: string;
      coverageRate: FixedDecimal;
      qualityStatus: "passed" | "warning";
      definitionVersionId: string;
      conversionVersionId: string | null;
    }
  | {
      availability:
        | "missing"
        | "not-collected"
        | "not-applicable"
        | "no-release"
        | "rejected"
        | "pending-review";
      coordinate: RequestedMetricCoordinate;
      releaseAttempt: {
        inputReleaseVersionIds: readonly string[];
        metricReleaseVersionId: string | null;
      } | null;
      value: null;
      unit: string;
      coverageRate: FixedDecimal | null;
      qualityStatus: "warning" | "blocking";
      definitionVersionId: string;
      conversionVersionId: string | null;
      reason: string;
    };

export interface ApprovedMetricBridge {
  metricId: string;
  fromDefinitionVersionId: string;
  toDefinitionVersionId: string;
  conversionVersionId: string;
}

export interface ComparisonPair {
  fromYear: number;
  toYear: number;
  kind: "year-over-year" | "current-vs-baseline";
  label: string;
  comparable: boolean;
  absoluteDelta: FixedDecimal | null;
  relativeRate: FixedDecimal | null;
  percentagePointDelta: FixedDecimal | null;
  reason: string | null;
  formula: string | null;
}

export interface ComparisonSet {
  metricId: string;
  points: readonly [
    PublishedMetricPoint,
    PublishedMetricPoint,
    PublishedMetricPoint,
    PublishedMetricPoint,
  ];
  pairs: readonly [ComparisonPair, ComparisonPair, ComparisonPair];
  currentVsBaselines: readonly ComparisonPair[];
  cagr:
    | { status: "available"; rate: FixedDecimal; formula: string }
    | { status: "unavailable"; reason: string };
  trend: {
    direction: "rising" | "falling" | "flat" | "mixed" | "insufficient";
    continuity: "continuous" | "broken";
    breakYears: readonly number[];
    anomalies: readonly string[];
  };
}

export function buildComparisonSet(input: {
  definition: MetricDefinition;
  currentYear: number;
  points: ComparisonSet["points"];
  approvedBridges: readonly ApprovedMetricBridge[];
}): ComparisonSet;

export interface MetricComparisonQuery {
  scope: OperationalScope;
  domain: MetricDefinition["domain"];
  businessSubtype?: BusinessClassification["id"];
  currentYear: number;
}

export type MetricComparisonQueryResult =
  | {
      status: "ready";
      definition: MetricDefinition;
      comparison: ComparisonSet;
    }
  | { status: "no-release"; metricId: string; reason: string };

export function queryPrototypeMetricComparisons(
  query: MetricComparisonQuery,
): readonly MetricComparisonQueryResult[];
```

Tests must prove:

```ts
expect(comparison.pairs.map((pair) => pair.relativeRate)).toEqual([
  fixedDecimal("10.0"),
  fixedDecimal("10.0"),
  fixedDecimal("10.0"),
]);
expect(comparison.cagr).toEqual({
  status: "available",
  rate: fixedDecimal("10.0"),
  formula: "(133.1 / 100)^(1/3) - 1",
});
```

Also add separate tests for percentage-point change, zero baseline, negative baseline, signed difference, Y-2 missing while Y/Y-1 remains valid, and non-consecutive CAGR. Add one focused test for each comparability dimension: region boundary version, product/form/cultivar, quality condition, price condition, delivery condition, population/sample, inventory nature, statistical moment, consolidation matrix, same-period/business-day key, data layer, metric definition, unit conversion, approved definition bridge, and each domain-specific coordinate branch (production area/yield/growth-stage/survey-round/cost basis, market statistic/currency/tax/package/settlement/route/processing-conversion basis, supply account-standard/consolidation-scope/rule-comparability/marketing-year-stage, operations obligation/population). A coverage-rate change adds a visible risk/anomaly but does not automatically make the numeric pair incomparable.

Release IDs and literal cutoff timestamps are lineage-only, not cross-year equality keys. Each point must cite valid input/metric release IDs, but 2023–2026 normally use different IDs and remain comparable. Likewise, compare cutoff through `samePeriodKey` or the governed equivalent business-day key, not identical timestamps. Add explicit tests proving different annual release/account/result IDs remain comparable and a mismatched same-period key does not. For supply, compare `accountStandardVersionId + consolidationScopeId + ruleComparabilityVersionId + marketingYearStageKey`; `supplyAccountVersionId`, `ruleVersionId`, and `resultReleaseVersionId` only prove lineage.

Assert naming semantics exactly: only the adjacent Y/Y-1 pair may use “当前同比”; `currentVsBaselines` items use “较 2023 年变化” or “较 2024 年变化” and never the word “同比”.

- [ ] **Step 6: Run comparison tests and verify RED**

Run:

```bash
npx vitest run src/prototype/core/metricCatalog.spec.ts src/prototype/core/comparableSeries.spec.ts
```

Expected: FAIL because the catalog and comparison engine do not exist.

- [ ] **Step 7: Implement per-point and per-pair comparability**

Implement the declared `PublishedMetricPoint` union without collapsing `missing`, `not-collected`, `not-applicable`, `no-release`, `rejected`, `pending-review`, or literal zero. `ComparisonSet` contains exactly four points, three adjacent `pairs`, direct `currentVsBaselines`, an available/unavailable CAGR result, and trend continuity with `breakYears`.

For every pair:

```ts
absoluteDelta = current - previous;
relativeRate = (absoluteDelta / previous) * 100;
percentagePointDelta = current - previous;
```

Only execute the formula selected by `comparisonPolicy`. A bad point invalidates only pairs that include that point. Attach a Chinese `reason` to every unavailable result.

CAGR is available only when all four years are consecutive, all three adjacent pairs are comparable under the same approved bridge chain, and both endpoints are positive. Otherwise return the exact governed reason; never compute through a broken middle pair.

- [ ] **Step 8: Write and verify failing fixture/catalog coverage tests**

The typed fixture test must assert this minimum seed set; it is not the final or exhaustive enterprise indicator range:

```ts
const requiredMetricIds = [
  "production.planted-area",
  "production.harvested-area",
  "production.unharvested-area",
  "production.regional-yield",
  "production.total-output",
  "production.cost-per-area",
  "production.farmer-stock",
  "production.sales-volume",
  "production.sales-price",
  "production.intended-area",
  "market.purchase-price",
  "market.trade-volume",
  "market.inventory",
  "market.sales-volume",
  "market.processing-input",
  "market.processing-output",
  "market.byproduct-output",
  "market.processing-loss",
  "market.operating-rate",
  "market.direct-use",
  "market.inflow",
  "market.outflow",
  "market.freight-rate",
  "market.agri-input-price",
  "market.agri-input-sales",
  "supply.total-supply",
  "supply.total-use",
  "supply.adopted-ending",
  "supply.survey-ending",
  "supply.inventory-difference",
  "operations.coverage-rate",
  "operations.on-time-rate",
  "operations.quality-block-rate",
] as const;
```

Build `businessComparisonCoverage.ts` as a matrix over every business classification in design-spec section 4. Every classification and comparable field— including disaster/affected/total-loss area, quality items, cost components, subsidy, insurance, stock inflow/outflow/loss, market quality, processing, logistics, and agricultural inputs—must map to one or more `metricId` values or an explicit governed `notComparableReason`. The seed list above is only the cross-domain minimum.

Assert `production.regional-yield.aggregation === "ratio-of-aggregates"`, every price definition states its statistic, and every comparable definition has explicit Y-3 through Y points or explicit missing states. Task 2 registers supply metric definitions but returns `no-release` for supply values; Task 7 alone projects immutable `SupplyAccountRelease` results into supply metric points, preventing a second supply-data truth.

Run:

```bash
npx vitest run src/prototype/data/enterpriseMetricFixtures.spec.ts src/prototype/data/businessComparisonCoverage.spec.ts
```

Expected: FAIL before fixtures exist, then PASS after the typed catalog and four-year points are added.

- [ ] **Step 9: Write failing view-model and migration-map tests**

Export:

```ts
export interface MetricComparisonViewModel {
  metricId: string;
  metricLabel: string;
  unit: string;
  currentValue: string;
  currentChangeText: string;
  yearCells: readonly {
    year: number;
    valueText: string;
    availabilityLabel: string;
    releaseVersionLabel: string;
  }[];
  pairCells: readonly {
    label: string;
    changeText: string;
    state: "comparable" | "not-comparable";
    reason: string | null;
  }[];
  cagrText: string;
  comparabilityText: string;
  levelSeries: readonly {
    year: number;
    rawValue: FixedDecimal | null;
    valueText: string;
  }[];
  annualChangeSeries: readonly {
    label: string;
    changeKind: "relative-rate" | "percentage-point" | "absolute-delta";
    rawChange: FixedDecimal | null;
    changeText: string;
    reason: string | null;
  }[];
}
```

The view-model test requires canonical numeric values plus `formatFixedDecimal()` display strings, explicit unavailable labels, release/version labels, and unchanged comparison reasons. The migration-map test requires every row from design-spec section 15, including task IDs/field counts, sample average versus weighted estimate, cultivar mapping state, region-ledger coverage, logistics monitoring content, supply source versions, and report `publishedAt`.

Run:

```bash
npx vitest run src/prototype/core/metricComparisonViewModel.spec.ts src/prototype/prototypeFieldPreservation.spec.ts
```

Expected: FAIL because the view model and explicit migration map do not exist.

- [ ] **Step 10: Implement the view model and mechanical migration map**

Build `prototypeFieldMap.ts` as an explicit array of `{ legacySource, legacyField, targetModel, targetPage }`. At this stage `prototypeFieldPreservation.spec.ts` proves the migration contract and metric legacy-field mappings only; it does not claim that Tasks 4–8 pages are already reachable. Each later domain task adds its own failing UI reachability assertions before migrating fields, and Task 9 adds the cross-application reachability audit.

- [ ] **Step 11: Run Task 2 tests GREEN and commit**

Run:

```bash
npx vitest run src/prototype/core/fixedDecimal.spec.ts src/prototype/core/metricCatalog.spec.ts src/prototype/core/comparableSeries.spec.ts src/prototype/core/metricComparisonViewModel.spec.ts src/prototype/data/enterpriseMetricFixtures.spec.ts src/prototype/data/businessComparisonCoverage.spec.ts src/prototype/prototypeFieldPreservation.spec.ts
npx tsc -p src/prototype/tsconfig.json --pretty false
```

Then compare the external baseline and commit only Task 2 files:

```bash
git add src/prototype/core/fixedDecimal.ts src/prototype/core/fixedDecimal.spec.ts src/prototype/core/metricCatalog.ts src/prototype/core/metricCatalog.spec.ts src/prototype/core/comparableSeries.ts src/prototype/core/comparableSeries.spec.ts src/prototype/core/metricComparisonViewModel.ts src/prototype/core/metricComparisonViewModel.spec.ts src/prototype/data/enterpriseMetricFixtures.ts src/prototype/data/enterpriseMetricFixtures.spec.ts src/prototype/data/businessComparisonCoverage.ts src/prototype/data/businessComparisonCoverage.spec.ts src/prototype/prototypeFieldMap.ts src/prototype/prototypeFieldPreservation.spec.ts
git diff --cached --check
git commit -m "feat: add comparable enterprise metric series"
```

---

### Task 3: Annual Comparison Track and Accessible Analytical Charts

**Files:**

- Create: `src/prototype/components/AnnualComparisonTrack.tsx`
- Create: `src/prototype/components/AnnualComparisonTrack.spec.tsx`
- Create: `src/prototype/components/ComparisonCharts.tsx`
- Create: `src/prototype/components/ComparisonCharts.spec.tsx`
- Modify: `src/prototype/unified-workspaces.css`

**Interfaces:**

- Consumes: `MetricComparisonViewModel` from Task 2.
- Produces: `AnnualComparisonTrack`, `ComparisonCharts`, and the `enterprise-comparison-*` CSS namespace.
- Consumed by: executive, production, market, supply, and report workspaces.

- [ ] **Step 1: Write failing component tests**

Render a four-year area model and assert:

```ts
expect(screen.getByRole("button", { name: /种植面积四年比较/ })).toBeVisible();
expect(screen.getByText("2023")).toBeVisible();
expect(screen.getByText("2026")).toBeVisible();
expect(screen.getByText("2026/2025同比 +2.8%")).toBeVisible();
expect(screen.getByText("指标版本 M-AREA-V4")).toBeVisible();
```

Render a broken series and assert the visible text “2024 与 2023 口径不可比：行政区划边界版本不同”. For charts, assert an SVG named “种植面积四年数值趋势”、an SVG named “种植面积三段年度同比”, and an equivalent accessible table containing all plotted values.

- [ ] **Step 2: Run the component tests and verify RED**

Run:

```bash
npx vitest run src/prototype/components/AnnualComparisonTrack.spec.tsx src/prototype/components/ComparisonCharts.spec.tsx
npx tsc -p src/prototype/tsconfig.json --pretty false
```

Expected: FAIL because both components are absent.

- [ ] **Step 3: Implement the comparison track**

Use this public contract:

```ts
export interface AnnualComparisonTrackProps {
  model: MetricComparisonViewModel;
  selected: boolean;
  onSelect: (metricId: string) => void;
}

export function AnnualComparisonTrack(
  props: AnnualComparisonTrackProps,
): JSX.Element;
```

Render one semantic button containing four year cells in chronological order, three adjacent comparison cells, current value, CAGR, version, and a visible comparability label. A missing value prints its availability label; it never prints `0`. Use `aria-pressed` for selection.

- [ ] **Step 4: Implement charts without a new dependency**

`ComparisonCharts` renders two SVGs and one visually compact but screen-reader-accessible data table. Calculate SVG `x`, `y`, and bar height from the view model's canonical `rawValue`/`rawChange` only inside a bounded geometry helper; never recompute business deltas. The second chart labels each bar as relative rate, percentage-point change, or absolute delta according to `changeKind`, includes a zero axis, and uses `title`/`desc` plus visible labels.

The series palette is fixed:

```ts
export const comparisonYearColors = {
  previous3: "#C6D1D3",
  previous2: "#91AAA9",
  previous1: "#4D8D87",
  current: "#1E625F",
} as const;
```

Risk colors come from the anomaly state, not from whether a value increased.

- [ ] **Step 5: Add component states and responsive CSS**

Under `.enterprise-comparison-*`, define default, hover, `:focus-visible`, selected, missing, not-comparable, and error states. At widths below 1120px, keep metric identity fixed and allow the year rail to scroll horizontally. At 1024px, chart panels stack vertically. Gold and light teal are strokes/fills only; foreground text uses `#6B4B00` or `#205F5B`.

- [ ] **Step 6: Run Task 3 tests GREEN and commit**

Run:

```bash
npx vitest run src/prototype/components/AnnualComparisonTrack.spec.tsx src/prototype/components/ComparisonCharts.spec.tsx
npx tsc -p src/prototype/tsconfig.json --pretty false
```

Then compare the external baseline and commit:

```bash
git add src/prototype/components/AnnualComparisonTrack.tsx src/prototype/components/AnnualComparisonTrack.spec.tsx src/prototype/components/ComparisonCharts.tsx src/prototype/components/ComparisonCharts.spec.tsx src/prototype/unified-workspaces.css
git diff --cached --check
git commit -m "feat: add four-year enterprise comparison visuals"
```

---

### Task 4: Filterable Executive Ledger Instead of a Card Wall

**Files:**

- Create: `src/prototype/core/executiveLedger.ts`
- Create: `src/prototype/core/executiveLedger.spec.ts`
- Create: `src/prototype/data/executiveLedgerFixtures.ts`
- Modify: `src/prototype/ExecutiveOverviewWorkspace.tsx`
- Modify: `src/prototype/PortalWorkspaces.spec.tsx`
- Modify: `src/prototype/FormalEnterprisePrototype.spec.tsx`
- Modify: `src/prototype/unified-workspaces.css`

**Interfaces:**

- Core consumes: `OperationalScope`, metric fixtures, and `ComparisonSet`; it has no React or component import.
- `ExecutiveOverviewWorkspace` consumes the core result plus `AnnualComparisonTrack` and `ComparisonCharts`.
- Produces: `ExecutiveLedgerQuery`, `ExecutiveLedgerResult`, and four distinct overview views.
- Consumed by: only the overview UI; it remains a read model and never mutates facts.

- [ ] **Step 1: Write failing ledger-model tests**

Use this query contract:

```ts
export interface ExecutiveLedgerQuery {
  view: "operations" | "risks" | "duty" | "releases";
  regionId: string;
  domain:
    "all" | "production" | "market" | "supply" | "operations" | "reporting";
  businessSubtype: BusinessClassification["id"] | null;
  productId: string | null;
  cultivarId: string | null;
  periodKey: string;
  dataLayer: "preliminary" | "official";
  releaseVersion: string | null;
  riskState: "all" | "warning" | "blocking";
}
```

Assert that the default query uses `regionId: "authorized-all"`, returns production, market, supply, and operations metrics, and does not silently filter to Qiqihar. Assert that `risks`, `duty`, and `releases` return different row shapes and identifiers; filtering releases by `domain: "reporting"` returns report publication/replacement rows rather than an empty or supply-only ledger.

- [ ] **Step 2: Run model tests and verify RED**

Run:

```bash
npx vitest run src/prototype/core/executiveLedger.spec.ts
```

Expected: FAIL because the read model is absent.

- [ ] **Step 3: Implement the executive read model**

Return a discriminated result:

```ts
export type ExecutiveLedgerResult =
  | { view: "operations"; metrics: readonly MetricComparisonViewModel[] }
  | { view: "risks"; risks: readonly ExecutiveRiskRow[] }
  | { view: "duty"; duties: readonly ExecutiveDutyRow[] }
  | { view: "releases"; releases: readonly ExecutiveReleaseRow[] };
```

Keep risk, duty, and release fixture values in `data/executiveLedgerFixtures.ts`. Include source version, cutoff, coverage, and drill-down target on every row.

- [ ] **Step 4: Replace old overview expectations with failing approved behavior**

The component test must assert:

```ts
expect(screen.getByRole("combobox", { name: "业务地区" })).toHaveValue(
  "authorized-all",
);
expect(screen.getByRole("tab", { name: "经营态势" })).toBeVisible();
expect(screen.getByRole("tab", { name: "异常风险" })).toBeVisible();
expect(screen.getByRole("tab", { name: "履责监督" })).toBeVisible();
expect(screen.getByRole("tab", { name: "发布成果" })).toBeVisible();
expect(screen.getByRole("table", { name: "经营指标趋势台账" })).toBeVisible();
expect(screen.queryByLabelText("经营核心摘要")).not.toBeInTheDocument();
expect(document.querySelectorAll(".workspace-inline-stats")).toHaveLength(0);
```

Select one metric and assert both comparison charts and a source/version drawer appear. Change domain and region filters and assert rows change.

- [ ] **Step 5: Run UI tests and verify RED**

Run:

```bash
npx vitest run src/prototype/PortalWorkspaces.spec.tsx src/prototype/FormalEnterprisePrototype.spec.tsx
```

Expected: FAIL against the old hard-coded cards and status strip.

- [ ] **Step 6: Implement the ledger-first overview**

Build the page in this order: title/action row, explicit business coordinate filters, view tabs, view-specific ledger, selected-metric charts, then definition/coverage/version detail. Do not show a generic responsibility status bar. Preserve existing risk fields `风险事项/所属业务/地区/影响/当前状态` in the risk ledger.

- [ ] **Step 7: Run Task 4 tests GREEN and commit**

Run:

```bash
npx vitest run src/prototype/core/executiveLedger.spec.ts src/prototype/PortalWorkspaces.spec.tsx src/prototype/FormalEnterprisePrototype.spec.tsx
npx tsc -p src/prototype/tsconfig.json --pretty false
```

Then compare the external baseline and commit:

```bash
git add src/prototype/core/executiveLedger.ts src/prototype/core/executiveLedger.spec.ts src/prototype/data/executiveLedgerFixtures.ts src/prototype/ExecutiveOverviewWorkspace.tsx src/prototype/PortalWorkspaces.spec.tsx src/prototype/FormalEnterprisePrototype.spec.tsx src/prototype/unified-workspaces.css
git diff --cached --check
git commit -m "feat: replace overview cards with an executive ledger"
```

---

### Task 5: Production Tasks, Object Registry, Documents, and Analysis

**Files:**

- Create: `src/prototype/core/businessWork.ts`
- Create: `src/prototype/core/businessWork.spec.ts`
- Create: `src/prototype/core/monitoringRegistry.ts`
- Create: `src/prototype/core/monitoringRegistry.spec.ts`
- Create: `src/prototype/data/businessWorkFixtures.ts`
- Create: `src/prototype/data/monitoringRegistryFixtures.ts`
- Create: `src/prototype/data/productionDocumentFixtures.ts`
- Create: `src/prototype/data/productionDocumentFixtures.spec.ts`
- Create: `src/prototype/application/businessWorkProjection.ts`
- Create: `src/prototype/application/businessWorkProjection.spec.ts`
- Create: `src/prototype/production/ProductionTaskWorkspace.tsx`
- Create: `src/prototype/production/ProductionObjectRegistry.tsx`
- Create: `src/prototype/production/ProductionAnalysisWorkspace.tsx`
- Create: `src/prototype/production/ProductionDocumentWorkbench.tsx`
- Modify: `src/prototype/ProductionMonitoringWorkspace.tsx`
- Modify: `src/prototype/ProductionMonitoringWorkspace.spec.tsx`
- Modify: `src/prototype/productionMonitoringModel.ts`
- Modify: `src/prototype/productionMonitoringData.ts`
- Modify: `src/prototype/MyWorkWorkspace.tsx`
- Modify: `src/prototype/PortalWorkspaces.spec.tsx`
- Modify: `src/prototype/prototypeFieldMap.ts`
- Modify: `src/prototype/prototypeFieldPreservation.spec.ts`
- Modify: `src/prototype/market-monitoring.css`
- Modify: `src/prototype/unified-workspaces.css`

**Interfaces:**

- Consumes: Task 1 routes/scope and Task 2/3 comparison models/components.
- Produces: one `BusinessWorkItem` source used by My Work and production/market task projections; one `MonitoringObject` registry used across periods.
- Consumed by: Task 6 market workspaces, Task 9 search, and field-preservation tests.

- [ ] **Step 1: Write failing core-model tests**

Use these exact state dimensions and stable identities:

```ts
export interface BusinessWorkItem {
  workId: string;
  title: string;
  domain: "production" | "market" | "supply" | "reporting";
  businessSubtypeId: BusinessClassification["id"];
  businessLabel: string;
  subject:
    | {
        kind: "monitoring-object";
        objectId: string;
        objectName: string;
        objectTypeId: string;
      }
    | {
        kind: "supply-account";
        productAccountId: string;
        accountVersionId: string;
        accountLabel: string;
      }
    | {
        kind: "report-run";
        runId: string;
        reportTypeId: string;
        reportLabel: string;
      };
  regionId: string;
  regionLabel: string;
  productId: string | null;
  cultivarIds: readonly string[];
  periodKey: string;
  deadline: string;
  responsibleUserId: string;
  responsiblePerson: string;
  responsiblePost: string;
  dutyLabel: string;
  reviewer: string;
  responsibilityId: string;
  frequency: string;
  deadlineRule: string;
  effectivePeriod: string;
  obligationStatus:
    | "not-due"
    | "in-progress"
    | "on-time"
    | "overdue-completed"
    | "missed"
    | "exempt";
  documentStatus: "draft" | "submitted" | "returned" | "corrected";
  reviewStatus: "pending" | "reviewing" | "approved" | "returned";
  qualityStatus: "passed" | "warning" | "blocking" | "awaiting-explanation";
  releaseStatus: "unreleased" | "pending" | "published" | "superseded";
  completedFields: number;
  applicableFields: number;
  collectionModes: readonly ("online" | "excel" | "system")[];
  fieldGroupIds: readonly string[];
  inputVersionState: "current" | "stale";
  qualityGovernance: {
    ruleVersionId: string;
    warningPublicationPolicy: "block" | "allow-approved-explanation";
    approvedExplanationVersionIds: readonly string[];
  };
  obligationHistory: readonly WorkObligationEvent[];
  submissionHistory: readonly SubmissionVersion[];
  reviewHistory: readonly WorkReviewEvent[];
  qualityHistory: readonly WorkQualityEvent[];
  releaseHistory: readonly WorkReleaseEvent[];
}

export interface SubmissionVersion {
  submissionVersionId: string;
  submittedBy: string;
  submittedAt: string;
  kind: "initial" | "corrected";
  replacesSubmissionVersionId: string | null;
}

export interface WorkObligationEvent {
  obligationEventId: string;
  action: "started" | "deadline-missed" | "completed" | "exempted";
  actor: string;
  at: string;
  reason: string | null;
}

export interface WorkReviewEvent {
  reviewEventId: string;
  submissionVersionId: string;
  action: "claimed" | "approved" | "returned";
  reviewer: string;
  at: string;
  reason: string | null;
}

export interface WorkQualityEvent {
  qualityEventId: string;
  action:
    | "rules-executed"
    | "explanation-submitted"
    | "explanation-approved"
    | "explanation-returned";
  ruleVersionId: string;
  result: BusinessWorkItem["qualityStatus"];
  actor: string;
  actorRoleId: string;
  at: string;
  explanationVersionId: string | null;
}

export interface WorkReleaseEvent {
  releaseEventId: string;
  action: "requested" | "published" | "replaced";
  releaseVersionId: string;
  actor: string;
  at: string;
  replacesReleaseVersionId: string | null;
}

export type BusinessWorkActorRoleId =
  | "responsible"
  | "authorized-admin"
  | "reviewer"
  | "quality-reviewer"
  | "publisher"
  | "system";

export interface BusinessWorkTransitionContext {
  actor: string;
  roleIds: readonly BusinessWorkActorRoleId[];
  permissionKeys: readonly string[];
  now: string;
}

export type BusinessWorkCommand =
  | {
      type: "start-obligation";
      event: WorkObligationEvent;
    }
  | {
      type: "mark-deadline-missed";
      event: WorkObligationEvent;
    }
  | {
      type: "complete-obligation";
      event: WorkObligationEvent;
    }
  | {
      type: "exempt-obligation";
      event: WorkObligationEvent;
    }
  | { type: "submit-document"; version: SubmissionVersion }
  | { type: "correct-document"; version: SubmissionVersion }
  | { type: "claim-review"; event: WorkReviewEvent }
  | { type: "approve-review"; event: WorkReviewEvent }
  | { type: "return-review"; event: WorkReviewEvent }
  | { type: "run-quality-rules"; event: WorkQualityEvent }
  | { type: "submit-quality-explanation"; event: WorkQualityEvent }
  | { type: "review-quality-explanation"; event: WorkQualityEvent }
  | { type: "request-release"; event: WorkReleaseEvent }
  | { type: "publish"; event: WorkReleaseEvent }
  | { type: "replace-release"; event: WorkReleaseEvent }
  | { type: "mark-input-stale"; at: string };

export type BusinessWorkTransitionResult =
  | { status: "applied"; item: BusinessWorkItem }
  | { status: "rejected"; item: BusinessWorkItem; reason: string };

export function transitionBusinessWork(
  item: BusinessWorkItem,
  command: BusinessWorkCommand,
  context: BusinessWorkTransitionContext,
): BusinessWorkTransitionResult;
```

Keep navigation and action copy out of the core item. Define them in `application/businessWorkProjection.ts`:

```ts
export interface BusinessWorkProjection {
  item: BusinessWorkItem;
  destination: {
    route: FormalRoute;
    selection: FormalSelection;
  };
  actionLabel: string;
  savedViewGroup: "待填报" | "待审核" | "异常逾期" | "待发布" | "已办";
}
```

Use a table-driven test for every legal transition in design-spec section 7.1 and the exact actor, role, permission, clock, and precondition for each command. The transition context—not an untrusted role label inside a command—is authoritative. Require the responsible role for collection, reviewer for business review, quality reviewer for explanation approval/return, publisher for publication, authorized admin for exemptions, and system identity for deadline/rule execution. Test every cross-state constraint in section 7.2: quality blocking prevents approval/release; warning requires an approved explanation under the selected rule; explanation submission and quality review are separate audited transitions; a returned document retains old submission/review events and creates a new corrected submission version; approval does not publish; stale inputs block unpublished release; published history is immutable and only a new release version can replace it. My Work/domain projections retain the same `workId` and complete histories.

For `MonitoringObject`, assert effective-dated roles and this migration:

```ts
expect(migrateLegacyProductionType("village-ledger")).toEqual({
  objectTypeId: "survey-area",
  sourceChannelId: "administrative-village-ledger",
});
```

- [ ] **Step 2: Run core tests and verify RED**

Run:

```bash
npx vitest run src/prototype/core/businessWork.spec.ts src/prototype/core/monitoringRegistry.spec.ts
```

Expected: FAIL because both core modules are absent.

- [ ] **Step 3: Implement work and registry models with typed fixtures**

Keep responsibility, document, review, quality, and release states independent. `projectMyWork()` filters by responsible/reviewer identity; `projectDomainTasks()` filters by domain and authorized scope; both return the same IDs and source objects. Include at least one supply explanation/review item and one report review/distribution item so My Work is not restricted to production and market.

Define object roles as:

```ts
export interface EffectiveBusinessRole {
  roleId: string;
  label: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  capabilityTemplateVersionId: string;
}
```

An object may have multiple roles. Object type appears in create/edit/filter/table data; applicable capabilities appear only in the object detail from the active role templates.

- [ ] **Step 4: Write failing production workspace tests**

Replace the old five-page expectations with:

```ts
expect(screen.getByRole("heading", { name: "产情任务作业" })).toBeVisible();
expect(screen.getByRole("table", { name: "产情任务台账" })).toBeVisible();
expect(screen.queryByText("产情对象名录")).not.toBeInTheDocument();
```

For `section="objects"`, assert a distinct table with columns `对象名称/对象类型/行政区划/作物/具体品种/来源渠道/责任人/有效状态`. For `section="analysis"`, assert the four-year metric ledger and comparison charts after selection.

Open a task detail and assert all preserved field groups are reachable: specific variety, area/location, growth/stage/disaster, yield/output, quality/evidence, stock/sales/self-use/loss, planting intention, cost/support/insurance, plus buttons “在线填报”“Excel批量导入”“授权系统接入”.

- [ ] **Step 5: Run production UI tests and verify RED**

Run:

```bash
npx vitest run src/prototype/ProductionMonitoringWorkspace.spec.tsx src/prototype/PortalWorkspaces.spec.tsx
```

Expected: FAIL against the old overview/objects/collection/review/reports implementation.

- [ ] **Step 6: Build four thin production workspaces**

Make `ProductionMonitoringWorkspace.tsx` only select among `tasks`, `objects`, and `analysis`. Task-row action opens `ProductionDocumentWorkbench` in the same task context; collection and review are lifecycle panels inside that workbench, not sidebar destinations. Move all existing demonstration form values, cost/support data, quality evidence, validation results, and collection-source details into `data/productionDocumentFixtures.ts`; the workbench contains no business-value literals. The analysis page reads only official metric fixture releases and shows source/cutoff/version detail.

Preserve `area`, `expectedYield`, `sampleResult`, and `regionalEstimate` as four separately labeled fields. A sample average never replaces the regional weighted estimate.

- [ ] **Step 7: Prove My Work uses the same task source**

Update the My Work test so clicking a production item routes to `page=production&section=tasks&recordType=work-item&recordId=<workId>`. Assert the domain task row and detail show the same ID, object, deadline, person, and five state dimensions.

- [ ] **Step 8: Run Task 5 tests GREEN and commit**

Run:

```bash
npx vitest run src/prototype/core/businessWork.spec.ts src/prototype/core/monitoringRegistry.spec.ts src/prototype/application/businessWorkProjection.spec.ts src/prototype/data/productionDocumentFixtures.spec.ts src/prototype/ProductionMonitoringWorkspace.spec.tsx src/prototype/PortalWorkspaces.spec.tsx src/prototype/prototypeFieldPreservation.spec.ts
npx tsc -p src/prototype/tsconfig.json --pretty false
```

Then compare the external baseline and commit:

```bash
git add src/prototype/core/businessWork.ts src/prototype/core/businessWork.spec.ts src/prototype/core/monitoringRegistry.ts src/prototype/core/monitoringRegistry.spec.ts src/prototype/data/businessWorkFixtures.ts src/prototype/data/monitoringRegistryFixtures.ts src/prototype/data/productionDocumentFixtures.ts src/prototype/data/productionDocumentFixtures.spec.ts src/prototype/application/businessWorkProjection.ts src/prototype/application/businessWorkProjection.spec.ts src/prototype/production/ProductionTaskWorkspace.tsx src/prototype/production/ProductionObjectRegistry.tsx src/prototype/production/ProductionAnalysisWorkspace.tsx src/prototype/production/ProductionDocumentWorkbench.tsx src/prototype/ProductionMonitoringWorkspace.tsx src/prototype/ProductionMonitoringWorkspace.spec.tsx src/prototype/productionMonitoringModel.ts src/prototype/productionMonitoringData.ts src/prototype/MyWorkWorkspace.tsx src/prototype/PortalWorkspaces.spec.tsx src/prototype/market-monitoring.css src/prototype/unified-workspaces.css src/prototype/prototypeFieldMap.ts src/prototype/prototypeFieldPreservation.spec.ts
git diff --cached --check
git commit -m "feat: separate production tasks objects and analysis"
```

---

### Task 6: Market Tasks, Object Registry, Documents, and Analysis

**Files:**

- Create: `src/prototype/market/MarketTaskWorkspace.tsx`
- Create: `src/prototype/market/MarketObjectRegistry.tsx`
- Create: `src/prototype/market/MarketAnalysisWorkspace.tsx`
- Create: `src/prototype/market/MarketDocumentWorkbench.tsx`
- Modify: `src/prototype/MarketMonitoringWorkspace.tsx`
- Modify: `src/prototype/MarketMonitoringWorkspace.spec.tsx`
- Modify: `src/prototype/marketMonitoringModel.ts`
- Modify: `src/prototype/marketMonitoringData.ts`
- Modify: `src/prototype/data/businessWorkFixtures.ts`
- Modify: `src/prototype/data/monitoringRegistryFixtures.ts`
- Create: `src/prototype/data/marketDocumentFixtures.ts`
- Create: `src/prototype/data/marketDocumentFixtures.spec.ts`
- Modify: `src/prototype/MyWorkWorkspace.tsx`
- Modify: `src/prototype/prototypeFieldMap.ts`
- Modify: `src/prototype/prototypeFieldPreservation.spec.ts`
- Modify: `src/prototype/market-monitoring.css`
- Modify: `src/prototype/unified-workspaces.css`

**Interfaces:**

- Consumes: `BusinessWorkItem`, `MonitoringObject`, scope, comparison models, and shared analytical components.
- Produces: distinct market task/object/analysis projections without a public capability encyclopedia.
- Consumed by: Task 9 global search and reports.

- [ ] **Step 1: Write failing market fixture and workspace tests**

Assert all 13 current role IDs survive, including trader, corn processor, soybean crusher, soybean protein, food/condiment, rice mill, feed, livestock, reserve, wholesale market, agricultural-input dealer, rail node, and road node.

Assert task fields retain `id/target/targetName/role/grain/region/owner/deadline/status/completedFields/applicableFields`. Assert region coverage retains `detail/townshipCount/villageCount/sourceNote/sourceState`. Assert logistics objects retain `coverage` and `monitoring`.

The approved page expectations are:

```ts
expect(screen.queryByText("市场对象业务能力清单")).not.toBeInTheDocument();
expect(screen.getByRole("table", { name: "市场任务台账" })).toBeVisible();
expect(
  screen.queryByRole("table", { name: "市场对象名录" }),
).not.toBeInTheDocument();
```

For `objects`, assert object type is a filter and a column. For an object's detail, assert only its effective roles and actual applicable capabilities appear. For `analysis`, assert price, trade, inventory, processing, direct use, sales, logistics, and agricultural-input subtypes exist.

- [ ] **Step 2: Run market tests and verify RED**

Run:

```bash
npx vitest run src/prototype/MarketMonitoringWorkspace.spec.tsx src/prototype/prototypeFieldPreservation.spec.ts
```

Expected: FAIL because the old capability table and five-page workspace remain.

- [ ] **Step 3: Build four thin market workspaces**

Make task rows business-specific: subject or logistics target, effective business role, product, current work, field completion, deadline, responsibility, independent lifecycle states, and action. Make registry rows stable: name, object type, effective roles, products, varieties, quality scope or monitoring content, region, owner, and validity.

Task detail renders only field groups returned by the role template: purchase/price, quality, processing, inventory, sales, movement, and evidence. Move all existing market form values, validation states, evidence, source metadata, and online/Excel/system collection examples into `data/marketDocumentFixtures.ts`; components contain no demonstration business values. Remove `marketCapabilityRows` from the main page; do not replace it with another all-role table.

- [ ] **Step 4: Connect analysis to the shared comparison engine**

The market analysis page queries `enterpriseMetricFixtures` by subtype, region, product, cultivar, period, data layer, and version. Price series label whether they are transaction-weighted, quote median, or another declared statistic. A missing region/product returns “没有符合条件的正式指标版本” and never Qiqihar data.

- [ ] **Step 5: Run Task 6 tests GREEN and commit**

Run:

```bash
npx vitest run src/prototype/core/businessWork.spec.ts src/prototype/core/monitoringRegistry.spec.ts src/prototype/data/marketDocumentFixtures.spec.ts src/prototype/MarketMonitoringWorkspace.spec.tsx src/prototype/prototypeFieldPreservation.spec.ts
npx tsc -p src/prototype/tsconfig.json --pretty false
```

Then compare the external baseline and commit:

```bash
git add src/prototype/market/MarketTaskWorkspace.tsx src/prototype/market/MarketObjectRegistry.tsx src/prototype/market/MarketAnalysisWorkspace.tsx src/prototype/market/MarketDocumentWorkbench.tsx src/prototype/MarketMonitoringWorkspace.tsx src/prototype/MarketMonitoringWorkspace.spec.tsx src/prototype/marketMonitoringModel.ts src/prototype/marketMonitoringData.ts src/prototype/data/businessWorkFixtures.ts src/prototype/data/monitoringRegistryFixtures.ts src/prototype/data/marketDocumentFixtures.ts src/prototype/data/marketDocumentFixtures.spec.ts src/prototype/MyWorkWorkspace.tsx src/prototype/prototypeFieldMap.ts src/prototype/prototypeFieldPreservation.spec.ts src/prototype/market-monitoring.css src/prototype/unified-workspaces.css
git diff --cached --check
git commit -m "feat: separate market tasks objects and analysis"
```

---

### Task 7: Versioned Supply Account, Reconciliation, and Publication Verdict

**Files:**

- Create: `src/prototype/core/supplyAccount.ts`
- Create: `src/prototype/core/supplyAccount.spec.ts`
- Create: `src/prototype/data/supplyAccountFixtures.ts`
- Create: `src/prototype/data/supplyAccountFixtures.spec.ts`
- Create: `src/prototype/components/SupplyAccountResultPanel.tsx`
- Create: `src/prototype/components/SupplyAccountResultPanel.spec.tsx`
- Modify: `src/prototype/SupplyDemandWorkspace.tsx`
- Modify: `src/prototype/SupplyDemandWorkspace.spec.tsx`
- Modify: `src/prototype/supplyBalanceScope.ts`
- Modify: `src/prototype/supplyBalanceScope.spec.ts`
- Modify: `src/prototype/data/enterpriseMetricFixtures.ts`
- Modify: `src/prototype/data/enterpriseMetricFixtures.spec.ts`
- Modify: `src/prototype/prototypeFieldMap.ts`
- Modify: `src/prototype/prototypeFieldPreservation.spec.ts`
- Modify: `src/prototype/unified-workspaces.css`

**Interfaces:**

- Consumes: Task 1 `OperationalScope`, Task 2 fixed-point arithmetic/comparison models, and Task 3 comparison visuals.
- Produces: the only authoritative supply-account evaluation, selected rule version, substituted equations, reconciliation result, and publication verdict.
- Consumed by: Task 8 report input snapshots and Task 9 search/release records.

- [ ] **Step 1: Write failing supply-account contract tests**

Create table-driven tests for these exact equations:

```ts
export const supplyEquationIds = [
  "total-supply",
  "total-use",
  "pre-adjustment-ending",
  "adopted-ending",
  "survey-difference",
] as const;

// total supply = opening + local production + inflow + imports + other supply
// total use = food + feed + seed + processing + loss + outflow + exports + other use
// pre-adjustment ending = total supply - total use
// adopted ending = pre-adjustment ending + approved adjustment
// survey difference = surveyed ending - adopted ending
```

Define the public contract with fixed-point values rather than display strings:

```ts
export interface SupplyAccountKey {
  productAccountId: string;
  regionId: string;
  regionBoundaryVersionId: string;
  regionLevel: "city" | "county";
  marketingYear: string;
  asOf: string;
  dataLayer: "preliminary" | "official";
}

export interface SupplyAccountCoordinate extends SupplyAccountKey {
  accountVersionId: string;
}

export interface SupplyRuleVersion {
  id: string;
  accountStandardVersionId: string;
  ruleComparabilityVersionId: string;
  regionLevel: "city" | "county";
  productAccountId: string;
  marketingYear: string;
  effectiveFrom: string;
  effectiveTo: string;
  includedItemIds: readonly string[];
  supplyRoleIds: readonly string[];
  useRoleIds: readonly string[];
  unit: string;
  precision: number;
  conversionRuleVersionIds: readonly string[];
  consolidationScopeId: string;
  inventoryEliminationMatrixVersionId: string;
  tolerancePolicy:
    | { kind: "absolute"; value: FixedDecimal }
    | { kind: "relative-to-adopted-ending"; ratePercent: FixedDecimal };
  surveyRequired: boolean;
  aboveTolerancePolicy: "block" | "allow-approved-explanation";
  acceptedDataLayers: readonly ("preliminary" | "official")[];
  maxSourceAgeHours: number;
  requiredExplanationRoleIds: readonly string[];
  requiredApprovalRoleIds: readonly string[];
}

export type SupplyRuleSelection =
  | { status: "matched"; rule: SupplyRuleVersion }
  | {
      status: "blocked";
      reason: "no-matching-rule" | "ambiguous-rule";
      candidateRuleIds: readonly string[];
    };

export type SupplyInputValue =
  | { availability: "available" | "true-zero"; value: FixedDecimal }
  | {
      availability:
        "missing" | "not-collected" | "not-applicable" | "quality-blocked";
      value: null;
      reason: string;
    };

export interface SupplyAccountLine {
  itemId: string;
  roleId: string;
  label: string;
  side: "supply" | "use";
  required: boolean;
  input: SupplyInputValue;
  sourceRecordId: string;
  sourceVersionId: string;
  sourceBusiness: string;
  sourceUnit: string;
  sourceCoordinate: Omit<SupplyAccountCoordinate, "accountVersionId">;
  sourceState: "current" | "expired" | "rejected" | "withdrawn" | "restated";
  dataLayer: "preliminary" | "official";
  qualityStatus: "passed" | "warning" | "blocking";
  reviewStatus: "pending" | "passed" | "returned";
  cutoff: string;
}

export interface SupplyConversionRule {
  conversionRuleVersionId: string;
  itemId: string;
  fromUnit: string;
  toUnit: string;
  multiplier: FixedDecimal;
  effectiveFrom: string;
  effectiveTo: string;
}

export interface SupplyEliminationEntry {
  itemId: string;
  sourceRegionId: string;
  destinationRegionId: string;
  value: FixedDecimal;
  sourceVersionId: string;
}

export interface SupplyEliminationMatrix {
  inventoryEliminationMatrixVersionId: string;
  consolidationScopeId: string;
  unit: string;
  entries: readonly SupplyEliminationEntry[];
}

export interface SupplyNormalizedLine {
  itemId: string;
  rawValue: FixedDecimal;
  conversionRuleVersionId: string | null;
  convertedValue: FixedDecimal;
  eliminatedValue: FixedDecimal;
  adoptedValue: FixedDecimal;
}

export type SupplySurveyInput =
  | { requirement: "not-required"; reason: string }
  | {
      requirement: "required";
      input: SupplyInputValue;
      sourceRecordId: string;
      sourceVersionId: string;
      sourceState:
        "current" | "expired" | "rejected" | "withdrawn" | "restated";
      sourceCoordinate: Omit<SupplyAccountCoordinate, "accountVersionId">;
      sourceUnit: string;
      cutoff: string;
      qualityStatus: "passed" | "warning" | "blocking";
      reviewStatus: "pending" | "passed" | "returned";
      dataLayer: "preliminary" | "official";
    };

export type SupplyAccountReview =
  | { status: "pending" }
  | {
      status: "passed" | "returned";
      reviewer: string;
      roleId: string;
      reviewedAt: string;
      versionId: string;
      reason: string | null;
    };

export interface SupplyAccountRecord {
  coordinate: SupplyAccountCoordinate;
  coverage: string;
  lines: readonly SupplyAccountLine[];
  declaredResults: {
    totalSupply: FixedDecimal;
    totalUse: FixedDecimal;
    preAdjustmentEnding: FixedDecimal;
    adoptedEnding: FixedDecimal;
    surveyDifference: FixedDecimal | null;
  };
  approvedAdjustment:
    | { status: "none"; value: FixedDecimal }
    | {
        status: "approved";
        value: FixedDecimal;
        reason: string;
        responsibleParty: string;
        responsibleRoleId: string;
        approvalId: string;
        approvedBy: string;
        approvalRoleId: string;
        approvedAt: string;
        versionId: string;
      }
    | {
        status: "pending";
        value: FixedDecimal;
        reason: string;
        submittedBy: string;
        submittedRoleId: string;
      };
  surveyedEnding: SupplySurveyInput;
  explanation:
    | { status: "not-submitted" }
    | {
        status: "pending-review";
        versionId: string;
        submittedBy: string;
        submittedRoleId: string;
      }
    | {
        status: "approved";
        versionId: string;
        submittedBy: string;
        submittedRoleId: string;
        approvedBy: string;
        approvalRoleId: string;
        approvedAt: string;
      };
  accountReview: SupplyAccountReview;
  accountQualityStatus: "passed" | "warning" | "blocking";
}

export interface SupplyEquationResult {
  equationId: (typeof supplyEquationIds)[number];
  expression: string;
  substitutedExpression: string;
  calculatedValue: FixedDecimal | null;
  declaredValue: FixedDecimal | null;
  status: "passed" | "failed" | "not-evaluated";
  reason: string | null;
}

export interface SupplyReconciliation {
  status:
    | "not-evaluated"
    | "unable"
    | "balanced"
    | "unbalanced-awaiting-explanation"
    | "explained-difference"
    | "unbalanced-blocked"
    | "stale";
  difference: FixedDecimal | null;
  tolerance: FixedDecimal | null;
  reasons: readonly string[];
}

export type SupplyIssueCode =
  | "no-matching-rule"
  | "ambiguous-rule"
  | "missing-required-input"
  | "coordinate-mismatch"
  | "equation-mismatch"
  | "survey-missing"
  | "above-tolerance"
  | "explanation-not-allowed"
  | "source-stale"
  | "source-rejected"
  | "source-withdrawn"
  | "source-restated"
  | "data-layer-rejected"
  | "review-incomplete"
  | "quality-blocked"
  | "adjustment-incomplete"
  | "conversion-rule-missing"
  | "elimination-matrix-missing"
  | "elimination-scope-mismatch"
  | "required-role-mismatch";

export interface SupplyAccountEvaluation {
  coordinate: SupplyAccountCoordinate;
  ruleSelection: SupplyRuleSelection;
  normalizedLines: readonly SupplyNormalizedLine[];
  internalFlowElimination: FixedDecimal;
  equationResults: readonly SupplyEquationResult[];
  calculation: {
    status: "passed" | "input-incomplete" | "failed" | "stale";
    reasons: readonly string[];
  };
  reconciliation: SupplyReconciliation;
  publication: {
    verdict: "publishable" | "publishable-with-explanation" | "blocked";
    issueCodes: readonly SupplyIssueCode[];
    reasons: readonly string[];
  };
}

export interface SupplyAccountRelease {
  resultReleaseVersionId: string;
  accountVersionId: string;
  ruleVersionId: string;
  publishedAt: string;
  evaluation: SupplyAccountEvaluation;
  metricProjectionSnapshot: readonly SupplyMetricProjectionSnapshot[];
}

export interface SupplyMetricProjectionSnapshot {
  metricId:
    | "supply.total-supply"
    | "supply.total-use"
    | "supply.adopted-ending"
    | "supply.survey-ending"
    | "supply.inventory-difference";
  valueSource:
    | {
        kind: "equation";
        equationId:
          "total-supply" | "total-use" | "adopted-ending" | "survey-difference";
      }
    | { kind: "survey-input" };
  requestedCoordinate: RequestedMetricCoordinate;
  inputReleaseVersionIds: readonly string[];
  metricReleaseVersionId: string;
  unit: string;
  coverageRate: FixedDecimal;
  qualityStatus: "passed" | "warning";
  definitionVersionId: string;
  conversionVersionId: string | null;
}

export function projectSupplyReleaseMetricPoints(
  releases: readonly SupplyAccountRelease[],
): readonly PublishedMetricPoint[];

export interface SupplyEvaluationContext {
  conversionRules: readonly SupplyConversionRule[];
  eliminationMatrices: readonly SupplyEliminationMatrix[];
}
```

Test the complete result matrix independently:

1. no matching rule;
2. ambiguous matching rules;
3. required source value missing;
4. source coordinate mismatch;
5. required survey value missing;
6. within tolerance;
7. above tolerance with approved explanation;
8. above tolerance without explanation;
9. stale source;
10. rejected source;
11. preliminary source under an official-only rule;
12. required review absent;
13. literal zero accepted as a present value;
14. missing value never coerced to zero;
15. declared total or derived equation does not match authoritative arithmetic;
16. explanation is approved but the rule forbids explanation-based publication;
17. account quality is blocking;
18. source is withdrawn;
19. source is restated;
20. relative tolerance is configured while adopted ending is zero;
21. approved adjustment lacks reason, responsible party, approval, or version;
22. approving an explanation does not change the difference value;
23. a required unit conversion rule is absent or ineffective;
24. the selected consolidation scope has no matching elimination matrix;
25. internal region-to-region flow is converted and eliminated exactly once before totals are calculated;
26. explanation submitter or adjustment approver lacks the role required by the selected rule.
27. surveyed ending is stale, rejected, withdrawn, restated, quality-blocked, review-incomplete, on the wrong layer, or beyond the cutoff;
28. account review is passed but its reviewer role is missing or is not allowed by the selected rule;
29. no approved adjustment exists but a missing or invalid final account review still blocks publication;
30. the authoritative internal-flow elimination equals the selected typed matrix calculation and can never be supplied as a hand-authored record total.
31. `surveyRequired: false` accepts the explicit `not-required` survey branch, does not require fabricated source lineage, skips reconciliation, and does not by itself block publication.
32. the five released supply indicators—total supply, total use, adopted ending, surveyed ending, and inventory difference—have exactly one immutable metric-projection entry whose value source, period/same-period key, unit definition, definition/conversion versions, coverage, quality, source-release IDs, and supply business coordinates are traceable to the selected account, rule, source records, metric catalog, and release request.

Also assert exact-boundary behavior: `abs(survey difference) == tolerance` is within tolerance.

Run:

```bash
npx vitest run src/prototype/core/supplyAccount.spec.ts
```

Expected: FAIL because the core module does not exist.

- [ ] **Step 2: Implement rule selection and authoritative arithmetic**

Implement pure functions:

```ts
export function selectSupplyRule(
  coordinate: SupplyAccountCoordinate,
  rules: readonly SupplyRuleVersion[],
): SupplyRuleSelection;

export function evaluateSupplyAccount(
  account: SupplyAccountRecord,
  ruleSelection: SupplyRuleSelection,
  context: SupplyEvaluationContext,
): SupplyAccountEvaluation;
```

Every addition, subtraction, comparison, absolute value, and display rounding delegates to `fixedDecimal.ts`. Reject duplicate account line items or duplicate adopted source values. Carry source record ID, source version ID, source coordinate, source state, source unit, data layer, quality status, review status, and cutoff time into every equation and survey input. Derive `internalFlowElimination` only from the selected typed elimination matrix after unit conversion; the record cannot provide an authoritative or display-formatted elimination total. Apply unit conversion, consolidation scope, and internal-flow elimination only from their named rule versions. Do not place tolerances, role lists, reviewer-role policy, or publication rules in React components.

- [ ] **Step 3: Write failing fixture and legacy-compatibility tests**

In `supplyAccountFixtures.spec.ts`, require the complete product-account catalog—`corn/玉米原粮`, `soybean/大豆原粮`, `soymeal/豆粕`, `soyoil/豆油`, `soy-protein/大豆蛋白产品`, `paddy/稻谷原粮`, and `rice/大米产品`. Each catalog item has an explicit `released`, `preparing`, or `no-release` state; unavailable accounts never borrow corn values. Also require distinct Qiqihar-city and Nehe-county official corn accounts, different rule IDs, and all legacy table fields:

```ts
[
  "期初库存",
  "本地生产",
  "区域外流入",
  "国际进口",
  "其他供给",
  "总供给",
  "口粮消费",
  "饲用消费",
  "种用消费",
  "加工投入",
  "损耗",
  "区域外流出",
  "国际出口",
  "其他使用",
  "总使用与外流",
  "调整前账面期末",
  "批准库存调整",
  "采用后账面期末",
  "调查汇总期末",
  "库存平衡差额",
];
```

Require current value, previous value, delta, source business, source version, status, and source action for every legacy row. Unknown region/product/year combinations must return `not-found`; they must never reuse a city account or a corn account.

Run:

```bash
npx vitest run src/prototype/data/supplyAccountFixtures.spec.ts src/prototype/supplyBalanceScope.spec.ts
```

Expected: FAIL on missing typed fixtures and on the old silent Qiqihar fallback.

- [ ] **Step 4: Create one fixture source and a compatibility adapter**

Move all demonstration values, source metadata, rules, approvals, and narratives to `data/supplyAccountFixtures.ts`. Change `supplyBalanceScope.ts` into a deprecated typed adapter over `getSupplyAccountFixture()`; it may preserve existing imports but may not own a second data table or fallback policy.

Create immutable `SupplyAccountRelease` fixtures only after an account is publication-eligible. At release creation, validate that `metricProjectionSnapshot` has exactly one entry for each of the five released supply indicators, that the `metricId`/`valueSource` mapping and requested coordinates match the account/rule/metric catalog, and that `inputReleaseVersionIds` equal the accepted source and survey versions actually used by the evaluation. The snapshot stores coordinates and lineage only—it never stores a second numeric result. `projectSupplyReleaseMetricPoints()` must take equation-backed numeric values exclusively from the matching `evaluation.equationResults` entry and the surveyed-ending value exclusively from `account.surveyedEnding`; combine each with the snapshot and `accountVersionId + ruleVersionId + resultReleaseVersionId` release lineage. When survey is not required, surveyed ending and inventory difference become explicit `not-applicable` points. Add a field-by-field source test for all five projected points. Never hand-write those five supply values in the metric fixture. The pre-adjustment ending remains an auditable equation result in the account view but is not one of these five released enterprise indicators.

Export explicit query states:

```ts
export type SupplyAccountQueryResult =
  | {
      status: "found";
      account: SupplyAccountRecord;
      evaluation: SupplyAccountEvaluation;
    }
  | { status: "not-found"; key: SupplyAccountKey }
  | { status: "invalid-scope"; issues: readonly OperationalScopeIssue[] };
```

- [ ] **Step 5: Write failing result-panel tests**

The panel test must require:

- a question header (“本账户计算什么”);
- the five named equations with substituted values and units;
- the adopted ending inventory as the primary answer;
- the surveyed-versus-adopted difference and rule tolerance;
- a verdict badge and plain-language reasons;
- rule ID, account version, cutoff, review state, data layer, and source lineage;
- current plus previous three years for the selected supply metric;
- explicit not-found and blocked states;
- an explanation action only when the selected rule permits it.

Run:

```bash
npx vitest run src/prototype/components/SupplyAccountResultPanel.spec.tsx
```

Expected: FAIL because the component is absent.

- [ ] **Step 6: Implement the supply calculation, comparison, and version sections**

`SupplyDemandWorkspace` owns three genuinely distinct sections:

- `calculation`: coordinate selector, authoritative calculation result, reconciliation, and source ledger;
- `comparison`: metric selector plus the shared four-year trend/YoY visuals;
- `versions`: account/rule/release version ledger with effective dates and statuses.

The calculation section first states the business question, then the adopted answer, then the substituted equations, then the publication verdict, and finally the detailed source table. Keep every valid legacy table field reachable in the source ledger. Disable any publish action when verdict is `blocked` and include the issue reasons in accessible text.

- [ ] **Step 7: Run Task 7 tests GREEN and commit**

Run:

```bash
npx vitest run src/prototype/core/supplyAccount.spec.ts src/prototype/data/supplyAccountFixtures.spec.ts src/prototype/data/enterpriseMetricFixtures.spec.ts src/prototype/components/SupplyAccountResultPanel.spec.tsx src/prototype/SupplyDemandWorkspace.spec.tsx src/prototype/supplyBalanceScope.spec.ts src/prototype/prototypeFieldPreservation.spec.ts
npx tsc -p src/prototype/tsconfig.json --pretty false
npx vitest run src/prototype
```

Compare the external SHA-256 manifest with its baseline. Then stage exactly:

```bash
git add src/prototype/core/supplyAccount.ts src/prototype/core/supplyAccount.spec.ts src/prototype/data/supplyAccountFixtures.ts src/prototype/data/supplyAccountFixtures.spec.ts src/prototype/data/enterpriseMetricFixtures.ts src/prototype/data/enterpriseMetricFixtures.spec.ts src/prototype/components/SupplyAccountResultPanel.tsx src/prototype/components/SupplyAccountResultPanel.spec.tsx src/prototype/SupplyDemandWorkspace.tsx src/prototype/SupplyDemandWorkspace.spec.tsx src/prototype/supplyBalanceScope.ts src/prototype/supplyBalanceScope.spec.ts src/prototype/prototypeFieldMap.ts src/prototype/prototypeFieldPreservation.spec.ts src/prototype/unified-workspaces.css
git diff --cached --check
git commit -m "feat: make supply accounting explicit and auditable"
```

Expected: only the listed `src/prototype` files are committed.

---

### Task 8A: Report Templates, Parameter Compatibility, Version Locking, and Immutable Preview

**Files:**

- Create: `src/prototype/core/reportRun.ts`
- Create: `src/prototype/core/reportRun.spec.ts`
- Create: `src/prototype/data/reportRunFixtures.ts`
- Create: `src/prototype/data/reportRunFixtures.spec.ts`
- Create: `src/prototype/components/ReportParameterWizard.tsx`
- Create: `src/prototype/components/ReportParameterWizard.spec.tsx`
- Modify: `src/prototype/businessReportModel.ts`
- Modify: `src/prototype/businessReportModel.spec.ts`
- Modify: `src/prototype/BusinessReportComposer.tsx`
- Modify: `src/prototype/BusinessReportComposer.spec.tsx`
- Modify: `src/prototype/ReportCenterWorkspace.tsx`
- Modify: `src/prototype/ReportCenterWorkspace.spec.tsx`
- Modify: `src/prototype/FormalEnterprisePrototype.tsx`
- Modify: `src/prototype/FormalEnterprisePrototype.spec.tsx`
- Modify: `src/prototype/ProductionMonitoringWorkspace.tsx`
- Modify: `src/prototype/MarketMonitoringWorkspace.tsx`
- Modify: `src/prototype/SupplyDemandWorkspace.tsx`
- Modify: `src/prototype/prototypeFieldMap.ts`
- Modify: `src/prototype/prototypeFieldPreservation.spec.ts`
- Modify: `src/prototype/unified-workspaces.css`

**Interfaces:**

- Consumes: released metric snapshots, production/market/supply source versions, and Task 1 routes/scope.
- Produces: validated parameters, a locked report input snapshot, editable launch presets, and immutable preview-ready report runs.
- Preserves: the current report's four indicator identities, three chapter identities, author/reviewer, amendment warning, report number, and export actions. Fixtures store template text and `metricId` narrative tokens only; every numeric title/summary/indicator/chart value is rendered from the locked snapshot.

- [ ] **Step 1: Write failing parameter-compatibility tests**

Define these contracts:

```ts
export type ReportBusinessDomain =
  "production" | "market" | "supply" | "cross-business" | "duty";

export type ReportFrequency =
  "daily" | "weekly" | "monthly" | "annual" | "special";

export type ReportProductSelection =
  | { kind: "none" }
  | { kind: "crop"; cropId: string; cultivarId?: string }
  | { kind: "commodity"; commodityId: string; cultivarId?: string }
  | {
      kind: "product-account";
      productAccountId: string;
      marketingYear: string;
      supplyAccountVersionId: string;
    };

export interface ReportParameters {
  domain: ReportBusinessDomain;
  businessSubtypeId?: BusinessClassification["id"];
  reportTypeId: string;
  templateVersionId: string;
  regionLevel: "city" | "county" | "township" | "village" | "custom";
  regionIds: readonly string[];
  product: ReportProductSelection;
  dutyScope?: {
    organizationIds: readonly string[];
    postIds: readonly string[];
    responsibilityPeriod: string;
  };
  frequency: ReportFrequency;
  periodId: string;
  dataCutoff: string;
  dataLayer: "preliminary" | "official";
  baselineYearCount: 3;
  inputReferences: readonly ReportInputReference[];
  metricIds: readonly string[];
  chapterIds: readonly string[];
  outputFormats: readonly ("xlsx" | "docx" | "pdf")[];
}

export interface ReportLaunchPreset {
  source:
    | "report-center"
    | "production-analysis"
    | "market-analysis"
    | "supply-analysis";
  sourceRecordId?: string;
  parameters: Partial<ReportParameters>;
}

export interface ReportInputReference {
  kind: "fact-release" | "metric-release" | "supply-result-release";
  versionId: string;
  status: "current" | "replaced" | "withdrawn";
  publishedAt: string;
  dataCutoff: string;
  coordinateDigest: string;
  coordinate: {
    domain: ReportBusinessDomain;
    businessSubtypeId: BusinessClassification["id"] | null;
    regionIds: readonly string[];
    regionBoundaryVersionId: string;
    product: ReportProductSelection;
    dataLayer: "preliminary" | "official";
    periodKey: string;
    metricIds: readonly string[];
    unitDefinitionVersionIds: readonly string[];
    metricDefinitionVersionIds: readonly string[];
    aggregationEligible: boolean;
  };
}

export interface ReportTemplateVersion {
  templateVersionId: string;
  reportTypeId: string;
  domain: ReportBusinessDomain;
  businessSubtypeIds: readonly BusinessClassification["id"][];
  frequencies: readonly ReportFrequency[];
  regionLevels: readonly ReportParameters["regionLevel"][];
  productKinds: readonly ReportProductSelection["kind"][];
  baselineYearCount: 3;
  requiredMetricIds: readonly string[];
  optionalChapterIds: readonly string[];
  acceptedDataLayers: readonly ("preliminary" | "official")[];
  allowRegionAggregation: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface ReportCatalog {
  templates: readonly ReportTemplateVersion[];
  reportTypes: readonly {
    id: string;
    domain: ReportBusinessDomain;
    label: string;
  }[];
  chapters: readonly { id: string; label: string }[];
}

export interface ReportAuthorization {
  regionIds: readonly string[];
  domainPermissions: readonly ReportBusinessDomain[];
  businessClassificationIds: readonly BusinessClassification["id"][];
  productIds: readonly string[];
  cultivarIds: readonly string[];
  organizationIds: readonly string[];
  postIds: readonly string[];
}

export interface ReportParameterIssue {
  code: string;
  field: keyof ReportParameters | "inputReferences";
  message: string;
  relatedFields: readonly (keyof ReportParameters)[];
}

export interface ReportInputSnapshot {
  snapshotId: string;
  createdAt: string;
  references: readonly ReportInputReference[];
  metricComparisons: readonly ComparisonSet[];
}

export interface ReportIndicatorSnapshot {
  metricId: string;
  label: string;
  valueText: string;
  comparisonText: string;
  metricReleaseVersionId: string;
}

export interface ReportChapterSnapshot {
  chapterId: string;
  title: string;
  narrativeTokens: readonly { token: string; metricId: string }[];
  renderedText: string;
}

export interface ReportDistributionRecord {
  distributionId: string;
  runId: string;
  channel: "portal" | "email" | "download";
  recipient: string;
  status: "pending" | "delivered" | "failed";
  attemptedAt: string;
}

export interface ReportRun {
  runId: string;
  reportNumber: string;
  parameters: ReportParameters;
  templateVersionId: string;
  snapshot: ReportInputSnapshot;
  title: string;
  summary: string;
  indicators: readonly ReportIndicatorSnapshot[];
  chapters: readonly ReportChapterSnapshot[];
  author: string;
  reviewer: string;
  amendmentWarning: string | null;
  status:
    | "draft"
    | "preview-ready"
    | "submitted"
    | "in-review"
    | "returned"
    | "approved"
    | "published"
    | "replaced"
    | "input-stale";
  replacesRunId: string | null;
  replacementReason: string | null;
  returnReason: string | null;
  publishedAt: string | null;
  reviewHistory: readonly {
    action: "submitted" | "review-started" | "returned" | "approved";
    actor: string;
    at: string;
    reason: string | null;
  }[];
  distributions: readonly ReportDistributionRecord[];
}

export type ReportRunResult =
  | { status: "created"; run: ReportRun }
  | { status: "invalid"; issues: readonly ReportParameterIssue[] };

export interface CompatibleReportOptions {
  reportTypeIds: readonly string[];
  templateVersionIds: readonly string[];
  regionLevels: readonly ReportParameters["regionLevel"][];
  regionIds: readonly string[];
  productKinds: readonly ReportProductSelection["kind"][];
  products: readonly ReportProductSelection[];
  frequencies: readonly ReportFrequency[];
  periodIds: readonly string[];
  inputReferences: readonly ReportInputReference[];
  metricIds: readonly string[];
  chapterIds: readonly string[];
}

export interface ReportOptionContext {
  catalog: ReportCatalog;
  authorization: ReportAuthorization;
  businessClassifications: readonly BusinessClassification[];
  regions: readonly {
    id: string;
    level: ReportParameters["regionLevel"];
    regionBoundaryVersionId: string;
  }[];
  products: readonly ReportProductSelection[];
  periods: readonly {
    frequency: ReportFrequency;
    periodId: string;
    dataCutoff: string;
  }[];
  metricDefinitions: readonly MetricDefinition[];
  availableInputs: readonly ReportInputReference[];
  metricComparisons: readonly ComparisonSet[];
}

export interface ReportValidationContext extends ReportOptionContext {
  now: string;
}

export interface ReportRunContext extends ReportValidationContext {
  nextRunId: string;
  nextReportNumber: string;
  nextSnapshotId: string;
  author: string;
  reviewer: string;
}
```

Test the compatibility matrix, not individual UI labels:

- every domain has at least one subtype and one active template version;
- every frequency has valid periods;
- production templates use `{ kind: "crop" }`, market templates use compatible `crop` or `commodity`, supply templates require `{ kind: "product-account" }` plus marketing year and account version, and duty templates use `{ kind: "none" }`;
- duty templates require organization, post, and responsibility period rather than a grain product;
- cultivar is allowed only for a compatible selected crop or commodity;
- region IDs match the selected region level and user authorization;
- each selected business subtype, product, cultivar, organization, and post is independently checked against authorization; an unauthorized value is rejected even when its domain and region are authorized;
- official reports require released input versions at or before the cutoff;
- all selected metrics exist and are compatible with domain/product/region grain;
- selected chapters exist in the template version;
- cross-business inputs share one boundary version, cutoff, period key, and compatible data layer;
- multi-region totals are allowed only when the template permits aggregation and every input has compatible boundary, unit, definition, and aggregation eligibility; otherwise the run uses per-region chapters;
- one report run locks one immutable input snapshot for preview and all later exports;
- stale template/input versions make a run invalid rather than silently upgrading;
- invalid combinations return field-level issue codes.

Run:

```bash
npx vitest run src/prototype/core/reportRun.spec.ts
```

Expected: FAIL because `reportRun.ts` is absent.

- [ ] **Step 2: Implement report validation and immutable run creation**

Implement pure functions:

```ts
export function getCompatibleReportOptions(
  draft: Partial<ReportParameters>,
  context: ReportOptionContext,
): CompatibleReportOptions;

export function validateReportParameters(
  parameters: ReportParameters,
  context: ReportValidationContext,
): readonly ReportParameterIssue[];

export function createReportRun(
  parameters: ReportParameters,
  context: ReportRunContext,
): ReportRunResult;
```

The run stores exact template version, typed fact/metric/supply input references, metric IDs, chapter IDs, cutoff, data layer, current-plus-three-year comparison window, and output formats. A preset may prefill fields but cannot lock them unless the source record requires it and the UI explains why.

- [ ] **Step 3: Write failing fixture and wizard tests**

Fixtures must cover all five domains, all five frequencies, city/county/township/village/custom regions, corn/soy/rice crops, market commodities, supply product accounts, cultivar-compatible templates, official/preliminary layers, and `xlsx`/`docx`/`pdf` outputs. None of those options may be created inside a component.

Wizard tests must exercise this ordered flow:

1. business domain and report type;
2. template version;
3. region level and region values;
4. product and optional cultivar;
5. frequency and period;
6. cutoff, data layer, and fixed three-year comparison window;
7. source/input versions;
8. indicators and chapters;
9. output formats;
10. validation summary and run creation.

Changing an upstream field must keep still-compatible downstream choices and clear only incompatible choices with an explanation. Keyboard navigation, labels, error summaries, and focus-to-invalid-field are required.

Run:

```bash
npx vitest run src/prototype/data/reportRunFixtures.spec.ts src/prototype/components/ReportParameterWizard.spec.tsx
```

Expected: FAIL because fixtures and wizard are absent.

- [ ] **Step 4: Replace hard-coded composer tests and verify RED**

Before changing the existing composer, replace rejected hard-coded expectations in `businessReportModel.spec.ts`, `BusinessReportComposer.spec.tsx`, and the compose portion of `ReportCenterWorkspace.spec.tsx`. Require:

- changing domain, region, product/cultivar, period, layer, or input reference changes the resolved input snapshot and preview content;
- no official version returns field/cross-field issues and never falls back to preliminary data or another region;
- preview title, summary numbers, four indicators, and three chapters all cite the run's `snapshotId`/metric release IDs;
- a source-launched preset prefills but remains editable;
- `BusinessReportComposer` accepts a created `ReportRun`, not the old `BusinessReportContext`.

Run:

```bash
npx vitest run src/prototype/businessReportModel.spec.ts src/prototype/BusinessReportComposer.spec.tsx src/prototype/ReportCenterWorkspace.spec.tsx
```

Expected: FAIL against the current hard-coded Qiqihar/corn/week-31 composer.

- [ ] **Step 5: Implement the wizard, locked snapshot, and immutable preview**

Move hard-coded market/corn/Qiqihar/week-31 values out of `BusinessReportComposer.tsx`. `reportRunFixtures.ts` may store template labels, chapter identities, narrative token definitions, people, and prototype input releases, but not a second copy of metric numbers. The composer renders only a valid `ReportRun` and derives title, number, summary, indicators, chapters, author/reviewer, amendment warning, and charts from the same locked snapshot.

Keep `businessReportModel.ts` as the stable public facade over the new `reportRun` core model so existing imports migrate without a second validation engine. Standardize all domain callbacks as:

```ts
onComposeReport: (preset: ReportLaunchPreset) => void;
```

Production, market, and supply pass editable presets; `FormalEnterprisePrototype` stores the preset and navigates to `reporting/compose`.

- [ ] **Step 6: Run Task 8A tests GREEN and commit**

Run:

```bash
npx vitest run src/prototype/core/reportRun.spec.ts src/prototype/data/reportRunFixtures.spec.ts src/prototype/components/ReportParameterWizard.spec.tsx src/prototype/businessReportModel.spec.ts src/prototype/BusinessReportComposer.spec.tsx src/prototype/ReportCenterWorkspace.spec.tsx src/prototype/FormalEnterprisePrototype.spec.tsx src/prototype/prototypeFieldPreservation.spec.ts
npx tsc -p src/prototype/tsconfig.json --pretty false
npx vitest run src/prototype
```

Compare the external manifest and stage exactly:

```bash
git add src/prototype/core/reportRun.ts src/prototype/core/reportRun.spec.ts src/prototype/data/reportRunFixtures.ts src/prototype/data/reportRunFixtures.spec.ts src/prototype/components/ReportParameterWizard.tsx src/prototype/components/ReportParameterWizard.spec.tsx src/prototype/businessReportModel.ts src/prototype/businessReportModel.spec.ts src/prototype/BusinessReportComposer.tsx src/prototype/BusinessReportComposer.spec.tsx src/prototype/ReportCenterWorkspace.tsx src/prototype/ReportCenterWorkspace.spec.tsx src/prototype/FormalEnterprisePrototype.tsx src/prototype/FormalEnterprisePrototype.spec.tsx src/prototype/ProductionMonitoringWorkspace.tsx src/prototype/MarketMonitoringWorkspace.tsx src/prototype/SupplyDemandWorkspace.tsx src/prototype/prototypeFieldMap.ts src/prototype/prototypeFieldPreservation.spec.ts src/prototype/unified-workspaces.css
git diff --cached --check
git commit -m "feat: parameterize and lock enterprise report previews"
```

---

### Task 8B: Report Review, Publication, Replacement, Distribution, Ledger, and Export Manifest

**Files:**

- Modify: `src/prototype/core/reportRun.ts`
- Modify: `src/prototype/core/reportRun.spec.ts`
- Modify: `src/prototype/data/reportRunFixtures.ts`
- Modify: `src/prototype/data/reportRunFixtures.spec.ts`
- Modify: `src/prototype/ReportCenterWorkspace.tsx`
- Modify: `src/prototype/ReportCenterWorkspace.spec.tsx`
- Modify: `src/prototype/BusinessReportComposer.tsx`
- Modify: `src/prototype/BusinessReportComposer.spec.tsx`
- Modify: `src/prototype/prototypeFieldMap.ts`
- Modify: `src/prototype/prototypeFieldPreservation.spec.ts`
- Modify: `src/prototype/unified-workspaces.css`

**Interfaces:**

- Consumes: immutable preview-ready `ReportRun` objects from Task 8A.
- Produces: audited lifecycle transitions, freshness checks, published replacement chains, distribution records, and export manifests.

- [ ] **Step 1: Write failing lifecycle and export tests**

Define:

```ts
export type ReportRunCommand =
  | { type: "save-draft"; actor: string; at: string }
  | { type: "submit"; actor: string; at: string }
  | { type: "start-review"; reviewer: string; at: string }
  | { type: "return"; reviewer: string; reason: string; at: string }
  | { type: "approve"; reviewer: string; at: string }
  | { type: "publish"; actor: string; publishedAt: string }
  | { type: "record-distribution"; record: ReportDistributionRecord };

export interface ReportExportManifest {
  runId: string;
  snapshotId: string;
  templateVersionId: string;
  files: readonly {
    format: "xlsx" | "docx" | "pdf";
    fileName: string;
    metricReleaseVersionIds: readonly string[];
  }[];
}

export type ReportRunTransitionResult =
  | { status: "applied"; run: ReportRun }
  | { status: "rejected"; run: ReportRun; reason: string };

export type ReportExportManifestResult =
  | { status: "created"; manifest: ReportExportManifest }
  | { status: "rejected"; reason: string };
```

Tests require: preview-ready → submitted → in-review → approved → published; returned requires a reason; stale input blocks an unpublished run's submit/publish/export; an already published historical snapshot remains exportable and never becomes `input-stale`; published runs cannot mutate in place; replacement activation returns both the old `replaced` projection and new `published` run with `replacesRunId`/reason; PDF/Word/Excel share one `runId` and `snapshotId`; distribution stores channel/recipient/status; reviewer, return reason, `publishedAt`, and replacement chain appear in the ledger.

- [ ] **Step 2: Implement lifecycle, freshness, replacement, and export functions**

```ts
export function checkReportRunFreshness(
  run: ReportRun,
  context: ReportRunContext,
): ReportRun;

export function transitionReportRun(
  run: ReportRun,
  command: ReportRunCommand,
): ReportRunTransitionResult;

export function createReplacementReportRun(
  publishedRun: ReportRun,
  parameters: ReportParameters,
  reason: string,
  context: ReportRunContext,
): ReportRunResult;

export function activateReportReplacement(
  originalPublishedRun: ReportRun,
  approvedReplacementRun: ReportRun,
  publishedAt: string,
):
  | { status: "applied"; original: ReportRun; replacement: ReportRun }
  | { status: "rejected"; reason: string };

export function buildReportExportManifest(
  run: ReportRun,
): ReportExportManifestResult;
```

Freshness compares every locked reference with current release state. It may change only an unpublished draft/preview/submitted/review/approved run to `input-stale`; it never swaps the reference automatically. A published run is an immutable historical snapshot and remains published/exportable even when an upstream release is later replaced. `createReplacementReportRun()` leaves the original published run unchanged; only `activateReportReplacement()` atomically publishes the approved replacement and moves the original to `replaced`. Export manifests reject mutable non-approved runs, but preserve historical published/replaced snapshots.

- [ ] **Step 3: Rebuild Reporting as three distinct sections**

`ReportCenterWorkspace` must implement:

- `compose`: parameter wizard, validation, immutable preview, and save/submit/export actions;
- `review-distribution`: review queue, amendment/version action, distribution channel and recipient status;
- `ledger`: filterable report runs with domain, type, scope, product, period, layer, snapshot, author, reviewer, status, and version.

Duty is a report domain/template, not a fourth report-center navigation section. Production, market, and supply “生成报告” actions pass editable `ReportLaunchPreset` objects to `compose`.

- [ ] **Step 4: Run Task 8B tests GREEN and commit**

Run:

```bash
npx vitest run src/prototype/core/reportRun.spec.ts src/prototype/data/reportRunFixtures.spec.ts src/prototype/BusinessReportComposer.spec.tsx src/prototype/ReportCenterWorkspace.spec.tsx src/prototype/prototypeFieldPreservation.spec.ts
npx tsc -p src/prototype/tsconfig.json --pretty false
npx vitest run src/prototype
```

Compare the external SHA-256 manifest with its baseline. Then stage exactly:

```bash
git add src/prototype/core/reportRun.ts src/prototype/core/reportRun.spec.ts src/prototype/data/reportRunFixtures.ts src/prototype/data/reportRunFixtures.spec.ts src/prototype/ReportCenterWorkspace.tsx src/prototype/ReportCenterWorkspace.spec.tsx src/prototype/BusinessReportComposer.tsx src/prototype/BusinessReportComposer.spec.tsx src/prototype/prototypeFieldMap.ts src/prototype/prototypeFieldPreservation.spec.ts src/prototype/unified-workspaces.css
git diff --cached --check
git commit -m "feat: govern report review publication and distribution"
```

Expected: only the listed `src/prototype` files are committed.

---

### Task 9: Authorized Global Search, Cross-Application Routing, and Field Preservation

**Files:**

- Create: `src/prototype/application/enterpriseSearch.ts`
- Create: `src/prototype/application/enterpriseSearch.spec.ts`
- Create: `src/prototype/data/enterpriseSearchFixtures.ts`
- Create: `src/prototype/components/EnterpriseGlobalSearch.tsx`
- Create: `src/prototype/components/EnterpriseGlobalSearch.spec.tsx`
- Create: `src/prototype/prototypeFieldReachability.spec.tsx`
- Modify: `src/prototype/EnterpriseShell.tsx`
- Modify: `src/prototype/EnterpriseShell.spec.tsx`
- Modify: `src/prototype/useFormalEnterpriseLocation.ts`
- Modify: `src/prototype/useFormalEnterpriseLocation.spec.tsx`
- Modify: `src/prototype/FormalEnterprisePrototype.tsx`
- Modify: `src/prototype/FormalEnterprisePrototype.spec.tsx`
- Modify: `src/prototype/MyWorkWorkspace.tsx`
- Modify: `src/prototype/PortalWorkspaces.spec.tsx`
- Modify: `src/prototype/formal-enterprise.css`

**Interfaces:**

- Consumes: stable routes, one task source, one object registry, supply accounts, report runs, and release/version records.
- Produces: authorization-filtered search results that route to the owning application and record without losing the current work-unit context.
- Verifies: every valid field in the approved section-15 migration matrix remains reachable in the redesigned application.

- [ ] **Step 1: Write failing search-core tests**

Define:

```ts
export type EnterpriseSearchResultType =
  | "object"
  | "work-item"
  | "document"
  | "exception"
  | "report"
  | "release-version";

export interface EnterpriseSearchRecord {
  id: string;
  type: EnterpriseSearchResultType;
  title: string;
  subtitle: string;
  businessDomain: FormalApplication;
  regionId: string | null;
  regionLabel: string;
  periodKey: string | null;
  status: string;
  tokens: readonly string[];
  route: FormalRoute;
  selection: FormalSelection;
  permissionKeys: readonly string[];
  scopeRegionIds: readonly string[];
}

export interface EnterpriseSearchResult {
  record: EnterpriseSearchRecord;
  score: number;
  matchedFields: readonly string[];
}

export interface EnterpriseSearchAuthorization {
  permissionKeys: readonly string[];
  authorizedRegionIds: readonly string[];
}

export interface EnterpriseSearchOptions {
  maximumResults: number;
  recentRecordIds: readonly string[];
}

export function searchEnterpriseRecords(
  query: string,
  records: readonly EnterpriseSearchRecord[],
  authorization: EnterpriseSearchAuthorization,
  options: EnterpriseSearchOptions,
): readonly EnterpriseSearchResult[];
```

Require search across all six result types, case-insensitive Latin tokens, Chinese substring tokens, stable relevance order, type grouping, permission filtering, region authorization filtering, and an empty-query recent-items result. Results visibly expose business domain, region, period, status, and matched fields. Unauthorized record titles must not leak into result counts or group headings.

Run:

```bash
npx vitest run src/prototype/application/enterpriseSearch.spec.ts
```

Expected: FAIL because the search core is absent.

- [ ] **Step 2: Implement search records as projections of authoritative fixtures**

`enterpriseSearchFixtures.ts` imports business IDs and labels from Tasks 5–8 fixtures and maps them into `EnterpriseSearchRecord`; it must not duplicate business values. Implement the declared pure function with deterministic ranking, recent-item ordering for the empty query, and the explicit maximum-result limit.

- [ ] **Step 3: Write failing global-search interaction tests**

Require:

- `⌘K` and `Ctrl+K` open search;
- input is labelled “搜索对象、任务、异常、报告和版本”;
- arrow keys move through results, Enter activates, Escape closes;
- group headings expose result type and count;
- selecting a result changes `page`, `section`, and `recordId` in the URL;
- browser Back/Forward restores the prior route, record, and filter scope;
- no-result and authorization-filtered states are distinct;
- focus returns to the invoking control on close.

Run:

```bash
npx vitest run src/prototype/components/EnterpriseGlobalSearch.spec.tsx src/prototype/EnterpriseShell.spec.tsx src/prototype/useFormalEnterpriseLocation.spec.tsx
```

Expected: FAIL because the shell search is inert.

- [ ] **Step 4: Implement the global search and shared task routing**

Replace the decorative shell input with `EnterpriseGlobalSearch`. Route work-item results through the same `workId` used by My Work and the owning production/market task detail; route object results to the registry/document view; route reports and releases to Reporting or Supply versions. Keep `recordId` separate from business filters in URL parsing.

- [ ] **Step 5: Write and satisfy the complete field-preservation test**

Create `prototypeFieldReachability.spec.tsx` over the already-complete mechanical `prototypeFieldMap`. Assert every mapped field is visible in its new owning surface or detail view. At minimum include:

- production list and detail fields, all collection-mode fields, summary counters, quality states, reviews, releases, and regional ledgers;
- market list and detail fields, all thirteen business roles, capabilities, subject/logistics fields, source/review/publication states, and administrative ledger;
- every supply account row and all source/version/status/action fields;
- report summary, metrics, chapters, authorship, review/amendment, lifecycle, and exports;
- executive operating, risk, duty, and release fields;
- the current value plus Y-1/Y-2/Y-3 values and comparison state for every comparable metric family.

The inventory fails if a field is represented only by an unlabeled number, hidden decorative element, or stale public capability encyclopedia.

Run:

```bash
npx vitest run src/prototype/prototypeFieldReachability.spec.tsx src/prototype/FormalEnterprisePrototype.spec.tsx src/prototype/PortalWorkspaces.spec.tsx
```

Expected on first run: FAIL specifically because work-item/object/report/release selections are not yet routed from the integrated shell to their owning detail surfaces. Make it GREEN by implementing those routes; do not add fictitious missing-field assertions.

- [ ] **Step 6: Run Task 9 tests GREEN and commit**

Run:

```bash
npx vitest run src/prototype/application/enterpriseSearch.spec.ts src/prototype/components/EnterpriseGlobalSearch.spec.tsx src/prototype/EnterpriseShell.spec.tsx src/prototype/useFormalEnterpriseLocation.spec.tsx src/prototype/prototypeFieldReachability.spec.tsx src/prototype/FormalEnterprisePrototype.spec.tsx src/prototype/PortalWorkspaces.spec.tsx
npx tsc -p src/prototype/tsconfig.json --pretty false
npx vitest run src/prototype
```

Compare the external SHA-256 manifest with its baseline. Then stage exactly:

```bash
git add src/prototype/application/enterpriseSearch.ts src/prototype/application/enterpriseSearch.spec.ts src/prototype/data/enterpriseSearchFixtures.ts src/prototype/components/EnterpriseGlobalSearch.tsx src/prototype/components/EnterpriseGlobalSearch.spec.tsx src/prototype/prototypeFieldReachability.spec.tsx src/prototype/EnterpriseShell.tsx src/prototype/EnterpriseShell.spec.tsx src/prototype/useFormalEnterpriseLocation.ts src/prototype/useFormalEnterpriseLocation.spec.tsx src/prototype/FormalEnterprisePrototype.tsx src/prototype/FormalEnterprisePrototype.spec.tsx src/prototype/MyWorkWorkspace.tsx src/prototype/PortalWorkspaces.spec.tsx src/prototype/formal-enterprise.css
git diff --cached --check
git commit -m "feat: connect authorized enterprise search and records"
```

Expected: only the listed `src/prototype` files are committed.

---

### Task 10: Visual-System Consolidation, Responsive QA, and Final Verification

**Files:**

- Modify: `src/prototype/formal-enterprise.css`
- Modify: `src/prototype/market-monitoring.css`
- Modify: `src/prototype/unified-workspaces.css`
- Verify unchanged: `src/prototype/prototype.css`
- Verify unchanged: `src/prototype/EnterpriseArchitecturePrototype.tsx`

**Interfaces:**

- Consumes: every redesigned workspace and state from Tasks 1–9.
- Produces: one coherent visual hierarchy and evidence that architecture, behavior, accessibility, responsive layout, fields, and repository isolation are correct.

- [ ] **Step 1: Establish the pre-cleanup GREEN regression and visual baseline**

Run the complete prototype suite and dedicated prototype typecheck. They must already be GREEN because semantic/accessibility RED tests belong to Tasks 3–9, where the owning markup can be changed. Confirm those tests cover:

- one page title and one primary action per workspace;
- filter bars rendered before result summaries;
- ledgers used for repeated operational records instead of card grids;
- cards reserved for a small number of executive signals, exceptions, or document summaries;
- trend SVGs have accessible names and a tabular fallback;
- rise/fall/flat comparison states plus independent business-risk meaning, neither communicated by color alone;
- loading, empty, partial, permission-denied, not-found, invalid-scope, and stale-version states have explicit text;
- table headers remain associated with cells after responsive transformation;
- dialogs trap focus and return it on close.

Capture pre-cleanup screenshots under `/tmp/qiqihar-enterprise-visual-qa/before/`. Task 10 changes CSS only; if a semantic defect is discovered, return it to the owning earlier task/test rather than hiding it with CSS.

- [ ] **Step 2: Consolidate the enterprise visual language**

Keep the current restrained navy/teal enterprise identity while defining one token layer for canvas, surface, border, text, muted text, focus, success, warning, danger, spacing, radii, row heights, and page widths. Use:

- dense, aligned filter and ledger surfaces for daily work;
- a stronger answer hierarchy for supply calculation and executive risk;
- consistent tab, table, status, form, and dialog patterns across domains;
- 8-pixel spacing rhythm, 44-pixel minimum interactive height, visible focus rings, and no body-text color below AA contrast;
- no decorative gradients, glass effects, oversized hero copy, excessive rounded cards, or default-Qiqihar visual assumptions.

Delete selectors only after `rg` proves they are unused. Do not edit `prototype.css`.

- [ ] **Step 3: Run formatting, lint, type, unit, and build verification**

Run in this order:

```bash
npx prettier --check 'src/prototype/**/*.{ts,tsx,css}'
npx eslint src/prototype --max-warnings 0
npx vitest run src/prototype
npx tsc -p src/prototype/tsconfig.json --pretty false
npx tsc -b --pretty false
npm run build:prototype
```

If repository-wide TypeScript reports failures in user-owned paths outside `src/prototype`, record them separately and prove there is no prototype diagnostic with:

```bash
npx tsc -b --pretty false 2>&1 | tee /tmp/qiqihar-enterprise-tsc.log
rg 'src/prototype/' /tmp/qiqihar-enterprise-tsc.log
```

Expected: Prettier, prototype ESLint, dedicated prototype typecheck, all prototype tests, and `build:prototype` pass. Repository-wide `tsc -b` may still report untouched user-owned main-application diagnostics; `rg` must return no prototype diagnostic. Do not “fix” external user-owned failures.

- [ ] **Step 4: Run browser-level responsive and state QA**

Start the prototype server without writing to the repo:

```bash
npm run prototype -- --host 127.0.0.1
```

Using the local browser-testing workflow, capture PNGs under `/tmp/qiqihar-enterprise-visual-qa/` at widths 1024, 1280, 1440, and 1920 for:

- Executive Overview operations and risks;
- Production tasks, objects, object detail, and analysis;
- Market tasks, objects, object detail, and analysis;
- Supply calculation, comparison, versions, blocked, and not-found states;
- Reporting compose, invalid parameters, preview, review-distribution, and ledger;
- global search open, no results, and grouped results.

For each width verify no horizontal page overflow, clipped action, overlapping text, detached sticky header, inaccessible dialog footer, or truncated comparison label. Exercise query changes, Back/Forward, keyboard search, selectors, task-to-detail navigation, object-to-document navigation, supply version change, report invalidation, and report preview.

- [ ] **Step 5: Perform final field, arithmetic, and isolation audits**

Run:

```bash
npx vitest run src/prototype/prototypeFieldPreservation.spec.ts src/prototype/prototypeFieldReachability.spec.tsx src/prototype/core/comparableSeries.spec.ts src/prototype/core/supplyAccount.spec.ts src/prototype/core/reportRun.spec.ts
git diff --check -- src/prototype
git status --short
```

Recompute the dirty-file SHA-256 manifest outside `src/prototype/**` and compare it byte-for-byte with Task 1's baseline, excluding only this committed plan/spec. Confirm:

- the 33-item seed set and every additional comparable item in `businessComparisonCoverage` have Y/Y-1/Y-2/Y-3 point states or an explicit governed unavailable reason;
- every locally comparable adjacent pair has the correct delta/rate or percentage-point result;
- all supply equations reconcile from source inputs with the selected rule version, and all seven product accounts retain released/preparing/no-release state without fallback;
- preview and all exports reference one report snapshot;
- every approved legacy field appears in the preservation inventory;
- no component contains a literal Qiqihar default, report conclusion, supply tolerance, or demo metric value.

- [ ] **Step 6: Request independent code and visual review**

Run the `requesting-code-review` workflow against the implementation commits. Give the reviewer the approved design spec, this implementation plan, baseline external SHA manifest, test/build output, and visual QA directory. Resolve every correctness, field-loss, accessibility, rule-ambiguity, and scope-leak issue; rerun the affected red/green test before accepting a fix.

- [ ] **Step 7: Commit final visual/verification changes**

Stage only Task 10 CSS files that actually changed:

```bash
git add src/prototype/formal-enterprise.css src/prototype/market-monitoring.css src/prototype/unified-workspaces.css
```

Omit any unchanged path from that command. Never stage `/tmp` evidence or external user changes. Then run:

```bash
git diff --cached --check
git diff --cached --stat
git commit -m "refactor: unify enterprise prototype visual architecture"
```

Finally rerun:

```bash
npx vitest run src/prototype
npm run build:prototype
git status --short
```

Expected: all prototype tests and the prototype build pass; the worktree still shows the same untouched user-owned external changes that existed at baseline.

---
