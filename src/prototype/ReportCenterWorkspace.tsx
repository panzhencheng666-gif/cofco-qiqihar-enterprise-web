import { useState } from "react";
import type {
  BusinessReportContext,
  ReportableApplication,
} from "./businessReportModel";
import {
  businessReportRows,
  dutyMonthlyRows,
  dutyWeeklyRows,
  responsibilityAssignments,
} from "./formalEnterpriseData";
import type { ReportingSection } from "./formalEnterpriseModel";
import {
  BusinessContextBar,
  WorkspaceFilterBar,
  WorkspaceHeader,
  WorkspacePagination,
  WorkspaceStatus,
  WorkspaceSummaryStrip,
  WorkspaceTable,
  WorkspaceTableToolbar,
  type WorkspaceTone,
} from "./UnifiedWorkspacePrimitives";

const reportApplications: readonly {
  key: ReportableApplication;
  label: string;
  products: readonly string[];
  versions: readonly string[];
}[] = [
  {
    key: "production",
    label: "产情监测",
    products: ["玉米", "大豆", "稻谷"],
    versions: ["产情第 30 周正式指标版本", "产情第 31 周待核定版本"],
  },
  {
    key: "market",
    label: "市场监测",
    products: ["玉米", "大豆", "稻谷", "农资专题"],
    versions: ["第 31 周已核定数据", "7 月 31 日已核定数据"],
  },
  {
    key: "supply",
    label: "供需与态势",
    products: ["玉米原粮", "大豆原粮", "稻谷原粮", "大米产品"],
    versions: ["2026/27 年度市级合并账户", "2026/27 年度县级账户"],
  },
];

const reportRegions = [
  "齐齐哈尔市全域",
  "讷河市",
  "龙江县",
  "黑河市全域",
  "呼伦贝尔指定范围",
] as const;

const reportPeriods = [
  "2026-07-31",
  "2026 年第 31 周",
  "2026 年 7 月",
  "2026/27 营销年度",
] as const;

function buildReportContext({
  application,
  product,
  region,
  period,
  dataVersion,
}: {
  application: ReportableApplication;
  product: string;
  region: string;
  period: string;
  dataVersion: string;
}): BusinessReportContext {
  const definition = reportApplications.find(
    (item) => item.key === application,
  )!;
  return {
    application,
    applicationLabel: definition.label,
    product,
    region,
    regionLevel: region.endsWith("市全域") ? "地市级" : "县级或指定范围",
    period,
    dataCutoff: "2026-07-31 17:00",
    dataVersion,
    author: `${definition.label.replace("监测", "")}分析岗`,
    reviewer: "报告复核岗",
  };
}

function toneFor(value: string): WorkspaceTone {
  if (
    value.includes("未提交") ||
    value.includes("逾期") ||
    value.includes("替代")
  ) {
    return "danger";
  }
  if (
    value.includes("等待") ||
    value.includes("生成") ||
    value.includes("复核")
  ) {
    return "warning";
  }
  if (
    value.includes("按时") ||
    value.includes("发布") ||
    value.includes("通过")
  ) {
    return "good";
  }
  return "normal";
}

function ReportContext({
  state,
  context,
}: {
  state: string;
  context: BusinessReportContext;
}) {
  return (
    <BusinessContextBar
      items={[
        ["所选业务", context.applicationLabel],
        ["地区与产品", `${context.region} · ${context.product}`],
        ["报告期间", context.period],
        ["采用版本", context.dataVersion],
      ]}
      state={state}
    />
  );
}

