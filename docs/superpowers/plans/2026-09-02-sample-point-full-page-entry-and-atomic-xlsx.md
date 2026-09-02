# Sample Point Full-Page Entry and Atomic XLSX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Replace sample-point drawers and inline cards with recoverable full-page workflows, add real atomic XLSX imports for design and formal sample masters, expose existing governed business-data XLSX imports from the full-page observation flow, and close the loop through authoritative requery, SSE, PR CI, merge CI, and browser acceptance.

**Architecture:** Backend owns workbook generation, one-pass validation, transactionality, idempotency, audit, and events. Web persists sample workflow pages in the existing formal hash location, renders list/form/import views as full-width workspaces, and delegates all data truth to the realtime repository. Existing production, market, and logistics import services remain the only period-data XLSX writers; the new master-data imports are separate and never create drafts or approval states.

**Tech Stack:** Java 25, Spring Boot, PostgreSQL/PostGIS, Spring JDBC, JUnit/MockMvc, TypeScript, React 19, Vite, Vitest/Testing Library, Playwright, SSE.

## Global Constraints

- New, view, edit, and latest-business-data update must be complete route-backed pages; no right drawer, side rail, or inline edit card.
- Object type from the latest formal sample controls the authoritative business field definition.
- Every XLSX import is upload -> one automatic validation -> atomic direct database write -> authoritative requery and SSE.
- Any invalid row means zero imported rows for the entire workbook and a downloadable row-error file.
- No draft, submission, approval, publication, retry workflow, or second user confirmation-to-write step.
- Design samples remain year-independent; stable formal sample data stays separate from period observations.
- No fixture, placeholder, fake success, internal ID, internal code, or unavailable static control may appear in the business UI.
- Backend and Web use separate branches and commits; PR CI and post-merge main CI must pass before browser runtime claims.
- Actual browser deployment is complete only when the running asset hash matches the merged source and live manual acceptance passes.

---

## File Structure

Backend repository: /Users/federal/Documents/Codex/2026-09-02/cofco-web-unified-existing-sample-ledger-20260902/work/backend-sample-full-page-entry

- Create src/main/java/com/cofco/qiqihar/graintrade/samplepoint/importing/SamplePointMasterWorkbook.java for hardened XLSX creation/parsing.
- Create src/main/java/com/cofco/qiqihar/graintrade/samplepoint/importing/SamplePointImportResult.java for the small completed-result projection.
- Create DesignSamplePointImportService.java and FormalSamplePointImportService.java beside their aggregate services.
- Modify both sample controllers and services to share manual/import validation.
- Add DesignSamplePointImportRestIntegrationTest.java, FormalSamplePointImportRestIntegrationTest.java, and SamplePointMasterWorkbookTest.java.
- Reuse platform.import_job, platform.import_row_outcome, audit, and outbox persistence; add no draft or approval schema.

Web repository: /Users/federal/Documents/Codex/2026-09-02/cofco-web-ledger-browser-closeout/work/web-ledger-browser-closeout

- Modify formalEnterpriseModel.ts and its tests to persist sample workflow selections in the hash.
- Modify realtimeBusinessRepository.ts and its tests for master-template/upload/error APIs.
- Create SamplePointImportPanel.tsx, FormalSamplePointWorkspace.tsx, FormalSamplePointFormPage.tsx, FormalSampleObservationPage.tsx, and DesignSamplePointFormPage.tsx.
- Refactor FormalSamplePointLedger.tsx and DesignSamplePointTable.tsx into list-only tables.
- Refactor ExistingSampleObservationPanel.tsx and SamplePointGovernanceWorkspace.tsx into route switches.
- Pass controlled selection through production, market, logistics, and EnterpriseBusinessApplication.
- Replace drawer/card CSS and add browser tests.

### Task 1: Prepare Backend branch and write red endpoint contracts

**Files:**
- Test: src/test/java/com/cofco/qiqihar/graintrade/designsample/point/interfaceadapter/DesignSamplePointImportRestIntegrationTest.java
- Test: src/test/java/com/cofco/qiqihar/graintrade/formalsamplepoint/interfaceadapter/FormalSamplePointImportRestIntegrationTest.java

**Interfaces:**
- Consumes: current origin/main CRUD, import-job, audit, and outbox contracts.
- Produces: failing contracts for Tasks 2-4.

