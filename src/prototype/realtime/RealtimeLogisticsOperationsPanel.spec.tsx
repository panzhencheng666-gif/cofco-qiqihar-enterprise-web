import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RealtimeBusinessRepository } from "@/platform/api/realtimeBusinessRepository";
import { RealtimeLogisticsOperationsPanel } from "./RealtimeLogisticsOperationsPanel";

function repository(): RealtimeBusinessRepository {
  return {
    loadMasterData: vi.fn(),
    listCultivars: vi.fn(),
    listObjectTypes: vi.fn(),
    loadProductionDefinition: vi.fn(),
    loadMarketDefinition: vi.fn(),
    listWorkItems: vi.fn(),
    listProduction: vi.fn(),
    getProduction: vi.fn(),
    createProduction: vi.fn(),
    updateProduction: vi.fn(),
    transitionProduction: vi.fn(),
    listMarket: vi.fn(),
    getMarket: vi.fn(),
    createMarket: vi.fn(),
    updateMarket: vi.fn(),
    transitionMarket: vi.fn(),
    loadSupplyInputWorkspace: vi.fn(),
    listSupplyAccounts: vi.fn(),
    createSupplyInputSet: vi.fn(),
    approveSupplyManualDecision: vi.fn(),
    runSupplyAccount: vi.fn(),
    importProductionCsv: vi.fn(),
    loadLogisticsDefinition: vi.fn(() =>
      Promise.resolve({
        productCode: "CORN",
        fields: [
          {
            code: "LOG_PERIOD",
            label: "物流监测期",
            controlType: "SELECT",
            unit: null,
            precision: null,
            scale: null,
            required: true,
            readOnly: false,
            sortOrder: 10,
            options: [
              { value: "2026-W32", label: "2026年第32周", sortOrder: 1 },
            ],
          },
        ],
        actions: [],
      }),
    ),
    listLogistics: vi.fn(() =>
      Promise.resolve({
        items: [],
        pageNumber: 0,
        pageSize: 100,
        totalElements: 0,
        totalPages: 0,
      }),
    ),
    getLogistics: vi.fn(),
    createLogistics: vi.fn(),
    updateLogistics: vi.fn(),
    transitionLogistics: vi.fn(),
  };
}

describe("RealtimeLogisticsOperationsPanel", () => {
  it("renders backend-owned logistics definitions and an empty real list", async () => {
    render(<RealtimeLogisticsOperationsPanel repository={repository()} />);
    expect(
      await screen.findByRole("heading", { name: "实时物流节点监测" }),
    ).toBeVisible();
    expect(screen.getByLabelText(/物流监测期/)).toBeVisible();
    expect(screen.getByText("暂无物流记录，可新建填报。")).toBeVisible();
  });
});
