# Production Submission Evidence and Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one production-monitoring vertical slice in which private watermarked photos, required submission metadata, atomic CSV/XLSX import, database persistence, and approved overview reads form one tested contract.

**Architecture:** Add a shared Evidence bounded context with staged private uploads and transactional business attachment. Normalize bounded CSV and XLSX inputs to one row model, validate the complete batch before inserts, and keep overview reads on the existing approved production tables.

**Tech Stack:** Java 21, Spring Boot 4.1 MVC, JDBC transactions, PostgreSQL 17/PostGIS, Flyway, JDK ImageIO/Graphics2D, JDK ZIP/StAX, MockMvc/JUnit 5.

## Global Constraints

- Preserve all existing production facts and the V56 reporter/contact/location contract.
- Require 1–5 unique private evidence photos for every new direct or imported production record.
- Accept JPEG/PNG up to 10 MiB; generate and store a server-side watermarked representation.
- CSV and XLSX imports are batch-atomic: any row error means zero production records and zero evidence attachments.
- Persist row-level errors and preserve subject/domain/idempotency-key replay semantics.
- Do not modify current UI list/edit components or regional boundary migrations.
- Stage exact files only and preserve unrelated worktree changes.

---

### Task 1: Private Evidence Upload

**Files:**
- Create: `src/main/resources/db/migration/V58__create_private_evidence_photos.sql`
- Create: `src/main/java/com/cofco/qiqihar/graintrade/evidence/application/EvidencePhotoView.java`
- Create: `src/main/java/com/cofco/qiqihar/graintrade/evidence/application/EvidencePhotoRepository.java`
- Create: `src/main/java/com/cofco/qiqihar/graintrade/evidence/application/EvidencePhotoService.java`
- Create: `src/main/java/com/cofco/qiqihar/graintrade/evidence/infrastructure/JdbcEvidencePhotoRepository.java`
- Create: `src/main/java/com/cofco/qiqihar/graintrade/evidence/interfaceadapter/EvidencePhotoController.java`
- Test: `src/test/java/com/cofco/qiqihar/graintrade/evidence/interfaceadapter/EvidencePhotoRestIntegrationTest.java`

**Interfaces:**
- Produces: `EvidencePhotoService.upload(String filename, String mediaType, byte[] bytes, OffsetDateTime capturedAt, String latitude, String longitude, String watermarkText)`.
- Produces: `EvidencePhotoService.content(UUID photoId, boolean watermarked)` and uploader-scoped staged reads.

- [ ] **Step 1: Write the failing private-upload integration test**

```java
mockMvc.perform(multipart("/api/v1/evidence-photos")
        .file(new MockMultipartFile("file", "field.png", "image/png", pngBytes()))
        .param("capturedAt", "2026-08-08T09:00:00+08:00")
        .param("latitude", "47.3543").param("longitude", "123.9182")
        .param("watermarkText", "齐齐哈尔 现场采集")
        .principal(() -> "production-tester"))
    .andExpect(status().isCreated())
    .andExpect(jsonPath("$.data.state").value("STAGED"))
    .andExpect(jsonPath("$.data.sha256").isString());
```

- [ ] **Step 2: Run RED**

Run: `mvn -Dtest=EvidencePhotoRestIntegrationTest test`
Expected: `404` because `/api/v1/evidence-photos` does not exist.

- [ ] **Step 3: Add V58 and minimal private storage implementation**

Create `evidence.evidence_photo` with UUID ID, original/watermarked `bytea`, SHA-256, bounded metadata, uploader, `STAGED|ATTACHED`, and nullable attached domain/record columns. Implement ImageIO decode, coordinate checks, 10 MiB bound, watermark drawing, and repository insert/read without a public URL.

- [ ] **Step 4: Add hostile and access tests, then make GREEN**

Assert non-image bytes return `400 INVALID_EVIDENCE_PHOTO`, another principal cannot read staged content, original and watermarked bytes differ, and no row is stored for rejected uploads. Run the focused class until all assertions pass.

