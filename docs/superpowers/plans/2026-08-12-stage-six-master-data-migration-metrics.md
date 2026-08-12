# Stage 6 Master Data, Migration, Metrics, and Reporting Plan

> Scope lock: execute compressed go-live order item 6 only. Do not execute item 5 gates or enter item 7.

**Goal:** Close every locally executable phase 5-6 gap while preserving `EXT-001` and `EXT-007` as external blockers and never substituting synthetic data for formal evidence.

**Completion contract:** `DEF-005` is closed; canonical master-data and stable-subject lineage are explicit; an explicit-ID-only migration is transactional, idempotent, auditable, replayable, and rollback-safe with two isolated reconciliation rounds; every overview metric carries formula/source/cutoff/coverage/version metadata and reads only approved governed data; list/detail/analysis/overview/export reconcile; CSV/XLSX/PDF/DOCX exports carry scope/cutoff/audit/classification metadata; proportional DB/HTTP/browser checks and standard tests/builds pass; four evidence records and three ledgers are current; all three repositories are pushed, clean, and `HEAD=upstream` with `0/0` divergence.

## Task 1: Close DEF-005 with executable contracts

- Add a backend integration contract that keeps `correctionSourceCount` filter-local while `unresolvedSourceCount` remains catalog-wide.
- Add UI coverage for unselected, category-switched, empty, and adjacent-type states using the 4/1/7 regression shape.
- Implement the smallest repository and presentation changes, then run the targeted backend and frontend tests.

## Task 2: Govern canonical master data and overview metrics

- Add database-owned definitions and append-only lineage for subject, region, product, and object type master data.
- Extend indicator definitions and API contracts with formula, source path, exact cutoff, requested coverage, calculation version, and approved-source audit data.
- Reconcile list/detail/analysis/overview consumer results from the same approved governed source identity.

## Task 3: Add explicit-ID migration and two-round reconciliation

- Stage only externally supplied source record IDs, stable subject IDs, and dispositions; reject names, contact details, and coordinate-based matching.
- Apply in one transaction with version guards, an immutable audit trail, idempotency keys, deterministic reconciliation, targeted replay, and exact rollback.
- Execute two full isolated rounds (apply, repeat/no-op, reconcile, rollback) against protected local test databases and record that formal execution remains blocked by `EXT-007`.

## Task 4: Complete auditable reporting formats

- Add DOCX to the server-owned format contract.
- Put filter scope, exact cutoff, dataset/preview audit identifier, data classification, formula/source/version metadata into preview and every exported format.
- Verify CSV, XLSX, PDF, and DOCX content against the same approved dataset digest.

## Task 5: Verify, review, publish evidence, and hand off

- Run proportional real DB/HTTP/browser paths, then standard backend/frontend/web verification without repeating item 5 gates.
- Review the final diff; register any newly confirmed defect before a red-green fix.
- Update the four evidence records and three permanent ledgers, commit exact repository boundaries, push normal private branches, and prove clean `0/0` state.
