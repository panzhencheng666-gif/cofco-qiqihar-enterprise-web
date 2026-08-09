# Menu-Locked Product and Workbook Contract Implementation Plan

> **Execution rule:** Implement every task test-first. Keep the existing enterprise architecture, preserve unrelated dirty work, and commit only the files named by the task being completed.

**Goal:** Make every product-specific production, market, and logistics menu the single source of product context so users never select a product again inside a create form, while keeping the create form, list columns, API payload, and generic XLSX workbook contract aligned.

**Architecture:** The formal route owns the product context. Product collection workspaces pass that immutable context into the modal editor and workbook operations. The browser still sends the locked product code as part of the API contract, but the import endpoints independently compare it with workbook metadata before any durable business write. Logistics is split into three product-owned routes to remove its remaining page-level product switcher. Existing `market/logistics` URLs remain readable as a compatibility alias and canonicalize to the corn logistics route; they are not shown as a fourth menu.

**Technology:** React 19, TypeScript, Vitest, Testing Library, Playwright, Spring Boot 4.1, Java 21, PostgreSQL, Flyway, Apache POI, Maven.

---

## Task 1: Establish route-owned product context

**Files:**

- Modify: `src/prototype/formalEnterpriseModel.ts`
- Modify: `src/prototype/formalEnterpriseModel.spec.ts`
- Modify: `src/prototype/formalEnterpriseData.ts`
- Modify: `src/prototype/EnterpriseShell.tsx`
- Modify: `src/prototype/EnterpriseShell.spec.tsx`
- Modify: `src/prototype/MarketMonitoringWorkspace.tsx`
- Modify: `src/prototype/MarketMonitoringWorkspace.spec.tsx`
- Modify: `src/prototype/market/LogisticsMonitoringWorkspace.tsx`
- Modify: `src/prototype/market/LogisticsMonitoringWorkspace.spec.tsx`

### Step 1: Write failing route tests

Add assertions that the formal model supports and serializes these visible routes:

- `market/corn-logistics` → `#/市场监测/玉米物流监测`
- `market/soybean-logistics` → `#/市场监测/大豆物流监测`
- `market/paddy-logistics` → `#/市场监测/稻谷物流监测`

Assert that the old `market/logistics` hash remains readable but writes back as the corn logistics canonical route. Assert that the market navigation tree contains exactly the three product logistics entries and not the old generic entry.

### Step 2: Run the focused tests and confirm RED

Run:

```bash
npm run test -- --run src/prototype/formalEnterpriseModel.spec.ts src/prototype/EnterpriseShell.spec.tsx src/prototype/MarketMonitoringWorkspace.spec.tsx src/prototype/market/LogisticsMonitoringWorkspace.spec.tsx
```

Expected: failures because the three product logistics routes and route-owned logistics product do not exist.

### Step 3: Add the minimum route model

Add the three product logistics sections and a typed helper that maps collection/logistics sections to `CORN`, `SOYBEAN`, or `RICE`. Retain `logistics` only as a hidden compatibility input. Update:

- the left business navigation;
- the top-level logistics application landing route;
- active application detection;
- work-item-to-route mapping;
- `MarketMonitoringWorkspace` logistics dispatch.

`LogisticsMonitoringWorkspace` must receive a required `productCode` prop and must remove its editable product selector. It may show the locked product as plain business context text, but never as a selectable control.

### Step 4: Re-run focused tests and commit

Run the same command and require all tests green, then commit only the task files:

```bash
git commit -m "feat: split logistics monitoring by product"
```

## Task 2: Lock production and market create forms to the current menu

**Files:**

- Modify: `src/prototype/production/ProductProductionCollectionWorkspace.tsx`
- Modify: `src/prototype/production/ProductProductionCollectionWorkspace.spec.tsx`
- Modify: `src/prototype/market/ProductMarketCollectionWorkspace.tsx`
- Modify: `src/prototype/market/ProductMarketCollectionWorkspace.spec.tsx`
- Modify: `src/prototype/FormalEnterprisePrototype.tsx`
- Modify: `src/prototype/FormalEnterprisePrototype.spec.tsx`
- Modify: `src/prototype/realtime/realtimeRecordFormModel.ts`
- Modify: `src/prototype/realtime/realtimeRecordFormModel.spec.ts`
- Modify: `src/prototype/realtime/RealtimeBusinessOperationsPanel.tsx`
- Modify: `src/prototype/realtime/RealtimeBusinessOperationsPanel.spec.tsx`
- Modify: `src/prototype/styles.css`

### Step 1: Write failing UI and payload tests

For corn, soybean, and rice production and market routes, assert:

- clicking “新建调查记录” opens the in-content modal;
- the dialog has a close button and retains the compact, scrollable grouped layout;
- no combobox or input named `品种` is rendered;
- the current route product is displayed only as non-editable context;
- `具体品种` remains a free-text input;
- saving a production record sends the route product to `createProduction`;
- saving a market record sends the route product to `createMarket`;
- opening a record from another product fails closed and never changes the current route product;
- closing returns to the unchanged list/filter page.

