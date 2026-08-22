import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { formalApplicationDefinitions } from "../business/formalEnterpriseData";

const baselinePath = resolve(
  process.cwd(),
  "docs/production-readiness/stage-one-system-baseline.json",
);
const uiInventoryPath = resolve(
  process.cwd(),
  "docs/production-readiness/stage-one-ui-inventory.json",
);
const singleRepositoryCi = process.env["COFCO_SINGLE_REPOSITORY_CI"] === "true";
const webRepository = "cofco-qiqihar-enterprise-web";

interface StageOneBaseline {
  canonicalAcceptanceEntry: {
    url: string;
    port: number;
    path: string;
    ownerRepository: string;
  };
  repositoryResponsibilities: readonly {
    repository: string;
    responsibilities: readonly string[];
  }[];
  runtimeComponents: readonly {
    id: string;
    ownerRepository: string;
    exposure: string;
    process: string;
    deploymentComponent: string;
  }[];
  primaryMenuInventory: readonly {
    application: string;
    label: string;
    implementationLocations: readonly string[];
    ownerRepository: string;
    status: string;
    verificationStage: string;
  }[];
  menuInventory: readonly {
    application: string;
    section: string;
    label: string;
    implementationLocations: readonly string[];
    ownerRepository: string;
    status: string;
    verificationStage: string;
  }[];
  uiInteractionInventory: {
    path: string;
    itemCount: number;
    ownerRepository: string;
    status: string;
    verificationStage: string;
  };
  actionInventory: readonly TraceabilityRow[];
  businessStateInventory: readonly (TraceabilityRow & {
    values: readonly string[];
  })[];
  importExportInventory: readonly TraceabilityRow[];
  backgroundTaskInventory: readonly TraceabilityRow[];
  historicalRequirementSources: readonly {
    repository: string;
    paths: readonly string[];
    status: string;
    verificationStage: string;
  }[];
}

interface TraceabilityRow {
  id: string;
  implementationLocations: readonly string[];
  ownerRepository: string;
  status: string;
  verificationStage: string;
}

interface UiInventory {
  sourceFileCount: number;
  sourceDigest: string;
  itemCount: number;
  countsByKind: Readonly<Record<string, number>>;
  items: readonly {
    id: string;
    sourceFile: string;
    implementationLocation: string;
    ownerRepository: string;
    status: string;
    verificationStage: string;
  }[];
}

function loadBaseline(): StageOneBaseline | undefined {
  if (!existsSync(baselinePath)) return undefined;
  return JSON.parse(readFileSync(baselinePath, "utf8")) as StageOneBaseline;
}

function historicalSources(repositoryRoot: string, repository: string) {
  return execFileSync("git", ["-C", repositoryRoot, "ls-files"], {
    encoding: "utf8",
  })
    .split("\n")
    .filter((path) =>
      /^(?:docs\/specs|docs\/superpowers\/(?:plans|specs))\/.+\.md$/u.test(
        path,
      ),
    )
    .map((path) => `${repository}:${path}`)
    .sort();
}

function implementationLocationExists(location: string) {
  const separator = location.indexOf(":");
  if (separator < 1) return false;
  const repository = location.slice(0, separator);
  const path = location.slice(separator + 1);
  return existsSync(join(dirname(process.cwd()), repository, path));
}

function requiresLocalRepositoryProof(location: string) {
  return !singleRepositoryCi || location.startsWith(`${webRepository}:`);
}

function locallyVerifiableLocationsExist(locations: readonly string[]) {
  return locations
    .filter(requiresLocalRepositoryProof)
    .every(implementationLocationExists);
}

function implementationLocationSource(location: string) {
  const separator = location.indexOf(":");
  if (separator < 1) return "";
  const repository = location.slice(0, separator);
  const path = location.slice(separator + 1);
  const absolutePath = join(dirname(process.cwd()), repository, path);
  return existsSync(absolutePath) && !absolutePath.endsWith("/db/migration")
    ? readFileSync(absolutePath, "utf8")
    : "";
}

