import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RealtimeBusinessRepository } from "@/platform/api/realtimeBusinessRepository";
import { RealtimeSupplyBalancePanel } from "./RealtimeSupplyBalancePanel";

function repository(): RealtimeBusinessRepository {
  const roles = [
    {
      code: "OPENING_INVENTORY",
      label: "期初库存",
      groupCode: "SUPPLY",
      required: true,
      sortOrder: 10,
      manualAllowed: true,
      manualDecisionVersion: 0,
      selectedReleaseId: null,
      releases: [],
    },
  ];
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
    loadSupplyInputWorkspace: vi.fn(() =>
      Promise.resolve({
        productCode: "CORN",
        regionCode: "230200",
        marketingYear: "2026-W32",
        inputSetVersion: 0,
        latestInputSetId: null,
        decisionVersion: 0,
        roles,
      }),
    ),
    listSupplyAccounts: vi.fn(() => Promise.resolve([])),
    createSupplyInputSet: vi.fn(),
    approveSupplyManualDecision: vi.fn(),
    runSupplyAccount: vi.fn(),
  } as unknown as RealtimeBusinessRepository;
}

describe("RealtimeSupplyBalancePanel", () => {
  it("renders database-owned input roles and fail-closed actions", async () => {
    render(<RealtimeSupplyBalancePanel repository={repository()} />);
    expect(
      await screen.findByRole("heading", { name: "本地实时供需平衡" }),
    ).toBeVisible();
    expect(screen.getByText("期初库存")).toBeVisible();
    expect(screen.getByRole("button", { name: "批准手工来源" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "创建不可变输入集" }),
    ).toBeDisabled();
    expect(screen.getByText(/缺少必填来源/)).toBeVisible();
  });
});