- [ ] **Step 1: Create the isolated Backend worktree**

    git fetch origin main
    git worktree add -b codex/20260902-sample-full-page-entry \
      /Users/federal/Documents/Codex/2026-09-02/cofco-web-unified-existing-sample-ledger-20260902/work/backend-sample-full-page-entry \
      origin/main
    git -C /Users/federal/Documents/Codex/2026-09-02/cofco-web-unified-existing-sample-ledger-20260902/work/backend-sample-full-page-entry status --short --branch

Expected: clean feature branch tracking current origin/main.

- [ ] **Step 2: Write endpoint tests for these exact resources**

    GET  /api/v1/design-sample-points/import-template
    POST /api/v1/design-sample-points/imports
    GET  /api/v1/design-sample-points/imports/{importId}/errors
    GET  /api/v1/formal-sample-points/import-template
    POST /api/v1/formal-sample-points/imports
    GET  /api/v1/formal-sample-points/imports/{importId}/errors

Each POST uses multipart part file and Idempotency-Key. Cover a valid two-row workbook, row 3 invalid, identical replay, key reuse with different bytes, out-of-scope region, invalid formal maintainer, and cross-template upload.

- [ ] **Step 3: Prove the endpoint tests fail**

    ./mvnw -Dtest=DesignSamplePointImportRestIntegrationTest,FormalSamplePointImportRestIntegrationTest test

Expected: FAIL with 404.

- [ ] **Step 4: Commit red tests**

    git add src/test/java/com/cofco/qiqihar/graintrade/designsample/point/interfaceadapter/DesignSamplePointImportRestIntegrationTest.java \
      src/test/java/com/cofco/qiqihar/graintrade/formalsamplepoint/interfaceadapter/FormalSamplePointImportRestIntegrationTest.java
    git commit -m "test: define atomic sample point xlsx imports"

### Task 2: Build the safe shared workbook boundary

**Files:**
- Create: src/main/java/com/cofco/qiqihar/graintrade/samplepoint/importing/SamplePointMasterWorkbook.java
- Create: src/test/java/com/cofco/qiqihar/graintrade/samplepoint/importing/SamplePointMasterWorkbookTest.java

**Interfaces:**
- Consumes: hardened ZIP/XML limits and metadata binding from BusinessImportWorkbook.
- Produces:

    public final class SamplePointMasterWorkbook {
        public enum Kind { DESIGN, FORMAL }
        public record Column(String code, String label, boolean required) {}
        public record Template(Kind kind, String version, String digest, List<Column> columns) {}
        public record Row(int rowNumber, Map<String, String> values) {}
        public static byte[] create(Template template);
        public static List<Row> parse(byte[] bytes, Template expected, int maximumRows);
    }

- [ ] **Step 1: Write failing parser/template tests**

Cover exact header order, hidden kind/version/digest, Office round trip, missing/extra/reordered columns, wrong kind, macro/external relationship, ZIP expansion, 5,001 rows, oversized text, formula cells, blank workbook, and stable row numbers.

- [ ] **Step 2: Run and see the missing class**

    ./mvnw -Dtest=SamplePointMasterWorkbookTest test

Expected: compile failure because the class does not exist.

- [ ] **Step 3: Implement the workbook**

Use existing hardened XLSX primitives. Throw only INVALID_SAMPLE_POINT_IMPORT_FORMAT, SAMPLE_POINT_IMPORT_LIMIT_EXCEEDED, or SAMPLE_POINT_IMPORT_TEMPLATE_MISMATCH. Accept XLSX only. Include no internal ID, expected version, draft, approval, publish, or year column.

- [ ] **Step 4: Run and commit**

    ./mvnw -Dtest=SamplePointMasterWorkbookTest test
    git add src/main/java/com/cofco/qiqihar/graintrade/samplepoint/importing/SamplePointMasterWorkbook.java \
      src/test/java/com/cofco/qiqihar/graintrade/samplepoint/importing/SamplePointMasterWorkbookTest.java
    git commit -m "feat: add safe sample point xlsx contract"

Expected: PASS and clean commit.

### Task 3: Implement atomic design-sample import

**Files:**
- Create: src/main/java/com/cofco/qiqihar/graintrade/samplepoint/importing/SamplePointImportResult.java
- Create: src/main/java/com/cofco/qiqihar/graintrade/designsample/point/application/DesignSamplePointImportService.java
- Modify: src/main/java/com/cofco/qiqihar/graintrade/designsample/point/application/DesignSamplePointService.java
- Modify: src/main/java/com/cofco/qiqihar/graintrade/designsample/point/interfaceadapter/DesignSamplePointController.java
- Test: DesignSamplePointImportRestIntegrationTest.java

