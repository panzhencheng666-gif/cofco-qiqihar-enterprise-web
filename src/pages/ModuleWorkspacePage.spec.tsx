import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { ModuleWorkspacePage } from "./ModuleWorkspacePage";
import { renderWithApp } from "@/testing/renderWithApp";

afterEach(cleanup);

describe("ModuleWorkspacePage", () => {
  it.each([
    ["/production/planting", "种植生产运营工作区"],
    ["/market/trading", "行情与交易工作区"],
    ["/supply/balance", "供需账户勾稽"],
    ["/reports/duty", "报表中心 · 履责报告"],
  ])("renders a non-empty governed workspace for %s", (path, title) => {
    renderWithApp(<ModuleWorkspacePage />, { initialEntries: [path] });

    expect(
      screen.getByRole("heading", { name: title, level: 1 }),
    ).toBeVisible();
    expect(
      screen.getByRole("region", {
        name: /工作清单|样本与调查任务|主体与业务任务|供需账户明细/,
      }),
    ).toBeVisible();
    if (path !== "/supply/balance") {
      expect(
        screen.getByRole("button", { name: "导出当前清单" }),
      ).toBeVisible();
    }
  });

  it("filters the current business workspace without changing source facts", async () => {
    const user = userEvent.setup();
    renderWithApp(<ModuleWorkspacePage />, {
      initialEntries: ["/market/trading"],
    });

    await user.type(
      screen.getByRole("searchbox", { name: "搜索当前工作区" }),
      "玉米加工厂",
    );

    expect(screen.getAllByText("齐齐哈尔北方玉米加工厂")).not.toHaveLength(0);
    expect(
      screen.queryByText("龙江丰禾粮贸第一经营场所"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("当前显示 2 项，共 6 项")).toBeVisible();
  });

  it("opens an object panorama from the explicit row action", async () => {
    const user = userEvent.setup();
    renderWithApp(<ModuleWorkspacePage />, {
      initialEntries: ["/production/planting"],
    });

    await user.click(
      screen.getByRole("button", {
        name: "查看 同义镇富强村级样本点",
      }),
    );

    expect(screen.getByRole("dialog", { name: "对象全景摘要" })).toBeVisible();
    expect(screen.getAllByText("同义镇富强村级样本点").length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText("当前业务信息")).toBeVisible();
    expect(screen.queryByText("能力")).not.toBeInTheDocument();
  });

  it("keeps one farmer together while showing each related business fact separately", async () => {
    const user = userEvent.setup();
    renderWithApp(<ModuleWorkspacePage />, {
      initialEntries: ["/production/stock"],
    });

    await user.click(
      screen.getByRole("button", {
        name: "查看 龙江县农户样本 017",
      }),
    );

    const panorama = screen.getByRole("dialog", { name: "对象全景摘要" });
    expect(panorama).toHaveTextContent("关联业务");
    expect(panorama).toHaveTextContent("种植生产");
    expect(panorama).toHaveTextContent("农户余粮");
    expect(panorama).toHaveTextContent("农户销售");
    expect(panorama).toHaveTextContent("种植意愿");
  });

  it("uses real in-page navigation and exposes the business control metadata", () => {
    renderWithApp(<ModuleWorkspacePage />, {
      initialEntries: ["/production/planting"],
    });

    const workspaceNavigation = screen.getByRole("navigation", {
      name: "业务工作区导航",
    });
    expect(
      screen.getByRole("link", { name: "样本与调查任务" }),
    ).toHaveAttribute("href", "#section-worklist");
    expect(screen.getByRole("link", { name: "质量与异常" })).toHaveAttribute(
      "href",
      "#section-quality",
    );
    expect(workspaceNavigation).toBeVisible();
    expect(
      screen.getByRole("region", { name: "产情业务控制信息" }),
    ).toHaveTextContent("责任岗位");
    expect(
      screen.getByRole("region", { name: "产情业务控制信息" }),
    ).toHaveTextContent("数据资格");
  });
});
