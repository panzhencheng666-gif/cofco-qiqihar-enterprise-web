# Real-Time Business System Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep the confirmed legacy business-platform UI intact while replacing its fixture/localStorage data path with typed backend API adapters, so production reporting, market collection, work queue, imports, and overview monitoring share the same database state and can be verified end to end.

**Architecture:** The legacy platform remains the presentation shell at `prototype.html`; a small frontend integration layer owns runtime API configuration, auth/trace headers, typed transport errors, master-data loading, record repositories, workflow commands, and query invalidation. The Spring Boot service remains the system of record. The overview frontend and the embedded overview route consume the same API resources. No business records are hardcoded in the browser; only display metadata and empty-state behavior remain local.

**Tech Stack:** React 18 + TypeScript + Vite prototype frontend, Spring Boot/Java backend, PostgreSQL, Flyway, REST/JSON, Vitest, TypeScript build, Playwright/browser smoke checks.

## Global Constraints

- Do not replace or redesign the confirmed legacy business-platform shell/menu/forms.
- Do not restore duplicate work menus; `待我处理` is the aggregate work queue and `已办事项` remains separate.
- Products are backend master data and must resolve to the configured three grains (玉米、大豆、稻谷), not a frontend list.
- Business periods, definitions, regions, task state, and metrics must come from API/database state; empty API data must render an explicit empty state, never silently fall back to fixtures.
- Every write path must expose success/error state and invalidate the matching work/overview query.
- Preserve existing uncommitted user changes; do not reset or overwrite unrelated files.

## Task 1: Establish the frontend API integration boundary

- [ ] Add a typed runtime API configuration module with local proxy and cloud `VITE_API_BASE_URL` support.
- [ ] Add a fetch client with JSON parsing, timeout/abort, trace/request id, and normalized API errors.
- [ ] Add contract tests for success, validation errors, network errors, and runtime base URL resolution.
- [ ] Keep fixture providers available only behind an explicit development/demo flag; production mode must not silently use them.

## Task 2: Replace hardcoded selectors with backend master data

- [ ] Add master-data repository calls for products, business periods, regions, page definitions, and applicability.
- [ ] Hydrate the old platform's product and period selectors from the repository and derive filters from returned rows.
- [ ] Ensure empty periods/definitions show a configured empty state and actionable admin/configuration message.
- [ ] Verify the database seed/configuration for the three products and valid business periods without creating fake reporting records.

## Task 3: Connect production reporting to the backend

- [ ] Inspect the production controller/service DTOs and map the existing document draft to the API's typed fields/facts.
- [ ] Implement list/detail/create/update/submit/approve/return adapters and preserve the existing form layout.
- [ ] Load draft/detail state from the API, save through API commands, and surface server validation errors inline.
- [ ] Add tests for a production draft round trip and workflow status transitions.

## Task 4: Connect market collection to the backend

- [ ] Inspect market controller/service DTOs and map the existing market form to typed core fields/facts.
- [ ] Implement list/detail/create/update/submit/approve/return adapters and status/error rendering.
- [ ] Add tests for market draft round trip and workflow transitions.

## Task 5: Connect `待我处理` to real work items

- [ ] Implement the required query context for work-item APIs and map rows to the aggregate queue projection.
- [ ] Include pending reporting, pending review, returned, exception, overdue, and published states in one queue with filters.
- [ ] Remove fixture fallback from normal runtime; retain fixtures only for isolated component tests.
- [ ] Add tests proving queue counts and actions reflect backend work-item changes.

## Task 6: Connect imports and persistence feedback

- [ ] Integrate production import template/upload/retry/error endpoints with progress and row-level error display.
- [ ] Inspect whether market import exists; if absent, document the gap and expose no fake import success.
- [ ] Verify imported rows can be read back through production/market list APIs.

## Task 7: Keep overview monitoring synchronized

- [ ] Ensure map/overview requests use the same backend base URL and authenticated context as the platform.
- [ ] Invalidate/re-fetch dashboard, indicators, work queue, and region detail after accepted writes or approvals.
- [ ] Verify `查看业务台账` and back navigation enter the confirmed legacy platform route, not a stale/invalid shell.

## Task 8: End-to-end verification

- [ ] Run TypeScript builds and focused Vitest suites for each adapter and workspace.
- [ ] Run a local DB round trip: create draft -> read -> submit -> approve -> read overview/work item.
- [ ] Run browser smoke checks for platform navigation, production/market forms, import feedback, and overview drill-down.
- [ ] Record known backend data/configuration blockers instead of masking them with fixtures.

## Task 9: Cloud synchronization readiness

- [ ] Parameterize API URL, database URL, CORS origins, auth issuer, secrets, object storage, and allowed origins.
- [ ] Verify Flyway migrations and seed/master data in the target cloud database.
- [ ] Add readiness/health checks, structured logs, request IDs, error monitoring, TLS/reverse-proxy configuration, and backup/rollback notes.
- [ ] Produce a launch checklist distinguishing what is verified locally from what still needs cloud credentials/infrastructure.
