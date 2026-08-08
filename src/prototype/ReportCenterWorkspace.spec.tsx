import { useState, type ReactNode } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EnterpriseRegionProvider } from "./EnterpriseRegionContext";
import {
  FormalReportCenterWorkspace,
  ReportCenterWorkspace,
} from "./ReportCenterWorkspace";
import type { OperationalScope } from "./core/operationalScope";
import type { EnterpriseRegionId } from "./enterpriseRegions";
import { prototypeOperationalIdentity } from "./formalEnterpriseData";
import { createPrototypeBusinessReportWorkflow } from "./businessReportWorkflow";
import type {
  BusinessReportArtifact,
  QuickReportExportKind,
} from "./businessReportModel";

type QuickExportHandler = (
  kind: QuickReportExportKind,
  artifact: BusinessReportArtifact,
) => void;

async function selectReportCity(
  user: ReturnType<typeof userEvent.setup>,
  cityName: string,
) {
  const context = screen.getByRole("region", {
    name: "业务报告生成条件",
  });
  await user.click(within(context).getByLabelText("选择地区"));
  await user.click(
    within(screen.getByLabelText("地市选项")).getByRole("button", {
      name: cityName,
    }),
  );
  await user.click(screen.getByRole("button", { name: "完成" }));
}

async function openReportMoreConditions(
  user: ReturnType<typeof userEvent.setup>,
) {
  const context = screen.getByRole("region", {
    name: "业务报告生成条件",
  });
  const more = within(context).getByRole("button", { name: "更多条件" });
  if (more.getAttribute("aria-expanded") === "false") {
    await user.click(more);
  }
}

afterEach(cleanup);

