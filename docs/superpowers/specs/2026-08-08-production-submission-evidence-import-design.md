# Production Submission Evidence and Import Design

Date: 2026-08-08
Status: approved implementation slice of the enterprise production-system design

## Scope

This slice makes production monitoring the first complete implementation of the common submission contract. Existing production facts remain unchanged. Each new record also requires reporter/contact/location metadata and at least one private on-site photo. The same contract applies to direct creation, CSV import, and XLSX import. Approved records remain the only inputs visible to overview and production analysis queries.

Market and logistics will reuse the shared evidence context in later slices. This slice does not modify list/edit UI components, supply UI, regional boundary data, or the current analysis UI.

## Architecture

Evidence is a shared bounded context, consistent with backend ADR 0001. Upload and business attachment are deliberately two steps:

1. An authenticated operator uploads a JPEG or PNG plus capture time, capture coordinates, and watermark text.
2. The server verifies bounded size and decodability, computes SHA-256, generates a watermarked representation, and stores both byte streams privately in PostgreSQL.
3. The upload returns an opaque photo ID in `STAGED` state. Only its uploader may use or read it before attachment.
4. Production create/import supplies one or more staged photo IDs. The same database transaction inserts the record and attaches the photos. A photo cannot be attached twice.
5. Attached photo metadata is visible only through an authorized production record read. Content download reuses the record's region authorization and never exposes a public storage URL.

PostgreSQL byte storage is the deployable private-storage implementation for this vertical slice. The application interface keeps storage replaceable by private object storage without changing the business API.

## Submission Contract

Production continues to require the five V56 metadata values: reporter name, reporter contact, subject/customer contact, latitude, and longitude. Latitude is bounded to `[-90, 90]`; longitude to `[-180, 180]`. Direct create and import additionally require `evidencePhotoIds` with 1–5 unique IDs.

Photo upload accepts only JPEG and PNG, at most 10 MiB per file, a capture timestamp, capture latitude/longitude, and nonblank watermark text. Stored metadata includes original filename, media type, byte length, SHA-256, capture time and coordinates, uploader, upload time, attachment state, and attached domain/record ID.

## Import Contract

CSV and XLSX share exactly one ordered header model. XLSX parsing accepts the first worksheet, shared or inline strings, and rejects formulas, external relationships, macros, more than 5,000 data rows, unexpected columns, cells over 500 code points, and expanded ZIP content over 8 MiB.

The upload format is selected from the filename and media type, then normalized into the same row maps. Parsing, required-field validation, authorization, production-domain validation, and staged-photo validation complete before any production row is inserted.

If any row is invalid, the import job completes with row-level errors and zero production/evidence attachments. If every row is valid, all records and attachments are written in one transaction. An unexpected failure rolls back the whole import. The existing subject/domain/idempotency-key unique reservation remains authoritative: the same key and digest returns the same job; the same key and different digest returns `409`.

## Read Consistency

A vertical integration test uploads a real image, creates a production record, submits and approves it, then reads:

- production detail and private evidence metadata/content;
- production list/analysis-facing projection values;
- overview dashboard approved counts and production metrics.

The test asserts that pre-approval overview values do not change and post-approval values come from the persisted production row.

## Stable Errors

- `INVALID_EVIDENCE_PHOTO` — invalid media, image, size, coordinates, watermark metadata, or count.
- `EVIDENCE_PHOTO_NOT_FOUND` — unknown photo ID.
- `EVIDENCE_PHOTO_NOT_AVAILABLE` — wrong uploader or already attached.
- `EVIDENCE_PHOTO_ACCESS_DENIED` — unauthorized metadata/content read.
- `INVALID_IMPORT_FORMAT` — unsupported file type or malformed XLSX.
- Existing row error codes remain in the error file; atomic batches report valid rows as `NOT_IMPORTED_ATOMIC_BATCH` when another row fails.

All rejected create/import operations leave production records and photo attachments unchanged.

## Verification

Focused tests cover migration replay, private upload/access, missing photo rejection, attachment atomicity, CSV atomic row errors, XLSX success, idempotent replay/conflict, and approved overview/analysis visibility. Full `mvn verify` and Flyway replay/startup remain required before commit. Only exact backend files and these design/report documents may be staged.
