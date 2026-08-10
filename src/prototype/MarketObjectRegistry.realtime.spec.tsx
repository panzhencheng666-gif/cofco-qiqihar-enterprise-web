import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import type { RealtimeBusinessRepository } from "@/platform/api/realtimeBusinessRepository";
import type { OperationalScope } from "./core/operationalScope";
import { prototypeOperationalIdentity } from "./formalEnterpriseData";
import { MarketMonitoringWorkspace } from "./MarketMonitoringWorkspace";

afterEach(cleanup);

const serverScope: OperationalScope = {
  ...prototypeOperationalIdentity,
  coordinates: { regionId: "230281" },
  authorization: {
    ...prototypeOperationalIdentity.authorization,
    serverAuthoritative: true,
    authorizedRegionIds: [
      "230281",
    ] as unknown as OperationalScope["authorization"]["authorizedRegionIds"],
    permissionKeys: ["BUSINESS_READ", "MARKET_OBJECT_MANAGE"],
  },
  savedView: null,
};

it("renders the server-owned market object registry in API mode", async () => {
  const user = userEvent.setup();
  const listMarketObjects = vi.fn().mockResolvedValue([
    {
      objectId: "object-server-1",
      objectName: "服务器权威市场主体",
      objectTypeId: "business-party",
      objectTypeLabel: "经营主体",
      regionCode: "230281",
      regionName: "讷河市",
      productIds: ["paddy"],
      productLabels: ["稻谷"],
      cultivarIds: [],
      cultivarLabels: [],
      sourceChannelId: "enterprise-report",
      sourceChannelLabel: "企业直报",
      responsibleUserId: "wang-yang",
      responsiblePerson: "王洋",
      effectiveFrom: "2026-08-01",
      effectiveTo: null,
      validityStatus: "active",
      roles: [
        {
          roleId: "rice-mill",
          label: "米厂",
          effectiveFrom: "2026-08-02",
          effectiveTo: null,
          capabilityTemplateVersionId: "CAPABILITY-MARKET-rice-mill",
        },
      ],
      version: 0,
    },
  ]);
  const repository = {
    listMarketObjects,
  } as unknown as RealtimeBusinessRepository;

  render(
    <MarketMonitoringWorkspace
      onComposeReport={vi.fn()}
      onScopeChange={vi.fn()}
      queryAllowed
      realtimeRepository={repository}
      scope={serverScope}
      section="objects"
    />,
  );

  expect(await screen.findByText("服务器权威市场主体")).toBeVisible();
  expect(listMarketObjects).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("讷河恒泰米业")).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "查看服务器权威市场主体" }),
  );
  expect(screen.getByText("当前生效")).toBeVisible();
  expect(screen.getByText("米厂监测")).toBeVisible();
});