**Interfaces:**

    public record SamplePointImportResult(
        UUID id, String statusCode, int importedRows, int failedRows, Instant completedAt) {}

    public byte[] template();
    public SamplePointImportResult importFile(
        String idempotencyKey, String filename, String mediaType, byte[] bytes);
    public ImportErrorFile errors(UUID importId);

- [ ] **Step 1: Refactor design validation into a no-write reusable boundary**

Manual create and import share metadata version/digest, field applicability, name, region, coordinate, boundary, length, precision, permission, and conflict rules. Validation returns normalized values but writes no point, audit, or event.

- [ ] **Step 2: Generate the design template from current metadata**

Expose business-visible Chinese context and editable stable identity columns only. Exclude observation fields, survey year, IDs, versions, and workflow columns.

- [ ] **Step 3: Implement all-row validation then one transaction**

Reserve by subject/domain/key/digest. Parse and validate every row first. If any error exists, complete the job with ERROR outcomes and importedRows 0; otherwise create all points and complete the job within one transaction. Otherwise-valid rows in a failed workbook use NOT_IMPORTED_ATOMIC_BATCH. Emit the same DESIGN_SAMPLE_POINT_CREATED audit/outbox event as manual create. Never create import drafts.

- [ ] **Step 4: Add controller methods**

Template uses XLSX content type and Chinese filename. Upload returns 201 new or 200 replay. Error download is owner-only and contains original business columns plus 错误代码 and 错误说明.

- [ ] **Step 5: Run and commit**

    ./mvnw -Dtest=SamplePointMasterWorkbookTest,DesignSamplePointImportRestIntegrationTest,DesignSamplePointRestIntegrationTest test
    git add src/main/java/com/cofco/qiqihar/graintrade/samplepoint/importing \
      src/main/java/com/cofco/qiqihar/graintrade/designsample/point
    git commit -m "feat: import design sample points atomically"

Expected: PASS; invalid workbook yields zero design rows and zero design events.

### Task 4: Implement atomic formal-sample import

**Files:**
- Create: src/main/java/com/cofco/qiqihar/graintrade/formalsamplepoint/application/FormalSamplePointImportService.java
- Modify: FormalSamplePointService.java
- Modify: FormalSamplePointController.java
- Test: FormalSamplePointImportRestIntegrationTest.java

**Interfaces:** Same template(), importFile(...), and errors(UUID) signatures as Task 3.

- [ ] **Step 1: Refactor formal validation into a no-write reusable boundary**

Share name, region, address, coordinates, object type, active maintainer, management permission, boundary, occupancy, and conflict rules with manual create.

- [ ] **Step 2: Generate and parse the formal template**

Columns are sample name, region, address, longitude, latitude, object type, and business-visible maintainer. No annual membership or period facts.

- [ ] **Step 3: Validate every row before any write**

Resolve the maintainer through the employee directory and reject inactive, disabled, unauthorized, ambiguous, or absent employees. Detect file-internal duplicate names/coordinates.

- [ ] **Step 4: Write all rows in one transaction**

On success emit FORMAL_SAMPLE_POINT_CREATED per row and complete the import. On any validation failure create only ERROR outcomes with importedRows 0. Do not create annual membership or observation records.

- [ ] **Step 5: Run and commit**

    ./mvnw -Dtest=FormalSamplePointImportRestIntegrationTest,FormalSamplePointWriteRestIntegrationTest,FormalSamplePointRestIntegrationTest,FormalSampleObservationRestIntegrationTest test
    git add src/main/java/com/cofco/qiqihar/graintrade/formalsamplepoint
    git commit -m "feat: import formal sample points atomically"

Expected: PASS with authoritative maintainer requery and no period row.

### Task 5: Complete Backend gate and merge SOP

**Files:** Only Tasks 1-4 files.

- [ ] **Step 1: Run the full gate**

    ./mvnw spotless:check
    ./mvnw verify

Expected: BUILD SUCCESS.

- [ ] **Step 2: Verify boundary**

    git status --short --branch
    git diff origin/main...HEAD --check
    git log --oneline origin/main..HEAD

Expected: clean and only planned files.

