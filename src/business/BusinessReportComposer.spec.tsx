import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  BusinessReportArtifact,
  BusinessReportContext,
  BusinessReportFormat,
} from "./businessReportModel";
import { BusinessReportComposer } from "./BusinessReportComposer";
import {
  BusinessReportWorkflow,
  createMemoryBusinessReportRepository,
  createFixtureBusinessReportWorkflow,
} from "./businessReportWorkflow";

afterEach(cleanup);

const marketContext: BusinessReportContext = {
  application: "market",
  applicationLabel: "市场监测",
  businessClassificationId: "market.quote-trade",
  businessClassificationLabel: "报价与交易",
  product: "玉米",
  cultivar: "德美亚3号",
  reportTemplate: "价格与交易监测报告",
  region: "齐齐哈尔市全域",
  regionLevel: "市级监测",
  period: "2026年第31周",
  frequency: "周报",
  dataCutoff: "2026-07-31 17:00",
  dataVersion: "MARKET-2026-W31-APPROVED",
  dataBatchLabel: "2026年第31周市场已核定数据",
  author: "王洋",
  authorPost: "区域数据管理员",
  reviewer: "赵晨",
  reviewerPost: "报告复核岗",
};

const supplyContext: BusinessReportContext = {
  ...marketContext,
  application: "supply",
  applicationLabel: "供需与态势",
  businessClassificationId: "supply.results",
  businessClassificationLabel: "结果",
  cultivar: "不按具体品种拆分",
  reportTemplate: "供需平衡分析报告",
  period: "2026/27营销年度",
  frequency: "月报",
  dataVersion: "SUPPLY-2026-MY-APPROVED",
  dataBatchLabel: "2026/27营销年度供需已核定数据",
};

