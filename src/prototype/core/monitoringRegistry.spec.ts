import { describe, expect, it } from "vitest";

import {
  getActiveObjectCapabilities,
  getEffectiveBusinessRoles,
  migrateLegacyProductionType,
  projectMonitoringObjects,
  type CapabilityTemplate,
  type MonitoringObject,
} from "./monitoringRegistry";
import { businessWorkFixtures } from "../data/businessWorkFixtures";
import {
  productionCapabilityTemplates,
  productionMonitoringObjects,
} from "../data/monitoringRegistryFixtures";
import { productionDocumentFixtures } from "../data/productionDocumentFixtures";
import { prototypeOperationalIdentity } from "../formalEnterpriseData";
import type { OperationalScope } from "./operationalScope";

const monitoringObject: MonitoringObject = {
  objectId: "OBJ-SURVEY-01",
  objectName: "讷河市同义镇调查片区",
  objectTypeId: "survey-area",
  objectTypeLabel: "调查片区",
  regionId: "qiqihar-nehe",
  regionLabel: "讷河市同义镇",
  productIds: ["corn", "soybean"],
  productLabels: ["玉米", "大豆"],
  cultivarIds: ["demeiya-3", "heinong-84"],
  cultivarLabels: ["德美亚3号", "黑农84"],
  sourceChannelId: "administrative-village-ledger",
  sourceChannelLabel: "行政村台账",
  responsibleUserId: "liu-min",
  responsiblePerson: "刘敏",
  effectiveFrom: "2025-01-01",
  effectiveTo: null,
  validityStatus: "active",
  roles: [
    {
      roleId: "production-survey",
      label: "产情调查对象",
      effectiveFrom: "2025-01-01",
      effectiveTo: null,
      capabilityTemplateVersionId: "CAPABILITY-PRODUCTION-2",
    },
    {
      roleId: "quality-sample",
      label: "质量样本对象",
      effectiveFrom: "2025-06-01",
      effectiveTo: "2025-12-31",
      capabilityTemplateVersionId: "CAPABILITY-QUALITY-1",
    },
  ],
};

const templates: readonly CapabilityTemplate[] = [
  {
    capabilityTemplateVersionId: "CAPABILITY-PRODUCTION-2",
    label: "产情调查字段模板第2版",
    capabilityLabels: ["种植面积填报", "长势与测产填报"],
  },
  {
    capabilityTemplateVersionId: "CAPABILITY-QUALITY-1",
    label: "质量调查字段模板第1版",
    capabilityLabels: ["质量检验依据填报"],
  },
];

