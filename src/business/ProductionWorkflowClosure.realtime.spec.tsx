import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import type { RealtimeBusinessRepository } from "@/platform/api/realtimeBusinessRepository";

import type { BusinessWorkItem } from "./core/businessWork";
import type { OperationalScope } from "./core/operationalScope";
import { businessWorkFixtures } from "./data/businessWorkFixtures";
import { fixtureOperationalIdentity } from "./formalEnterpriseData";
import { MarketMonitoringWorkspace } from "./MarketMonitoringWorkspace";
import { ProductionMonitoringWorkspace } from "./ProductionMonitoringWorkspace";

afterEach(cleanup);

const scope: OperationalScope = {
  ...fixtureOperationalIdentity,
  coordinates: { regionId: "authorized-all", productId: "corn" },
  authorization: {
    ...fixtureOperationalIdentity.authorization,
    serverAuthoritative: true,
    permissionKeys: [
      "BUSINESS_READ",
      "BUSINESS_CREATE",
      "BUSINESS_UPDATE",
      "BUSINESS_APPROVE",
      "BUSINESS_RETURN",
    ],
  },
  savedView: null,
};

function serverWorkItem(domain: "production" | "market"): BusinessWorkItem {
  const fixture = businessWorkFixtures.find((item) => item.domain === domain);
  if (!fixture) throw new Error(`Missing ${domain} fixture`);
  return {
    ...fixture,
    workId: `server-${domain}-work-item`,
    subject: {
      kind: "monitoring-object",
      objectId: `server-${domain}-record`,
      objectName: domain === "production" ? "权威产情记录" : "权威市场记录",
      objectTypeId: domain.toUpperCase(),
    },
  };
}

const realtimeRepositoryWithMasterData = {
  loadMasterData: vi.fn().mockResolvedValue({
    products: [
      { code: "CORN", name: "玉米" },
      { code: "SOYBEAN", name: "大豆" },
      { code: "RICE", name: "稻谷" },
    ],
    periods: [],
    regions: [],
  }),
} as unknown as RealtimeBusinessRepository;

it("opens and creates production tasks through the realtime record workflow", async () => {
  const user = userEvent.setup();
  const onCreateRecord = vi.fn();
  const onEditRecord = vi.fn();
  render(
    <ProductionMonitoringWorkspace
      onComposeReport={vi.fn()}
      onCreateRecord={onCreateRecord}
      onEditRecord={onEditRecord}
      queryAllowed
      realtimeRepository={realtimeRepositoryWithMasterData}
      scope={scope}
      section="tasks"
      workItems={[serverWorkItem("production")]}
    />,
  );

  await user.click(screen.getByRole("button", { name: "新建产情任务" }));
  expect(onCreateRecord).toHaveBeenCalledWith("CORN");

  await user.click(screen.getByRole("button", { name: /办理|查看|审核/u }));
  expect(onEditRecord).toHaveBeenCalledWith("CORN", "server-production-record");
  expect(
    screen.queryByText(/尚未配置可打开的业务单据/u),
  ).not.toBeInTheDocument();
});

it("opens and creates market tasks through the realtime record workflow", async () => {
  const user = userEvent.setup();
  const onCreateRecord = vi.fn();
  const onEditRecord = vi.fn();
  render(
    <MarketMonitoringWorkspace
      onComposeReport={vi.fn()}
      onCreateRecord={onCreateRecord}
      onEditRecord={(_domain, productCode, recordId) => {
        onEditRecord(productCode, recordId);
      }}
      queryAllowed
      realtimeRepository={realtimeRepositoryWithMasterData}
      scope={scope}
      section="tasks"
      workItems={[serverWorkItem("market")]}
    />,
  );

  await user.click(screen.getByRole("button", { name: "新建市场任务" }));
  expect(onCreateRecord).toHaveBeenCalledWith("CORN");

  await user.click(screen.getByRole("button", { name: /办理|查看|审核/u }));
  expect(onEditRecord).toHaveBeenCalledWith("CORN", "server-market-record");
});

