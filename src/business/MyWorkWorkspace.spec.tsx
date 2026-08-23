import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fixtureOperationalIdentity } from "./formalEnterpriseData";
import { MyWorkWorkspace } from "./MyWorkWorkspace";

afterEach(cleanup);

describe("my work sample point governance entry", () => {
  it("renders sample governance as an independent route and never inside the work ledger", () => {
    render(
      <MyWorkWorkspace
        samplePointGovernance={<div>企业级样本点管理工作区</div>}
        onOpenBusiness={vi.fn()}
        onScopeChange={vi.fn()}
        scope={{
          ...fixtureOperationalIdentity,
          coordinates: { regionId: "authorized-all" },
          savedView: null,
        }}
        section="sample-governance"
        workItems={[]}
      />,
    );

    expect(screen.getByText("企业级样本点管理工作区")).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "本人工作台账区域" }),
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
