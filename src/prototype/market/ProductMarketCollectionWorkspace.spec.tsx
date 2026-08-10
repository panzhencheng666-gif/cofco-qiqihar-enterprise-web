import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  BusinessRecordListInput,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";

import type { OperationalScope } from "../core/operationalScope";
import { prototypeOperationalIdentity } from "../formalEnterpriseData";
import { ProductMarketCollectionWorkspace } from "./ProductMarketCollectionWorkspace";

afterEach(cleanup);

const scope: OperationalScope = {
  ...prototypeOperationalIdentity,
  coordinates: { regionId: "authorized-all" },
  authorization: {
    ...prototypeOperationalIdentity.authorization,
    authorizedBusinessClassificationIds: ["market.quote-trade"],
    authorizedProductIds: ["corn"],
    authorizedCultivarIds: [],
  },
  savedView: null,
};

const realtimeScope: OperationalScope = {
  ...scope,
  authorization: {
    ...scope.authorization,
    authorizedRegionIds: [
      "230202",
    ] as unknown as OperationalScope["authorization"]["authorizedRegionIds"],
  },
};

const loadMasterData = vi.fn().mockResolvedValue({
  products: [{ code: "CORN", name: "玉米" }],
  periods: [],
  regions: [
    {
      code: "230200",
      name: "齐齐哈尔市",
      parentCode: null,
      level: "PREFECTURE",
    },
    {
      code: "230202",
      name: "龙沙区",
      parentCode: "230200",
      level: "COUNTY",
    },
  ],
});

