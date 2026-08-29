import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import type { RealtimeBusinessRepository } from "@/platform/api/realtimeBusinessRepository";
import { RealtimeApiError } from "@/platform/api/realtimeApiClient";

import type { OperationalScope } from "./core/operationalScope";
import { fixtureOperationalIdentity } from "./formalEnterpriseData";
import { ProductionMonitoringWorkspace } from "./ProductionMonitoringWorkspace";

afterEach(cleanup);

const serverScope: OperationalScope = {
  ...fixtureOperationalIdentity,
  coordinates: { regionId: "230281" },
  authorization: {
    ...fixtureOperationalIdentity.authorization,
    serverAuthoritative: true,
    authorizedRegionIds: [
      "230281",
    ] as unknown as OperationalScope["authorization"]["authorizedRegionIds"],
    permissionKeys: ["BUSINESS_READ", "BUSINESS_UPDATE"],
  },
  savedView: null,
};

const liveServerScope: OperationalScope = {
  ...serverScope,
  authorization: {
    ...serverScope.authorization,
    authorizedProductIds: [],
    authorizedCultivarIds: [],
  },
};

const authoritativeMasterData = {
  products: [
    { code: "CORN", name: "玉米" },
    { code: "SOYBEAN", name: "大豆" },
    { code: "RICE", name: "稻谷" },
  ],
  periods: [],
  regions: [
    {
      code: "230281",
      name: "讷河市",
      parentCode: "230200",
      level: "COUNTY",
    },
  ],
};

const persistedObject = {
  objectId: "production-object-server-1",
  objectName: "讷河市权威产情调查对象",
  objectTypeId: "village-committee",
  objectTypeLabel: "村委会",
  regionCode: "230281",
  regionName: "讷河市",
  productIds: ["corn"],
  productLabels: ["玉米"],
  cultivarIds: [],
  cultivarLabels: [],
  sourceChannelId: "administrative-village-ledger",
  sourceChannelLabel: "行政村台账",
  responsibleUserId: "production-tester",
  responsiblePerson: "产情测试员",
  effectiveFrom: "2026-08-01",
  effectiveTo: null,
  validityStatus: "active" as const,
  roles: [
    {
      roleId: "production-survey",
      label: "产情调查对象",
      effectiveFrom: "2026-08-01",
      effectiveTo: null,
      capabilityTemplateVersionId: "CAPABILITY-PRODUCTION-FULL-2",
    },
  ],
  version: 0,
};

it("uses authoritative master data to bootstrap the first realtime object", async () => {
  const user = userEvent.setup();
  render(
    <ProductionMonitoringWorkspace
      onComposeReport={vi.fn()}
      queryAllowed
      realtimeRepository={
        {
          listProductionObjects: vi.fn().mockResolvedValue([]),
          loadMasterData: vi.fn().mockResolvedValue(authoritativeMasterData),
        } as unknown as RealtimeBusinessRepository
      }
      scope={liveServerScope}
      section="objects"
    />,
  );

  await screen.findByText(/没有可查看的监测对象/u);
  await user.click(screen.getByRole("button", { name: "新增监测对象" }));

  expect(screen.getByRole("checkbox", { name: "玉米" })).toBeVisible();
  expect(screen.getByRole("option", { name: "讷河市" })).toBeVisible();
  expect(
    screen.queryByRole("option", { name: "230281" }),
  ).not.toBeInTheDocument();
});

it("renders production objects exclusively from the authoritative repository", async () => {
  const listProductionObjects = vi.fn().mockResolvedValue([persistedObject]);
  render(
    <ProductionMonitoringWorkspace
      onComposeReport={vi.fn()}
      queryAllowed
      realtimeRepository={
        {
          listProductionObjects,
          loadMasterData: vi.fn().mockResolvedValue(authoritativeMasterData),
        } as unknown as RealtimeBusinessRepository
      }
      scope={liveServerScope}
      section="objects"
    />,
  );

  expect(await screen.findByText("讷河市权威产情调查对象")).toBeVisible();
  expect(screen.getByText("玉米")).toBeVisible();
  expect(listProductionObjects).toHaveBeenCalledTimes(1);
  expect(
    screen.queryByText("讷河市同义镇保国村村委会"),
  ).not.toBeInTheDocument();
});

