# Task 5: Final Navigation and Enterprise Shell

## Delivered

- Added one immutable `navigationItems` registry containing the eight approved top-level modules exactly once, including `态势监控` children `实时监控平台` and `区域地图`.
- Added the aligned, minimal Refine `refineResources` list.
- Added `EnterpriseShell`, `OverviewPage`, safe `ModuleLandingPage`, and global enterprise styles.
- Added real-render contract tests for navigation and the shell.

## TDD evidence

1. RED: `npm test -- src/app/router/navigation.spec.ts` failed because `./navigation` did not exist.
2. GREEN: after adding the navigation registry, the first re-run exposed the project Vitest configuration's missing globals (`describe is not defined`); importing Vitest APIs corrected the test harness, and the contract passed: 2 tests.
3. RED: `npm test -- src/app/shell/EnterpriseShell.spec.tsx` failed because `./EnterpriseShell` did not exist.
4. GREEN: after adding the shell, the real app test wrapper surfaced Refine product telemetry and route-change handler router-context failures. The approved narrow provider controls below were added, then the focused shell and navigation tests passed: 3 tests.

## Cross-task provider/test-wrapper adjustment

- `AppProviders` now disables Refine product telemetry globally. This isolated enterprise frontend does not approve Refine product telemetry as application observability.
- `AppProviders` accepts only the narrow optional `disableRouteChangeHandler` control, defaulting to `false`; production continues to use `syncWithLocation: true` and the normal route-change behavior.
- `renderWithApp` alone sets `disableRouteChangeHandler`, avoiding Refine's internal route handler in component tests while retaining a real `MemoryRouter`, real providers, and real shell behavior. No arbitrary Refine-options escape hatch was introduced.

## Files changed

- `src/app/router/navigation.ts`
- `src/app/router/navigation.spec.ts`
- `src/app/shell/EnterpriseShell.tsx`
- `src/app/shell/EnterpriseShell.spec.tsx`
- `src/app/styles/global.css`
- `src/pages/OverviewPage.tsx`
- `src/pages/ModuleLandingPage.tsx`
- `src/app/providers/AppProviders.tsx`
- `src/testing/renderWithApp.tsx`

## Verification

| Command | Result |
| --- | --- |
| `npm test -- src/app/router/navigation.spec.ts` | RED: missing `./navigation`; GREEN: 2 passed |
| `npm test -- src/app/shell/EnterpriseShell.spec.tsx` | RED: missing `./EnterpriseShell`; GREEN with wrapper fix: passed |
| `npm test -- src/app/shell/EnterpriseShell.spec.tsx src/app/router/navigation.spec.ts` | 2 files, 3 tests passed |
| `npm run format:check` | passed |
| `npm run lint` | passed with zero warnings |
| `npm run architecture` | passed: 45 modules and 72 dependencies, no violations |
| `npm test` | passed: 7 files, 9 tests |
| `npm run build` | blocked by the intentionally absent `src/main.tsx`, which Task 6 owns |

## Self-review

- Confirmed one navigation registry is the shell's sole menu source and no router/main entrypoint was introduced.
- Confirmed approved labels/order and monitoring children are contract-tested.
- Confirmed menu navigation uses registered paths and the safe module page does not create, modify, or present business outcomes.
- Reviewed all diffs and ran `git diff --check`; no whitespace errors.

## Concern / handoff

`npm run build` cannot complete until Task 6 creates `src/main.tsx` and integrates these modules into the final router/entrypoint. This is expected ownership separation, not a Task 5 code failure.