describe("阶段一唯一系统基线", () => {
  it("提供机器可核验的系统基线与唯一 63182 验收入口", () => {
    const baseline = loadBaseline();

    expect(baseline).toBeDefined();
    if (!baseline) return;
    expect(baseline.canonicalAcceptanceEntry).toMatchObject({
      url: "http://127.0.0.1:63182/",
      port: 63182,
      path: "/",
      ownerRepository: "cofco-qiqihar-enterprise-web",
    });
    expect(JSON.stringify(baseline)).not.toContain("64185");
    expect(
      baseline.repositoryResponsibilities.map((item) => item.repository).sort(),
    ).toEqual([
      "cofco-qiqihar-enterprise-backend",
      "cofco-qiqihar-enterprise-frontend",
      "cofco-qiqihar-enterprise-web",
    ]);
    expect(
      baseline.runtimeComponents.every(
        (item) =>
          item.ownerRepository &&
          item.exposure &&
          item.process &&
          item.deploymentComponent,
      ),
    ).toBe(true);
    expect(
      baseline.historicalRequirementSources.every(
        (item) =>
          item.paths.length > 0 && item.status && item.verificationStage,
      ),
    ).toBe(true);
  });

  it("逐项覆盖当前正式一级和二级业务菜单", () => {
    const baseline = loadBaseline();
    expect(baseline).toBeDefined();
    if (!baseline) return;

    expect(
      baseline.primaryMenuInventory
        .map((item) => `${item.application}:${item.label}`)
        .sort(),
    ).toEqual(
      formalApplicationDefinitions
        .map((item) => `${item.key}:${item.label}`)
        .sort(),
    );
    expect(
      baseline.primaryMenuInventory.every((item) =>
        locallyVerifiableLocationsExist(item.implementationLocations),
      ),
    ).toBe(true);

    const expected = formalApplicationDefinitions
      .flatMap((application) =>
        application.navigation.map(
          (item) =>
            `${item.route.application}:${item.route.section}:${item.label}`,
        ),
      )
      .sort();
    const actual = baseline.menuInventory
      .map((item) => `${item.application}:${item.section}:${item.label}`)
      .sort();

    expect(actual).toEqual(expected);
    for (const item of baseline.menuInventory) {
      expect(item.implementationLocations.length).toBeGreaterThan(0);
      expect(
        locallyVerifiableLocationsExist(item.implementationLocations),
      ).toBe(true);
      expect(item.ownerRepository).toBeTruthy();
      expect(item.status).toMatch(/^(?:IMPLEMENTED|PARTIAL|NOT_EVIDENCED)$/u);
      expect(item.verificationStage).toMatch(/^阶段/u);
    }
  });

  it.skipIf(singleRepositoryCi)("覆盖所有受控历史规格和计划来源", () => {
    const baseline = loadBaseline();
    expect(baseline).toBeDefined();
    if (!baseline) return;

    const runtimeRoot = dirname(process.cwd());
    const repositories = [
      "cofco-qiqihar-enterprise-backend",
      "cofco-qiqihar-enterprise-frontend",
      "cofco-qiqihar-enterprise-web",
    ] as const;
    const expected = repositories.flatMap((repository) =>
      historicalSources(join(runtimeRoot, repository), repository),
    );
    const actual = baseline.historicalRequirementSources
      .flatMap((item) => item.paths.map((path) => `${item.repository}:${path}`))
      .sort();

    expect(actual).toEqual(expected.sort());
  });

  it("所有按钮动作、导入导出和后台任务均可定位且有后续验证归属", () => {
    const baseline = loadBaseline();
    expect(baseline).toBeDefined();
    if (!baseline) return;

    for (const inventory of [
      baseline.actionInventory,
      baseline.businessStateInventory,
      baseline.importExportInventory,
      baseline.backgroundTaskInventory,
    ]) {
      expect(inventory.length).toBeGreaterThan(0);
      expect(new Set(inventory.map((item) => item.id)).size).toBe(
        inventory.length,
      );
      for (const item of inventory) {
        expect(item.implementationLocations.length).toBeGreaterThan(0);
        expect(
          locallyVerifiableLocationsExist(item.implementationLocations),
        ).toBe(true);
        expect(item.ownerRepository).toBeTruthy();
        expect(item.status).toMatch(/^(?:IMPLEMENTED|PARTIAL|NOT_EVIDENCED)$/u);
        expect(item.verificationStage).toMatch(/^阶段/u);
      }
    }
    expect(
      baseline.businessStateInventory.every((item) => item.values.length > 0),
    ).toBe(true);
    for (const item of baseline.businessStateInventory) {
      const locallyVerifiableLocations = item.implementationLocations.filter(
        requiresLocalRepositoryProof,
      );
      if (
        locallyVerifiableLocations.length !==
        item.implementationLocations.length
      ) {
        continue;
      }
      const implementationSource = locallyVerifiableLocations
        .map(implementationLocationSource)
        .join("\n");
      for (const value of item.values.flatMap((entry) => entry.split("/"))) {
        expect(implementationSource).toContain(value);
      }
    }
  });

  it("逐节点登记正式业务源码中的按钮、链接、筛选输入和弹框", () => {
    const baseline = loadBaseline();
    expect(baseline).toBeDefined();
    expect(existsSync(uiInventoryPath)).toBe(true);
    if (!baseline || !existsSync(uiInventoryPath)) return;

    const inventory = JSON.parse(
      readFileSync(uiInventoryPath, "utf8"),
    ) as UiInventory;
    expect(baseline.uiInteractionInventory).toMatchObject({
      path: "docs/production-readiness/stage-one-ui-inventory.json",
      itemCount: inventory.itemCount,
      ownerRepository: "cofco-qiqihar-enterprise-web",
      status: "IMPLEMENTED",
      verificationStage: "阶段二/三",
    });
    expect(inventory.sourceFileCount).toBeGreaterThan(0);
    expect(inventory.sourceDigest).toMatch(/^[a-f0-9]{64}$/u);
    expect(inventory.itemCount).toBe(inventory.items.length);
    expect(
      Object.values(inventory.countsByKind).reduce(
        (total, count) => total + count,
        0,
      ),
    ).toBe(inventory.itemCount);
    for (const item of inventory.items) {
      expect(existsSync(resolve(process.cwd(), item.sourceFile))).toBe(true);
      expect(item.implementationLocation).toBe(
        `cofco-qiqihar-enterprise-web:${item.sourceFile}`,
      );
      expect(item.ownerRepository).toBe("cofco-qiqihar-enterprise-web");
      expect(item.status).toBe("IMPLEMENTED");
      expect(item.verificationStage).toBe("阶段二/三");
    }
  });

  it("提供可重放的三仓原子门禁执行器", () => {
    expect(
      existsSync(resolve(process.cwd(), "scripts/run-stage-one-gate.mjs")),
    ).toBe(true);
  });
});