it("does not report a successful production-object save when the API fails", async () => {
  const user = userEvent.setup();
  const createProductionObject = vi
    .fn()
    .mockRejectedValue(new Error("request failed"));
  render(
    <ProductionMonitoringWorkspace
      onComposeReport={vi.fn()}
      queryAllowed
      realtimeRepository={
        {
          listProductionObjects: vi.fn().mockResolvedValue([]),
          loadMasterData: vi.fn().mockResolvedValue(authoritativeMasterData),
          createProductionObject,
        } as unknown as RealtimeBusinessRepository
      }
      scope={serverScope}
      section="objects"
    />,
  );

  await screen.findByText(/没有可查看的监测对象/u);
  await user.click(screen.getByRole("button", { name: "新增监测对象" }));
  await user.type(
    screen.getByRole("textbox", { name: "对象名称" }),
    "失败对象",
  );
  await user.selectOptions(
    screen.getByRole("combobox", { name: "编辑对象类型" }),
    "village-committee",
  );
  await user.selectOptions(
    screen.getByRole("combobox", { name: "编辑行政区划" }),
    "230281",
  );
  await user.click(screen.getByRole("checkbox", { name: "玉米" }));
  await user.selectOptions(
    screen.getByRole("combobox", { name: "编辑来源渠道" }),
    "administrative-village-ledger",
  );
  await user.selectOptions(
    screen.getByRole("combobox", { name: "编辑有效状态" }),
    "active",
  );
  await user.click(screen.getByRole("checkbox", { name: "产情调查对象" }));
  await user.type(
    screen.getByLabelText("产情调查对象角色生效日期"),
    "2026-08-01",
  );
  await user.click(screen.getByRole("button", { name: "保存对象草稿" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("保存失败");
  expect(screen.queryByText(/对象草稿已保存/u)).not.toBeInTheDocument();
});

it("updates with the server version and requeries the authoritative list", async () => {
  const user = userEvent.setup();
  const updated = {
    ...persistedObject,
    objectName: "讷河市更新后权威调查对象",
    version: 1,
  };
  const listProductionObjects = vi
    .fn()
    .mockResolvedValueOnce([persistedObject])
    .mockResolvedValueOnce([updated]);
  const updateProductionObject = vi.fn().mockResolvedValue(updated);
  render(
    <ProductionMonitoringWorkspace
      onComposeReport={vi.fn()}
      queryAllowed
      realtimeRepository={
        {
          listProductionObjects,
          loadMasterData: vi.fn().mockResolvedValue(authoritativeMasterData),
          updateProductionObject,
        } as unknown as RealtimeBusinessRepository
      }
      scope={serverScope}
      section="objects"
    />,
  );

  await screen.findByText("讷河市权威产情调查对象");
  await user.click(
    screen.getByRole("button", { name: "查看讷河市权威产情调查对象" }),
  );
  await user.click(screen.getByRole("button", { name: "编辑对象" }));
  const name = screen.getByRole("textbox", { name: "对象名称" });
  await user.clear(name);
  await user.type(name, "讷河市更新后权威调查对象");
  await user.click(screen.getByRole("button", { name: "保存对象草稿" }));

  expect(updateProductionObject).toHaveBeenCalledWith(
    "production-object-server-1",
    expect.objectContaining({
      objectName: "讷河市更新后权威调查对象",
      version: 0,
    }),
  );
  expect(listProductionObjects).toHaveBeenCalledTimes(2);
  expect(
    screen.getAllByText("讷河市更新后权威调查对象").length,
  ).toBeGreaterThan(0);
});

it("keeps the editor open and reports an optimistic-lock failure", async () => {
  const user = userEvent.setup();
  render(
    <ProductionMonitoringWorkspace
      onComposeReport={vi.fn()}
      queryAllowed
      realtimeRepository={
        {
          listProductionObjects: vi.fn().mockResolvedValue([persistedObject]),
          loadMasterData: vi.fn().mockResolvedValue(authoritativeMasterData),
          updateProductionObject: vi.fn().mockRejectedValue(
            new RealtimeApiError({
              code: "PRODUCTION_OBJECT_VERSION_CONFLICT",
              message: "调查对象已被其他人员更新",
              status: 409,
            }),
          ),
        } as unknown as RealtimeBusinessRepository
      }
      scope={serverScope}
      section="objects"
    />,
  );

  await screen.findByText("讷河市权威产情调查对象");
  await user.click(
    screen.getByRole("button", { name: "查看讷河市权威产情调查对象" }),
  );
  await user.click(screen.getByRole("button", { name: "编辑对象" }));
  await user.click(screen.getByRole("button", { name: "保存对象草稿" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "对象已被其他人员更新",
  );
  expect(screen.getByRole("form", { name: "编辑监测对象" })).toBeVisible();
  expect(screen.queryByText(/已保存到服务端权威名录/u)).not.toBeInTheDocument();
});