- [ ] **Step 3: Push, PR, required CI, and squash merge**

    git push -u origin codex/20260902-sample-full-page-entry
    gh pr create --base main --head codex/20260902-sample-full-page-entry \
      --title "Add atomic sample point XLSX imports" --body-file /tmp/cofco-backend-sample-import-pr.md
    gh pr checks --watch
    gh pr merge --squash --delete-branch

Expected: merge only after all checks succeed; record PR, merge SHA, and run ID.

- [ ] **Step 4: Verify the exact downstream main run**

    gh run list --branch main --limit 5
    gh run watch <resolved run ID whose head SHA is the merge SHA>

Expected: success.

### Task 6: Persist sample workflow pages in Web routing

**Files:**
- Modify: src/business/formalEnterpriseModel.ts
- Modify: src/business/formalEnterpriseModel.spec.ts
- Modify: src/business/useFormalEnterpriseLocation.spec.tsx

**Interfaces:**

    type SampleWorkflowSelectionType =
      | "formal-sample-list" | "formal-sample-create" | "formal-sample-view"
      | "formal-sample-edit" | "formal-sample-observation"
      | "design-sample-list" | "design-sample-create"
      | "design-sample-view" | "design-sample-edit";

- [ ] **Step 1: Write failing reload/back/forward tests**

Assert writeFormalLocation includes allow-listed page and safe opaque entity ID, readFormalLocation restores it, unsafe/overlong IDs are discarded, and old hashes remain compatible.

- [ ] **Step 2: Run the tests**

    npx vitest run src/business/formalEnterpriseModel.spec.ts src/business/useFormalEnterpriseLocation.spec.tsx

Expected: FAIL because selections are not serialized.

- [ ] **Step 3: Implement parsing/serialization and rerun**

Append encoded selection type and safe ID to the hash; preserve current route and normalization; never show the ID in UI.

    npx vitest run src/business/formalEnterpriseModel.spec.ts src/business/useFormalEnterpriseLocation.spec.tsx

Expected: PASS.

- [ ] **Step 4: Commit**

    git add src/business/formalEnterpriseModel.ts src/business/formalEnterpriseModel.spec.ts \
      src/business/useFormalEnterpriseLocation.spec.tsx
    git commit -m "feat: persist sample workflow pages"

### Task 7: Add Web import API and simple import panel

**Files:**
- Modify: src/platform/api/realtimeBusinessRepository.ts
- Modify: src/platform/api/realtimeBusinessRepository.spec.ts
- Create: src/business/formal-sample/SamplePointImportPanel.tsx
- Create: src/business/formal-sample/SamplePointImportPanel.spec.tsx

**Interfaces:**

    interface SamplePointImportResult {
      id: string;
      statusCode: "COMPLETED" | "COMPLETED_WITH_ERRORS";
      importedRows: number;
      failedRows: number;
      completedAt: string;
    }

    downloadDesignSamplePointTemplate(): Promise<Blob>;
    importDesignSamplePoints(file: File, key: string): Promise<SamplePointImportResult>;
    downloadDesignSamplePointImportErrors(id: string): Promise<Blob>;
    downloadFormalSamplePointTemplate(): Promise<Blob>;
    importFormalSamplePoints(file: File, key: string): Promise<SamplePointImportResult>;
    downloadFormalSamplePointImportErrors(id: string): Promise<Blob>;

- [ ] **Step 1: Write failing repository/panel tests**

Assert URLs, XLSX blob, multipart file, Idempotency-Key, new key after completion, imported count, “本次零条入库”, error download, and absence of draft/review/retry/publish text.

- [ ] **Step 2: Run and see compile failures**

    npx vitest run src/platform/api/realtimeBusinessRepository.spec.ts \
      src/business/formal-sample/SamplePointImportPanel.spec.tsx

- [ ] **Step 3: Implement adapters and panel**

    export function SamplePointImportPanel(props: {
      kind: "design" | "formal";
      repository: RealtimeBusinessRepository;
      onImported(): Promise<void> | void;
    }): React.ReactElement;

Render only template download, file chooser, 校验并导入, processing text, final summary, and error download. Never render a workflow timeline.

- [ ] **Step 4: Run and commit**

    npx vitest run src/platform/api/realtimeBusinessRepository.spec.ts \
      src/business/formal-sample/SamplePointImportPanel.spec.tsx
    git add src/platform/api/realtimeBusinessRepository.ts \
      src/platform/api/realtimeBusinessRepository.spec.ts \
      src/business/formal-sample/SamplePointImportPanel.tsx \
      src/business/formal-sample/SamplePointImportPanel.spec.tsx
    git commit -m "feat: connect atomic sample point imports"

