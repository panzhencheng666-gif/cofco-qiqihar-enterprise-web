import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  CurrentSession,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";
import { fixtureOperationalIdentity } from "./formalEnterpriseData";
import { MyTasksWorkspace } from "./MyTasksWorkspace";
import { taskRepository } from "./taskRepository";
import { ProductMarketCollectionWorkspace } from "./market/ProductMarketCollectionWorkspace";
import { ProductProductionCollectionWorkspace } from "./production/ProductProductionCollectionWorkspace";
import { LogisticsMonitoringWorkspace } from "./market/LogisticsMonitoringWorkspace";
afterEach(cleanup);
const scope = {
  ...fixtureOperationalIdentity,
  coordinates: { regionId: "authorized-all" as const },
  savedView: null,
};
const common = {
  scope,
  queryAllowed: true,
  onScopeChange: vi.fn(),
  onSelectionChange: vi.fn(),
  permissions: [
    "ADMIN",
    "BUSINESS_CREATE",
    "BUSINESS_IMPORT",
    "FORMAL_SAMPLE_MANAGE",
    "FORMAL_SAMPLE_DELETE",
  ],
};
describe("monitoring and task boundary", () => {
  it.each(["market", "production", "logistics"])(
    "%s browsing omits every write toolbar even with administrator permissions",
    (domain) => {
      render(
        domain === "market" ? (
          <ProductMarketCollectionWorkspace
            {...common}
            section="corn-collection"
          />
        ) : domain === "production" ? (
          <ProductProductionCollectionWorkspace
            {...common}
            section="corn-collection"
          />
        ) : (
          <LogisticsMonitoringWorkspace {...common} productCode="CORN" />
        ),
      );
      expect(screen.queryByRole("group", { name: "单条录入" })).toBeNull();
      expect(screen.queryByRole("group", { name: "批量导入" })).toBeNull();
      expect(screen.queryByRole("button", { name: "编辑" })).toBeNull();
      expect(screen.queryByRole("button", { name: "彻底删除" })).toBeNull();
      expect(screen.getByRole("table")).toBeInTheDocument();
    },
  );
  it("sends MY_TASKS with existing filters", async () => {
    const listEligibleFormalSamples = vi.fn().mockResolvedValue([]);
    const listMarket = vi.fn().mockResolvedValue({ items: [] });
    const original = {
      listEligibleFormalSamples,
      listMarket,
    } as unknown as RealtimeBusinessRepository;
    const scoped = taskRepository(original);
    await scoped.listMarket({
      productCode: "CORN",
      page: 2,
      filters: { regionCode: "230221100" },
    });
    expect(listMarket).toHaveBeenCalledWith({
      productCode: "CORN",
      page: 2,
      filters: { regionCode: "230221100" },
      scope: "MY_TASKS",
    });
    expect(listMarket).toHaveBeenCalledTimes(1);
  });
  it("opens the normal task list for an unassigned reporter", async () => {
    const listEligibleFormalSamples = vi.fn().mockResolvedValue([]);
    render(
      <MyTasksWorkspace
        {...common}
        repository={
          { listEligibleFormalSamples } as unknown as RealtimeBusinessRepository
        }
        session={
          {
            regionCodes: [],
            roleCodes: ["BUSINESS_OPERATOR"],
            permissions: [
              "BUSINESS_CREATE",
              "BUSINESS_UPDATE",
              "BUSINESS_SUBMIT",
            ],
            unassignedReporter: true,
          } as unknown as CurrentSession
        }
        refreshToken={0}
        onSelectionClear={vi.fn()}
        onCreateRecord={vi.fn()}
        onViewRecord={vi.fn()}
      />,
    );
    expect(screen.queryByText("暂未分配责任地区")).toBeNull();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "单条录入" })).toBeInTheDocument();
    await waitFor(() =>
      expect(listEligibleFormalSamples).toHaveBeenCalledWith(
        expect.objectContaining({ scope: "MY_TASKS", regionCode: undefined }),
      ),
    );
  });
  it("opens the business list for an unassigned ordinary account", () => {
    render(
      <MyTasksWorkspace
        {...common}
        repository={
          {
            listEligibleFormalSamples: vi.fn().mockResolvedValue([]),
          } as unknown as RealtimeBusinessRepository
        }
        session={
          {
            regionCodes: [],
            roleCodes: [],
            permissions: ["BUSINESS_CREATE"],
          } as unknown as CurrentSession
        }
        refreshToken={0}
        onSelectionClear={vi.fn()}
        onCreateRecord={vi.fn()}
        onViewRecord={vi.fn()}
      />,
    );
    expect(screen.queryByText("暂未分配责任地区")).toBeNull();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
});