it("bootstraps production and market task creation from authoritative products when queues are empty", async () => {
  const user = userEvent.setup();
  const realtimeRepository = {
    loadMasterData: vi.fn().mockResolvedValue({
      products: [
        { code: "CORN", name: "玉米" },
        { code: "SOYBEAN", name: "大豆" },
        { code: "RICE", name: "稻谷" },
      ],
      periods: [],
      regions: [],
    }),
  } as unknown as RealtimeBusinessRepository;
  const unselectedScope: OperationalScope = {
    ...scope,
    coordinates: { regionId: "authorized-all" },
  };
  const onScopeChange = vi.fn();
  const onCreateProduction = vi.fn();
  const production = render(
    <ProductionMonitoringWorkspace
      onComposeReport={vi.fn()}
      onCreateRecord={onCreateProduction}
      onScopeChange={onScopeChange}
      queryAllowed
      realtimeRepository={realtimeRepository}
      scope={unselectedScope}
      section="tasks"
      workItems={[]}
    />,
  );

  await user.selectOptions(
    await screen.findByRole("combobox", { name: "产品或作物" }),
    "corn",
  );
  expect(onScopeChange).toHaveBeenCalledWith({
    productId: "corn",
    cultivarId: undefined,
  });
  production.rerender(
    <ProductionMonitoringWorkspace
      onComposeReport={vi.fn()}
      onCreateRecord={onCreateProduction}
      onScopeChange={onScopeChange}
      queryAllowed
      realtimeRepository={realtimeRepository}
      scope={{
        ...unselectedScope,
        coordinates: { regionId: "authorized-all", productId: "corn" },
      }}
      section="tasks"
      workItems={[]}
    />,
  );
  await user.click(screen.getByRole("button", { name: "新建产情任务" }));
  expect(onCreateProduction).toHaveBeenCalledWith("CORN");
  production.unmount();

  const onCreateMarket = vi.fn();
  const market = render(
    <MarketMonitoringWorkspace
      onComposeReport={vi.fn()}
      onCreateRecord={onCreateMarket}
      onScopeChange={onScopeChange}
      queryAllowed
      realtimeRepository={realtimeRepository}
      scope={unselectedScope}
      section="tasks"
      workItems={[]}
    />,
  );
  await user.selectOptions(
    await screen.findByRole("combobox", { name: "产品或品类" }),
    "corn",
  );
  market.rerender(
    <MarketMonitoringWorkspace
      onComposeReport={vi.fn()}
      onCreateRecord={onCreateMarket}
      onScopeChange={onScopeChange}
      queryAllowed
      realtimeRepository={realtimeRepository}
      scope={{
        ...unselectedScope,
        coordinates: { regionId: "authorized-all", productId: "corn" },
      }}
      section="tasks"
      workItems={[]}
    />,
  );
  await user.click(screen.getByRole("button", { name: "新建市场任务" }));
  expect(onCreateMarket).toHaveBeenCalledWith("CORN");
});

it("shows only actionable submitted records on production and market review routes", () => {
  const productionReturned = {
    ...serverWorkItem("production"),
    workId: "production-returned",
    documentStatus: "returned" as const,
    reviewStatus: "returned" as const,
    subject: {
      ...serverWorkItem("production").subject,
      objectId: "production-returned-record",
      objectName: "已退回产情记录",
    },
  };
  const productionPending = {
    ...serverWorkItem("production"),
    workId: "production-pending",
    documentStatus: "submitted" as const,
    reviewStatus: "pending" as const,
    subject: {
      ...serverWorkItem("production").subject,
      objectId: "production-pending-record",
      objectName: "待审核产情记录",
    },
  };
  const production = render(
    <ProductionMonitoringWorkspace
      onComposeReport={vi.fn()}
      onEditRecord={vi.fn()}
      queryAllowed
      realtimeRepository={{} as RealtimeBusinessRepository}
      scope={scope}
      section="review"
      workItems={[productionReturned, productionPending]}
    />,
  );

  expect(screen.getByText("待审核产情记录")).toBeVisible();
  expect(screen.queryByText("已退回产情记录")).not.toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "审核任务" })).toHaveLength(1);
  production.unmount();

  const marketReturned = {
    ...serverWorkItem("market"),
    workId: "market-returned",
    documentStatus: "returned" as const,
    reviewStatus: "returned" as const,
    subject: {
      ...serverWorkItem("market").subject,
      objectId: "market-returned-record",
      objectName: "已退回市场记录",
    },
  };
  const marketPending = {
    ...serverWorkItem("market"),
    workId: "market-pending",
    documentStatus: "submitted" as const,
    reviewStatus: "reviewing" as const,
    subject: {
      ...serverWorkItem("market").subject,
      objectId: "market-pending-record",
      objectName: "审核中市场记录",
    },
  };
  render(
    <MarketMonitoringWorkspace
      onComposeReport={vi.fn()}
      onEditRecord={vi.fn()}
      queryAllowed
      realtimeRepository={{} as RealtimeBusinessRepository}
      scope={scope}
      section="review"
      workItems={[marketReturned, marketPending]}
    />,
  );

  expect(screen.getByText("审核中市场记录")).toBeVisible();
  expect(screen.queryByText("已退回市场记录")).not.toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "审核任务" })).toHaveLength(1);
});