Expected: PASS.

### Task 8: Move formal sample writes to complete pages

**Files:**
- Create: FormalSamplePointWorkspace.tsx
- Create: FormalSamplePointFormPage.tsx
- Create: FormalSampleObservationPage.tsx
- Refactor: FormalSamplePointLedger.tsx and ExistingSampleObservationPanel.tsx
- Modify: ExistingSampleObservationPanel.spec.tsx
- Modify: ProductProductionCollectionWorkspace.tsx, ProductMarketCollectionWorkspace.tsx, LogisticsMonitoringWorkspace.tsx

**Interfaces:**

    interface FormalSampleWorkflowProps {
      domain: FormalSampleObservationDomain;
      productCode: string;
      repository: RealtimeBusinessRepository;
      permissions: readonly string[];
      selection?: FormalSelection;
      onSelectionChange(selection: FormalSelection): void;
      onSelectionClear(): void;
      onSaved(): void;
    }

- [ ] **Step 1: Replace drawer tests with failing full-page tests**

Cover list/create/view/edit/delete confirmation/maintainer/observation update/back/requery/SSE/period XLSX. Assert no existing-observation__drawer, editing dialog, formal-sample-ledger__editor, or side detail.

- [ ] **Step 2: Run and verify failure**

    npx vitest run src/business/formal-sample/ExistingSampleObservationPanel.spec.tsx

- [ ] **Step 3: Make the ledger list-only**

Keep filters, pagination, deletion confirmation, permission actions, import panel, and SSE requery. Row actions emit route selections.

- [ ] **Step 4: Implement stable-data full page**

Edit reads current point first, saves expected version, rereads authority, then reports success and returns. Maintainer reassignment remains reason-required.

- [ ] **Step 5: Implement object-type-driven observation full page**

Read latest sample, use its objectTypeCode with domain/product to load the field definition, lock identity, prefill latest values, show compact history, save only applicable fields, requery, and return. Expose existing real governed period XLSX import only for the matching domain/product endpoint.

- [ ] **Step 6: Wire selection through production, market, and logistics**

Base business ledger renders only when no formal sample workflow page is active.

- [ ] **Step 7: Run and commit**

    npx vitest run src/business/formal-sample/ExistingSampleObservationPanel.spec.tsx \
      src/business/ProductionMonitoringWorkspace.spec.tsx \
      src/business/MarketMonitoringWorkspace.spec.tsx
    git add src/business/formal-sample \
      src/business/production/ProductProductionCollectionWorkspace.tsx \
      src/business/market/ProductMarketCollectionWorkspace.tsx \
      src/business/market/LogisticsMonitoringWorkspace.tsx
    git commit -m "feat: move formal sample writes to full pages"

Expected: PASS.

### Task 9: Move design sample writes to complete pages

**Files:**
- Create: src/business/samplepoint/DesignSamplePointFormPage.tsx
- Modify: DesignSamplePointTable.tsx
- Modify: SamplePointGovernanceWorkspace.tsx
- Modify: SamplePointGovernanceWorkspace.spec.tsx
- Modify: EnterpriseBusinessApplication.tsx

- [ ] **Step 1: Write failing design page tests**

Cover route-backed create/view/edit, refresh, context-first field contract, save/requery/return, deletion confirmation, import/error file, SSE reload/conflict, and no nested design-sample-point-editor.

- [ ] **Step 2: Run and verify failure**

    npx vitest run src/business/samplepoint/SamplePointGovernanceWorkspace.spec.tsx

- [ ] **Step 3: Implement list-only table and full-page form**

The list emits route callbacks. The form loads the authoritative context contract, renders editable fields, creates/updates, rereads saved detail, and returns. It never adds surveyYear.

- [ ] **Step 4: Add import and SSE**

Import success reloads list/total. Events reload non-dirty pages; same-object events on a dirty form show a conflict notice without overwriting user input.

- [ ] **Step 5: Run and commit**

    npx vitest run src/business/samplepoint/SamplePointGovernanceWorkspace.spec.tsx \
      src/business/EnterpriseBusinessApplication.spec.tsx
    git add src/business/samplepoint src/business/EnterpriseBusinessApplication.tsx
    git commit -m "feat: move design sample writes to full pages"

