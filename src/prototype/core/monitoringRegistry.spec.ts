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
  objectName: "讷河市同义镇产情调查点",
  objectTypeId: "survey-area",
  objectTypeLabel: "产情调查点",
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

const marketMonitoringObject: MonitoringObject = {
  objectId: "OBJ-MARKET-RAIL-01",
  objectName: "齐齐哈尔铁路货运站",
  objectTypeId: "rail-node",
  objectTypeLabel: "铁路站点",
  regionId: "qiqihar-all",
  regionLabel: "齐齐哈尔市",
  productIds: ["corn"],
  productLabels: ["玉米"],
  cultivarIds: [],
  cultivarLabels: [],
  sourceChannelId: "rail-waybill-ledger",
  sourceChannelLabel: "铁路运单与站点台账",
  responsibleUserId: "wang-yang",
  responsiblePerson: "王洋",
  effectiveFrom: "2025-01-01",
  effectiveTo: null,
  validityStatus: "active",
  roles: [
    {
      roleId: "rail-node",
      label: "铁路站点",
      effectiveFrom: "2025-01-01",
      effectiveTo: null,
      capabilityTemplateVersionId: "CAPABILITY-MARKET-RAIL-NODE",
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

  it("derives business capability labels without exposing template editions", () => {
    const activeCapabilities = getActiveObjectCapabilities(
      monitoringObject,
      templates,
      "2025-08-01",
    );

    expect(activeCapabilities).toEqual([
      {
        roleLabel: "产情调查对象",
        templateLabel: "产情调查",
        capabilityLabels: ["种植面积填报", "长势与测产填报"],
      },
      {
        roleLabel: "质量样本对象",
        templateLabel: "质量调查",
        capabilityLabels: ["质量检验依据填报"],
      },
    ]);
    expect(
      activeCapabilities.flatMap(({ capabilityLabels }) => capabilityLabels),
    ).toEqual(["种植面积填报", "长势与测产填报", "质量检验依据填报"]);
    expect(JSON.stringify(activeCapabilities)).not.toMatch(
      /模板第[一二三四五六七八九十\d]+版/,
    );
  });

  it("never falls back to an internal template code when governance is missing", () => {
    expect(
      getActiveObjectCapabilities(monitoringObject, [], "2026-08-01"),
    ).toEqual([
      {
        roleLabel: "产情调查对象",
        templateLabel: "适用能力名称未提供",
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
        ).every(({ templateLabel }) => templateLabel !== "适用能力名称未提供"),
      ).toBe(true);
    }
    expect(
      productionCapabilityTemplates.every(
        ({ label }) => !/模板|第[一二三四五六七八九十\d]+版/.test(label),
      ),
    ).toBe(true);
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

  it("projects truthful market object types and source channels through the shared registry", () => {
    const scope: OperationalScope = {
      ...prototypeOperationalIdentity,
      authorization: {
        ...prototypeOperationalIdentity.authorization,
        authorizedRegionIds: ["qiqihar-all"],
        authorizedBusinessClassificationIds: ["market.quote-trade"],
        authorizedProductIds: ["corn"],
        authorizedCultivarIds: [],
      },
      coordinates: {
        regionId: "authorized-all",
        businessDomainId: "market",
      },
      savedView: null,
    };

    expect(
      projectMonitoringObjects([marketMonitoringObject], scope, true, "market"),
    ).toEqual([marketMonitoringObject]);
    expect(marketMonitoringObject.objectTypeId).toBe("rail-node");
    expect(marketMonitoringObject.sourceChannelId).toBe("rail-waybill-ledger");
    expect(
      projectMonitoringObjects(
        [marketMonitoringObject],
        {
          ...scope,
          coordinates: { ...scope.coordinates, businessDomainId: "production" },
        },
        true,
        "market",
      ),
    ).toEqual([]);
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
      authorization: {
        ...prototypeOperationalIdentity.authorization,
        authorizedProductIds: ["corn"],
        authorizedCultivarIds: ["jingke-968"],
      },
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
