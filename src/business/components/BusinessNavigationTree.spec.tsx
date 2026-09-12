import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { formalApplicationDefinitions } from "../formalEnterpriseData";
import { createFormalRoute } from "../formalEnterpriseModel";
import { BusinessNavigationTree } from "./BusinessNavigationTree";

describe("BusinessNavigationTree", () => {
  it("renders the current application as one stable keyboard-operable business tree", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const application = formalApplicationDefinitions.find(
      ({ key }) => key === "production",
    );
    if (!application) throw new Error("missing production application");

    render(
      <BusinessNavigationTree
        application={application}
        currentRoute={createFormalRoute("production", "corn-collection")}
        onNavigate={onNavigate}
      />,
    );

    const navigation = screen.getByRole("navigation", {
      name: "产情监测模块",
    });
    expect(
      within(navigation).getByRole("button", { name: "玉米产情监测" }),
    ).toHaveAttribute("aria-current", "page");
    expect(navigation).toHaveTextContent("大豆产情监测");
    expect(navigation).toHaveTextContent("稻谷产情监测");
    expect(navigation).toHaveTextContent("地区产情信息");

    within(navigation).getByRole("button", { name: "玉米产情监测" }).focus();
    await user.keyboard("{Enter}");
    expect(onNavigate).toHaveBeenCalledWith(
      createFormalRoute("production", "corn-collection"),
    );

    await user.click(
      within(navigation).getByRole("button", { name: "大豆产情监测" }),
    );
    expect(onNavigate).toHaveBeenLastCalledWith(
      createFormalRoute("production", "soybean-collection"),
    );
  });

  it("keeps only design-sample maintenance under My Work", () => {
    const onNavigate = vi.fn();
    const application = formalApplicationDefinitions.find(
      ({ key }) => key === "work",
    );
    if (!application) throw new Error("missing work application");

    render(
      <BusinessNavigationTree
        application={application}
        currentRoute={createFormalRoute("work", "sample-governance")}
        onNavigate={onNavigate}
      />,
    );

    const navigation = screen.getByRole("navigation", {
      name: "我的工作模块",
    });
    expect(
      within(navigation).getByRole("button", { name: "样本点管理" }),
    ).toHaveAttribute("aria-current", "page");
    expect(navigation).not.toHaveTextContent("人工审核");
    expect(navigation).not.toHaveTextContent("待我处理");
    expect(navigation).not.toHaveTextContent("已办事项");
    expect(navigation).not.toHaveTextContent("导入任务");
  });

  it("does not expose retired task, review, or report-center entries", () => {
    const application = formalApplicationDefinitions.find(
      ({ key }) => key === "production",
    );
    if (!application) throw new Error("missing production application");
    render(
      <BusinessNavigationTree
        application={application}
        currentRoute={createFormalRoute("production", "corn-collection")}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "产情任务" })).toBeNull();
    expect(screen.queryByRole("button", { name: "采集任务" })).toBeNull();
    expect(screen.queryByRole("button", { name: "数据审核" })).toBeNull();
    expect(screen.queryByText("报表中心")).toBeNull();
  });
});

it("groups all browse modules and tasks under two independently collapsible sibling headings", async () => {
  const onNavigate = vi.fn();
  const { container } = render(
    <BusinessNavigationTree
      application={formalApplicationDefinitions[0]}
      currentRoute={createFormalRoute("work", "task-market")}
      onNavigate={onNavigate}
      administrator
    />,
  );
  const sections = container.querySelectorAll("nav > details");
  expect(sections).toHaveLength(2);
  expect(sections[0].querySelector("summary")?.textContent).toBe("总揽信息");
  expect(sections[1].querySelector("summary")?.textContent).toBe("我的任务");
  expect(sections[0]).toHaveTextContent("产情监测");
  expect(sections[0]).toHaveTextContent("供需分析");
  expect(sections[0]).not.toHaveTextContent("我的工作");
  expect(sections[1]).toHaveTextContent("设计样本点维护");
  await userEvent.click(
    within(sections[1] as HTMLElement).getByRole("button", { name: "市场" }),
  );
  expect(onNavigate).toHaveBeenCalledWith(
    createFormalRoute("work", "task-market"),
  );
  await userEvent.click(sections[0].querySelector("summary")!);
  expect(sections[0]).not.toHaveAttribute("open");
  expect(sections[1]).toHaveAttribute("open");
});

it("keeps historical sample browsing inside 总揽信息", async () => {
  const onNavigate = vi.fn();
  const { container } = render(
    <BusinessNavigationTree
      application={formalApplicationDefinitions[0]}
      currentRoute={createFormalRoute("work", "sample-history")}
      onNavigate={onNavigate}
    />,
  );
  const sections = container.querySelectorAll("nav > details");
  const history = within(sections[0] as HTMLElement).getByRole("button", {
    name: "历史样本点",
  });
  expect(history).toHaveAttribute("aria-current", "page");
  expect(
    within(sections[1] as HTMLElement).queryByRole("button", {
      name: "历史样本点",
    }),
  ).toBeNull();
  await userEvent.click(history);
  expect(onNavigate).toHaveBeenCalledWith(
    createFormalRoute("work", "sample-history"),
  );
});