### Task 2: Require and Attach Evidence on Production Writes

**Files:**
- Modify: `src/main/java/com/cofco/qiqihar/graintrade/production/application/ProductionDraft.java`
- Modify: `src/main/java/com/cofco/qiqihar/graintrade/production/application/ProductionRecordView.java`
- Modify: `src/main/java/com/cofco/qiqihar/graintrade/production/application/ProductionRecordService.java`
- Modify: `src/main/java/com/cofco/qiqihar/graintrade/production/interfaceadapter/ProductionRecordController.java`
- Modify: `src/main/java/com/cofco/qiqihar/graintrade/evidence/application/EvidencePhotoService.java`
- Test: `src/test/java/com/cofco/qiqihar/graintrade/production/interfaceadapter/ProductionEvidenceIntegrationTest.java`

**Interfaces:**
- Consumes: staged photo IDs from Task 1.
- Produces: `EvidencePhotoService.validateAvailable(List<UUID> ids, String subjectId)` and `attachToProduction(List<UUID> ids, String recordId, String subjectId)`.
- Produces: `DraftRequest.evidencePhotoIds` and response evidence metadata without binary content.

- [ ] **Step 1: Write failing attachment/rollback tests**

```java
postProduction(validBodyWithoutEvidence()).andExpect(status().isBadRequest())
    .andExpect(jsonPath("$.error.code").value("INVALID_EVIDENCE_PHOTO"));
String photoId = uploadPhoto("production-tester");
String recordId = postProduction(validBody(photoId)).andExpect(status().isCreated())
    .andExpect(jsonPath("$.data.evidencePhotos[0].id").value(photoId));
assertThat(attachedRecord(photoId)).isEqualTo(recordId);
```

Also submit an unavailable second ID with a valid ID and assert neither a production row nor an attachment is created.

- [ ] **Step 2: Run RED**

Run: `mvn -Dtest=ProductionEvidenceIntegrationTest test`
Expected: missing evidence is accepted and response has no `evidencePhotos`.

- [ ] **Step 3: Implement transactional validation and attachment**

Add immutable `List<UUID> evidencePhotoIds` to `ProductionDraft`. In `create`, authorize, validate all IDs for the current subject, insert the production record, then attach all IDs inside the existing `@Transactional` method. Detail responses load authorized metadata through the evidence service.

- [ ] **Step 4: Make GREEN and keep existing production tests compatible**

Update production API integration fixtures to upload or seed one staged photo per create. Run `ProductionEvidenceIntegrationTest,ProductionRecordRestIntegrationTest,ProductionInputLimitIntegrationTest` and require zero failures.

### Task 3: Atomic CSV and XLSX Import

**Files:**
- Create: `src/main/java/com/cofco/qiqihar/graintrade/importing/domain/XlsxTable.java`
- Modify: `src/main/java/com/cofco/qiqihar/graintrade/importing/application/ProductionImportTemplate.java`
- Modify: `src/main/java/com/cofco/qiqihar/graintrade/importing/application/ProductionImportService.java`
- Modify: `src/main/java/com/cofco/qiqihar/graintrade/importing/interfaceadapter/ProductionImportController.java`
- Modify: `src/main/java/com/cofco/qiqihar/graintrade/production/application/ProductionImportPort.java`
- Modify: `src/main/java/com/cofco/qiqihar/graintrade/production/application/ProductionRecordService.java`
- Test: `src/test/java/com/cofco/qiqihar/graintrade/importing/interfaceadapter/ProductionImportFormatIntegrationTest.java`
- Test: `src/test/java/com/cofco/qiqihar/graintrade/importing/domain/XlsxTableTest.java`

**Interfaces:**
- Produces: `ProductionImportService.importFile(String idempotencyKey, String filename, String mediaType, byte[] bytes)`.
- Produces: `ProductionImportPort.validateImportDraft(ProductionDraft draft)` followed by `importDraft` only after every row validates.
- Produces: common header `evidencePhotoId` for CSV and XLSX.