Add model tests showing `productionPayloadFromValues(values, lockedProductCode, definition)` ignores any stale `values.productCode` key.

### Step 2: Run focused tests and confirm RED

Run:

```bash
npm run test -- --run src/prototype/realtime/realtimeRecordFormModel.spec.ts src/prototype/realtime/RealtimeBusinessOperationsPanel.spec.tsx src/prototype/FormalEnterprisePrototype.spec.tsx src/prototype/production/ProductProductionCollectionWorkspace.spec.tsx src/prototype/market/ProductMarketCollectionWorkspace.spec.tsx
```

Expected: failures because `RealtimeBusinessOperationsPanel` still selects the first master product and exposes a product combobox.

### Step 3: Implement immutable product propagation

Make `lockedProductCode` a required `RealtimeBusinessOperationsPanel` prop. Remove `productCode` from `productionCoreFields`, remove `setProductCode`, and remove product-option/edit branches. Load definitions, list data, downloads, imports, and saves only with `lockedProductCode`.

Change `productionPayloadFromValues` to receive the locked code explicitly. Product workspaces must call `onCreateRecord(productCode)` using their route context. `FormalEnterprisePrototype` stores the product code together with the entry domain and passes it to the modal. Do not default to the first configured product.

If the locked code is absent from master data, or a fetched record has a different product code, show a business-facing error and do not save or switch products.

Retain the existing modal overlay within the content area. Keep the close control, grouped fieldsets, two-column responsive grid, internal scrolling, and sticky action footer. Do not introduce a full-page create route or developer terminology.

### Step 4: Re-run focused tests and commit

Require all focused tests green and commit only the named files:

```bash
git commit -m "fix: lock record forms to menu product"
```

## Task 3: Make XLSX upload inherit and verify menu context

**Frontend files:**

- Modify: `src/platform/api/realtimeBusinessRepository.ts`
- Modify: `src/platform/api/realtimeBusinessRepository.spec.ts`
- Modify: `src/prototype/realtime/RealtimeBusinessOperationsPanel.tsx`
- Modify: `src/prototype/realtime/RealtimeBusinessOperationsPanel.spec.tsx`
- Modify: `src/prototype/market/ProductMarketCollectionWorkspace.tsx`
- Modify: `src/prototype/market/ProductMarketCollectionWorkspace.spec.tsx`
- Modify: `src/prototype/market/LogisticsMonitoringWorkspace.tsx`
- Modify: `src/prototype/market/LogisticsMonitoringWorkspace.spec.tsx`

**Backend files:**

- Modify: `src/main/java/com/cofco/qiqihar/graintrade/importing/interfaceadapter/ProductionImportController.java`
- Modify: `src/main/java/com/cofco/qiqihar/graintrade/importing/interfaceadapter/MarketImportController.java`
- Modify: `src/main/java/com/cofco/qiqihar/graintrade/importing/interfaceadapter/LogisticsImportController.java`
- Modify: `src/main/java/com/cofco/qiqihar/graintrade/importing/application/ProductionImportService.java`
- Modify: `src/main/java/com/cofco/qiqihar/graintrade/importing/application/MarketImportService.java`
- Modify: `src/main/java/com/cofco/qiqihar/graintrade/importing/application/LogisticsImportService.java`
- Modify: `src/main/resources/openapi/grain-trade-v1.yaml`
- Modify: `src/test/java/com/cofco/qiqihar/graintrade/importing/interfaceadapter/ProductionImportRestIntegrationTest.java`
- Modify: `src/test/java/com/cofco/qiqihar/graintrade/importing/interfaceadapter/MarketImportRestIntegrationTest.java`
- Modify: `src/test/java/com/cofco/qiqihar/graintrade/importing/interfaceadapter/LogisticsImportRestIntegrationTest.java`

### Step 1: Write failing cross-product import tests

For each domain, generate a valid soybean workbook, then upload it through a corn menu context. Require:

- HTTP 400 with a stable `IMPORT_CONTEXT_MISMATCH` business error;
- zero new production, market, or logistics records;
- zero completed import rows and audit side effects;
- a matching corn upload succeeds and persists only corn records.

Also assert that the visible workbook sheet contains the domain’s editable fields but no editable product column. Product remains workbook metadata generated by the server.

### Step 2: Run backend tests and confirm RED

Run:

```bash
JAVA_HOME=/opt/homebrew/opt/openjdk@21 mvn -Dtest=ProductionImportRestIntegrationTest,MarketImportRestIntegrationTest,LogisticsImportRestIntegrationTest test
```

Expected: failures because upload endpoints currently trust workbook metadata and receive no expected menu context.

### Step 3: Enforce expected context before processing

