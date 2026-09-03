import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  EligibleFormalSample,
  FormalSampleObservationDomain,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";
import { FormalSamplePointLedger } from "../formal-sample/FormalSamplePointLedger";
import { SamplePointLedgerTable } from "../formal-sample/SamplePointLedgerPrimitives";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const productionObjects = [
  "FARMER",
  "VILLAGE_COMMITTEE",
  "AGRICULTURAL_TECH_STATION",
];
const marketObjects: Readonly<Record<string, readonly string[]>> = {
  CORN: [
    "TRADER",
    "DEEP_PROCESSOR",
    "WHOLESALE_MARKET",
    "RESERVE_ENTERPRISE",
    "BREEDING_FACTORY",
    "FEED_MILL",
    "AGRICULTURAL_INPUT_STORE",
  ],
  SOYBEAN: [
    "TRADER",
    "DEEP_PROCESSOR",
    "WHOLESALE_MARKET",
    "RESERVE_ENTERPRISE",
    "AGRICULTURAL_INPUT_STORE",
  ],
  RICE: [
    "TRADER",
    "DEEP_PROCESSOR",
    "WHOLESALE_MARKET",
    "RESERVE_ENTERPRISE",
    "RICE_MILL",
    "AGRICULTURAL_INPUT_STORE",
  ],
};
const contexts = [
  ...["CORN", "SOYBEAN", "RICE"].flatMap((product) =>
    productionObjects.map(
      (objectType) => ["PRODUCTION", product, objectType] as const,
    ),
  ),
  ...Object.entries(marketObjects).flatMap(([product, objectTypes]) =>
    objectTypes.map((objectType) => ["MARKET", product, objectType] as const),
  ),
  ["LOGISTICS", "CORN", null] as const,
] satisfies readonly (readonly [
  FormalSampleObservationDomain,
  string,
  string | null,
])[];

function fields(prefix: string) {
  return Array.from({ length: 5 }, (_, index) => ({
    code: `${prefix}_FIELD_${index + 1}`,
    label: `${prefix}字段${index + 1}`,
    unit: "吨",
    precision: 18,
    scale: 4,
    required: false,
    readOnly: false,
    calculated: false,
    importable: true,
    displayed: true,
    controlType: "DECIMAL",
    groupCode: "BUSINESS",
    groupLabel: "业务字段",
    groupOrder: 10,
    sortOrder: index + 1,
    options: [],
    description: null,
  }));
}

describe("current sample field contract", () => {
  it.each([1440, 1920])(
    "keeps repeated business labels console-clean at %dpx",
    (width) => {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: width,
      });
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      render(
        <SamplePointLedgerTable
          className="enterprise-ledger-table"
          headers={[
            "地区",
            "对象类型",
            "填报状态",
            "地区",
            "对象类型",
            "填报状态",
          ]}
        >
          <tr>
            <td>样本</td>
          </tr>
        </SamplePointLedgerTable>,
      );

      const duplicateKeyErrors = consoleError.mock.calls.filter((call) =>
        call.some((value) => String(value).includes("same key")),
      );
      expect(duplicateKeyErrors).toEqual([]);
    },
  );

  it.each(contexts)(
    "%s %s %s keeps every applicable latest value visible in the reused ledger",
    async (domain, productCode, objectTypeCode) => {
      const prefix = `${productCode}_${objectTypeCode ?? "ROUTE"}`;
      const definitionFields = fields(prefix);
      const completeField = {
        ...definitionFields[0],
        code:
          domain === "PRODUCTION"
            ? "PROD_SAMPLE_CONTACT"
            : domain === "MARKET"
              ? "MKT_SAMPLE_CONTACT"
              : "LOG_SAMPLE_CONTACT",
        label: "完整字段",
        unit: null,
        sortOrder: 0,
      };
      const sample = {
        samplePointId: `point-${prefix}`,
        sampleName: `${prefix}样本`,
        address: "龙沙区测试地址",
        objectTypeCode,
        objectTypeName: objectTypeCode,
        domain,
        productCode,
        regionCode: "230202",
        regionName: "龙沙区",
        maintainerSubjectId: "operator-1",
        maintainerDisplayName: "操作员",
        latitude: "47.3",
        longitude: "123.9",
        effectiveFrom: "2026-01-01",
        effectiveTo: null,
        version: 1,
        annualObservationCount: 1,
        networkMembershipCount: 0,
        latestObservationId: `record-${prefix}`,
        latestObservedAt: "2026-08-01T00:00:00Z",
        latestValues: {
          ...Object.fromEntries(
            definitionFields.map((field, index) => [
              field.code,
              String(index + 1),
            ]),
          ),
          [completeField.code]: "完整值",
        },
      } satisfies EligibleFormalSample;
      const repository = {
        loadMasterData: vi
          .fn()
          .mockResolvedValue({ regions: [], products: [] }),
        listObjectTypes: vi
          .fn()
          .mockResolvedValue(
            objectTypeCode
              ? [{ code: objectTypeCode, name: objectTypeCode, domain }]
              : [],
          ),
        listEligibleFormalSamples: vi.fn().mockResolvedValue([sample]),
        getFormalSamplePoint: vi.fn(),
        loadProductionDefinition: vi.fn().mockResolvedValue({
          productCode,
          objectTypeCode,
          contractVersion: "test",
          contractDigest: "sha256:test",
          fields: [...definitionFields, completeField],
          groups: [],
        }),
        loadMarketDefinition: vi.fn().mockResolvedValue({
          productCode,
          objectTypeCode,
          coreFields: [completeField],
          groups: [
            {
              category: "BUSINESS",
              label: "业务字段",
              sortOrder: 10,
              fields: definitionFields.map((field) => ({
                code: field.code,
                label: field.label,
                valueType: "DECIMAL",
                unit: field.unit,
                precision: field.precision,
                scale: field.scale,
                sortOrder: field.sortOrder,
              })),
            },
          ],
        }),
        loadLogisticsDefinition: vi.fn().mockResolvedValue({
          productCode,
          fields: [...definitionFields, completeField],
          actions: [],
        }),
      } as unknown as RealtimeBusinessRepository;

      render(
        <FormalSamplePointLedger
          domain={domain}
          permissions={[]}
          productCode={productCode}
          repository={repository}
          showAllApplicableFields
          onCollectData={() => undefined}
        />,
      );

      expect(
        await screen.findByRole("columnheader", {
          name: `${prefix}字段5（吨）`,
        }),
      ).toBeVisible();
      expect(screen.getByRole("cell", { name: "5" })).toBeVisible();
      expect(
        screen.getByRole("columnheader", { name: "完整字段" }),
      ).toBeVisible();
      expect(screen.getByRole("cell", { name: "完整值" })).toBeVisible();
    },
  );
});