function BusinessReports({
  onComposeReport,
}: {
  onComposeReport: (context: BusinessReportContext) => void;
}) {
  const [application, setApplication] =
    useState<ReportableApplication>("market");
  const definition = reportApplications.find(
    (item) => item.key === application,
  )!;
  const [region, setRegion] = useState<string>("齐齐哈尔市全域");
  const [product, setProduct] = useState<string>("玉米");
  const [period, setPeriod] = useState<string>("2026 年第 31 周");
  const [dataVersion, setDataVersion] = useState<string>("第 31 周已核定数据");
  const context = buildReportContext({
    application,
    product,
    region,
    period,
    dataVersion,
  });

  function changeApplication(next: ReportableApplication) {
    const nextDefinition = reportApplications.find(
      (item) => item.key === next,
    )!;
    setApplication(next);
    setProduct(nextDefinition.products[0]);
    setDataVersion(nextDefinition.versions[0]);
  }

  return (
    <div className="unified-workspace">
      <WorkspaceHeader
        actions={
          <>
            <button type="button">报告口径说明</button>
            <button className="is-primary" type="button">
              新建报告
            </button>
          </>
        }
        eyebrow="报表中心 / 业务报告"
        summary="按业务、地区、产品、期间和已核定数据版本生成报告，不复制原始业务数据。"
        title="业务报告"
      />
      <ReportContext context={context} state="报告条件完整" />
      <WorkspaceFilterBar
        label="业务报告生成条件"
        actions={
          <>
            {(["日报", "周报", "月报"] as const).map((frequency) => (
              <button
                key={frequency}
                type="button"
                onClick={() => onComposeReport(context)}
              >
                生成{frequency}
              </button>
            ))}
          </>
        }
      >
        <label>
          <span>业务</span>
          <select
            aria-label="业务类型"
            value={application}
            onChange={(event) =>
              changeApplication(event.target.value as ReportableApplication)
            }
          >
            {reportApplications.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>地区</span>
          <select
            aria-label="报告地区"
            value={region}
            onChange={(event) => setRegion(event.target.value)}
          >
            {reportRegions.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          <span>产品</span>
          <select
            aria-label="产品或专题"
            value={product}
            onChange={(event) => setProduct(event.target.value)}
          >
            {definition.products.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          <span>期间</span>
          <select
            aria-label="报告期间"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
          >
            {reportPeriods.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          <span>数据版本</span>
          <select
            aria-label="采用数据版本"
            value={dataVersion}
            onChange={(event) => setDataVersion(event.target.value)}
          >
            {definition.versions.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </WorkspaceFilterBar>
      <WorkspaceSummaryStrip
        label="业务报告摘要"
        items={[
          {
            label: "本期报告",
            value: "24 份",
            note: "业务报告统一登记",
          },
          {
            label: "等待复核",
            value: "4 份",
            note: "复核通过后方可发布",
            tone: "warning",
          },
          {
            label: "已发布",
            value: "18 份",
            note: "正式版本可追溯",
            tone: "good",
          },
          {
            label: "等待替代",
            value: "2 份",
            note: "修订版发布后替代旧版",
            tone: "danger",
          },
        ]}
      />
      <WorkspaceTableToolbar
        actions={
          <>
            <button type="button">导出目录</button>
            <button type="button">筛选</button>
          </>
        }
        note="报告只引用已核定数据版本；发布后形成不可覆盖的正式版本。"
        title="业务报告台账"
      />
      <WorkspaceTable
        columns={[
          "报告名称",
          "周期",
          "范围",
          "报告期间",
          "采用数据",
          "状态",
          "责任岗位",
          "发布时间",
          "操作",
        ]}
        label="业务报告台账"
        rows={businessReportRows.map((row) => [
          <strong key={`${row.name}-name`}>{row.name}</strong>,
          row.frequency,
          row.scope,
          row.period,
          row.dataVersion,
          <WorkspaceStatus key={`${row.name}-state`} tone={toneFor(row.status)}>
            {row.status}
          </WorkspaceStatus>,
          row.owner,
          row.publishedAt,
          <button
            className="unified-table-action"
            key={`${row.name}-action`}
            type="button"
          >
            查看
          </button>,
        ])}
      />
      <WorkspacePagination
        end={businessReportRows.length}
        page={1}
        pages={6}
        start={1}
        total={24}
      />
    </div>
  );
}

function DutyReports() {
  const [view, setView] = useState<"weekly" | "monthly">("weekly");
  const dutyContext = buildReportContext({
    application: "market",
    product: "全部责任事项",
    region: "齐齐哈尔市全域",
    period: "2026 年第 31 周",
    dataVersion: "第 31 周责任截止快照",
  });
  return (
    <div className="unified-workspace">
      <WorkspaceHeader
        actions={
          <>
            <button type="button">导出责任周报</button>
            <button type="button">导出责任月报</button>
            <button className="is-primary" type="button">
              维护责任配置
            </button>
          </>
        }
        eyebrow="报表中心 / 履责报告"
        summary="监督责任人是否按时完成所属区域任务；不在这里重复填写产情或市场业务值。"
        title="填报履责监督"
      />
      <ReportContext context={dutyContext} state="第 31 周责任快照已固定" />
      <WorkspaceFilterBar label="履责报告筛选条件">
        <label>
          <span>业务类型</span>
          <select aria-label="履责业务类型" defaultValue="all">
            <option value="all">全部业务</option>
            <option>产情监测</option>
            <option>市场监测</option>
          </select>
        </label>
        <label>
          <span>责任区域</span>
          <select aria-label="履责责任区域" defaultValue="all">
            <option value="all">全部责任区域</option>
            <option>齐齐哈尔市本级</option>
            <option>讷河市</option>
            <option>甘南县</option>
            <option>拜泉县</option>
          </select>
        </label>
        <label>
          <span>统计周期</span>
          <select aria-label="履责统计周期" defaultValue="week-31">
            <option value="week-31">2026 年第 31 周</option>
            <option value="month-07">2026 年 7 月</option>
          </select>
        </label>
        <label>
          <span>履责状态</span>
          <select aria-label="履责状态" defaultValue="all">
            <option value="all">全部状态</option>
            <option>按时完成</option>
            <option>逾期补填</option>
            <option>截止未提交</option>
          </select>
        </label>
      </WorkspaceFilterBar>
      <p className="report-workspace-note">
        本页监督是否按时完成；业务日报、周报、月报请在“业务报告”中生成。
      </p>
      <WorkspaceTableToolbar
        title="填报责任规则"
        note="责任、权限、频率和逾期规则统一执行"
      />
      <WorkspaceTable
        columns={["规则事项", "执行规则", "说明"]}
        label="填报责任规则"
        rows={[
          ["责任归属", "一人一责区", "责任配置按人员、区域、业务和有效期生效"],
          [
            "填写权限",
            "他人无权代填",
            "管理员可以催办和重派未来任务，不能代替责任人填写",
          ],
          ["任务频率", "每周填报一次", "按周生成任务并固定截止时间"],
          [
            "逾期规则",
            "逾期补填保留原逾期记录",
            "补报不覆盖截止快照，周报和月报均可追溯",
          ],
        ]}
      />
      <WorkspaceSummaryStrip
        label="本周履责指标"
        items={[
          {
            label: "本周应报",
            value: "428 项",
            note: "免报任务不计入应报",
          },
          {
            label: "按时完成",
            value: "395 项",
            note: "首次合格提交在截止前",
            tone: "good",
          },
          {
            label: "截止未提交",
            value: "26 项",
            note: "逾期状态已经固定",
            tone: "danger",
          },
          {
            label: "逾期后补填",
            value: "7 项",
            note: "原逾期记录继续保留",
            tone: "warning",
          },
        ]}
      />
      <WorkspaceTableToolbar
        actions={
          <div className="unified-mode-switch" aria-label="履责统计周期">
            <button
              aria-pressed={view === "weekly"}
              className={view === "weekly" ? "is-active" : undefined}
              type="button"
              onClick={() => setView("weekly")}
            >
              周度履责
            </button>
            <button
              aria-pressed={view === "monthly"}
              className={view === "monthly" ? "is-active" : undefined}
              type="button"
              onClick={() => setView("monthly")}
            >
              月度履责
            </button>
          </div>
        }
        note={
          view === "weekly"
            ? "以任务截止快照为准，显示首次合格提交和补填情况。"
            : "按责任人汇总应报、按时、逾期、缺报和退回次数。"
        }
        title={view === "weekly" ? "第 31 周履责明细" : "2026 年 7 月履责汇总"}
      />
      {view === "weekly" ? (
        <WorkspaceTable
          columns={[
            "责任人",
            "责任区域",
            "业务事项",
            "规定截止",
            "首次合格提交",
            "履责状态",
            "逾期时长",
            "审核结果",
          ]}
          label="履责监督台账"
          rows={dutyWeeklyRows.map((row) => [
            <strong key={`${row.person}-${row.region}`}>{row.person}</strong>,
            row.region,
            row.item,
            row.deadline,
            row.firstQualifiedSubmission,
            <WorkspaceStatus
              key={`${row.person}-${row.status}`}
              tone={toneFor(row.status)}
            >
              {row.status}
            </WorkspaceStatus>,
            row.overdueDuration,
            row.review,
          ])}
        />
      ) : (
        <WorkspaceTable
          columns={[
            "责任人",
            "责任区域",
            "应报",
            "按时",
            "逾期",
            "缺报",
            "退回",
            "按时率",
            "趋势",
          ]}
          label="月度履责记录"
          rows={dutyMonthlyRows.map((row) => [
            <strong key={`${row.person}-${row.region}`}>{row.person}</strong>,
            row.region,
            row.expected,
            row.onTime,
            row.overdue,
            row.missing,
            row.returned,
            row.onTimeRate,
            row.trend,
          ])}
        />
      )}
      <WorkspaceTableToolbar
        actions={<button type="button">导出责任配置</button>}
        note="责任配置决定任务归属和填写权限；历史配置按有效期保留。"
        title="有效责任关系"
      />
      <WorkspaceTable
        columns={[
          "区域",
          "业务事项",
          "频率",
          "责任人",
          "责任岗位",
          "审核人",
          "截止规则",
          "有效期",
          "状态",
        ]}
        label="填报责任配置"
        rows={responsibilityAssignments.map((row) => [
          row.region,
          row.businessItem,
          row.frequency,
          <strong key={`${row.id}-person`}>{row.responsiblePerson}</strong>,
          row.responsiblePost,
          row.reviewer,
          row.deadlineRule,
          row.effectivePeriod,
          <WorkspaceStatus key={`${row.id}-state`} tone={toneFor(row.status)}>
            {row.status}
          </WorkspaceStatus>,
        ])}
      />
    </div>
  );
}

function ReviewWorkspace() {
  const context = buildReportContext({
    application: "market",
    product: "玉米",
    region: "齐齐哈尔市全域",
    period: "2026 年第 31 周",
    dataVersion: "第 31 周已核定数据",
  });
  return (
    <div className="unified-workspace">
      <WorkspaceHeader
        actions={<button className="is-primary">批量复核</button>}
        eyebrow="报表中心 / 报告复核"
        summary="复核报告结论、引用数据版本、地区产品口径和敏感信息。"
        title="报告复核"
      />
      <ReportContext context={context} state="4 份报告等待复核" />
      <WorkspaceTableToolbar
        note="复核不修改原始业务值；数据问题退回所属业务重新审核。"
        title="待复核报告"
      />
      <WorkspaceTable
        columns={[
          "报告",
          "业务",
          "数据版本",
          "结论校核",
          "口径校核",
          "责任岗位",
          "操作",
        ]}
        label="待复核报告"
        rows={[
          [
            "齐齐哈尔玉米市场运行日报",
            "市场监测",
            "7 月 31 日已核定数据",
            <WorkspaceStatus key="review-status-1" tone="warning">
              待复核
            </WorkspaceStatus>,
            "通过",
            "市场分析岗",
            <button className="unified-table-action" key="review-action-1">
              开始复核
            </button>,
          ],
          [
            "齐齐哈尔玉米产情监测周报",
            "产情监测",
            "第 31 周已核定数据",
            "通过",
            <WorkspaceStatus key="review-status-2" tone="warning">
              1 项待说明
            </WorkspaceStatus>,
            "产情分析岗",
            <button className="unified-table-action" key="review-action-2">
              开始复核
            </button>,
          ],
        ]}
      />
    </div>
  );
}

function DistributionWorkspace() {
  const context = buildReportContext({
    application: "market",
    product: "玉米",
    region: "齐齐哈尔市全域",
    period: "2026 年第 31 周",
    dataVersion: "第 31 周已核定数据",
  });
  return (
    <div className="unified-workspace">
      <WorkspaceHeader
        actions={<button className="is-primary">新建发布任务</button>}
        eyebrow="报表中心 / 发布与分发"
        summary="统一控制报告发布范围、接收对象、发布时间和替代关系。"
        title="发布与分发"
      />
      <ReportContext context={context} state="发布渠道正常" />
      <WorkspaceTableToolbar
        note="仅已复核的正式报告可以进入发布计划。"
        title="报告分发任务"
      />
      <WorkspaceTable
        columns={[
          "报告",
          "发布范围",
          "接收对象",
          "发布时间",
          "替代版本",
          "状态",
          "操作",
        ]}
        label="报告分发任务"
        rows={[
          [
            "齐齐哈尔粮食商情月报",
            "东北区域经营中心",
            "经营管理层、区域业务岗",
            "7 月 30 日 17:20",
            "2026 年 6 月版",
            <WorkspaceStatus key="distribution-status-1" tone="good">
              已发布
            </WorkspaceStatus>,
            <button
              className="unified-table-action"
              key="distribution-action-1"
            >
              查看回执
            </button>,
          ],
          [
            "齐齐哈尔玉米市场运行日报",
            "齐齐哈尔授权范围",
            "经营管理层、市场业务岗",
            "计划今日 18:30",
            "—",
            <WorkspaceStatus key="distribution-status-2" tone="warning">
              等待复核
            </WorkspaceStatus>,
            <button
              className="unified-table-action"
              key="distribution-action-2"
            >
              查看计划
            </button>,
          ],
        ]}
      />
    </div>
  );
}

function VersionWorkspace() {
  const context = buildReportContext({
    application: "market",
    product: "玉米",
    region: "齐齐哈尔市全域",
    period: "2026 年第 31 周",
    dataVersion: "第 31 周已核定数据",
  });
  return (
    <div className="unified-workspace">
      <WorkspaceHeader
        actions={<button type="button">导出版本目录</button>}
        eyebrow="报表中心 / 历史版本"
        summary="查询报告生成、复核、发布和替代全过程，正式版本不可覆盖。"
        title="报告历史版本"
      />
      <ReportContext context={context} state="版本链完整" />
      <WorkspaceTableToolbar
        note="同一报告的修订版通过替代关系关联，原发布版继续留痕。"
        title="正式报告版本"
      />
      <WorkspaceTable
        columns={[
          "报告",
          "版本",
          "生成时间",
          "复核时间",
          "发布时间",
          "当前效力",
          "操作",
        ]}
        label="报告历史版本"
        rows={[
          [
            "齐齐哈尔粮食商情月报",
            "2026-07 · 正式版",
            "7 月 30 日 15:10",
            "7 月 30 日 16:48",
            "7 月 30 日 17:20",
            <WorkspaceStatus key="version-status-1" tone="good">
              当前有效
            </WorkspaceStatus>,
            <button className="unified-table-action" key="version-action-1">
              查看版本
            </button>,
          ],
          [
            "齐齐哈尔粮食商情月报",
            "2026-06 · 正式版",
            "6 月 30 日 15:04",
            "6 月 30 日 16:30",
            "6 月 30 日 17:00",
            <WorkspaceStatus key="version-status-2">已被替代</WorkspaceStatus>,
            <button className="unified-table-action" key="version-action-2">
              查看版本
            </button>,
          ],
        ]}
      />
    </div>
  );
}

export function ReportCenterWorkspace({
  section,
  onComposeReport,
}: {
  section: ReportingSection;
  onComposeReport: (context: BusinessReportContext) => void;
}) {
  if (section === "duty-reports") return <DutyReports />;
  if (section === "review") return <ReviewWorkspace />;
  if (section === "distribution") return <DistributionWorkspace />;
  if (section === "versions") return <VersionWorkspace />;
  return <BusinessReports onComposeReport={onComposeReport} />;
}
