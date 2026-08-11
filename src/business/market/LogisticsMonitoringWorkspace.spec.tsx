import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  BusinessRecordListInput,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";

import type { OperationalScope } from "../core/operationalScope";
import { fixtureOperationalIdentity } from "../formalEnterpriseData";
import { LogisticsMonitoringWorkspace } from "./LogisticsMonitoringWorkspace";

afterEach(cleanup);

const scope: OperationalScope = {
  ...fixtureOperationalIdentity,
  coordinates: { regionId: "authorized-all" },
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
  periods: [{ code: "2026-W32", name: "2026年第32周" }],
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

describe("logistics monitoring workspace", () => {
  it("queries by survey year and month, real filling dates and logistics status", async () => {
    const user = userEvent.setup();
    const listLogistics = vi
      .fn<RealtimeBusinessRepository["listLogistics"]>()
      .mockResolvedValue({
        items: [],
        pageNumber: 0,
        pageSize: 20,
        totalElements: 0,
        totalPages: 0,
      });
    const repository = {
      listLogistics,
      loadMasterData,
      loadLogisticsDefinition: vi.fn().mockResolvedValue({
        productCode: "CORN",
        fields: [],
        actions: [],
      }),
    } as unknown as RealtimeBusinessRepository;
    render(
      <LogisticsMonitoringWorkspace
        onScopeChange={vi.fn()}
        onSelectionChange={vi.fn()}
        productCode="CORN"
        queryAllowed
        realtimeRepository={repository}
        scope={realtimeScope}
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
      "PENDING_REVIEW",
    );

    await waitFor(() =>
      expect(listLogistics.mock.lastCall?.[0].filters).toMatchObject({
        surveyYear: "2026",
        surveyMonth: "8",
        fillingDateFrom: "2026-08-01",
        fillingDateTo: "2026-08-31",
        status: "PENDING_REVIEW",
      }),
    );
    expect(
      screen.queryByRole("combobox", { name: "监测期" }),
    ).not.toBeInTheDocument();
  });

  it("loads the next persisted logistics page from the backend", async () => {
    const user = userEvent.setup();
    const records = Array.from({ length: 25 }, (_, index) => ({
      id: `LOG-PAGE-${String(index + 1).padStart(2, "0")}`,
      productCode: "CORN",
      values: {
        LOG_STATUS: "DRAFT",
        LOG_ORIGIN: "齐齐哈尔验收铁路站",
        LOG_DESTINATION: "齐齐哈尔验收公路节点",
        LOG_SOURCE_ORGANIZATION: `第 ${index + 1} 个物流台账`,
      },
      displayValues: {},
      status: "DRAFT",
      returnReason: null,
      allowedActions: [],
      version: 1,
    }));
    const listLogistics = vi.fn(({ page = 0 }: BusinessRecordListInput) =>
      Promise.resolve({
        items: records.slice(page * 20, page * 20 + 20),
        pageNumber: page,
        pageSize: 20,
        totalElements: records.length,
        totalPages: 2,
      }),
    );
    const repository = {
      listLogistics,
      loadMasterData,
      loadLogisticsDefinition: vi.fn().mockResolvedValue({
        productCode: "CORN",
        fields: [
          {
            code: "LOG_SOURCE_ORGANIZATION",
            label: "来源单位",
            controlType: "TEXT",
            unit: null,
            precision: null,
            scale: null,
            required: true,
            readOnly: false,
            sortOrder: 1,
            options: [],
          },
        ],
        actions: [],
      }),
    } as unknown as RealtimeBusinessRepository;

    render(
      <LogisticsMonitoringWorkspace
        onScopeChange={vi.fn()}
        onSelectionChange={vi.fn()}
        productCode="CORN"
        queryAllowed
        realtimeRepository={repository}
        scope={realtimeScope}
      />,
    );

    expect(await screen.findByText("第 1 个物流台账")).toBeVisible();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "业务地区" }),
      "230202",
    );
    await waitFor(() => {
      expect(listLogistics.mock.lastCall?.[0].page).toBe(0);
      expect(listLogistics.mock.lastCall?.[0].filters).toMatchObject({
        regionCode: "230202",
        surveyYear: "2026",
      });
    });
    await user.click(screen.getByRole("button", { name: "下一页" }));

    expect(await screen.findByText("第 21 个物流台账")).toBeVisible();
    expect(listLogistics.mock.lastCall?.[0]).toMatchObject({
      page: 1,
      pageSize: 20,
    });
    expect(listLogistics.mock.lastCall?.[0].filters).toMatchObject({
      regionCode: "230202",
      surveyYear: "2026",
    });
  });
});
