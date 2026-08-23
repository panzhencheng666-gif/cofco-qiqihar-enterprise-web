import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fixtureOperationalIdentity } from "./formalEnterpriseData";
import { MyWorkWorkspace } from "./MyWorkWorkspace";

afterEach(cleanup);

describe("my work sample point governance entry", () => {
  it("loads the governed sample-point workspace only after expansion without replacing the work ledger", async () => {
    const user = userEvent.setup();
    render(
      <MyWorkWorkspace
        coordinateGovernance={<div>真实坐标治理工作台</div>}
        onOpenBusiness={vi.fn()}
        onScopeChange={vi.fn()}
        scope={{
          ...fixtureOperationalIdentity,
          coordinates: { regionId: "authorized-all" },
          savedView: null,
        }}
        section="tasks"
        workItems={[]}
      />,
    );

    expect(screen.getByText("样本点治理")).toBeVisible();
    expect(
      screen.getByText("坐标修正、身份核验、历史归并与独立审核"),
    ).toBeVisible();
    expect(screen.queryByText("真实坐标治理工作台")).not.toBeInTheDocument();
    await user.click(screen.getByText("样本点治理"));
    expect(screen.getByText("真实坐标治理工作台")).toBeVisible();
    expect(
      screen.getByRole("region", { name: "本人工作台账区域" }),
    ).toBeVisible();
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
