# Three-Repository CI and Pull-Request Gates Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task.

**Goal:** Make Backend, Web, and Frontend task branches independently verifiable and mergeable through GitHub pull requests before any future cloud release.

**Architecture:** Each repository owns one least-privilege CI workflow and one repository-local pull-request checklist. The Web repository additionally owns the cross-repository release-manifest template because it coordinates the user-facing runtime while Backend `8090`, Web `63182`, and Frontend remain separately versioned source repositories.

**Tech Stack:** GitHub Actions, Maven/JDK 21, PostgreSQL 17 + PostGIS, npm 11.6, Node.js 24, Vite, Vitest, Playwright.

---

### Task 1: Add Backend CI and pull-request contract

**Files:**

- Create: `../cofco-qiqihar-enterprise-backend/.github/workflows/ci.yml`
- Create: `../cofco-qiqihar-enterprise-backend/.github/pull_request_template.md`

**Implementation:** Run `mvn -B -ntp verify` with JDK 21 against an isolated `qiqihar_enterprise_test` PostGIS service. Pin first-party actions to reviewed commit SHAs, grant read-only repository permission, cancel superseded branch runs, and expose no cloud or production credentials.

**Verification:**

```bash
JAVA_HOME=/opt/homebrew/opt/openjdk@21 PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH mvn -B -ntp verify
git diff --check
```

### Task 2: Add Web CI, pull-request contract, and release manifest

**Files:**

- Create: `.github/workflows/ci.yml`
- Create: `.github/pull_request_template.md`
- Create: `docs/releases/THREE_REPOSITORY_RELEASE_MANIFEST_TEMPLATE.md`

**Implementation:** Run the existing `npm run verify` contract on Node 24/npm 11.6 with Chromium installed. The private single-repository runner verifies Web-owned baseline locations and explicitly skips the exact sibling-repository history comparison; the release manifest therefore requires a full three-sibling-worktree Web verify before a release candidate can pass. Record the exact Backend, Web, and Frontend commit SHAs plus local-runtime acceptance evidence in one version manifest; never place databases or secrets in a release bundle.

**Verification:**

```bash
npm ci
npx playwright install chromium
npm run verify
git diff --check
```

### Task 3: Add Frontend CI and pull-request contract

**Files:**

- Create: `../cofco-qiqihar-enterprise-frontend/.github/workflows/ci.yml`
- Create: `../cofco-qiqihar-enterprise-frontend/.github/pull_request_template.md`

**Implementation:** Run the existing `npm run verify` contract on Node 24/npm 11.6 with Chromium installed. Preserve Frontend as a separate source repository; do not turn the managed Web runtime copy into a development checkout.

**Verification:**

```bash
npm ci
npx playwright install chromium
npm run verify
git diff --check
```

### Task 4: Publish and merge through GitHub pull requests

**Files:**

- Inspect: all files changed by Tasks 1-3

**Implementation:** Commit each repository independently on `chore/20260822-ci-pr-gates`, push all three branches, open three pull requests, wait for their CI checks, review the focused diffs, and merge without force-pushing. Finally fetch and prove local `main` equals `origin/main` in all three repositories.

**Verification:**

```bash
git status --short --branch
git diff --check origin/main...HEAD
git log --oneline --decorate -5
```
