import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { businessWorkFixtures } from "./data/businessWorkFixtures";
import { fixtureOperationalIdentity } from "./formalEnterpriseData";
import { MyWorkWorkspace } from "./MyWorkWorkspace";

afterEach(cleanup);

describe("my work sample point governance entry", () => {
  it("presents the work queue as one action-led enterprise ledger", () => {
    render(
      <MyWorkWorkspace
        onOpenBusiness={vi.fn()}
        onScopeChange={vi.fn()}
        scope={{
          ...fixtureOperationalIdentity,
          coordinates: { regionId: "authorized-all" },
          savedView: null,
        }}
        section="tasks"
      />,
    );

    const ledger = screen.getByRole("table", { name: "本人工作台账" });
    for (const heading of [
      "事项",
      "业务范围",
      "期间与截止",
      "责任人",
      "当前状态",
      "处理",
    ]) {
      expect(screen.getByRole("columnheader", { name: heading })).toBeVisible();
    }
    expect(ledger.querySelectorAll("thead th")).toHaveLength(6);
    expect(
      screen.queryByRole("complementary", { name: "当前事项详情" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: "搜索事项名称或单据编号" }),
    ).toBeVisible();
    expect(screen.getByRole("combobox", { name: "待处理状态" })).toBeVisible();
    expect(screen.getByRole("status", { name: "待我处理概况" })).toBeVisible();
    expect(screen.getByRole("button", { name: "查询" })).toBeVisible();
    expect(screen.getByRole("button", { name: "重置" })).toBeVisible();
  });

  it("uses completed-work language instead of pending-work instructions", () => {
    render(
      <MyWorkWorkspace
        onOpenBusiness={vi.fn()}
        onScopeChange={vi.fn()}
        scope={{
          ...fixtureOperationalIdentity,
          coordinates: { regionId: "authorized-all" },
          savedView: null,
        }}
        section="completed"
        workItems={[
          {
            ...businessWorkFixtures[0],
            obligationStatus: "on-time",
            documentStatus: "submitted",
            reviewStatus: "approved",
            qualityStatus: "passed",
            releaseStatus: "published",
          },
        ]}
      />,
    );

    expect(
      screen.getByText(
        "查询本人已完成事项，核对办理结果，并可返回原业务单据。",
      ),
    ).toBeVisible();
    expect(
      screen.getByText("按完成时间查看办理结果；点击“查看”返回原业务单据。"),
    ).toBeVisible();
    expect(
      screen.queryByText(
        "先处理退回和质量阻断，再处理临近截止事项；点击“处理”直接进入原业务单据。",
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("complementary", { name: "已办事项详情" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("status", { name: "已办事项概况" })).toBeVisible();
    expect(
      screen.getAllByRole("button", { name: "查看原业务单据" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", { name: /继续.*填报/u }),
    ).not.toBeInTheDocument();
  });

  it("renders import tasks as an independent My Work route instead of another ledger panel", () => {
    render(
      <MyWorkWorkspace
        importTasks={<div>真实导入任务工作区</div>}
        onOpenBusiness={vi.fn()}
        onScopeChange={vi.fn()}
        scope={{
          ...fixtureOperationalIdentity,
          coordinates: { regionId: "authorized-all" },
          savedView: null,
        }}
        section="imports"
        workItems={[]}
      />,
    );

    expect(screen.getByText("真实导入任务工作区")).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "本人工作台账区域" }),
    ).not.toBeInTheDocument();
  });
});
