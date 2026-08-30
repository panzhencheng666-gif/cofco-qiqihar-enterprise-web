import { readFileSync } from "node:fs";

import { expect, it } from "vitest";

it("keeps production and market task routes connected to realtime record operations", () => {
  const productionRoute = readFileSync(
    "src/business/ProductionMonitoringWorkspace.tsx",
    "utf8",
  );
  const marketRoute = readFileSync(
    "src/business/MarketMonitoringWorkspace.tsx",
    "utf8",
  );
  const productionTasks = readFileSync(
    "src/business/production/ProductionTaskWorkspace.tsx",
    "utf8",
  );
  const marketTasks = readFileSync(
    "src/business/market/MarketTaskWorkspace.tsx",
    "utf8",
  );

  for (const source of [productionRoute, marketRoute]) {
    expect(source).toContain("realtimeRepository={realtimeRepository}");
    expect(source).toContain('reviewMode={section === "review"}');
  }
  for (const source of [productionTasks, marketTasks]) {
    expect(source).toContain("item.subject.objectId");
    expect(source).toContain("onEditRecord?.(productCode");
    expect(source).toContain("BUSINESS_CREATE");
  }
});

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