describe("product market collection workspace", () => {
  it("queries by mandatory survey year, optional month and real filling dates", async () => {
    const user = userEvent.setup();
    const listMarket = vi
      .fn<RealtimeBusinessRepository["listMarket"]>()
      .mockResolvedValue({
        items: [],
        pageNumber: 0,
        pageSize: 20,
        totalElements: 0,
        totalPages: 0,
      });
    const repository = {
      listMarket,
      loadMasterData,
      loadMarketDefinition: vi.fn().mockResolvedValue({
        productCode: "CORN",
        objectTypeCode: "TRADER",
        coreFields: [],
        groups: [],
      }),
    } as unknown as RealtimeBusinessRepository;
    render(
      <ProductMarketCollectionWorkspace
        onScopeChange={vi.fn()}
        onSelectionChange={vi.fn()}
        queryAllowed
        realtimeRepository={repository}
        scope={realtimeScope}
        section="corn-collection"
      />,
    );

    await screen.findByRole("combobox", { name: "调查年份" });
    await user.selectOptions(
      screen.getByRole("combobox", { name: "调查月份" }),
      "8",
    );
    await user.type(screen.getByLabelText("填报日期起"), "2026-08-01");
    await user.type(screen.getByLabelText("填报日期止"), "2026-08-31");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "填报状态" }),
      "待审核",
    );

    await waitFor(() =>
      expect(listMarket.mock.lastCall?.[0].filters).toMatchObject({
        surveyYear: "2026",
        surveyMonth: "8",
        fillingDateFrom: "2026-08-01",
        fillingDateTo: "2026-08-31",
        status: "PENDING_REVIEW",
      }),
    );
    expect(screen.queryByLabelText("采集日期")).not.toBeInTheDocument();
  });

  it("loads the next persisted market page from the backend", async () => {
    const user = userEvent.setup();
    const records = Array.from({ length: 25 }, (_, index) => ({
      id: `MKT-PAGE-${String(index + 1).padStart(2, "0")}`,
      values: {
        MKT_SAMPLE_NAME: `第 ${index + 1} 个市场监测点`,
        MKT_OBJECT_TYPE: "TRADER",
        MKT_STATUS: "DRAFT",
      },
      allowedActions: [],
      version: 1,
    }));
    const listMarket = vi.fn(({ page = 0 }: BusinessRecordListInput) =>
      Promise.resolve({
        items: records.slice(page * 20, page * 20 + 20),
        pageNumber: page,
        pageSize: 20,
        totalElements: records.length,
        totalPages: 2,
      }),
    );
    const repository = {
      listMarket,
      loadMasterData,
      loadMarketDefinition: vi.fn().mockResolvedValue({
        productCode: "CORN",
        objectTypeCode: "TRADER",
        coreFields: [],
        groups: [],
      }),
    } as unknown as RealtimeBusinessRepository;

    render(
      <ProductMarketCollectionWorkspace
        onScopeChange={vi.fn()}
        onSelectionChange={vi.fn()}
        queryAllowed
        realtimeRepository={repository}
        scope={realtimeScope}
        section="corn-collection"
      />,
    );

    expect(await screen.findByText("第 1 个市场监测点")).toBeVisible();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "业务地区" }),
      "230202",
    );
    await waitFor(() => {
      expect(listMarket.mock.lastCall?.[0].page).toBe(0);
      expect(listMarket.mock.lastCall?.[0].filters?.regionCode).toBe("230202");
    });
    await user.click(screen.getByRole("button", { name: "下一页" }));

    expect(await screen.findByText("第 21 个市场监测点")).toBeVisible();
    expect(listMarket.mock.lastCall?.[0]).toMatchObject({
      page: 1,
      pageSize: 20,
    });
    expect(listMarket.mock.lastCall?.[0].filters?.regionCode).toBe("230202");
  });

  it("downloads and imports the backend-owned market XLSX template from the list", async () => {
    const user = userEvent.setup();
    const listMarket = vi.fn().mockResolvedValue({
      items: [
        {
          id: "MKT-DB-001",
          values: {
            MKT_OBJECT_TYPE: "TRADER",
            MKT_SAMPLE_NAME: "验收贸易商",
            MKT_STATUS: "退回补充",
          },
        },
      ],
      pageNumber: 0,
      pageSize: 100,
      totalElements: 0,
      totalPages: 0,
    });
    const loadMarketDefinition = vi.fn().mockResolvedValue({
      productCode: "CORN",
      objectTypeCode: "TRADER",
      coreFields: [],
      groups: [],
    });
    const importMarketWorkbook = vi.fn().mockResolvedValue({
      id: "IMPORT-MARKET-001",
      domainCode: "MARKET",
      statusCode: "COMPLETED",
      importedRows: 2,
      failedRows: 0,
    });
    const downloadMarketXlsxTemplate = vi
      .fn()
      .mockResolvedValue(new Blob(["xlsx"]));
    const onCreateRecord = vi.fn();
    const onEditRecord = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:market-template"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      () => undefined,
    );
    const repository = {
      listMarket,
      loadMarketDefinition,
      importMarketWorkbook,
      downloadMarketXlsxTemplate,
    } as unknown as RealtimeBusinessRepository;

    render(
      <ProductMarketCollectionWorkspace
        onCreateRecord={onCreateRecord}
        onEditRecord={onEditRecord}
        onScopeChange={vi.fn()}
        onSelectionChange={vi.fn()}
        queryAllowed
        realtimeRepository={repository}
        scope={scope}
        section="corn-collection"
      />,
    );

    expect(
      await screen.findByRole("button", { name: "下载 XLSX 模板" }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("combobox", { name: "具体品种" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "需补充" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "查询" }));
    await waitFor(() => expect(listMarket).toHaveBeenCalledTimes(2));
    await user.click(screen.getByRole("button", { name: "下载 XLSX 模板" }));
    await waitFor(() =>
      expect(downloadMarketXlsxTemplate).toHaveBeenCalledWith("CORN", "TRADER"),
    );

    const file = new File(["market"], "market.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    await user.upload(screen.getByLabelText("批量导入市场采集记录"), file);

    await waitFor(() =>
      expect(importMarketWorkbook).toHaveBeenCalledWith(file, "CORN", "TRADER"),
    );
    expect(
      await screen.findByText("导入完成：成功 2 条，失败 0 条。"),
    ).toBeVisible();
    await waitFor(() => expect(listMarket).toHaveBeenCalledTimes(3));
    await user.click(screen.getByRole("button", { name: "新建采集记录" }));
    expect(onCreateRecord).toHaveBeenCalledWith("CORN");
    await user.click(screen.getByRole("button", { name: "查看" }));
    expect(onEditRecord).toHaveBeenCalledWith("CORN", "MKT-DB-001");
  });
});
