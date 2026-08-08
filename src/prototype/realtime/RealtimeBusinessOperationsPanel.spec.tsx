import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { RealtimeBusinessRepository } from "@/platform/api/realtimeBusinessRepository";
import { RealtimeBusinessOperationsPanel } from "./RealtimeBusinessOperationsPanel";

function repository(): RealtimeBusinessRepository {
  return {
    loadMasterData: vi.fn(() =>
      Promise.resolve({
        products: [{ code: "CORN", name: "玉米" }],
        periods: [
          {
            code: "2026-W32",
            name: "2026年第32周",
            startsOn: "2026-08-03",
            endsOn: "2026-08-09",
          },
        ],
        regions: [
          {
            code: "230200",
            name: "齐齐哈尔市",
            parentCode: null,
            level: "PREFECTURE",
          },
        ],
      }),
    ),
    listCultivars: vi.fn(() => Promise.resolve([])),
    listObjectTypes: vi.fn(() =>
      Promise.resolve([{ code: "FARMER", name: "农户", domain: "PRODUCTION" }]),
    ),
    loadProductionDefinition: vi.fn(() =>
      Promise.resolve({
        productCode: "CORN",
        objectTypeCode: "FARMER",
        groups: [],
      }),
    ),
    loadMarketDefinition: vi.fn(),
    listWorkItems: vi.fn(),
    listProduction: vi.fn(() =>
      Promise.resolve({
        items: [],
        pageNumber: 0,
        pageSize: 100,
        totalElements: 0,
        totalPages: 0,
      }),
    ),
    getProduction: vi.fn(),
    createProduction: vi.fn(),
    updateProduction: vi.fn(),
    transitionProduction: vi.fn(),
    listMarket: vi.fn(),
    getMarket: vi.fn(),
    createMarket: vi.fn(),
    updateMarket: vi.fn(),
    transitionMarket: vi.fn(),
  } as unknown as RealtimeBusinessRepository;
}

describe("RealtimeBusinessOperationsPanel", () => {
  it("renders the required production provenance fields without the removed duplicate inputs", async () => {
    render(
      <RealtimeBusinessOperationsPanel
        actorName="张三"
        domain="production"
        repository={repository()}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "本地实时产情业务" }),
    ).toBeVisible();
    expect(screen.getByLabelText("填报人")).toBeVisible();
    expect(screen.getByLabelText("样本点联系方式")).toBeVisible();
    expect(screen.getByLabelText("样本点纬度")).toBeVisible();
    expect(screen.getByLabelText("样本点经度")).toBeVisible();
    expect(screen.queryByLabelText("样本平均结果")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("区域加权估计")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("测产轮次")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("入库数量")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("自用数量")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("损耗数量")).not.toBeInTheDocument();
  });
});