describe("monitoring registry", () => {
  it("migrates a village ledger into an object type and an independent source channel", () => {
    expect(migrateLegacyProductionType("village-ledger")).toEqual({
      objectTypeId: "survey-area",
      sourceChannelId: "administrative-village-ledger",
    });
  });

  it("keeps multiple effective-dated roles on one stable object", () => {
    expect(
      getEffectiveBusinessRoles(monitoringObject, "2025-08-01"),
    ).toHaveLength(2);
    expect(getEffectiveBusinessRoles(monitoringObject, "2026-08-01")).toEqual([
      expect.objectContaining({ roleId: "production-survey" }),
    ]);
    expect(monitoringObject.objectId).toBe("OBJ-SURVEY-01");
  });

  it("derives capabilities only from active role template versions", () => {
    expect(
      getActiveObjectCapabilities(monitoringObject, templates, "2025-08-01"),
    ).toEqual([
      {
        roleLabel: "产情调查对象",
        templateLabel: "产情调查字段模板第2版",
        capabilityLabels: ["种植面积填报", "长势与测产填报"],
      },
      {
        roleLabel: "质量样本对象",
        templateLabel: "质量调查字段模板第1版",
        capabilityLabels: ["质量检验依据填报"],
      },
    ]);
  });

  it("never falls back to an internal template code when governance is missing", () => {
    expect(
      getActiveObjectCapabilities(monitoringObject, [], "2026-08-01"),
    ).toEqual([
      {
        roleLabel: "产情调查对象",
        templateLabel: "能力模板名称待维护",
        capabilityLabels: [],
      },
    ]);
  });

  it("keeps governed cultivar identities aligned across registry, task and document fixtures", () => {
    for (const object of productionMonitoringObjects) {
      expect(object.cultivarIds).toHaveLength(object.cultivarLabels.length);
      expect(
        getActiveObjectCapabilities(
          object,
          productionCapabilityTemplates,
          "2026-08-01",
        ).every(({ templateLabel }) => templateLabel !== "能力模板名称待维护"),
      ).toBe(true);
    }
    const task = businessWorkFixtures.find(
      ({ domain }) => domain === "production",
    );
    expect(task?.subject.kind).toBe("monitoring-object");
    if (!task || task.subject.kind !== "monitoring-object") return;
    const taskObjectId = task.subject.objectId;
    const object = productionMonitoringObjects.find(
      ({ objectId }) => objectId === taskObjectId,
    );
    expect(object).toBeDefined();
    expect(
      task.cultivarIds.every((id) => object?.cultivarIds.includes(id)),
    ).toBe(true);
    const documentCultivar = productionDocumentFixtures[0].fieldGroups
      .flatMap(({ fields }) => fields)
      .find(({ fieldId }) => fieldId === "cultivar")?.value;
    expect(object?.cultivarLabels).toContain(documentCultivar);
  });

  it("denies the object projection when the query or read permission is denied", () => {
    const scope = {
      ...prototypeOperationalIdentity,
      coordinates: { regionId: "authorized-all" as const },
      savedView: null,
    };
    expect(
      projectMonitoringObjects(productionMonitoringObjects, scope, false),
    ).toEqual([]);
    expect(
      projectMonitoringObjects(
        productionMonitoringObjects,
        {
          ...scope,
          authorization: { ...scope.authorization, permissionKeys: [] },
        },
        true,
      ),
    ).toEqual([]);
  });

  it("requires an authorized production classification before projecting objects", () => {
    const scope: OperationalScope = {
      ...prototypeOperationalIdentity,
      coordinates: { regionId: "authorized-all" },
      savedView: null,
    };
    for (const authorizedBusinessClassificationIds of [
      [],
      ["market.quote-trade"],
    ] as const) {
      expect(
        projectMonitoringObjects(
          productionMonitoringObjects,
          {
            ...scope,
            authorization: {
              ...scope.authorization,
              authorizedBusinessClassificationIds,
            },
          },
          true,
        ),
      ).toEqual([]);
    }
    expect(
      projectMonitoringObjects(
        productionMonitoringObjects,
        {
          ...scope,
          authorization: {
            ...scope.authorization,
            authorizedBusinessClassificationIds: [
              "production.planting-production",
            ],
          },
        },
        true,
      ),
    ).not.toEqual([]);
  });

  it("rejects an explicit production subtype outside the authorized classification set", () => {
    const scope: OperationalScope = {
      ...prototypeOperationalIdentity,
      authorization: {
        ...prototypeOperationalIdentity.authorization,
        authorizedBusinessClassificationIds: ["production.planting-production"],
      },
      coordinates: {
        regionId: "authorized-all",
        businessSubtypeId: "production.quality-survey",
      },
      savedView: null,
    };
    expect(
      projectMonitoringObjects(productionMonitoringObjects, scope, true),
    ).toEqual([]);
  });

  it("removes an object row when it contains only unauthorized products or cultivars", () => {
    const scope = {
      ...prototypeOperationalIdentity,
      coordinates: { regionId: "authorized-all" as const },
      savedView: null,
    };
    const unauthorizedProduct = {
      ...monitoringObject,
      productIds: ["barley"],
      productLabels: ["大麦"],
    };
    const unauthorizedCultivar = {
      ...monitoringObject,
      cultivarIds: ["private-cultivar"],
      cultivarLabels: ["未授权品种"],
    };
    expect(
      projectMonitoringObjects([unauthorizedProduct], scope, true),
    ).toEqual([]);
    expect(
      projectMonitoringObjects([unauthorizedCultivar], scope, true),
    ).toEqual([]);
  });

  it("redacts mixed object coordinates to authorized product and cultivar arrays", () => {
    const scope = {
      ...prototypeOperationalIdentity,
      coordinates: { regionId: "authorized-all" as const },
      savedView: null,
    };
    const projected = projectMonitoringObjects(
      productionMonitoringObjects,
      scope,
      true,
    );
    expect(projected[0]).toMatchObject({
      productIds: ["corn"],
      productLabels: ["玉米"],
      cultivarIds: ["jingke-968"],
      cultivarLabels: ["京科968"],
    });
  });

  it("rejects a non-production business-domain coordinate without fallback", () => {
    const scope = {
      ...prototypeOperationalIdentity,
      coordinates: {
        regionId: "authorized-all" as const,
        businessDomainId: "market",
      },
      savedView: null,
    };
    expect(
      projectMonitoringObjects(productionMonitoringObjects, scope, true),
    ).toEqual([]);
    expect(
      projectMonitoringObjects(
        productionMonitoringObjects,
        {
          ...scope,
          coordinates: {
            regionId: "authorized-all",
            businessSubtypeId: "market.origin-purchase",
          },
        },
        true,
      ),
    ).toEqual([]);
  });

  it("accepts an authorized unique short production subtype alias", () => {
    const scope = {
      ...prototypeOperationalIdentity,
      coordinates: {
        regionId: "authorized-all" as const,
        businessSubtypeId: "planting-production",
      },
      savedView: null,
    };
    expect(
      projectMonitoringObjects(productionMonitoringObjects, scope, true),
    ).not.toEqual([]);
  });
});