Require `productCode` on all three multipart upload endpoints and require `objectTypeCode` where the menu/form selected an object type. Pass these values into the import services. Parse workbook context and compare it with the expected context before validating rows or writing business records. A mismatch must use the same error code in all domains.

For compatible legacy CSV imports, compare any product/object fields with the expected menu context and reject mismatches; do not silently rewrite a conflicting row.

Update the frontend repository import signatures to accept the locked product and object type and send them as multipart request query parameters. All workspace and modal import buttons must pass current route context. Keep one generic field-definition-driven XLSX implementation rather than one hand-coded workbook per product.

### Step 4: Verify frontend request construction

Run:

```bash
npm run test -- --run src/platform/api/realtimeBusinessRepository.spec.ts src/prototype/realtime/RealtimeBusinessOperationsPanel.spec.tsx src/prototype/market/ProductMarketCollectionWorkspace.spec.tsx src/prototype/market/LogisticsMonitoringWorkspace.spec.tsx
```

Require upload request URLs to contain the locked product/object context and never a user-selected product.

### Step 5: Commit backend and frontend independently

```bash
git commit -m "fix: verify workbook menu context"
```

Use one exact commit in each repository; do not combine unrelated dirty files.

## Task 4: Prove form/list/workbook field parity

**Frontend files:**

- Modify: `src/prototype/production/ProductProductionCollectionWorkspace.contract.spec.tsx`
- Modify: `src/prototype/market/ProductMarketCollectionWorkspace.contract.spec.tsx`
- Modify: `src/prototype/market/LogisticsMonitoringWorkspace.spec.tsx`
- Modify: `src/prototype/realtime/RealtimeBusinessOperationsPanel.spec.tsx`

**Backend files:**

- Modify: `src/test/java/com/cofco/qiqihar/graintrade/importing/interfaceadapter/ProductionImportRestIntegrationTest.java`
- Modify: `src/test/java/com/cofco/qiqihar/graintrade/importing/interfaceadapter/MarketImportRestIntegrationTest.java`
- Modify: `src/test/java/com/cofco/qiqihar/graintrade/importing/interfaceadapter/LogisticsImportRestIntegrationTest.java`

### Step 1: Add a single parity assertion per domain

Derive expected editable fields from the backend definition response. Assert that:

- every non-read-only definition field appears in the create form;
- every non-read-only definition field appears in the XLSX template;
- every list column is either a definition field or an explicitly documented derived/read-only field;
- derived fields such as estimated output and year-on-year comparison are never editable;
- product and account-locked reporter are context fields, not editable workbook/form fields;
- `具体品种` is editable text and is present in form, detail, and workbook contracts.

Do not duplicate static field arrays in tests; compare normalized field codes from the same definition contract so future schema changes fail the gate automatically.

### Step 2: Run parity tests and repair any missing mappings

Run the focused frontend and backend suites. If a definition field is missing, add it through the definition-driven renderer/template rather than adding a one-off control.

### Step 3: Commit parity gates

```bash
git commit -m "test: enforce business field contract parity"
```

## Task 5: Cross-repository acceptance and clean-snapshot verification

**Files:**

- Modify: `e2e/canonical-workflow.spec.ts`
- Modify: `e2e/support/api-server.mjs`
- Create or modify: `docs/superpowers/verification/2026-08-09-menu-product-workbook-acceptance.md`

### Step 1: Add browser acceptance coverage

Against the controlled API and then the real local backend, cover:

1. open soybean production menu;
2. confirm no product selector;
3. fill `具体品种` as free text;
4. complete required fields and attach evidence;
5. save and verify the POST payload and persisted row are soybean;
6. close and confirm the list refreshes without route loss;
7. download soybean XLSX and import it successfully through soybean context;
8. attempt the same file through corn context and verify safe rejection;
9. repeat the context check for market and logistics;
10. confirm no console errors, page errors, developer wording, or fixture fallback.

### Step 2: Run all fresh quality gates

Frontend:

```bash
npm run verify
```

Backend:

```bash
JAVA_HOME=/opt/homebrew/opt/openjdk@21 mvn verify
```

Also run Flyway empty-schema replay and a clean detached worktree verification for each repository. A dirty combined worktree result is supporting evidence only; the exact committed snapshot must pass independently.

### Step 3: Record evidence and complete the batch

Record test counts, browser scenarios, schema replay, cross-product rejection, and commit SHAs in the verification document. Do not mark this batch complete unless all tests pass without skips and both repositories have an empty index.

---

## Completion criteria

- Production, market, and logistics each have product-owned menu routes.
- No create form contains an editable product field.
- `具体品种` is a free-text business field.
- New records, lists, downloads, and imports remain within the current route product.
- A workbook for one product cannot be imported through another product menu.
- Form, list, API definition, and XLSX field contracts are automatically checked for parity.
- All UI text is business-facing; no port, backend, database, environment, fixture, demo, or implementation terminology is visible.
- Focused tests, full frontend verification, full backend verification, Flyway replay, and clean-snapshot tests all pass.
