import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CompactBusinessQuery } from "./CompactBusinessQuery";
import { EnterpriseWorkTable } from "./EnterpriseWorkTable";

type Row = {
  id: string;
  objectName: string;
  price: string;
  moisture: string;
  state: string;
};

describe("EnterpriseWorkTable", () => {
  it("renders grouped headers, row identity and editable business cells", () => {
    const { container } = render(
      <EnterpriseWorkTable<Row>
        ariaLabel="玉米市场采集表"
        columns={[
          { key: "objectName", title: "采集对象", frozen: true },
          {
            key: "price",
            title: "采购价",
            group: "采购与质量",
            editable: true,
            align: "right",
          },
          {
            key: "moisture",
            title: "水分",
            group: "采购与质量",
            editable: true,
            align: "right",
          },
          { key: "state", title: "状态" },
        ]}
        emptyText="当前范围内暂无采集记录"
        getRowId={(row) => row.id}
        rows={[
          {
            id: "1",
            objectName: "龙江北方粮贸有限公司",
            price: "2,410 元/吨",
            moisture: "14.2%",
            state: "待审核",
          },
        ]}
      />,
    );

    const table = screen.getByRole("table", { name: "玉米市场采集表" });
    expect(
      within(table).getByRole("columnheader", { name: "采购与质量" }),
    ).toHaveAttribute("colspan", "2");
    expect(
      within(table).getByRole("rowheader", {
        name: "龙江北方粮贸有限公司",
      }),
    ).toHaveClass("is-frozen");
    expect(
      within(table).getByRole("cell", { name: "2,410 元/吨" }),
    ).toHaveAttribute("data-editable", "true");
    expect(
      container.querySelector(".enterprise-work-table__scroll"),
    ).toBeVisible();
  });

  it("keeps query actions singular and hides secondary conditions until requested", async () => {
    const user = userEvent.setup();
    const onQuery = vi.fn();
    render(
      <CompactBusinessQuery
        actions={
          <button type="button" onClick={onQuery}>
            查询
          </button>
        }
        ariaLabel="玉米产情查询"
        moreFields={[
          <label key="cultivar">
            <span>具体品种</span>
            <select aria-label="具体品种" />
          </label>,
        ]}
        primaryFields={[
          <label key="period">
            <span>调查期</span>
            <select aria-label="调查期" />
          </label>,
          <label key="state">
            <span>任务状态</span>
            <select aria-label="任务状态" />
          </label>,
        ]}
      />,
    );

    const query = screen.getByRole("search", { name: "玉米产情查询" });
    expect(within(query).queryByLabelText("具体品种")).not.toBeInTheDocument();
    expect(within(query).getAllByRole("button", { name: "查询" })).toHaveLength(
      1,
    );
    await user.click(within(query).getByRole("button", { name: "更多条件" }));
    expect(within(query).getByLabelText("具体品种")).toBeVisible();
    await user.click(within(query).getByRole("button", { name: "查询" }));
    expect(onQuery).toHaveBeenCalledTimes(1);
  });
});
