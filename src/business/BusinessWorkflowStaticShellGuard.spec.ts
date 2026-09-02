import { readFileSync } from "node:fs";

import { expect, it } from "vitest";

it("keeps production objects behind the authoritative API contract", () => {
  const repository = readFileSync(
    "src/platform/api/realtimeBusinessRepository.ts",
    "utf8",
  );
  const registry = readFileSync(
    "src/business/production/ProductionObjectRegistry.tsx",
    "utf8",
  );

  expect(repository).toContain('"/api/v1/production-objects"');
  expect(repository).toContain(
    "`/api/v1/production-objects/${encodeURIComponent(id)}`",
  );
  expect(registry).toContain("listProductionObjects()");
  expect(registry).toContain("updateProductionObject?.(");
  expect(registry).toContain("createProductionObject?.(");
  expect(registry).toContain("serverRegistryObjects");
});

it("keeps scoped business workspaces operable in the mobile shell", () => {
  const shellStyles = readFileSync(
    "src/business/formal-enterprise.css",
    "utf8",
  );

  expect(shellStyles).toContain("task-c1-mobile-business-shell:start");
  expect(shellStyles).toContain("grid-template-columns: minmax(0, 1fr)");
  expect(shellStyles).toContain(".formal-enterprise .formal-sidebar");
  expect(shellStyles).toContain(".formal-enterprise .realtime-entry-overlay");
});