describe("business report composer", () => {
  it("inherits the selected business context", () => {
    render(
      <BusinessReportComposer context={marketContext} onClose={vi.fn()} />,
    );

    expect(screen.getByRole("dialog", { name: "编制业务报告" })).toBeVisible();
    expect(screen.getByText("市场监测 · 报价与交易")).toBeVisible();
    expect(screen.getByText("玉米 · 德美亚3号")).toBeVisible();
    expect(screen.getByText("齐齐哈尔市全域")).toBeVisible();
    expect(screen.getByText("未采用核定数据")).toBeVisible();
    expect(screen.queryByText(/MARKET-2026/)).not.toBeInTheDocument();
  });

  it("shows business-readable report metadata instead of technical codes", () => {
    const technicalContext: BusinessReportContext = {
      ...marketContext,
      applicationLabel: "MARKET",
      dataCutoff: "2026-07-31T17:00:00",
      dataVersion: "METRIC-2026-W31-V3",
      dataBatchLabel: undefined,
    };
    const { container } = render(
      <BusinessReportComposer context={technicalContext} onClose={vi.fn()} />,
    );

    expect(screen.getByText("报告编号待分配")).toBeVisible();
    expect(screen.getByText("未采用核定数据")).toBeVisible();
    expect(screen.getByText("2026年7月31日 17:00")).toBeVisible();
    expect(container).not.toHaveTextContent("METRIC-2026-W31-V3");
    expect(container).not.toHaveTextContent("2026-07-31T17:00:00");
    expect(container).not.toHaveTextContent(/QQHE|MARKET|V1\.0/);
    expect(
      Array.from(container.querySelectorAll("[aria-label]"))
        .map((element) => element.getAttribute("aria-label"))
        .join(" "),
    ).not.toMatch(/QQHE|MARKET|SUPPLY|PRODUCTION|METRIC|V1\.0/);
  });

  it("keeps the approved report frequency read-only", () => {
    render(
      <BusinessReportComposer context={marketContext} onClose={vi.fn()} />,
    );

    expect(
      screen.getByRole("heading", {
        name: "齐齐哈尔市全域玉米德美亚3号市场监测周报",
      }),
    ).toBeVisible();
    expect(screen.getByText("报告周期")).toBeVisible();
    expect(screen.getByText("周报", { selector: "strong" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "日报" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "月报" }),
    ).not.toBeInTheDocument();
  });

  it("starts with the frequency explicitly selected in report parameters", () => {
    render(
      <BusinessReportComposer
        context={{ ...marketContext, frequency: "日报" }}
        onClose={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "齐齐哈尔市全域玉米德美亚3号市场监测日报",
      }),
    ).toBeVisible();
    expect(screen.getByText("日报", { selector: "strong" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "当前筛选范围尚无已核定指标",
    );
    expect(screen.queryByText("2,346 元/吨")).not.toBeInTheDocument();
  });

  it("shows the Chinese source of an exactly matched approved dataset", () => {
    render(
      <BusinessReportComposer context={supplyContext} onClose={vi.fn()} />,
    );

    expect(screen.getByText("数据来源")).toBeVisible();
    expect(screen.getByText("2026/27营销年度市级供需已核定账户")).toBeVisible();
  });

  it("shows an honest empty result for a scope without approved indicators", () => {
    const { container } = render(
      <BusinessReportComposer
        context={{
          ...marketContext,
          application: "production",
          applicationLabel: "产情监测",
          region: "黑河市全域",
          product: "大豆",
          dataVersion: "PRODUCTION-2026-W31-APPROVED",
          dataBatchLabel: "2026年第31周产情已核定数据",
        }}
        onClose={vi.fn()}
      />,
    );

    expect(
      screen.getByText("黑河市全域大豆当前筛选范围尚无已核定指标。"),
    ).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "当前筛选范围尚无已核定指标",
    );
    expect(container).not.toHaveTextContent("1,284.6 万亩");
    expect(container).not.toHaveTextContent("齐齐哈尔市玉米");
    expect(screen.getByText("无可用核定数据")).toBeVisible();
    expect(screen.getByRole("button", { name: "送审" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "导出电子表格附件" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "导出文字文档" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "导出版式文档" })).toBeDisabled();
  });

  it("persists every report coordinate and every save and submit event", async () => {
    const user = userEvent.setup();
    let sequence = 0;
    const workflow = new BusinessReportWorkflow(
      createMemoryBusinessReportRepository(),
      {
        now: () => 1_786_000_000_000 + sequence,
        createId: () => `报告-${String(++sequence)}`,
      },
    );
    render(
      <BusinessReportComposer
        context={supplyContext}
        onClose={vi.fn()}
        workflow={workflow}
      />,
    );

    await user.click(screen.getByRole("button", { name: "保存草稿" }));
    expect(screen.getByText("草稿已保存")).toBeVisible();
    expect(workflow.getSnapshot()).toHaveLength(1);
    expect(workflow.getSnapshot()[0]).toMatchObject({
      scope: {
        application: "supply",
        businessClassificationId: "supply.results",
        businessClassificationLabel: "结果",
        region: "齐齐哈尔市全域",
        product: "玉米",
        cultivar: "不按具体品种拆分",
        reportTemplate: "供需平衡分析报告",
        period: "2026/27营销年度",
        frequency: "月报",
        dataCutoff: "2026-07-31 17:00",
        dataBatchId: "SUPPLY-2026-MY-APPROVED",
      },
      status: "草稿",
    });

    await user.click(screen.getByRole("button", { name: "送审" }));
    expect(screen.getByText("待复核")).toBeVisible();
    expect(workflow.getSnapshot()[0].currentHandlerPost).toBe("报告复核岗");
    expect(
      workflow.getSnapshot()[0].auditTrail.map(({ action }) => action),
    ).toEqual(["创建草稿", "提交复核"]);
  });

  it("keeps people visible while using posts for handler and audit responsibility", async () => {
    const user = userEvent.setup();
    const workflow = new BusinessReportWorkflow(
      createMemoryBusinessReportRepository(),
      {
        now: () => 1_786_000_000_000,
        createId: () => "报告-身份一致性",
      },
    );
    render(
      <BusinessReportComposer
        actorPost="区域数据管理员"
        context={supplyContext}
        onClose={vi.fn()}
        workflow={workflow}
      />,
    );

    expect(screen.getByText(/编制：王洋 · 审核：赵晨/)).toBeVisible();
    expect(screen.queryByText(/编制：区域数据管理员/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "保存草稿" }));

    const report = workflow.getSnapshot()[0];
    expect(report).toMatchObject({
      authorPost: "区域数据管理员",
      reviewerPost: "报告复核岗",
      currentHandlerPost: "区域数据管理员",
    });
    expect(report.auditTrail[0]).toMatchObject({
      action: "创建草稿",
      actorPost: "区域数据管理员",
    });
  });

  it("does not let a login without report permissions save submit or export", () => {
    const workflow = new BusinessReportWorkflow(
      createMemoryBusinessReportRepository(),
    );
    render(
      <BusinessReportComposer
        actorPost="区域数据管理员"
        context={supplyContext}
        onClose={vi.fn()}
        permissionKeys={[]}
        workflow={workflow}
      />,
    );

    expect(screen.getByRole("button", { name: "保存草稿" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "送审" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "导出电子表格附件" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "导出文字文档" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "导出版式文档" })).toBeDisabled();
    expect(workflow.getSnapshot()).toHaveLength(0);
  });

  it("blocks report mutation and export when persisted workflow records need recovery", () => {
    const storedValue = "{损坏的报告工作流";
    const values = new Map<string, string>([
      ["齐齐哈尔粮食商情业务报告工作流-业务真值三", storedValue],
    ]);
    const workflow = createFixtureBusinessReportWorkflow({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    });

    render(
      <BusinessReportComposer
        actorPost="区域数据管理员"
        context={supplyContext}
        onClose={vi.fn()}
        workflow={workflow}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("报告记录暂时无法读取");
    expect(screen.getByRole("alert")).toHaveTextContent("原始内容已保留");
    expect(screen.getByRole("button", { name: "保存草稿" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "送审" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "导出电子表格附件" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "导出文字文档" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "导出版式文档" })).toBeDisabled();
    expect(values.get("齐齐哈尔粮食商情业务报告工作流-业务真值三")).toBe(
      storedValue,
    );
  });

  it("exports only a saved unchanged draft and marks it as an internal working document", async () => {
    const user = userEvent.setup();
    const workflow = new BusinessReportWorkflow(
      createMemoryBusinessReportRepository(),
      {
        now: () => 1_786_000_000_000,
        createId: () => "报告-工作稿导出",
      },
    );
    const onExport =
      vi.fn<
        (format: BusinessReportFormat, artifact: BusinessReportArtifact) => void
      >();
    render(
      <BusinessReportComposer
        actorPost="区域数据管理员"
        context={supplyContext}
        onClose={vi.fn()}
        onExport={onExport}
        workflow={workflow}
      />,
    );

    const exportWord = screen.getByRole("button", { name: "导出文字文档" });
    expect(exportWord).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "保存草稿" }));
    expect(exportWord).toBeEnabled();
    await user.click(exportWord);

    expect(onExport).toHaveBeenCalledOnce();
    expect(onExport.mock.calls[0][1]).toMatchObject({
      documentStatus: "内部工作稿",
    });
    expect(onExport.mock.calls[0][1].filename).toContain("内部工作稿");
    expect(onExport.mock.calls[0][1].filename).not.toContain("正式报告");
    expect(onExport.mock.calls[0][1].content).toContain(
      "未经复核发布，不得作为正式报告使用",
    );

    await user.type(screen.getByRole("textbox", { name: "本期摘要" }), "补充");
    expect(exportWord).toBeDisabled();
  });

  it("offers PDF Word and Excel output", async () => {
    const user = userEvent.setup();
    const onExport =
      vi.fn<
        (format: BusinessReportFormat, artifact: BusinessReportArtifact) => void
      >();
    render(
      <BusinessReportComposer
        context={supplyContext}
        onClose={vi.fn()}
        onExport={onExport}
      />,
    );

    await user.click(screen.getByRole("button", { name: "导出文字文档" }));

    expect(screen.getByRole("button", { name: "导出版式文档" })).toBeVisible();
    expect(screen.getByRole("button", { name: "导出文字文档" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "导出电子表格附件" }),
    ).toBeVisible();
    expect(onExport).toHaveBeenCalledOnce();
    expect(onExport.mock.calls[0][0]).toBe("Word");
    expect(onExport.mock.calls[0][1].action).toBe("download");
    expect(onExport.mock.calls[0][1].filename).toMatch(/\.doc$/);
    expect(onExport.mock.calls[0][1].filename).not.toMatch(/版本|第1版/);
  });

  it("closes without changing business context", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <BusinessReportComposer context={marketContext} onClose={onClose} />,
    );

    await user.click(screen.getByRole("button", { name: "关闭报告编制" }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
