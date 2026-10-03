# God's Eye View implementation plan

**Goal:** A separately removable, free fourth application integrated with the live application center.
**Architecture:** Isolated static application and exact portal delta. Existing business bundles and APIs remain untouched.
**Tech Stack:** Audited upstream JavaScript/Cesium, independent Vite build, node:test, browser verification.

## Global constraints

- Upstream aa16b7c3b0166a89d8c7a6089e0aff53a22faaee read-only; never push to its author.
- Only user's panzhencheng666-gif/cofco-qiqihar-enterprise-web may receive commits/push/PRs.
- No new services/permissions/legal agreements without approval; no paid or NC data defaults.
- No fourth-app dependencies/requests/rendering before entry; destroy on hide/exit.
- Preserve exact existing three application behavior, layout, auth and API contracts.

## Task 1: Independent application

- [ ] Execute ../coordination/fourth-app-brief.md in apps/gods-eye-view; test lifecycle/source/auth guards before implementing.
- [ ] Review exact vendor/source hashes and dependency lifecycle scripts; install --ignore-scripts.
- [ ] Build and review resulting import/resource graph; preserve provider attribution and failure states.

## Task 2: Portal integration and release preparation

- [ ] Add fourth catalog entry with feature switch, normal new-tab link and no heavy import.
- [ ] Construct production delta from captured live portal; preserve the first three objects and protected assets.
- [ ] Validate rollback and drift refusal in local transaction tests.

## Task 3: Acceptance and delivery

- [ ] Independent code review plus browser real-source/auth/lifecycle/failure/performance evidence.
- [ ] Commit atomic changes only in user's repository; verify full target/diff before push.
- [ ] Preview under existing route with hashes, fresh CAS, shared lock; publish only after all gates pass.
