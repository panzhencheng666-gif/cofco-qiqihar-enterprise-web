import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  HistoricalFormalSample,
  Page,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";
import { HistoricalSampleWorkspace } from "./HistoricalSampleWorkspace";
afterEach(cleanup);
const sample: HistoricalFormalSample = {
  samplePointId: "retired-point",
  sampleName: "历史粮食样本",
  regionCode: "230221100",
  regionName: "龙江县示例乡镇",
  address: "历史记录地址",
  objectTypeCode: "TRADER",
  objectTypeName: "贸易商",
  productCode: "CORN",
  productName: "玉米",
  domain: "MARKET",
  retiredAt: "2025-03-11T10:00:00Z",
  retirementYear: 2025,
  retirementReason: "业务对象退出",
  lastObservationId: "old-record",
  lastObservedAt: "2025-03-01T10:00:00Z",
};
const page = (
  items: readonly HistoricalFormalSample[] = [sample],
): Page<HistoricalFormalSample> => ({
  items,
  pageNumber: 0,
  pageSize: 20,
  totalElements: items.length,
  totalPages: items.length ? 1 : 0,
});
function repository(list = vi.fn().mockResolvedValue(page())) {
  return {
    listHistoricalFormalSamples: list,
    loadMasterData: vi.fn().mockResolvedValue({ regions: [] }),
  } as unknown as RealtimeBusinessRepository;
}

describe("historical samples read-only ledger", () => {
  it("uses authoritative retirement metadata and opens only the last read-only record", async () => {
    const view = vi.fn();
    render(
      <HistoricalSampleWorkspace
        repository={repository()}
        onViewRecord={view}
      />,
    );
    expect(await screen.findByText("历史粮食样本")).toBeVisible();
    expect(screen.getByRole("tab", { name: "产情" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "产情",
      "市场",
      "物流",
    ]);
    expect(screen.getByText("业务对象退出")).toBeVisible();
    expect(screen.getByText("2025/3/11")).toBeVisible();
    expect(screen.queryByText("retired-point")).toBeNull();
    expect(screen.queryByText("TRADER")).toBeNull();
    for (const name of [
      "编辑",
      "彻底删除",
      "淘汰为历史",
      "新建采集记录",
      "下载 XLSX 模板",
    ])
      expect(screen.queryByRole("button", { name })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "查看最后记录" }));
    expect(view).toHaveBeenCalledWith("market", "CORN", "old-record");
  });
  it("requests all three domains and all three products without filtering an already-paged population", async () => {
    const list = vi.fn().mockResolvedValue(page());
    render(
      <HistoricalSampleWorkspace
        repository={repository(list)}
        onViewRecord={vi.fn()}
      />,
    );
    await screen.findByText("历史粮食样本");
    for (const [domain, label] of [
      ["MARKET", "市场"],
      ["PRODUCTION", "产情"],
      ["LOGISTICS", "物流"],
    ]) {
      await userEvent.click(screen.getByRole("tab", { name: label }));
      for (const productCode of ["CORN", "SOYBEAN", "RICE"]) {
        await userEvent.selectOptions(
          screen.getByRole("combobox", { name: "历史样本品种" }),
          productCode,
        );
        await waitFor(() =>
          expect(list).toHaveBeenLastCalledWith(
            expect.objectContaining({
              domain,
              productCode,
              pageNumber: 0,
              pageSize: 20,
            }),
          ),
        );
      }
    }
  });
  it("uses server totals for paging and applies retirement year and keyword on query", async () => {
    const list = vi.fn().mockImplementation((input) =>
      Promise.resolve({
        ...page(),
        pageNumber: input.pageNumber,
        totalElements: 21,
        totalPages: 2,
      }),
    );
    render(
      <HistoricalSampleWorkspace
        repository={repository(list)}
        onViewRecord={vi.fn()}
      />,
    );
    await screen.findByText("历史粮食样本");
    await userEvent.click(screen.getByRole("button", { name: "下一页" }));
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(
        expect.objectContaining({ pageNumber: 1 }),
      ),
    );
    await userEvent.type(screen.getByLabelText("淘汰年份"), "2025");
    await userEvent.type(screen.getByLabelText("历史样本关键词"), "粮食");
    await userEvent.click(screen.getByRole("button", { name: "查询" }));
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(
        expect.objectContaining({ pageNumber: 0, year: 2025, keyword: "粮食" }),
      ),
    );
  });
  it("keeps an error distinct from an empty population and supports read-only retry", async () => {
    const list = vi
      .fn()
      .mockRejectedValueOnce(new Error("unavailable"))
      .mockResolvedValue(page([]));
    render(
      <HistoricalSampleWorkspace
        repository={repository(list)}
        onViewRecord={vi.fn()}
      />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "历史样本点读取失败",
    );
    expect(screen.queryByText("当前筛选条件下暂无历史样本点")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(
      await screen.findByText("当前筛选条件下暂无历史样本点"),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "下一页" })).toBeDisabled();
  });
  it("discards a previous product response arriving after the new product", async () => {
    let resolveOld!: (value: Page<HistoricalFormalSample>) => void;
    const old = new Promise<Page<HistoricalFormalSample>>((resolve) => {
      resolveOld = resolve;
    });
    const list = vi
      .fn()
      .mockReturnValueOnce(old)
      .mockResolvedValue(
        page([
          {
            ...sample,
            sampleName: "大豆历史样本",
            productCode: "SOYBEAN",
            productName: "大豆",
          },
        ]),
      );
    render(
      <HistoricalSampleWorkspace
        repository={repository(list)}
        onViewRecord={vi.fn()}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("正在读取历史样本点");
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "历史样本品种" }),
      "SOYBEAN",
    );
    await screen.findByText("大豆历史样本");
    resolveOld(page());
    await waitFor(() => expect(screen.queryByText("历史粮食样本")).toBeNull());
    expect(screen.getByText("大豆历史样本")).toBeVisible();
  });
  it("does not invent a last record for a retired sample without observations", async () => {
    render(
      <HistoricalSampleWorkspace
        repository={repository(
          vi.fn().mockResolvedValue(
            page([
              {
                ...sample,
                lastObservationId: null,
                lastObservedAt: null,
                retirementReason: null,
              },
            ]),
          ),
        )}
        onViewRecord={vi.fn()}
      />,
    );
    expect(await screen.findByText("无填报记录")).toBeVisible();
    expect(screen.queryByRole("button", { name: "查看最后记录" })).toBeNull();
  });
});
