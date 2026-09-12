import { cleanup, render, screen } from "@testing-library/react";
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
  it("sends MY_TASKS with existing filters and uses global browse repository unchanged", async () => {
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
    expect(original.listMarket).toBe(listMarket);
  });
  it("shows no list or create action for an unassigned ordinary account", () => {
    render(
      <MyTasksWorkspace
        {...common}
        repository={{} as RealtimeBusinessRepository}
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
    expect(screen.getByRole("status")).toHaveTextContent("暂未分配责任地区");
    expect(screen.queryByRole("table")).toBeNull();
  });
});
