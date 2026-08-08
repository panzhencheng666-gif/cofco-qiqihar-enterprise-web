import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EnterpriseTable, type EnterpriseColumn } from "./EnterpriseTable";

interface Row {
  id: string;
  name: string;
}

describe("EnterpriseTable", () => {
  it("renders typed rows through the internal adapter", () => {
    const columns: EnterpriseColumn<Row>[] = [
      { title: "样本名称", dataIndex: "name" },
    ];
    render(
      <EnterpriseTable<Row>
        ariaLabel="样本任务表"
        columns={columns}
        rows={[{ id: "one", name: "讷河农户样本 017" }]}
      />,
    );

    expect(screen.getByRole("region", { name: "样本任务表" })).toBeVisible();
    expect(screen.getByText("讷河农户样本 017")).toBeVisible();
  });

  it("keeps the semantic operation column available while wide tables scroll", () => {
    const columns: EnterpriseColumn<Row>[] = [
      { title: "样本名称", dataIndex: "name", width: 240 },
      {
        title: "操作",
        pinned: "right",
        width: 96,
        render: () => "查看",
      },
    ];

    render(
      <EnterpriseTable<Row>
        ariaLabel="宽表操作测试"
        columns={columns}
        rows={[{ id: "one", name: "讷河农户样本 017" }]}
      />,
    );

    expect(screen.getByRole("columnheader", { name: "操作" })).toHaveClass(
      "ant-table-cell-fix-right",
    );
  });
});