- [ ] **Step 1: Write XLSX parser RED tests**

Use a minimal ZIP fixture containing workbook relationships, shared strings, and one worksheet. Assert the exact header/data rows, then assert formula cells, 5,001 data rows, and expanded ZIP content over 8 MiB are rejected with deterministic parser errors.

- [ ] **Step 2: Implement bounded JDK OOXML parsing and make parser GREEN**

Use `ZipInputStream` with per-entry and aggregate expanded-byte counters, hardened StAX factories with external entities disabled, deterministic first-sheet selection, and shared/inline-string support. Do not evaluate formulas.

- [ ] **Step 3: Write import atomicity RED tests**

```java
uploadCsv(validRow(photoA) + invalidRow(photoB))
    .andExpect(jsonPath("$.data.failedRows").value(1))
    .andExpect(jsonPath("$.data.importedRows").value(0));
assertThat(productionCount()).isZero();
assertThat(attachedPhotoCount()).isZero();

uploadXlsx(validRows(photoA, photoB), "xlsx-key")
    .andExpect(jsonPath("$.data.importedRows").value(2));
replaySameXlsx("xlsx-key").andExpect(jsonPath("$.data.id").value(firstJobId));
```

- [ ] **Step 4: Implement common normalization and all-row prevalidation**

Select CSV/XLSX from sanitized filename and media type, normalize both into `List<Map<String,String>>`, validate authorization/domain/photo availability for all rows, and if any row fails store errors plus `NOT_IMPORTED_ATOMIC_BATCH` outcomes without calling `importDraft`. If all rows pass, insert and attach every row; allow unexpected runtime failures to roll back the transaction.

- [ ] **Step 5: Make import GREEN**

Run `mvn -Dtest=XlsxTableTest,ProductionImportFormatIntegrationTest,ProductionImportRestIntegrationTest test`. Confirm valid CSV and XLSX, mixed-row atomic failure, row error download, replay, and digest conflict all pass.

### Task 4: Approved Data Read-Through

**Files:**
- Test: `src/test/java/com/cofco/qiqihar/graintrade/overview/interfaceadapter/ProductionSubmissionReadThroughIntegrationTest.java`

**Interfaces:**
- Consumes: production create/submit/approve and evidence APIs from Tasks 1–3.
- Verifies: existing production list/detail projections and `/api/v1/overview/dashboard` approved-only aggregation.

- [ ] **Step 1: Write the read-through test**

Upload a real PNG, create a CORN production record in period `2026-W32`, assert overview excludes the draft, submit and approve it, then assert production detail returns contact/location/photo metadata and overview metrics include its cultivated area/output and source count.

- [ ] **Step 2: Run RED and close only genuine projection gaps**

Run: `mvn -Dtest=ProductionSubmissionReadThroughIntegrationTest test`. If the existing overview query already passes after approval, add no production query. If evidence metadata is absent from detail, add only that response projection.

- [ ] **Step 3: Run focused and migration verification**

Run the four new focused classes plus existing production/import/overview integration suites. Then run `mvn -Dtest=FlywayMigrationReplayTest,BootFlywayStartupTest test` and require all migrations through V58 to replay.

### Task 5: Full Verification and Exact Delivery

**Files:**
- Create: `.superpowers/sdd/phase-2-production-submission-evidence-report.md` in `cofco-qiqihar-enterprise-web`

- [ ] **Step 1: Run full verification**

Run `JAVA_HOME=/opt/homebrew/opt/openjdk@21 PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH mvn verify` and require `BUILD SUCCESS` with zero failures/errors.

- [ ] **Step 2: Audit exact diffs**

Run `git diff --check`, inspect every target-file diff, verify no UI files, V36–V57, regional boundaries, or unrelated dirty files are staged.

- [ ] **Step 3: Commit and report**

Stage exact backend files and commit without amend or push. Record RED/GREEN evidence, stable errors, transaction semantics, Flyway/full results, SHA, and remaining market/logistics evidence adoption in the phase report.
