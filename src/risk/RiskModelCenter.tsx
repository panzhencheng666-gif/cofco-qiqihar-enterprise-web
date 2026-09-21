import {
  ClockCircleOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { Alert, App, Badge, Button, Empty, Spin, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createRealtimeApiClient,
  RealtimeApiError,
} from "@/platform/api/realtimeApiClient";

interface RiskModelSummary {
  modelId: string;
  modelName: string;
  modelKind: string;
  domainCode: string;
  statusCode: string;
  policyEnabled: boolean;
  scheduledLocalTime: string | null;
  scheduleTimezone: string | null;
  trainingWindowDays: number;
  minimumNewLabels: number;
  automaticCandidateEnabled: boolean;
  autoActivationEnabled: boolean;
  lastScheduledDate: string | null;
  lastExecutionStatus: string | null;
  lastOutcomeCode: string | null;
  lastOutcomeMessage: string | null;
  lastCompletedAt: string | null;
  latestVersion: number | null;
  latestVersionStatus: string | null;
}

interface RiskTrainingExecution {
  executionId: string;
  modelId: string;
  modelName: string;
  scheduledLocalDate: string;
  triggerCode: string;
  statusCode: string;
  outcomeCode: string | null;
  outcomeMessage: string | null;
  trainingSnapshotId: string | null;
  trainingRunId: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface RiskModelOverview {
  models: RiskModelSummary[];
  recentExecutions: RiskTrainingExecution[];
  readAt: string;
}

const api = createRealtimeApiClient();

const modelKindLabels: Readonly<Record<string, string>> = {
  DOMAIN_LLM: "独立大模型",
  RISK_CLASSIFIER: "领域风险分类",
  ANOMALY: "异常检测",
  FORECAST: "趋势预测",
  RERANKER: "证据重排",
};

const executionStatus: Readonly<
  Record<string, { label: string; badge: "default" | "processing" | "success" | "error" | "warning" }>
> = {
  QUEUED: { label: "已排队", badge: "default" },
  RUNNING: { label: "训练中", badge: "processing" },
  SUCCEEDED: { label: "候选已生成", badge: "success" },
  SKIPPED: { label: "本次跳过", badge: "warning" },
  FAILED: { label: "训练失败", badge: "error" },
};

function modelError(error: unknown): string {
  if (error instanceof RealtimeApiError)
    return error.clientMessage ?? "AI 模型服务请求失败";
  return "AI 模型服务暂时不可用";
}

function time(value: string | null): string {
  if (!value) return "—";
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

function schedule(model: RiskModelSummary): string {
  if (!model.policyEnabled || !model.scheduledLocalTime || !model.scheduleTimezone)
    return "训练策略未启用";
  return `每日 ${model.scheduledLocalTime.slice(0, 5)} ${model.scheduleTimezone}`;
}

function implementationLabel(model: RiskModelSummary): string {
  if (model.modelKind === "RISK_CLASSIFIER") return "内置可复现分类算法";
  return model.statusCode === "ACTIVE" ? "独立基座已接入" : "独立基座尚未接入";
}

export function RiskModelCenter() {
  const { message } = App.useApp();
  const [overview, setOverview] = useState<RiskModelOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOverview(
        await api.get<RiskModelOverview>("/api/v1/risk/models/overview"),
      );
      setError(null);
    } catch (loadError) {
      setError(modelError(loadError));
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => void load(), 15_000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [load]);

  async function requestTraining(model: RiskModelSummary) {
    setRequesting(model.modelId);
    try {
      await api.post(
        `/api/v1/risk/models/${model.modelId}/training-requests`,
        {},
      );
      void message.success("真实训练请求已入队，页面将持续回读运行状态");
      await load();
    } catch (requestError) {
      void message.error(modelError(requestError));
    } finally {
      setRequesting(null);
    }
  }

  const columns = useMemo<ColumnsType<RiskTrainingExecution>>(
    () => [
      {
        title: "模型",
        dataIndex: "modelName",
        ellipsis: true,
      },
      {
        title: "触发方式",
        dataIndex: "triggerCode",
        width: 96,
        render: (value: string) => (value === "DAILY" ? "每日自动" : "人工请求"),
      },
      {
        title: "状态",
        dataIndex: "statusCode",
        width: 128,
        render: (value: string) => {
          const state = executionStatus[value] ?? {
            label: value,
            badge: "default" as const,
          };
          return <Badge status={state.badge} text={state.label} />;
        },
      },
      {
        title: "真实结果",
        dataIndex: "outcomeMessage",
        render: (value: string | null) => value ?? "等待执行",
      },
      {
        title: "创建时间",
        dataIndex: "createdAt",
        width: 176,
        render: time,
      },
    ],
    [],
  );

  if (loading && !overview)
    return (
      <div className="risk-model-loading">
        <Spin tip="读取真实模型与训练运行" />
      </div>
    );

  return (
    <div className="risk-model-center">
      {error && (
        <Alert
          type="error"
          showIcon
          message="无法读取 AI 模型运行状态"
          description={error}
          action={
            <Button icon={<ReloadOutlined />} onClick={() => void load()}>
              重新连接
            </Button>
          }
        />
      )}
      <section className="risk-model-governance" aria-label="模型训练治理边界">
        <SafetyCertificateOutlined />
        <div>
          <strong>每日自动取数、训练、评估并生成候选版本</strong>
          <span>候选模型只能进入影子评估；系统数据库永久禁止自动上线。</span>
        </div>
        <Tag color="green">禁止自动上线</Tag>
      </section>
      <section className="risk-model-grid" aria-label="AI 模型清单">
        {!overview?.models.length ? (
          <Empty description="服务端没有登记 AI 模型" />
        ) : (
          overview.models.map((model) => {
            const trainable = model.statusCode === "ACTIVE" && model.policyEnabled;
            const state = model.lastExecutionStatus
              ? executionStatus[model.lastExecutionStatus]
              : null;
            return (
              <article className="risk-model-card" key={model.modelId}>
                <header>
                  <span className="risk-model-icon">
                    {model.modelKind === "DOMAIN_LLM" ? (
                      <ThunderboltOutlined />
                    ) : (
                      <ExperimentOutlined />
                    )}
                  </span>
                  <div>
                    <small>{modelKindLabels[model.modelKind] ?? model.modelKind}</small>
                    <h2>{model.modelName}</h2>
                  </div>
                  <Tag color={model.statusCode === "ACTIVE" ? "green" : "default"}>
                    {model.statusCode === "ACTIVE" ? "已启用" : "待配置"}
                  </Tag>
                </header>
                <dl>
                  <div>
                    <dt><ClockCircleOutlined /> 训练计划</dt>
                    <dd>{schedule(model)}</dd>
                  </div>
                  <div>
                    <dt><DatabaseOutlined /> 数据契约</dt>
                    <dd>
                      {model.policyEnabled
                        ? `${model.trainingWindowDays} 天窗口 · 至少 ${model.minimumNewLabels} 条新标签`
                        : "尚未批准训练策略"}
                    </dd>
                  </div>
                  <div>
                    <dt>当前候选</dt>
                    <dd>
                      {model.latestVersion
                        ? `v${model.latestVersion} · ${model.latestVersionStatus}`
                        : "尚未生成候选版本"}
                    </dd>
                  </div>
                  <div>
                    <dt>最近运行</dt>
                    <dd>
                      {state ? (
                        <Badge status={state.badge} text={state.label} />
                      ) : (
                        "尚无运行记录"
                      )}
                    </dd>
                  </div>
                </dl>
                {model.lastOutcomeMessage && (
                  <p className="risk-model-outcome">{model.lastOutcomeMessage}</p>
                )}
                <footer>
                  <span>实现方式：{implementationLabel(model)}</span>
                  <Button
                    type="primary"
                    disabled={!trainable}
                    loading={requesting === model.modelId}
                    onClick={() => void requestTraining(model)}
                  >
                    {trainable ? "立即训练" : "配置后可训练"}
                  </Button>
                </footer>
              </article>
            );
          })
        )}
      </section>
      <section className="risk-training-ledger" aria-label="训练运行记录">
        <header>
          <div>
            <strong>训练运行台账</strong>
            <small>快照、运行、结果和候选版本均来自服务端数据库</small>
          </div>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void load()}>
            刷新
          </Button>
        </header>
        <Table
          rowKey="executionId"
          columns={columns}
          dataSource={overview?.recentExecutions ?? []}
          pagination={false}
          size="small"
          locale={{ emptyText: "尚无真实训练运行" }}
          scroll={{ x: 820 }}
        />
      </section>
    </div>
  );
}
