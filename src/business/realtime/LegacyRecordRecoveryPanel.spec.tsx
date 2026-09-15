import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { RealtimeBusinessRepository } from "@/platform/api/realtimeBusinessRepository";
import { LegacyRecordRecoveryPanel } from "./LegacyRecordRecoveryPanel";
afterEach(cleanup);
it.each(["market", "production", "logistics"] as const)(
  "opens original %s record without exposing its ID",
  async (domain) => {
    const list = vi
      .fn()
      .mockResolvedValue({
        items: [
          {
            id: "private-old-id",
            values: {
              MKT_SAMPLE_NAME: "旧样本",
              PROD_SAMPLE_NAME: "旧样本",
              LOG_SAMPLE_NAME: "旧样本",
            },
            allowedActions: ["SAVE"],
            version: 1,
          },
        ],
        totalPages: 1,
      });
    const repository = {
      listMarket: list,
      listProduction: list,
      listLogistics: list,
    } as unknown as RealtimeBusinessRepository;
    const onOpen = vi.fn();
    render(
      <LegacyRecordRecoveryPanel
        domain={domain}
        productCode="CORN"
        repository={repository}
        refreshToken={0}
        onOpen={onOpen}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "旧填报待校验" }));
    fireEvent.click(await screen.findByRole("button", { name: "查看并修正" }));
    expect(onOpen).toHaveBeenCalledWith("CORN", "private-old-id");
    expect(screen.queryByText("private-old-id")).toBeNull();
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        recovery: true,
        filters: { status: "PENDING_REVIEW" },
      }),
    );
  },
);
it("reports read failure and does not offer a fabricated record", async () => {
  const repository = {
    listMarket: vi.fn().mockRejectedValue(new Error("403")),
  } as unknown as RealtimeBusinessRepository;
  render(
    <LegacyRecordRecoveryPanel
      domain="market"
      productCode="CORN"
      repository={repository}
      refreshToken={0}
      onOpen={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "旧填报待校验" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("读取失败");
  expect(screen.queryByRole("button", { name: "查看并修正" })).toBeNull();
});
