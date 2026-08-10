import { useEffect, useMemo, useState } from "react";

import {
  realtimeBusinessRepository,
  type CurrentSession,
  type EmployeeProfile,
  type MasterRegion,
  type RealtimeBusinessRepository,
  type WorkObligationReportInput,
  type WorkObligationWeeklyReport,
} from "@/platform/api/realtimeBusinessRepository";

import { RealtimeRegionCascadePicker } from "./RealtimeRegionCascadePicker";

const domainOptions = [
  { code: "", label: "全部业务" },
  { code: "PRODUCTION", label: "产情监测" },
  { code: "MARKET", label: "市场监测" },
  { code: "LOGISTICS", label: "物流监测" },
] as const;

function currentMonday(): string {
  const now = new Date();
  const day = now.getDay() || 7;
  now.setDate(now.getDate() - day + 1);
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function saveWorkbook(blob: Blob, filename: string): void {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(href);
}

function formatMoment(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function RealtimeWorkObligationReportPanel({
  repository = realtimeBusinessRepository,
  session,
}: {
  repository?: RealtimeBusinessRepository;
  session: CurrentSession;
}) {
  const [weekStart, setWeekStart] = useState(currentMonday);
  const [personScope, setPersonScope] = useState(session.subjectId);
  const [businessDomain, setBusinessDomain] = useState("");
  const [regionCode, setRegionCode] = useState("");
  const [regions, setRegions] = useState<readonly MasterRegion[]>([]);
  const [employees, setEmployees] = useState<readonly EmployeeProfile[]>([]);
  const [report, setReport] = useState<WorkObligationWeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const mayReadUnit = session.permissions.includes("OBLIGATION_REPORT_UNIT");
  const mayReadEmployees = session.permissions.includes("IDENTITY_READ");
  const mayExport = session.permissions.includes("OBLIGATION_REPORT_EXPORT");

  const input = useMemo<WorkObligationReportInput>(
    () => ({
      weekStart,
      ...(personScope === "__UNIT__"
        ? { workUnitCode: session.workUnitCode }
        : { subjectId: personScope || session.subjectId }),
      ...(businessDomain
        ? {
            businessDomain: businessDomain as
              "PRODUCTION" | "MARKET" | "LOGISTICS",
          }
        : {}),
      ...(regionCode ? { regionCode } : {}),
    }),
    [businessDomain, personScope, regionCode, session, weekStart],
  );

  async function load(nextInput: WorkObligationReportInput): Promise<void> {
    setLoading(true);
    setError("");
    try {
      setReport(await repository.loadWorkObligationWeeklyReport(nextInput));
    } catch {
      setReport(null);
      setError("当前范围的履职记录暂时无法读取，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const employeeRequest = mayReadEmployees
      ? repository.listEmployees()
      : Promise.resolve([] as const);
    void Promise.all([repository.loadMasterData(), employeeRequest])
      .then(([master, nextEmployees]) => {
        if (cancelled) return;
        setRegions(master.regions);
        setEmployees(
          nextEmployees.filter(
            (employee) => employee.workUnitCode === session.workUnitCode,
          ),
        );
      })
      .catch(() => {
        if (!cancelled) setError("履职周报筛选范围暂时无法读取。");
      });
    queueMicrotask(() => {
      if (cancelled) return;
      void load({ weekStart: currentMonday(), subjectId: session.subjectId });
    });
    return () => {
      cancelled = true;
    };
    // The authenticated employee determines the initial governed scope.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repository, session.subjectId, session.workUnitCode]);

  async function exportReport(): Promise<void> {
    setExporting(true);
    setError("");
    try {
      const task = await repository.createWorkObligationReportExport(input);
      const workbook = await repository.downloadWorkObligationReport(task.id);
      saveWorkbook(workbook, task.filename);
    } catch {
      setError("履职周报导出未完成，请稍后重试。");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="enterprise-ledger-workbench obligation-report-workspace">
      <div className="enterprise-ledger-workbench__breadcrumb">
        我的工作 / 填报履职周报
      </div>
      <header className="enterprise-ledger-title">
        <h1>填报履职周报</h1>
        <p>按员工责任范围汇总填报、退回、按时完成和逾期记录</p>
      </header>

      <section
        aria-label="履职周报筛选条件"
        className="enterprise-ledger-query obligation-report-filters"
        role="search"
      >
        <label>
          <span>周起始日期</span>
          <input
            aria-label="周起始日期"
            type="date"
            value={weekStart}
            onChange={(event) => setWeekStart(event.target.value)}
          />
          <small>请选择星期一</small>
        </label>
        <label>
          <span>统计人员</span>
          <select
            aria-label="统计人员"
            value={personScope}
            onChange={(event) => setPersonScope(event.target.value)}
          >
            <option value={session.subjectId}>
              {session.displayName}（本人）
            </option>
            {mayReadUnit && <option value="__UNIT__">本单位全部人员</option>}
            {mayReadEmployees &&
              employees
                .filter(({ subjectId }) => subjectId !== session.subjectId)
                .map((employee) => (
                  <option key={employee.subjectId} value={employee.subjectId}>
                    {employee.displayName}
                  </option>
                ))}
          </select>
        </label>
        <label>
          <span>业务范围</span>
          <select
            aria-label="业务范围"
            value={businessDomain}
            onChange={(event) => setBusinessDomain(event.target.value)}
          >
            {domainOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <RealtimeRegionCascadePicker
          ariaLabel="履职统计地区"
          onChange={setRegionCode}
          regions={regions}
          requireVillage={false}
          value={regionCode}
        />
        <div className="obligation-report-actions">
          <button
            disabled={loading}
            onClick={() => void load(input)}
            type="button"
          >
            {loading ? "正在查询……" : "查询"}
          </button>
          {mayExport && (
            <button
              disabled={loading || exporting || !report}
              onClick={() => void exportReport()}
              type="button"
            >
              {exporting ? "正在导出……" : "一键导出 XLSX"}
            </button>
          )}
        </div>
      </section>

      {error && (
        <div className="market-task6-alert" role="alert">
          {error}
        </div>
      )}

      {report && (
        <>
          <section
            aria-label="履职情况汇总"
            className="obligation-report-summary"
          >
            <article>
              <span>应填事项</span>
              <strong>{report.summary.total}</strong>
            </article>
            <article>
              <span>按时完成</span>
              <strong>{report.summary.onTime}</strong>
            </article>
            <article>
              <span>逾期完成</span>
              <strong>{report.summary.lateCompleted}</strong>
            </article>
            <article>
              <span>逾期未完成</span>
              <strong>{report.summary.overdueOutstanding}</strong>
            </article>
            <article>
              <span>未到期</span>
              <strong>{report.summary.pending}</strong>
            </article>
            <article>
              <span>退回记录</span>
              <strong>{report.summary.returned}</strong>
            </article>
          </section>
          <section
            aria-label="履职记录明细"
            className="obligation-report-ledger"
          >
            <header>
              <div>
                <h2>{report.scopeLabel || "当前范围"}</h2>
                <p>
                  {report.weekStart} 至 {report.weekEnd}
                </p>
              </div>
              <strong>{report.rows.length} 条记录</strong>
            </header>
            <div className="enterprise-ledger-table-scroll" tabIndex={0}>
              <table aria-label="填报履职记录">
                <thead>
                  <tr>
                    <th>填报人员</th>
                    <th>单位</th>
                    <th>业务</th>
                    <th>地区</th>
                    <th>品种</th>
                    <th>业务期间</th>
                    <th>截止时间</th>
                    <th>完成时间</th>
                    <th>处理状态</th>
                    <th>履职状态</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row) => (
                    <tr key={row.workItemId}>
                      <td>{row.employeeName}</td>
                      <td>{row.workUnitName}</td>
                      <td>{row.businessDomainLabel}</td>
                      <td>{row.regionName}</td>
                      <td>{row.productName}</td>
                      <td>{row.businessPeriod}</td>
                      <td>{formatMoment(row.dueAt)}</td>
                      <td>{formatMoment(row.completedAt)}</td>
                      <td>{row.statusLabel}</td>
                      <td>{row.complianceLabel}</td>
                    </tr>
                  ))}
                  {report.rows.length === 0 && (
                    <tr>
                      <td colSpan={10}>当前筛选范围暂无履职记录</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
