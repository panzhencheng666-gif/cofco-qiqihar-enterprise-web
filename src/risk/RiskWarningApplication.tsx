import {
  AuditOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  FileSearchOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Badge,
  Button,
  ConfigProvider,
  Descriptions,
  Empty,
  Input,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createRealtimeApiClient,
  RealtimeApiError,
} from "@/platform/api/realtimeApiClient";
import type { CurrentSession } from "@/platform/api/realtimeBusinessRepository";
import { riskAntTheme } from "./riskVisualTheme";
import { RiskModelCenter } from "./RiskModelCenter";

type RiskLevel =
  "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "UNAVAILABLE";

interface RiskAssessmentSummary {
  assessmentId: string;
  domainCode: string;
  subjectType: string;
  subjectId: string;
  evaluationMode: string;
  riskLevel: RiskLevel;
  reasonCodes: readonly string[];
  score: number | null;
  evaluatedAt: string;
  evaluationDurationMs: number;
  modelName: string | null;
  modelVersion: number | null;
  reviewed: boolean;
  conclusionCode: string | null;
}

interface RiskFeedback {
  feedbackId: string;
  assessmentId: string;
  conclusionCode: string;
  reasonCode: string;
  dispositionNote: string;
  resolvedBySubject: string;
  resolvedAt: string;
}

interface AiJudgement {
  judgementId: string;
  independentConclusion: string;
  supportingEvidence: unknown;
  contradictingEvidence: unknown;
  uncertaintyDefinition: unknown;
  recommendedActions: unknown;
  confidence: number;
  generatedAt: string;
}

interface RiskAssessmentDetail {
  assessment: RiskAssessmentSummary;
  evidenceSnapshot: Record<string, unknown>;
  judgement: AiJudgement | null;
  feedback: RiskFeedback | null;
}

interface Filters {
  domain: string;
  level: string;
  status: string;
  search: string;
}

const api = createRealtimeApiClient();
const applicationCenterUrl = "/#/applications";
const domainLabels: Readonly<Record<string, string>> = {
  INVENTORY: "库存",
  MARKET: "市场",
  SUPPLY: "供需",
  LOGISTICS: "物流",
  QUALITY: "质量",
  OPERATIONS: "经营",
  DATA_PIPELINE: "数据链路",
};
const riskLabels: Readonly<Record<RiskLevel, string>> = {
  NONE: "无风险",
  LOW: "低",
  MEDIUM: "中",
  HIGH: "高",
  CRITICAL: "重大",
  UNAVAILABLE: "不可判定",
};
const conclusionLabels: Readonly<Record<string, string>> = {
  CONFIRMED: "确认风险",
  FALSE_POSITIVE: "误报",
  MISSED_RISK: "漏报",
  INSUFFICIENT_EVIDENCE: "证据不足",
};

function errorMessage(error: unknown): string {
  if (error instanceof RealtimeApiError) {
    const known: Readonly<Record<string, string>> = {
      AUTHENTICATION_REQUIRED:
        "登录状态已失效，请重新登录后再进入风险研判预警系统",
      ACCESS_SUBJECT_UNKNOWN: "当前登录账号尚未获得平台业务访问权限",
      ACCESS_PERMISSION_DENIED: "当前登录账号没有风险研判访问权限",
      API_NETWORK_ERROR: "无法连接风险研判服务，请确认后台服务已经启动",
      API_TIMEOUT: "风险研判服务响应超时，请稍后重试",
    };
    return (
      known[error.code] ??
      error.clientMessage ??
      "风险研判请求失败，请联系系统管理员并提供页面时间"
    );
  }
  return "风险研判服务暂时不可用";
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return String(value);
  return JSON.stringify(value, null, 2);
}

function levelTag(level: RiskLevel) {
  const colors: Record<RiskLevel, string> = {
    NONE: "default",
    LOW: "blue",
    MEDIUM: "gold",
    HIGH: "orange",
    CRITICAL: "red",
    UNAVAILABLE: "default",
  };
  return <Tag color={colors[level]}>{riskLabels[level]}</Tag>;
}

