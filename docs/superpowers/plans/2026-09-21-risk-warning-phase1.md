# Risk Warning Phase 1 Implementation Plan

**Goal:** Deliver an isolated `/risk/` application whose every visible control reads or writes the governed risk backend.

## Completed

- [x] Add the peer `/risk/` platform navigation without changing workbench routing.
- [x] Add the independent Vite entry and isolated React/CSS surface.
- [x] Replace static prototype controls with real assessment queries, detail reads, refresh, filters and feedback writes.
- [x] Hide training, promotion, source configuration and response controls until their execution services exist.
- [x] Add authenticated backend endpoints backed only by the `risk` schema.
- [x] Add feedback validation, one-review conflict handling and business audit recording.
- [x] Pass frontend lint, TypeScript/Vite build and backend JDK 21 package compilation.

## Required before release

- [ ] Run backend unit and PostgreSQL integration tests with an explicit isolated `QIQIHAR_TEST_DB_URL`.
- [ ] Start the backend containing the new endpoints and verify browser list/detail/filter/refresh behavior with a real authorized account.
- [ ] Create a governed test assessment in the isolated test database, submit feedback through the UI, and re-query database/API evidence.
- [ ] Run existing workbench regression checks to confirm the additive entry does not change current business functions.
- [ ] Publish only after migration/readback, real login, API/database re-query and rollback checks pass.

Do not add another UI surface until this vertical slice has passed the release requirements above.