it("creates a governed dossier through the server repository", async () => {
  const user = userEvent.setup();
  const created = {
    objectId: "object-server-2",
    objectName: "讷河阶段四米业",
    objectTypeId: "business-party",
    objectTypeLabel: "经营主体",
    regionCode: "230281",
    regionName: "讷河市",
    productIds: ["paddy"],
    productLabels: ["稻谷"],
    cultivarIds: [],
    cultivarLabels: [],
    sourceChannelId: "enterprise-report",
    sourceChannelLabel: "企业直报",
    responsibleUserId: "wang-yang",
    responsiblePerson: "王洋",
    effectiveFrom: "2026-08-01",
    effectiveTo: null,
    validityStatus: "active" as const,
    roles: [
      {
        roleId: "rice-mill",
        label: "米厂",
        effectiveFrom: "2026-08-01",
        effectiveTo: null,
        capabilityTemplateVersionId: "CAPABILITY-MARKET-rice-mill",
      },
    ],
    version: 0,
  };
  const createMarketObject = vi.fn().mockResolvedValue(created);
  const repository = {
    listMarketObjects: vi.fn().mockResolvedValue([]),
    createMarketObject,
  } as unknown as RealtimeBusinessRepository;

  render(
    <MarketMonitoringWorkspace
      onComposeReport={vi.fn()}
      onScopeChange={vi.fn()}
      queryAllowed
      realtimeRepository={repository}
      scope={serverScope}
      section="objects"
    />,
  );

  await screen.findByText(/当前筛选范围内没有已授权监测对象/u);
  await user.click(screen.getByRole("button", { name: "新增监测对象" }));
  await user.type(
    screen.getByRole("textbox", { name: "新增对象名称" }),
    "讷河阶段四米业",
  );
  await user.selectOptions(
    screen.getByRole("combobox", { name: "新增对象类型" }),
    "business-party",
  );
  await user.selectOptions(
    screen.getByRole("combobox", { name: "新增对象业务地区" }),
    "230281",
  );
  await user.click(
    screen.getByRole("checkbox", { name: "新增对象经营产品：稻谷" }),
  );
  await user.selectOptions(
    screen.getByRole("combobox", { name: "新增对象来源渠道" }),
    "enterprise-report",
  );
  await user.type(
    screen.getByRole("textbox", { name: "新增对象责任人" }),
    "王洋",
  );
  await user.type(screen.getByLabelText("新增对象生效日期"), "2026-08-01");
  await user.click(
    screen.getByRole("checkbox", { name: "新增对象业务角色：米厂" }),
  );
  await user.type(
    screen.getByLabelText("新增对象米厂角色生效日期"),
    "2026-08-01",
  );
  await user.click(screen.getByRole("button", { name: "保存监测对象" }));

  expect(createMarketObject).toHaveBeenCalledWith(
    expect.objectContaining({
      objectName: "讷河阶段四米业",
      regionCode: "230281",
      productIds: ["paddy"],
      sourceChannelId: "enterprise-report",
    }),
  );
  expect(createMarketObject.mock.calls[0]?.[0]).not.toHaveProperty(
    "responsiblePerson",
  );
  expect((await screen.findAllByText("讷河阶段四米业")).length).toBeGreaterThan(
    0,
  );
});

it("updates a governed dossier with its server version", async () => {
  const user = userEvent.setup();
  const existing = {
    objectId: "object-server-3",
    objectName: "讷河原对象名称",
    objectTypeId: "business-party",
    objectTypeLabel: "经营主体",
    regionCode: "230281",
    regionName: "讷河市",
    productIds: ["paddy"],
    productLabels: ["稻谷"],
    cultivarIds: [],
    cultivarLabels: [],
    sourceChannelId: "enterprise-report",
    sourceChannelLabel: "企业直报",
    responsibleUserId: "wang-yang",
    responsiblePerson: "王洋",
    effectiveFrom: "2026-08-01",
    effectiveTo: null,
    validityStatus: "active" as const,
    roles: [
      {
        roleId: "rice-mill",
        label: "米厂",
        effectiveFrom: "2026-08-01",
        effectiveTo: null,
        capabilityTemplateVersionId: "CAPABILITY-MARKET-rice-mill",
      },
    ],
    version: 4,
  };
  const updateMarketObject = vi
    .fn()
    .mockImplementation((_id: string, input: { objectName: string }) =>
      Promise.resolve({
        ...existing,
        objectName: input.objectName,
        version: 5,
      }),
    );
  const repository = {
    listMarketObjects: vi.fn().mockResolvedValue([existing]),
    updateMarketObject,
  } as unknown as RealtimeBusinessRepository;

  render(
    <MarketMonitoringWorkspace
      onComposeReport={vi.fn()}
      onScopeChange={vi.fn()}
      queryAllowed
      realtimeRepository={repository}
      scope={serverScope}
      section="objects"
    />,
  );

  await user.click(
    await screen.findByRole("button", { name: "查看讷河原对象名称" }),
  );
  await user.click(screen.getByRole("button", { name: "编辑监测对象" }));
  const name = screen.getByRole("textbox", { name: "编辑对象名称" });
  await user.clear(name);
  await user.type(name, "讷河更新后对象名称");
  await user.click(screen.getByRole("button", { name: "保存对象资料" }));

  expect(updateMarketObject).toHaveBeenCalledWith(
    "object-server-3",
    expect.objectContaining({
      objectName: "讷河更新后对象名称",
      version: 4,
    }),
  );
  expect(
    (await screen.findAllByText("讷河更新后对象名称")).length,
  ).toBeGreaterThan(0);
});