Expected: PASS.

### Task 10: Remove card/drawer styling and verify responsive browser behavior

**Files:**
- Modify: src/business/market-monitoring.css
- Modify: src/business/samplepoint/sample-point-governance-workspace.css
- Modify: src/business/unified-workspaces.css
- Modify: tests/enterprise-workflows.spec.ts

- [ ] **Step 1: Write failing source/style/browser assertions**

Assert no fixed sample drawer, no two-pane side detail, continuous section separators, full-width main form, 390px one-column fields, desktop two-column fields, no horizontal overflow, and back restoration.

- [ ] **Step 2: Implement restrained enterprise layout**

Use headings, border separators, grid form rows, and one action bar. Do not introduce rounded card collections, shadows, metrics cards, or decorative whitespace.

- [ ] **Step 3: Run focused and browser tests**

    npx vitest run src/business/formal-sample/ExistingSampleObservationPanel.spec.tsx \
      src/business/samplepoint/SamplePointGovernanceWorkspace.spec.tsx
    npm run build
    npm run test:e2e:preview -- --grep "sample"

Expected: PASS with no console warnings, including the null-controlled-input warning.

- [ ] **Step 4: Commit**

    git add src/business/market-monitoring.css \
      src/business/samplepoint/sample-point-governance-workspace.css \
      src/business/unified-workspaces.css tests/enterprise-workflows.spec.ts
    git commit -m "fix: present sample entry as formal workspaces"

### Task 11: Complete Web gate, merge, governed deployment, and live acceptance

**Files:** Planned files only; update the approved spec status after verified closure.

- [ ] **Step 1: Run the complete Web gate**

    npm run verify

Expected: all format, lint, architecture, inventory, Vitest, runtime, identity, preproduction, performance, observability, build, budget, and Playwright gates pass.

- [ ] **Step 2: Commit status and verify boundary**

    git add docs/superpowers/specs/2026-09-02-sample-point-full-page-entry-and-atomic-xlsx-design.md
    git commit -m "docs: record sample workflow verification"
    git status --short --branch
    git diff origin/main...HEAD --check

Expected: clean, planned boundary.

- [ ] **Step 3: Push, PR, required CI, and squash merge**

    git push -u origin codex/20260902-sample-full-page-entry
    gh pr create --base main --head codex/20260902-sample-full-page-entry \
      --title "Move sample point writes to full-page workflows" \
      --body-file /tmp/cofco-web-sample-pages-pr.md
    gh pr checks --watch
    gh pr merge --squash --delete-branch

Expected: merge only after checks succeed; record PR, merge SHA, and run ID.

- [ ] **Step 4: Verify exact downstream Web main CI**

    gh run list --branch main --limit 5
    gh run watch <resolved run ID whose head SHA equals the merge SHA>

Expected: success.

- [ ] **Step 5: Publish only through the governed release path**

Use the canonical three-repository release manifest bound to exact merged SHAs, artifacts, SBOMs, configuration, and immutable image digests. Do not substitute an ad-hoc Vite server.

    npm run verify:local-runtime

Expected: served asset hash matches the Web merge. If release evidence is unavailable, report a deployment blocker and do not claim browser deployment.

- [ ] **Step 6: Run live browser acceptance**

    formal list -> create page -> save -> authoritative requery
    formal list -> edit page -> save -> authoritative requery
    formal list -> protected delete -> clear rejection
    formal list -> observation page -> object fields -> save
    design list -> create/edit pages -> save -> authoritative requery
    valid design/formal XLSX -> rows persist
    one invalid row -> zero persist -> error file
    second browser -> SSE list/total/overview/map/analysis refresh
    390px and desktop -> no overflow/drawer/side card

Expected: all paths pass, console is clean, and screenshots/network evidence identify the running merge SHA.

---

## Self-Review

- Spec coverage maps independent pages, object-type fields, design/formal XLSX, existing period XLSX, atomic zero-write failure, authority, audit, idempotency, SSE, responsive UI, SOP, deployment, and browser evidence to Tasks 1-11.
- Placeholder scan found no TODO, TBD, deferred implementation, or “similar to” step.
- Type consistency uses one SamplePointImportResult, one shared workbook, allow-listed route types, and matching repository/panel methods.
- Complexity check adds no approval model, draft table, second fact model, bulk update/delete, or user-visible import state machine.

