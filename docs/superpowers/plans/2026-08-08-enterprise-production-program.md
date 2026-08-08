# Enterprise Production System Program

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved enterprise production-system design as one deployable, secure, fully functional business system without changing its approved visual shell.

**Architecture:** Keep the existing modular-monolith backend and PostgreSQL/PostGIS database. Promote `cofco-qiqihar-enterprise-web` as the official business-platform view, retain `cofco-qiqihar-enterprise-frontend` as the overview-monitoring view, and expose both through one authenticated gateway and API.

**Tech Stack:** Java 21, Spring Boot 4.1, Spring Modulith, PostgreSQL 17/PostGIS, Flyway, React 19, TypeScript 5.9, Vite 8, Zod 4, Vitest, Playwright, Docker Compose, Nginx.

## Global Constraints

- Preserve the current top navigation, left business directory, blue visual system, brand, and overview-map visual language.
- Production must never render fixture data, prototype fallback data, empty buttons, ports, API names, database versions, or environment labels.
- Every visible action must have permission, API, persistence, success, failure, audit, and automated-test coverage.
- Longitude, latitude, reporter, customer contact, and at least one on-site watermarked photo are required for every new submission.
- Overview monitoring reads only approved business data and exposes business period and freshness, not infrastructure details.
- Git commits must stage exact task files only; existing unrelated worktree changes must remain untouched.

---

## Delivery Packages

- [ ] **Package 1 — Production foundation and security:** execute `docs/superpowers/plans/2026-08-08-production-foundation-security.md` and close region authorization, identity trust, import atomicity, resource limits, official runtime ownership, and baseline quality gates.
- [ ] **Package 2 — Submission contract and evidence:** add common reporter/contact/location contracts, private watermarked-photo storage, compatible Flyway migrations, production/market field retirement, and product-owned logistics definitions.
- [ ] **Package 3 — Business workbenches and analysis:** make list mode the default, route new/view/edit states, remove the duplicate prototype workbench, implement three-year production/market analysis, and make supply balance result/process-first.
- [ ] **Package 4 — Reporting and shell capabilities:** remove comprehensive reports and specified account entries; implement bounded business-report generation/export, real work items, notifications, help, preferences, account security, and logout.
- [ ] **Package 5 — Overview, cloud, and release:** add transactional outbox projections, approved-data overview aggregation, full gateway topology, object storage, monitoring, backup/restore, performance tests, all-button E2E, release rehearsal, and rollback evidence.

## Program Verification

- [ ] Run `JAVA_HOME=/opt/homebrew/opt/openjdk@21 mvn verify` in `cofco-qiqihar-enterprise-backend`; expect `BUILD SUCCESS` and zero failures.
- [ ] Run `npm run verify` in `cofco-qiqihar-enterprise-web`; expect format, lint, architecture, unit, build, budget, and preview E2E to pass.
- [ ] Run `npm run verify` in `cofco-qiqihar-enterprise-frontend`; expect format, lint, architecture, unit, build, and Chromium E2E to pass.
- [ ] Run the infrastructure release smoke, backup, restore, permission-isolation, report-bound, and overview-consistency rehearsals in pre-production.
- [ ] Publish only after every blocker in `docs/operations/release-checklist.md` has independently verifiable evidence.