function EvidenceSnapshot({ value }: { value: Record<string, unknown> }) {
  const entries = Object.entries(value);
  if (entries.length === 0)
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="该研判没有保存证据快照"
      />
    );
  return (
    <div className="risk-evidence-list">
      {entries.map(([key, item]) => (
        <div key={key}>
          <span>{key}</span>
          <pre>{renderValue(item)}</pre>
        </div>
      ))}
    </div>
  );
}

function FeedbackForm({
  assessment,
  onSaved,
}: {
  assessment: RiskAssessmentDetail;
  onSaved: (value: RiskAssessmentDetail) => void;
}) {
  const { message } = App.useApp();
  const [conclusion, setConclusion] = useState<string>();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  if (assessment.feedback)
    return (
      <Descriptions
        bordered
        size="small"
        column={1}
        items={[
          {
            key: "conclusion",
            label: "人工结论",
            children:
              conclusionLabels[assessment.feedback.conclusionCode] ??
              assessment.feedback.conclusionCode,
          },
          {
            key: "reason",
            label: "原因编码",
            children: assessment.feedback.reasonCode,
          },
          {
            key: "note",
            label: "处置说明",
            children: assessment.feedback.dispositionNote,
          },
          {
            key: "actor",
            label: "复核人员",
            children: assessment.feedback.resolvedBySubject,
          },
          {
            key: "time",
            label: "复核时间",
            children: formatTime(assessment.feedback.resolvedAt),
          },
        ]}
      />
    );

  async function submit() {
    if (!conclusion || !reason.trim() || !note.trim()) {
      void message.error("请填写复核结论、原因编码和处置说明");
      return;
    }
    setSaving(true);
    try {
      await api.post<RiskFeedback>(
        `/api/v1/risk/workbench/assessments/${assessment.assessment.assessmentId}/feedback`,
        {
          conclusionCode: conclusion,
          reasonCode: reason.trim().toUpperCase(),
          dispositionNote: note.trim(),
        },
      );
      const refreshed = await api.get<RiskAssessmentDetail>(
        `/api/v1/risk/workbench/assessments/${assessment.assessment.assessmentId}`,
      );
      onSaved(refreshed);
      void message.success("人工复核已写入并重新读取确认");
    } catch (error) {
      void message.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="risk-feedback-form">
      <Select
        aria-label="人工复核结论"
        placeholder="选择复核结论"
        value={conclusion}
        onChange={setConclusion}
        options={Object.entries(conclusionLabels).map(([value, label]) => ({
          value,
          label,
        }))}
      />
      <Input
        aria-label="复核原因编码"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="原因编码，例如 SOURCE_VERIFIED"
        maxLength={80}
      />
      <Input.TextArea
        aria-label="处置说明"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="填写核验依据和处置说明"
        autoSize={{ minRows: 3, maxRows: 6 }}
        maxLength={2000}
        showCount
      />
      <Button type="primary" loading={saving} onClick={() => void submit()}>
        提交人工复核
      </Button>
    </div>
  );
}

export function RiskWarningApplication() {
  const [activeView, setActiveView] = useState<"events" | "models">("events");
  const [session, setSession] = useState<CurrentSession | null>(null);
  const [rows, setRows] = useState<readonly RiskAssessmentSummary[]>([]);
  const [selected, setSelected] = useState<RiskAssessmentDetail | null>(null);
  const [filters, setFilters] = useState<Filters>({
    domain: "",
    level: "",
    status: "OPEN",
    search: "",
  });
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [current, nextRows] = await Promise.all([
        api.get<CurrentSession>("/api/v1/session/me"),
        api.get<RiskAssessmentSummary[]>("/api/v1/risk/workbench/assessments", {
          domain: filters.domain,
          level: filters.level,
          status: filters.status,
          search: filters.search,
          limit: 100,
        }),
      ]);
      setSession(current);
      setRows(nextRows);
      setError(null);
      setRefreshedAt(new Date());
      setSelected((current) =>
        current &&
        !nextRows.some(
          (row) => row.assessmentId === current.assessment.assessmentId,
        )
          ? null
          : current,
      );
    } catch (loadError) {
      setError(errorMessage(loadError));
      setRows([]);
      setSelected(null);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const columns = useMemo<ColumnsType<RiskAssessmentSummary>>(
    () => [
      { title: "等级", dataIndex: "riskLevel", width: 84, render: levelTag },
      {
        title: "业务域",
        dataIndex: "domainCode",
        width: 92,
        render: (value: string) => domainLabels[value] ?? value,
      },
      { title: "研判对象", dataIndex: "subjectId", ellipsis: true },
      { title: "对象类型", dataIndex: "subjectType", width: 120 },
      { title: "研判方式", dataIndex: "evaluationMode", width: 126 },
      {
        title: "模型",
        width: 150,
        render: (_, row) =>
          row.modelName ? `${row.modelName} v${row.modelVersion}` : "规则研判",
      },
      {
        title: "研判时间",
        dataIndex: "evaluatedAt",
        width: 174,
        render: formatTime,
      },
      {
        title: "复核状态",
        width: 92,
        render: (_, row) => (
          <Badge
            status={row.reviewed ? "success" : "processing"}
            text={row.reviewed ? "已复核" : "待复核"}
          />
        ),
      },
    ],
    [],
  );

  async function open(row: RiskAssessmentSummary) {
    setDetailLoading(true);
    try {
      setSelected(
        await api.get<RiskAssessmentDetail>(
          `/api/v1/risk/workbench/assessments/${row.assessmentId}`,
        ),
      );
    } catch (detailError) {
      setError(errorMessage(detailError));
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <ConfigProvider theme={riskAntTheme}>
      <App>
        <div
          className="risk-application"
          data-service-state={error ? "error" : "online"}
        >
          <header className="risk-system-header">
            <a
              className="risk-system-brand"
              href={applicationCenterUrl}
              aria-label="返回平台应用中心"
            >
              <img src="/brand/rice-emblem.png" alt="" />
              <span>
                <strong>风险研判预警系统</strong>
                <small>齐齐哈尔粮食商情企业平台 · 独立应用</small>
              </span>
            </a>
            <div className="risk-system-account">
              <span>
                <small>当前用户</small>
                <strong>{session?.displayName ?? "未认证"}</strong>
              </span>
              <a href={applicationCenterUrl}>返回应用中心</a>
            </div>
          </header>
          <div className="risk-shell">
            <aside className="risk-rail">
              <div className="risk-app-mark">
                <span>研</span>
                <div>
                  <strong>风险研判预警</strong>
                  <small>独立应用</small>
                </div>
              </div>
              <div className="risk-live-state">
                <Badge
                  status={error ? "error" : "processing"}
                  text={error ? "服务异常" : "数据链路已连接"}
                />
                <small>
                  {refreshedAt
                    ? `最近同步 ${refreshedAt.toLocaleTimeString("zh-CN", { hour12: false })}`
                    : "尚未完成同步"}
                </small>
              </div>
              <nav aria-label="风险系统功能">
                <button
                  type="button"
                  aria-current={activeView === "events" ? "page" : undefined}
                  onClick={() => setActiveView("events")}
                >
                  <FileSearchOutlined />
                  风险事件研判
                </button>
                <button
                  type="button"
                  aria-current={activeView === "models" ? "page" : undefined}
                  onClick={() => setActiveView("models")}
                >
                  <ExperimentOutlined />
                  AI 模型中心
                </button>
              </nav>
              <div className="risk-rail-foot">
                <SafetyCertificateOutlined />
                <span>所有结论保留证据、模型版本和人工复核记录</span>
              </div>
            </aside>
            <main className="risk-main" aria-label="风险研判工作区">
              <header className="risk-command-header">
                <div>
                  <span>风险智能分析</span>
                  <h1>
                    {activeView === "events"
                      ? "风险研判预警中心"
                      : "AI 模型训练与治理中心"}
                  </h1>
                  <p>
                    {activeView === "events"
                      ? "真实事件 · 可追溯证据 · 受控模型 · 人工复核"
                      : "每日学习 · 冻结快照 · 真实工件 · 候选受控晋级"}
                  </p>
                </div>
                {activeView === "events" && (
                  <div className="risk-sync-facts">
                    <div>
                      <small>当前查询</small>
                      <strong>{error ? "—" : rows.length}</strong>
                      <span>{error ? "未取得数据" : "条真实记录"}</span>
                    </div>
                    <div>
                      <small>同步状态</small>
                      <strong className={error ? "is-error" : "is-online"}>
                        {error ? "异常" : "在线"}
                      </strong>
                      <span>30 秒自动刷新</span>
                    </div>
                  </div>
                )}
              </header>
              {activeView === "models" ? (
                <RiskModelCenter />
              ) : (
                <>
                  {error && (
                    <Alert
                      type="error"
                      showIcon
                      message="无法读取风险研判数据"
                      description={error}
                      action={
                        <Button
                          icon={<ReloadOutlined />}
                          onClick={() => void load()}
                        >
                          重新连接
                        </Button>
                      }
                    />
                  )}
                  <section className="risk-query-panel">
                    <div className="risk-query-title">
                      <DatabaseOutlined />
                      <span>
                        <strong>风险事件流</strong>
                        <small>仅显示服务端返回的正式研判记录</small>
                      </span>
                    </div>
                    <Space wrap>
                      <Input
                        allowClear
                        prefix={<SearchOutlined />}
                        placeholder="搜索对象或原因编码"
                        value={filters.search}
                        onChange={(event) =>
                          setFilters((current) => ({
                            ...current,
                            search: event.target.value,
                          }))
                        }
                      />
                      <Select
                        aria-label="业务域"
                        value={filters.domain}
                        onChange={(domain) =>
                          setFilters((current) => ({ ...current, domain }))
                        }
                        options={[
                          { value: "", label: "全部业务域" },
                          ...Object.entries(domainLabels).map(
                            ([value, label]) => ({
                              value,
                              label,
                            }),
                          ),
                        ]}
                      />
                      <Select
                        aria-label="风险等级"
                        value={filters.level}
                        onChange={(level) =>
                          setFilters((current) => ({ ...current, level }))
                        }
                        options={[
                          { value: "", label: "全部等级" },
                          ...Object.entries(riskLabels).map(
                            ([value, label]) => ({
                              value,
                              label,
                            }),
                          ),
                        ]}
                      />
                      <Select
                        aria-label="复核状态"
                        value={filters.status}
                        onChange={(status) =>
                          setFilters((current) => ({ ...current, status }))
                        }
                        options={[
                          { value: "OPEN", label: "待复核" },
                          { value: "REVIEWED", label: "已复核" },
                          { value: "ALL", label: "全部" },
                        ]}
                      />
                      <Button
                        icon={<ReloadOutlined />}
                        loading={loading}
                        onClick={() => void load()}
                      >
                        刷新
                      </Button>
                    </Space>
                  </section>
                  <section className="risk-workspace">
                    <div className="risk-event-ledger">
                      <Table
                        rowKey="assessmentId"
                        loading={loading}
                        columns={columns}
                        dataSource={[...rows]}
                        pagination={false}
                        locale={{
                          emptyText: (
                            <Empty
                              image={Empty.PRESENTED_IMAGE_SIMPLE}
                              description={
                                error
                                  ? "服务恢复后显示真实风险事件"
                                  : "当前查询没有风险事件"
                              }
                            />
                          ),
                        }}
                        onRow={(row) => ({ onClick: () => void open(row) })}
                        rowClassName={(row) =>
                          selected?.assessment.assessmentId === row.assessmentId
                            ? "is-selected"
                            : ""
                        }
                        scroll={{ x: 1050, y: 360 }}
                        size="small"
                      />
                    </div>
                    <div className="risk-detail-panel">
                      <Spin spinning={detailLoading}>
                        {!selected ? (
                          <Empty
                            image={<AuditOutlined />}
                            description="选择一条真实风险事件查看证据与复核记录"
                          />
                        ) : (
                          <>
                            <div className="risk-detail-heading">
                              <div>
                                <small>
                                  {domainLabels[
                                    selected.assessment.domainCode
                                  ] ?? selected.assessment.domainCode}
                                </small>
                                <h2>{selected.assessment.subjectId}</h2>
                              </div>
                              {levelTag(selected.assessment.riskLevel)}
                            </div>
                            <Descriptions
                              bordered
                              size="small"
                              column={2}
                              items={[
                                {
                                  key: "type",
                                  label: "对象类型",
                                  children: selected.assessment.subjectType,
                                },
                                {
                                  key: "mode",
                                  label: "研判方式",
                                  children: selected.assessment.evaluationMode,
                                },
                                {
                                  key: "model",
                                  label: "模型版本",
                                  children: selected.assessment.modelName
                                    ? `${selected.assessment.modelName} v${selected.assessment.modelVersion}`
                                    : "规则研判",
                                },
                                {
                                  key: "duration",
                                  label: "计算耗时",
                                  children: `${selected.assessment.evaluationDurationMs} ms`,
                                },
                                {
                                  key: "reasons",
                                  label: "原因编码",
                                  span: 2,
                                  children:
                                    selected.assessment.reasonCodes.join(
                                      "、",
                                    ) || "—",
                                },
                              ]}
                            />
                            <section>
                              <h3>证据快照</h3>
                              <EvidenceSnapshot
                                value={selected.evidenceSnapshot}
                              />
                            </section>
                            <section>
                              <h3>AI研判意见</h3>
                              {selected.judgement ? (
                                <div className="risk-ai-record">
                                  <p>
                                    {selected.judgement.independentConclusion}
                                  </p>
                                  <dl>
                                    <div>
                                      <dt>置信度</dt>
                                      <dd>
                                        {(
                                          selected.judgement.confidence * 100
                                        ).toFixed(2)}
                                        %
                                      </dd>
                                    </div>
                                    <div>
                                      <dt>生成时间</dt>
                                      <dd>
                                        {formatTime(
                                          selected.judgement.generatedAt,
                                        )}
                                      </dd>
                                    </div>
                                  </dl>
                                  <Typography.Text type="secondary">
                                    支持证据
                                  </Typography.Text>
                                  <pre>
                                    {renderValue(
                                      selected.judgement.supportingEvidence,
                                    )}
                                  </pre>
                                  <Typography.Text type="secondary">
                                    反面证据
                                  </Typography.Text>
                                  <pre>
                                    {renderValue(
                                      selected.judgement.contradictingEvidence,
                                    )}
                                  </pre>
                                  <Typography.Text type="secondary">
                                    不确定性
                                  </Typography.Text>
                                  <pre>
                                    {renderValue(
                                      selected.judgement.uncertaintyDefinition,
                                    )}
                                  </pre>
                                  <Typography.Text type="secondary">
                                    建议措施
                                  </Typography.Text>
                                  <pre>
                                    {renderValue(
                                      selected.judgement.recommendedActions,
                                    )}
                                  </pre>
                                </div>
                              ) : (
                                <Empty
                                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                                  description="该事件没有AI研判记录"
                                />
                              )}
                            </section>
                            <section>
                              <h3>人工复核</h3>
                              <FeedbackForm
                                assessment={selected}
                                onSaved={(value) => {
                                  setSelected(value);
                                  void load();
                                }}
                              />
                            </section>
                          </>
                        )}
                      </Spin>
                    </div>
                  </section>
                </>
              )}
            </main>
          </div>
        </div>
      </App>
    </ConfigProvider>
  );
}