describe("ReportCenterWorkspace", () => {
  function RegionHarness({ children }: { children: ReactNode }) {
    const [regionId, setRegionId] = useState<EnterpriseRegionId>("qiqihar-all");
    return (
      <EnterpriseRegionProvider
        regionId={regionId}
        onRegionChange={setRegionId}
      >
        {children}
      </EnterpriseRegionProvider>
    );
  }

  it("requires nine explicit, linked business report parameters", async () => {
    const user = userEvent.setup();
    const onComposeReport = vi.fn();
    const onQuickExport = vi.fn<QuickExportHandler>();
    const { container } = render(
      <RegionHarness>
        <ReportCenterWorkspace
          section="compose"
          onComposeReport={onComposeReport}
          onQuickExport={onQuickExport}
        />
      </RegionHarness>,
    );

    const context = screen.getByRole("region", {
      name: "业务报告生成条件",
    });
    const query = within(context).getByRole("search", {
      name: "业务报告查询条件",
    });
    expect(within(query).getAllByRole("combobox")).toHaveLength(5);
    expect(within(query).getByLabelText("选择地区")).toBeVisible();
    expect(
      within(query).queryByRole("combobox", { name: "业务分类" }),
    ).not.toBeInTheDocument();
    await openReportMoreConditions(user);
    expect(
      within(context).getByRole("combobox", { name: "业务类型" }),
    ).toHaveValue("");
    expect(within(context).getByLabelText("选择地区")).toHaveTextContent(
      "请选择地区",
    );
    expect(
      within(context).getByRole("combobox", { name: "报告期间" }),
    ).toHaveValue("");
    expect(
      within(context).getByRole("combobox", { name: "报告频率" }),
    ).toHaveValue("");
    expect(
      within(context).getByRole("combobox", { name: "产品或专题" }),
    ).toHaveValue("");
    expect(
      within(context).getByRole("combobox", { name: "采用数据" }),
    ).toHaveValue("");
    expect(
      within(context).getByRole("combobox", { name: "业务分类" }),
    ).toHaveValue("");
    expect(
      within(context).getByRole("combobox", { name: "具体品种" }),
    ).toHaveValue("");
    expect(
      within(context).getByRole("combobox", { name: "报告模板" }),
    ).toHaveValue("");
    expect(screen.getByRole("button", { name: "生成报告" })).toBeDisabled();
    expect(screen.getByLabelText("数据截止")).toBeVisible();
    expect(screen.getByRole("group", { name: "报告章节" })).toBeVisible();
    for (const name of [
      "导出业务日报",
      "导出业务周报",
      "导出业务月报",
      "导出填报记录周报",
      "导出填报记录月报",
    ]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
    expect(document.body).not.toHaveTextContent("版本");

    await user.selectOptions(
      within(context).getByRole("combobox", { name: "业务类型" }),
      "production",
    );
    expect(
      within(context).getByRole("option", { name: "种植生产" }),
    ).toBeEnabled();
    expect(
      within(context).getByRole("option", {
        name: "成本与政策支持（暂无已核定数据）",
      }),
    ).toBeDisabled();
    expect(within(context).getByRole("option", { name: "玉米" })).toBeEnabled();

    await user.selectOptions(
      within(context).getByRole("combobox", { name: "业务类型" }),
      "supply",
    );
    await user.selectOptions(
      within(context).getByRole("combobox", { name: "业务分类" }),
      "supply.results",
    );
    await selectReportCity(user, "齐齐哈尔市");
    await user.selectOptions(
      within(context).getByRole("combobox", { name: "产品或专题" }),
      "corn",
    );
    await user.selectOptions(
      within(context).getByRole("combobox", { name: "具体品种" }),
      "not-applicable",
    );
    await user.selectOptions(
      within(context).getByRole("combobox", { name: "报告频率" }),
      "月报",
    );
    await user.selectOptions(
      within(context).getByRole("combobox", { name: "报告期间" }),
      "2026/27营销年度",
    );
    await user.selectOptions(
      within(context).getByRole("combobox", { name: "报告模板" }),
      "供需平衡分析报告",
    );
    const batchSelect = within(context).getByRole("combobox", {
      name: "采用数据",
    });
    expect(
      within(batchSelect).getByRole("option", {
        name: "2026/27营销年度供需已核定数据",
      }),
    ).toBeInTheDocument();
    await user.selectOptions(batchSelect, "SUPPLY-2026-MY-APPROVED");
    expect(screen.getByRole("button", { name: "生成报告" })).toBeEnabled();
    expect(screen.getByLabelText("数据截止")).toHaveTextContent(
      "2026年7月31日 17:00",
    );
    expect(screen.getByRole("button", { name: "导出业务月报" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "导出业务日报" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "导出业务周报" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "导出业务月报" }));
    const [quickExportKind, quickExportArtifact] = onQuickExport.mock.calls[0];
    expect(quickExportKind).toBe("business-monthly");
    expect(quickExportArtifact.filename).toContain("月报");
    expect(
      `${quickExportArtifact.filename}${quickExportArtifact.content}`,
    ).not.toMatch(/SUPPLY-|METRIC-|VERSION-/);
    await user.click(screen.getByRole("button", { name: "生成报告" }));
    expect(onComposeReport).toHaveBeenCalledWith(
      expect.objectContaining({
        application: "supply",
        businessClassificationId: "supply.results",
        businessClassificationLabel: "结果",
        product: "玉米",
        cultivar: "不按具体品种拆分",
        reportTemplate: "供需平衡分析报告",
        region: "齐齐哈尔市全域",
        period: "2026/27营销年度",
        frequency: "月报",
        dataVersion: "SUPPLY-2026-MY-APPROVED",
        dataBatchLabel: "2026/27营销年度供需已核定数据",
        author: "当前登录人员",
        authorPost: "区域数据管理员",
        reviewer: "复核人员待指派",
        reviewerPost: "报告复核岗",
      }),
    );

    await selectReportCity(user, "黑河市");
    expect(
      within(context).getByRole("combobox", { name: "采用数据" }),
    ).toHaveValue("");
    expect(screen.getByRole("button", { name: "生成报告" })).toBeDisabled();
    expect(screen.getByRole("table", { name: "待继续编制报告" })).toBeVisible();
    expect(container.querySelector(".unified-metric-strip")).toBeNull();
    expect(container.querySelector(".workspace-summary-strip")).toBeNull();
    expect(screen.queryByRole("region", { name: "当前业务上下文" })).toBeNull();
  });

  it("exports exact market business and submission records from one selected scope", async () => {
    const user = userEvent.setup();
    const onQuickExport = vi.fn<QuickExportHandler>();
    render(
      <RegionHarness>
        <ReportCenterWorkspace
          section="compose"
          onComposeReport={vi.fn()}
          onQuickExport={onQuickExport}
          requestedDataBatchId="MARKET-2026-W31-APPROVED"
        />
      </RegionHarness>,
    );

    expect(screen.getByRole("button", { name: "导出业务周报" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "导出填报记录周报" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "导出填报记录月报" }),
    ).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "导出业务周报" }));
    await user.click(screen.getByRole("button", { name: "导出填报记录周报" }));
    await user.click(screen.getByRole("button", { name: "导出填报记录月报" }));

    expect(onQuickExport.mock.calls.map(([kind]) => kind)).toEqual([
      "business-weekly",
      "submission-weekly",
      "submission-monthly",
    ]);
  });

  it("blocks report generation when the current business scope is not queryable", async () => {
    const user = userEvent.setup();
    const onComposeReport = vi.fn();
    render(
      <RegionHarness>
        <ReportCenterWorkspace
          onComposeReport={onComposeReport}
          queryAllowed={false}
          requestedDataBatchId="SUPPLY-2026-MY-APPROVED"
          section="compose"
        />
      </RegionHarness>,
    );

    expect(
      screen.getByText("当前筛选范围超出您的数据权限，不能生成报告。"),
    ).toBeInTheDocument();
    const compose = screen.getByRole("button", { name: "生成报告" });
    expect(compose).toBeDisabled();
    await user.click(compose);
    expect(onComposeReport).not.toHaveBeenCalled();
  });

  it.each([
    [
      "production",
      "production.planting-production",
      "种植生产监测报告",
      "PRODUCTION-2026-W31-APPROVED",
      "2026年第31周产情已核定数据",
    ],
    [
      "market",
      "market.quote-trade",
      "价格与交易监测报告",
      "MARKET-2026-W31-APPROVED",
      "2026年第31周市场已核定数据",
    ],
  ] as const)(
    "generates an exact approved %s aggregate report without inventing cultivar detail",
    async (
      application,
      businessClassificationId,
      reportTemplate,
      dataBatchId,
      dataBatchLabel,
    ) => {
      const user = userEvent.setup();
      const onComposeReport = vi.fn();
      render(
        <RegionHarness>
          <ReportCenterWorkspace
            section="compose"
            onComposeReport={onComposeReport}
          />
        </RegionHarness>,
      );
      const context = screen.getByRole("region", {
        name: "业务报告生成条件",
      });

      await user.selectOptions(
        within(context).getByRole("combobox", { name: "业务类型" }),
        application,
      );
      await openReportMoreConditions(user);
      await user.selectOptions(
        within(context).getByRole("combobox", { name: "业务分类" }),
        businessClassificationId,
      );
      await selectReportCity(user, "齐齐哈尔市");
      await user.selectOptions(
        within(context).getByRole("combobox", { name: "产品或专题" }),
        "corn",
      );
      await user.selectOptions(
        within(context).getByRole("combobox", { name: "具体品种" }),
        "not-applicable",
      );
      await user.selectOptions(
        within(context).getByRole("combobox", { name: "报告频率" }),
        "周报",
      );
      await user.selectOptions(
        within(context).getByRole("combobox", { name: "报告期间" }),
        "2026年第31周",
      );
      await user.selectOptions(
        within(context).getByRole("combobox", { name: "报告模板" }),
        reportTemplate,
      );
      await user.selectOptions(
        within(context).getByRole("combobox", { name: "采用数据" }),
        dataBatchId,
      );

      const compose = screen.getByRole("button", { name: "生成报告" });
      expect(compose).toBeEnabled();
      await user.click(compose);
      expect(onComposeReport).toHaveBeenCalledWith(
        expect.objectContaining({
          application,
          businessClassificationId,
          region: "齐齐哈尔市全域",
          product: "玉米",
          cultivar: "不按具体品种拆分",
          reportTemplate,
          period: "2026年第31周",
          frequency: "周报",
          dataVersion: dataBatchId,
          dataBatchLabel,
        }),
      );
    },
  );

  it("keeps responsibility supervision centralized and auditable", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <RegionHarness>
        <ReportCenterWorkspace section="compose" onComposeReport={vi.fn()} />
      </RegionHarness>,
    );
    await user.click(screen.getByRole("tab", { name: "履责报告" }));

    const policy = screen.getByRole("group", { name: "查看填报规则" });
    expect(policy).not.toHaveAttribute("open");
    await user.click(screen.getByText("查看填报规则"));
    expect(screen.getByText("一人一责区")).toBeVisible();
    expect(screen.getByText("他人无权代填")).toBeVisible();
    expect(screen.getByText("逾期补填保留原逾期记录")).toBeVisible();
    expect(screen.getByRole("link", { name: "导出责任周报" })).toHaveAttribute(
      "download",
      "责任周报.csv",
    );
    expect(screen.getByRole("link", { name: "导出责任月报" })).toHaveAttribute(
      "download",
      "责任月报.csv",
    );
    expect(screen.getByRole("combobox", { name: "履责业务类型" })).toHaveValue(
      "",
    );
    expect(screen.getByRole("combobox", { name: "履责责任区域" })).toHaveValue(
      "",
    );
    expect(
      within(screen.getByRole("combobox", { name: "履责责任区域" })).getByRole(
        "option",
        { name: "讷河市" },
      ),
    ).toBeVisible();
    expect(
      screen.getByText(/业务日报、周报、月报请在“业务报告”中生成/),
    ).toBeVisible();

    const table = screen.getByRole("table", { name: "履责监督台账" });
    expect(within(table).getByText("截止未提交")).toBeVisible();
    expect(container.querySelector(".duty-rule-strip")).toBeNull();
    expect(container.querySelector(".unified-metric-strip")).toBeNull();
    expect(container.querySelector(".workspace-summary-strip")).toBeNull();
    expect(screen.queryByRole("region", { name: "当前业务上下文" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "月度履责" }));
    expect(screen.getByRole("table", { name: "月度履责记录" })).toBeVisible();
    expect(screen.getByText("连续 2 周异常")).toBeVisible();
  });

  it("keeps an unselected report region explicit and blocks generation", () => {
    const scope: OperationalScope = {
      ...prototypeOperationalIdentity,
      coordinates: { regionId: "" },
      savedView: null,
    };

    render(
      <FormalReportCenterWorkspace
        section="compose"
        scope={scope}
        onScopeChange={vi.fn()}
        onComposeReport={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("选择地区")).toHaveTextContent("请选择地区");
    expect(screen.getByRole("button", { name: "生成报告" })).toBeDisabled();
  });

  it("shows a recoverable Chinese integrity error instead of hiding damaged report storage", () => {
    const storedValue = "{无法解析的报告记录";
    const values = new Map<string, string>([
      ["齐齐哈尔粮食商情业务报告工作流-业务真值三", storedValue],
    ]);
    const workflow = createPrototypeBusinessReportWorkflow({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    });

    render(
      <RegionHarness>
        <ReportCenterWorkspace
          section="compose"
          onComposeReport={vi.fn()}
          workflow={workflow}
        />
      </RegionHarness>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("报告记录暂时无法读取");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "原始内容已保留，请联系系统管理员恢复",
    );
    expect(
      screen.queryByRole("button", { name: "生成报告" }),
    ).not.toBeInTheDocument();
    expect(values.get("齐齐哈尔粮食商情业务报告工作流-业务真值三")).toBe(
      storedValue,
    );
  });

  it("uses authorized master data for regions products and batches", async () => {
    const user = userEvent.setup();
    const scope: OperationalScope = {
      ...prototypeOperationalIdentity,
      authorization: {
        ...prototypeOperationalIdentity.authorization,
        authorizedRegionIds: ["heihe-all", "hulunbuir-designated"],
        authorizedBusinessClassificationIds: [
          "reporting.supply",
          "supply.results",
        ],
        authorizedProductIds: ["corn"],
        authorizedCultivarIds: [],
        authorizedReleaseVersionIds: ["SUPPLY-2026-MY-APPROVED"],
      },
      coordinates: { regionId: "authorized-all" },
      savedView: null,
    };

    render(
      <FormalReportCenterWorkspace
        section="compose"
        scope={scope}
        onScopeChange={vi.fn()}
        onComposeReport={vi.fn()}
      />,
    );

    const filters = screen.getByRole("region", {
      name: "业务报告生成条件",
    });
    const business = within(filters).getByRole("combobox", {
      name: "业务类型",
    });
    expect(
      within(business).getByRole("option", { name: "供需与态势" }),
    ).toBeVisible();
    expect(
      within(business).queryByRole("option", { name: "市场监测" }),
    ).not.toBeInTheDocument();
    await user.selectOptions(business, "supply");
    await openReportMoreConditions(user);
    await user.selectOptions(
      within(filters).getByRole("combobox", { name: "业务分类" }),
      "supply.results",
    );

    await user.click(within(filters).getByLabelText("选择地区"));
    expect(
      within(screen.getByLabelText("地市选项")).getByRole("button", {
        name: "黑河市",
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("地市选项")).getByRole("button", {
        name: "呼伦贝尔市",
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("地市选项")).queryByRole("button", {
        name: "齐齐哈尔市",
      }),
    ).not.toBeInTheDocument();

    const product = within(filters).getByRole("combobox", {
      name: "产品或专题",
    });
    expect(within(product).getByRole("option", { name: "玉米" })).toBeVisible();
    expect(within(product).getAllByRole("option")).toHaveLength(2);

    const batch = within(filters).getByRole("combobox", {
      name: "采用数据",
    });
    expect(within(batch).getAllByRole("option")).toHaveLength(2);
    expect(document.body).not.toHaveTextContent(
      /PRODUCTION|METRIC|2026-07-31|版本/,
    );
  });

  it("keeps compose distinct from the full ledger and resumes only assigned drafts", async () => {
    const user = userEvent.setup();
    const onComposeReport = vi.fn();
    render(
      <RegionHarness>
        <ReportCenterWorkspace
          actorPost="供需分析岗"
          onComposeReport={onComposeReport}
          section="compose"
        />
      </RegionHarness>,
    );

    expect(
      screen.queryByRole("table", { name: "业务报告台账" }),
    ).not.toBeInTheDocument();
    const queue = screen.getByRole("table", { name: "待继续编制报告" });
    expect(queue).toHaveTextContent("齐齐哈尔玉米供需账户编制月报");
    expect(queue).not.toHaveTextContent("齐齐哈尔粮食商情月报");
    await user.click(
      within(queue).getByRole("button", {
        name: "继续编制齐齐哈尔玉米供需账户编制月报",
      }),
    );
    expect(onComposeReport).toHaveBeenCalledWith(
      expect.objectContaining({
        businessClassificationId: "supply.results",
        cultivar: "不按具体品种拆分",
        reportTemplate: "供需平衡分析报告",
        region: "齐齐哈尔市全域",
      }),
    );
  });

  it("renders Chinese business dates in the dedicated ledger and responsibility view", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <RegionHarness>
        <ReportCenterWorkspace section="ledger" onComposeReport={vi.fn()} />
      </RegionHarness>,
    );

    expect(
      screen.getByRole("table", { name: "报告修订记录" }),
    ).toHaveTextContent("2026年7月31日");
    expect(document.body).not.toHaveTextContent("2026-07-31");

    rerender(
      <RegionHarness>
        <ReportCenterWorkspace section="compose" onComposeReport={vi.fn()} />
      </RegionHarness>,
    );
    await user.click(screen.getByRole("tab", { name: "履责报告" }));
    expect(
      screen.getByRole("table", { name: "填报责任配置" }),
    ).toHaveTextContent("2026年1月1日至2026年12月31日");
    expect(document.body).not.toHaveTextContent("2026-01-01");
  });

  it("orders report content from generation conditions to the current draft queue", () => {
    render(
      <RegionHarness>
        <ReportCenterWorkspace section="compose" onComposeReport={vi.fn()} />
      </RegionHarness>,
    );

    const heading = screen.getByRole("heading", {
      level: 1,
      name: "业务报告",
    });
    const generationConditions = screen.getByRole("region", {
      name: "业务报告生成条件",
    });
    const draftQueue = screen.getByRole("toolbar", {
      name: "待继续编制",
    });

    const precedes = (first: Element, second: Element) =>
      Boolean(
        first.compareDocumentPosition(second) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    expect(precedes(heading, generationConditions)).toBe(true);
    expect(precedes(generationConditions, draftQueue)).toBe(true);
  });

  it("reviews a persisted report and appends an auditable transition", async () => {
    const user = userEvent.setup();
    const workflow = createPrototypeBusinessReportWorkflow();
    render(
      <RegionHarness>
        <ReportCenterWorkspace
          section="review-distribution"
          onComposeReport={vi.fn()}
          workflow={workflow}
          actorPost="报告复核岗"
          permissionKeys={["report.review.approve", "report.review.return"]}
        />
      </RegionHarness>,
    );

    const heading = screen.getByRole("heading", { name: "报告复核", level: 1 });
    const tabs = screen.getByRole("tablist", {
      name: "报告复核与分发子视图",
    });
    expect(heading.compareDocumentPosition(tabs)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    await user.click(
      screen.getByRole("button", {
        name: "处理齐齐哈尔玉米供需账户复核月报",
      }),
    );
    const detail = screen.getByRole("region", { name: "报告复核详情" });
    expect(
      within(detail).getByRole("button", { name: "退回修改" }),
    ).toBeDisabled();
    await user.click(within(detail).getByRole("button", { name: "复核通过" }));

    expect(detail).toHaveTextContent("复核已通过，报告已转交报告发布岗");
    const report = workflow
      .getSnapshot()
      .find(({ title }) => title === "齐齐哈尔玉米供需账户复核月报");
    expect(report).toMatchObject({
      status: "待发布",
      currentHandlerPost: "报告发布岗",
    });
    expect(report?.auditTrail.at(-1)?.action).toBe("复核通过");
  });

  it("resolves the authenticated responsibility post instead of using the person's name as actorPost", async () => {
    const user = userEvent.setup();
    const workflow = createPrototypeBusinessReportWorkflow();
    const reviewerScope: OperationalScope = {
      ...prototypeOperationalIdentity,
      identity: {
        userId: "zhao-chen",
        postId: "business-reviewer",
        displayName: "赵晨",
      },
      authorization: {
        ...prototypeOperationalIdentity.authorization,
        permissionKeys: [
          "prototype:read",
          "report.review.approve",
          "report.review.return",
        ],
      },
      coordinates: { regionId: "authorized-all" },
      savedView: null,
    };
    render(
      <FormalReportCenterWorkspace
        onComposeReport={vi.fn()}
        onScopeChange={vi.fn()}
        scope={reviewerScope}
        section="review-distribution"
        workflow={workflow}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "处理齐齐哈尔玉米供需账户复核月报",
      }),
    );
    const detail = screen.getByRole("region", { name: "报告复核详情" });
    expect(
      within(detail).getByRole("button", { name: "复核通过" }),
    ).toBeEnabled();
  });

  it("opens the exact report workflow instance requested by a report work item", () => {
    const workflow = createPrototypeBusinessReportWorkflow();
    render(
      <RegionHarness>
        <ReportCenterWorkspace
          actorPost="区域数据管理员"
          onComposeReport={vi.fn()}
          requestedWorkItemId="WORK-REPORT-REVIEW-W31"
          section="ledger"
          workflow={workflow}
        />
      </RegionHarness>,
    );

    expect(
      screen.getByRole("heading", { name: "发布与分发", level: 1 }),
    ).toBeVisible();
    expect(screen.getByRole("tab", { name: "报告分发" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const detail = screen.getByRole("region", { name: "报告发布详情" });
    expect(detail).toHaveTextContent("第31周粮食商情周报");
    expect(detail).toHaveTextContent("齐齐哈尔市全域");
    expect(detail).toHaveTextContent("2026年第31周粮食商情周报复核通过稿");
  });

  it("does not guess a report instance for an unmapped report work item", () => {
    render(
      <RegionHarness>
        <ReportCenterWorkspace
          onComposeReport={vi.fn()}
          requestedWorkItemId="WORK-REPORT-UNKNOWN"
          section="ledger"
        />
      </RegionHarness>,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("未找到该报告任务对应的报告");
    expect(alert).toHaveTextContent(
      "请核对任务关联关系，或联系报告管理员补充关联信息",
    );
    expect(document.body).not.toHaveTextContent(/报告实例|正式映射|任务编号/);
    expect(
      screen.queryByRole("region", { name: "报告发布详情" }),
    ).not.toBeInTheDocument();
  });

  it("does not open a mapped report when the requested work item is absent from the authorized ledger", () => {
    const scope: OperationalScope = {
      ...prototypeOperationalIdentity,
      coordinates: { regionId: "authorized-all" },
      savedView: null,
    };
    render(
      <FormalReportCenterWorkspace
        onComposeReport={vi.fn()}
        onScopeChange={vi.fn()}
        requestedWorkItemId="WORK-REPORT-REVIEW-W31"
        scope={scope}
        section="review-distribution"
        workItems={[]}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "报告任务无法定位" }),
    ).toBeVisible();
    expect(document.body).not.toHaveTextContent("第31周粮食商情周报");
  });

  it("publishes only a reviewed report and records the publication event", async () => {
    const user = userEvent.setup();
    const workflow = createPrototypeBusinessReportWorkflow();
    render(
      <RegionHarness>
        <ReportCenterWorkspace
          section="review-distribution"
          onComposeReport={vi.fn()}
          workflow={workflow}
          actorPost="报告发布岗"
          permissionKeys={["report.publish.confirm"]}
        />
      </RegionHarness>,
    );

    await user.click(screen.getByRole("tab", { name: "报告分发" }));
    await user.click(
      screen.getByRole("button", {
        name: "查看玉米供需账户分析月报发布详情",
      }),
    );
    const detail = screen.getByRole("region", { name: "报告发布详情" });
    await user.click(within(detail).getByRole("button", { name: "确认发布" }));

    expect(detail).toHaveTextContent("报告已正式发布");
    const report = workflow
      .getSnapshot()
      .find(({ title }) => title === "玉米供需账户分析月报");
    expect(report?.status).toBe("已发布");
    expect(report?.auditTrail.at(-1)?.action).toBe("发布报告");
  });

  it("creates a revision draft without overwriting the published report", async () => {
    const user = userEvent.setup();
    const workflow = createPrototypeBusinessReportWorkflow();
    render(
      <RegionHarness>
        <ReportCenterWorkspace
          section="ledger"
          onComposeReport={vi.fn()}
          workflow={workflow}
          actorPost="经营分析岗"
          permissionKeys={[
            "report.revision.create",
            "report.audit.read",
            "report.export",
          ]}
        />
      </RegionHarness>,
    );

    expect(screen.getByRole("link", { name: "导出修订记录" })).toHaveAttribute(
      "download",
      "报告修订记录.csv",
    );
    await user.click(
      screen.getByRole("button", {
        name: "查看齐齐哈尔粮食商情月报报告沿革",
      }),
    );
    const detail = screen.getByRole("region", { name: "报告修订详情" });
    expect(
      within(detail).getByRole("button", { name: "创建修订草稿" }),
    ).toBeDisabled();
    await user.type(
      within(detail).getByRole("textbox", { name: "修订原因" }),
      "补充经复核确认的经营分析资料。",
    );
    await user.click(
      within(detail).getByRole("button", { name: "创建修订草稿" }),
    );

    expect(detail).toHaveTextContent("原报告保持有效");
    const original = workflow
      .getSnapshot()
      .find(({ title }) => title === "齐齐哈尔粮食商情月报");
    const revision = workflow
      .getSnapshot()
      .find(({ revisionOfReportId }) => revisionOfReportId === original?.id);
    expect(original?.status).toBe("已发布");
    expect(revision).toMatchObject({ status: "草稿" });
    expect(revision?.auditTrail[0].action).toBe("创建修订草稿");
    expect(
      within(detail).getByRole("button", { name: "确认替代原报告" }),
    ).toBeDisabled();
    expect(detail).toHaveTextContent("尚无完成复核并发布的修订报告");
  });

  it("keeps review and publication actions unavailable to an unassigned login", async () => {
    const user = userEvent.setup();
    const workflow = createPrototypeBusinessReportWorkflow();
    render(
      <RegionHarness>
        <ReportCenterWorkspace
          actorPost="区域数据管理员"
          onComposeReport={vi.fn()}
          permissionKeys={[
            "report.review.approve",
            "report.review.return",
            "report.publish.confirm",
          ]}
          section="review-distribution"
          workflow={workflow}
        />
      </RegionHarness>,
    );

    await user.click(
      screen.getByRole("button", {
        name: "处理齐齐哈尔玉米供需账户复核月报",
      }),
    );
    const reviewDetail = screen.getByRole("region", {
      name: "报告复核详情",
    });
    expect(
      within(reviewDetail).getByRole("button", { name: "复核通过" }),
    ).toBeDisabled();
    expect(reviewDetail).toHaveTextContent(
      "当前登录岗位“区域数据管理员”不是本报告的复核处理岗位，只能查看",
    );
    expect(reviewDetail).toHaveTextContent(
      "当前登录岗位没有查看报告审计记录的权限",
    );
    expect(
      workflow
        .getSnapshot()
        .find(({ title }) => title === "齐齐哈尔玉米供需账户复核月报")?.status,
    ).toBe("待复核");

    await user.click(screen.getByRole("tab", { name: "报告分发" }));
    await user.click(
      screen.getByRole("button", {
        name: "查看玉米供需账户分析月报发布详情",
      }),
    );
    const publicationDetail = screen.getByRole("region", {
      name: "报告发布详情",
    });
    expect(
      within(publicationDetail).getByRole("button", { name: "确认发布" }),
    ).toBeDisabled();
    expect(publicationDetail).toHaveTextContent(
      "当前登录岗位“区域数据管理员”无权发布本报告，只能查看",
    );
    expect(publicationDetail).toHaveTextContent(
      "当前登录岗位没有查看报告审计记录的权限",
    );
  });

  it("does not expose the report ledger without audit permission", () => {
    render(
      <RegionHarness>
        <ReportCenterWorkspace
          actorPost="区域数据管理员"
          onComposeReport={vi.fn()}
          permissionKeys={["report.export"]}
          section="ledger"
        />
      </RegionHarness>,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "没有查看报告沿革和审计记录的权限",
    );
    expect(
      screen.queryByRole("table", { name: "报告修订记录" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "导出修订记录" }),
    ).not.toBeInTheDocument();
  });

  it("does not expose unauthorized reports in review distribution ledger or a requested task", async () => {
    const user = userEvent.setup();
    const workflow = createPrototypeBusinessReportWorkflow();
    const scope: OperationalScope = {
      ...prototypeOperationalIdentity,
      authorization: {
        ...prototypeOperationalIdentity.authorization,
        authorizedRegionIds: ["heihe-all"],
      },
      coordinates: { regionId: "authorized-all" },
      savedView: null,
    };
    const common = {
      scope,
      onScopeChange: vi.fn(),
      onComposeReport: vi.fn(),
      workflow,
      actorPost: "供需分析岗",
    };
    const { rerender } = render(
      <FormalReportCenterWorkspace {...common} section="review-distribution" />,
    );

    expect(document.body).not.toHaveTextContent("齐齐哈尔玉米供需账户复核月报");
    expect(screen.getByRole("status")).toHaveTextContent(
      "当前没有等待复核的报告",
    );

    await user.click(screen.getByRole("tab", { name: "报告分发" }));
    expect(document.body).not.toHaveTextContent("玉米供需账户分析月报");
    expect(screen.getByRole("status")).toHaveTextContent(
      "当前没有待发布或已发布报告",
    );

    rerender(<FormalReportCenterWorkspace {...common} section="ledger" />);
    expect(document.body).not.toHaveTextContent("齐齐哈尔粮食商情月报");
    expect(
      within(
        screen.getByRole("table", { name: "报告修订记录" }),
      ).queryAllByRole("row"),
    ).toHaveLength(1);

    rerender(
      <FormalReportCenterWorkspace
        {...common}
        requestedWorkItemId="WORK-REPORT-REVIEW-W31"
        section="review-distribution"
      />,
    );
    expect(
      screen.getByRole("heading", { name: "报告任务无法定位" }),
    ).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "未找到该报告任务对应的报告",
    );
    expect(document.body).not.toHaveTextContent("第31周粮食商情周报");
    expect(
      screen.queryByRole("region", { name: "报告发布详情" }),
    ).not.toBeInTheDocument();

    rerender(<FormalReportCenterWorkspace {...common} section="compose" />);
    expect(document.body).not.toHaveTextContent("齐齐哈尔玉米供需账户编制月报");
    expect(
      within(
        screen.getByRole("table", { name: "待继续编制报告" }),
      ).queryAllByRole("row"),
    ).toHaveLength(1);
  });

  it("explains the report data boundary instead of rendering an inert help button", async () => {
    const user = userEvent.setup();
    render(
      <RegionHarness>
        <ReportCenterWorkspace section="compose" onComposeReport={vi.fn()} />
      </RegionHarness>,
    );

    const guidance = screen.getByRole("group", { name: "报告口径说明" });
    expect(guidance).not.toHaveAttribute("open");
    await user.click(within(guidance).getByText("报告口径说明"));
    expect(guidance).toHaveAttribute("open");
    expect(guidance).toHaveTextContent(
      "报告只使用当前生成条件对应的已核定数据",
    );
    expect(
      screen.queryByRole("button", { name: "报告口径说明" }),
    ).not.toBeInTheDocument();
  });
});
