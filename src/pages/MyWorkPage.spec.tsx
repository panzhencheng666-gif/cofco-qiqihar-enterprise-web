import { cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MyWorkPage } from "./MyWorkPage";
import { renderWithApp } from "@/testing/renderWithApp";

afterEach(cleanup);

describe("MyWorkPage", () => {
  it("presents one unified personal work surface with actionable business facts", async () => {
    renderWithApp(<MyWorkPage />);

    expect(
      screen.getByRole("heading", { name: "我的工作", level: 1 }),
    ).toBeVisible();
    expect(screen.getByText("正在加载本人工作")).toBeVisible();

    await waitFor(() => {
      expect(screen.getByText("玉米市场日报区域复核")).toBeVisible();
    });

    expect(screen.getByText("大豆农户样本质量修正")).toBeVisible();
    expect(screen.getByText("大豆农户余粮月度调查")).toBeVisible();
    expect(screen.getByText("待处理工作")).toBeVisible();
    expect(screen.getByText("质量阻断")).toBeVisible();
    expect(screen.getByText("已经逾期")).toBeVisible();
    expect(screen.getAllByText("报送义务")).not.toHaveLength(0);
    expect(screen.getAllByText("时效结果")).not.toHaveLength(0);
    expect(screen.getAllByText("单据流程")).not.toHaveLength(0);
    expect(screen.getAllByText("数据质量")).not.toHaveLength(0);
  });

  it("uses the contextual navigation query to project one queue without duplicating work", async () => {
    renderWithApp(<MyWorkPage />, {
      initialEntries: ["/?view=review"],
    });

    await waitFor(() => {
      expect(screen.getByText("玉米市场日报区域复核")).toBeVisible();
    });

    expect(screen.queryByText("大豆农户样本质量修正")).not.toBeInTheDocument();
    expect(screen.queryByText("水稻农户余粮月度调查")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "待我审核", level: 2 }),
    ).toBeVisible();
  });

  it("uses a plain-language message when work cannot be loaded", async () => {
    renderWithApp(<MyWorkPage />, {
      gatewayOverrides: {
        listMyWork: () => Promise.reject(new Error("unavailable")),
      },
    });

    await waitFor(() => {
      expect(screen.getByText("暂时无法加载，请稍后重试")).toBeVisible();
    });
    expect(screen.queryByText("服务暂时不可用")).not.toBeInTheDocument();
  });
});
