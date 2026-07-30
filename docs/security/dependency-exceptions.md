# Dependency Security Decisions

## React Router RSC action advisory

- Advisory: `GHSA-qwww-vcr4-c8h2`
- Affected lock: `react-router@7.18.2`
- Decision date: 2026-07-30
- Next mandatory review: 2026-08-31
- Owners: 前端平台主管、应用安全负责人
- Status: temporarily accepted with an explicit architecture prohibition

### Current reachability

This application is a client-rendered SPA. `RootApp` uses `BrowserRouter`,
Vite emits static browser assets, and the repository has no React Server
Components transport, server action handler, or RSC request parser. The
advisory's RSC action-execution path is therefore not reachable in the
current deployment model.

This is a constrained exception, not a statement that the dependency is
safe in every mode. The repository must not enable React Server Components,
React Router server actions, or an RSC endpoint while this exception remains
open.

### Controls

1. Keep routing client-side through `BrowserRouter`.
2. Reject any change that adds RSC/server-action packages or endpoints unless
   this decision is replaced by a security review and a patched router.
3. Continue running `npm audit` in every release checkpoint and record the
   exact remaining advisory.
4. Do not silence or omit the finding from release evidence.

### Exit conditions

Remove this exception and upgrade when either:

- Refine officially supports a React Router release outside the affected
  range and compatibility/E2E gates pass; or
- React Router publishes a compatible 7.x patch that resolves the advisory.

The owners must review this record no later than 2026-08-31, and immediately
if the application architecture adds any server-rendering or server-action
capability.

## path-to-regexp override

`path-to-regexp` is overridden to `8.4.2`, the current patched 8.x release,
because `@ant-design/pro-layout` otherwise resolves an affected 8.2.x
version. The lockfile, complete unit/E2E suite, architecture gate, build, and
bundle budgets must pass with the override. Remove the override once the
upstream ProComponents dependency range resolves the patched release
directly.
