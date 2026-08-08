import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { OperationalScope } from "../core/operationalScope";
import { prototypeOperationalIdentity } from "../formalEnterpriseData";
import { LogisticsMonitoringWorkspace } from "./LogisticsMonitoringWorkspace";

afterEach(cleanup);

const authorizedScope: OperationalScope = {
  ...prototypeOperationalIdentity,
  coordinates: { regionId: "authorized-all" },
  authorization: {
    ...prototypeOperationalIdentity.authorization,
    authorizedBusinessClassificationIds: ["market.logistics"],
    authorizedProductIds: ["corn", "soybean", "paddy"],
    authorizedCultivarIds: [],
  },
  savedView: null,
};

describe("logistics monitoring workspace", () => {
  it("uses a dedicated node ledger instead of mixing logistics into market subjects", () => {
    render(
      <LogisticsMonitoringWorkspace
        onScopeChange={vi.fn()}
        onSelectionChange={vi.fn()}
        queryAllowed
        scope={authorizedScope}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "粮食物流节点监测表" }),
    ).toBeVisible();
    expect(
      within(screen.getByRole("combobox", { name: "节点类型" })).getByRole(
        "option",
        { name: "铁路站点" },
      ),
    ).toBeVisible();
    const table = screen.getByRole("table", {
      name: "粮食物流节点监测表",
    });
    expect(
      within(table).getByRole("columnheader", { name: "流入量" }),
    ).toBeVisible();
    expect(
      within(table).getByRole("columnheader", { name: "流出量" }),
    ).toBeVisible();
    expect(table).toHaveTextContent("齐齐哈尔铁路货运站");
    expect(table).toHaveTextContent("待审核");
    expect(table).toHaveTextContent("质量警告");
  });
});
