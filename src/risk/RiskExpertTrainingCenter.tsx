import {
  AuditOutlined,
  Alert,
  App,
  Badge,
  Button,
  CloudUploadOutlined,
  type ColumnsType,
  DatabaseOutlined,
  Empty,
  ExperimentOutlined,
  FileProtectOutlined,
  Input,
  InputNumber,
  Popconfirm,
  Progress,
  ReloadOutlined,
  Select,
  Spin,
  StopOutlined,
  Table,
  Tag,
} from "@/shared/enterprise-ui/RiskWorkspaceUi";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createRealtimeApiClient,
  RealtimeApiError,
} from "@/platform/api/realtimeApiClient";

interface ExpertDatasetSnapshot {
  snapshotId: string;
  datasetId: string;
  version: number;
  datasetSha256: string;
  counts: Readonly<Record<"train" | "valid" | "test", number>>;
  qualityStatus: string;
  provenanceStatus: string;
  createdAt: string;
}

interface ExpertTrainingTask {
  taskId: string;
  datasetSnapshotId: string;
  status: string;
  modelReference: string;
  attemptCount: number;
  progressPercent: number;
  progressPhase: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  artifactReference: string | null;
  artifactSha256: string | null;
  cancellationRequestedBySubject: string | null;
  cancellationRequestedAt: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ExpertTrainingAuditEvent {
  eventId: string;
  taskId: string;
  actorType: string;
  actorId: string;
  eventCode: string;
  details: unknown;
  occurredAt: string;
}

interface ExpertTrainingOverview {
  datasets: ExpertDatasetSnapshot[];
  tasks: ExpertTrainingTask[];
  auditEvents: ExpertTrainingAuditEvent[];
}

interface DatasetDocumentSummary {
  value: Record<string, unknown>;
  datasetId: string;
  sourceCount: number;
  exampleCount: number;
}

interface ValidationError {
  row?: unknown;
  field?: unknown;
  message?: unknown;
}

interface TrainingConfig {
  iterations: number;
  maxSeqLength: number;
  numLayers: number;
  seed: number;
  learningRate: number;
}

const api = createRealtimeApiClient();
const endpoint = "/api/v1/risk/expert-training";
const initialConfig: TrainingConfig = {
  iterations: 100,
  maxSeqLength: 1024,
  numLayers: 8,
  seed: 42,
  learningRate: 0.00001,
};

const statusLabels: Readonly<Record<string, string>> = {
  QUEUED: "等待训练节点",
  RUNNING: "训练中",
  CANCEL_REQUESTED: "正在取消",
  CANCELLED: "已取消",
  SUCCEEDED: "训练成功",
  FAILED: "训练失败",
};

const auditLabels: Readonly<Record<string, string>> = {
  REQUESTED: "创建训练任务",
  CLAIMED: "训练节点领取",
  ARTIFACT_UPLOADED: "工件已上传",
  SUCCEEDED: "训练成功",
  FAILED: "训练失败",
  CANCEL_REQUESTED: "请求取消",
  CANCELLED: "取消完成",
  LEASE_RECOVERED: "离线任务已恢复排队",
};

function formatTime(value: string | null): string {
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

function shortHash(value: string | null): string {
  if (!value) return "—";
  return value.length > 16 ? `${value.slice(0, 12)}…${value.slice(-4)}` : value;
}

function taskStatus(value: string) {
  const badges: Readonly<
    Record<string, "default" | "processing" | "success" | "error" | "warning">
  > = {
    QUEUED: "default",
    RUNNING: "processing",
    CANCEL_REQUESTED: "warning",
    CANCELLED: "default",
    SUCCEEDED: "success",
    FAILED: "error",
  };
  return (
    <Badge
      status={badges[value] ?? "default"}
      text={statusLabels[value] ?? value}
    />
  );
}

function expertError(error: unknown): string {
  if (!(error instanceof RealtimeApiError)) return "专家训练服务暂时不可用";
  const known: Readonly<Record<string, string>> = {
    RISK_GLOBAL_MODEL_FORBIDDEN:
      "当前账号不是根管理员，不能访问全域专家训练管理",
    AUTHENTICATION_REQUIRED: "登录状态已失效，请重新登录后再试",
    EXPERT_DATASET_NOT_FOUND: "所选专家数据集快照已不存在，请刷新后重新选择",
    EXPERT_MODEL_IDENTITY_NOT_FOUND:
      "齐粮专家模型身份尚未配置，不能创建训练任务",
    EXPERT_TASK_IDEMPOTENCY_CONFLICT:
      "该幂等键已经用于另一项训练请求，请核对后更换",
  };
  return (
    known[error.code] ??
    error.clientMessage ??
    "专家训练请求失败，请联系系统管理员"
  );
}

function validationErrors(error: unknown): string[] {
  if (
    !(error instanceof RealtimeApiError) ||
    error.code !== "EXPERT_DATASET_INVALID"
  )
    return [];
  if (typeof error.details !== "object" || error.details === null) return [];
  const errors = (error.details as { errors?: unknown }).errors;
  if (!Array.isArray(errors)) return [];
  return errors.slice(0, 12).map((item) => {
    const value = item as ValidationError;
    const row =
      typeof value.row === "number" && value.row > 0
        ? `第 ${value.row} 行`
        : "数据集";
    const field =
      typeof value.field === "string" && value.field ? ` ${value.field}` : "";
    const reason =
      typeof value.message === "string" ? value.message : "校验失败";
    return `${row}${field}：${reason}`;
  });
}

function parseDatasetDocument(value: string): DatasetDocumentSummary {
  const parsed: unknown = JSON.parse(value);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("专家数据集文件顶层必须是 JSON 对象");
  }
  const document = parsed as Record<string, unknown>;
  const datasetId =
    typeof document.datasetId === "string" ? document.datasetId.trim() : "";
  if (!datasetId) throw new Error("专家数据集缺少 datasetId");
  if (!Array.isArray(document.sources))
    throw new Error("专家数据集缺少 sources 数组");
  if (!Array.isArray(document.examples))
    throw new Error("专家数据集缺少 examples 数组");
  return {
    value: document,
    datasetId,
    sourceCount: document.sources.length,
    exampleCount: document.examples.length,
  };
}

export function RiskExpertTrainingCenter() {
  const { message } = App.useApp();
  const fileInput = useRef<HTMLInputElement>(null);
  const [overview, setOverview] = useState<ExpertTrainingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [datasetDocument, setDatasetDocument] =
    useState<DatasetDocumentSummary | null>(null);
  const [datasetFileError, setDatasetFileError] = useState<string | null>(null);
  const [snapshotId, setSnapshotId] = useState<string>();
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [config, setConfig] = useState<TrainingConfig>(initialConfig);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [lastSuccessfulAt, setLastSuccessfulAt] = useState<Date | null>(null);
  const resolvedSnapshotId =
    snapshotId &&
    overview?.datasets.some((item) => item.snapshotId === snapshotId)
      ? snapshotId
      : undefined;

  const load = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    try {
      const next = await api.get<ExpertTrainingOverview>(
        `${endpoint}/overview`,
      );
      setOverview(next);
      setSnapshotId((current) =>
        current && next.datasets.some((item) => item.snapshotId === current)
          ? current
          : undefined,
      );
      setLastSuccessfulAt(new Date());
      setError(null);
      return true;
    } catch (loadError) {
      setError(expertError(loadError));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => void load(), 20_000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [load]);

  async function selectDataset(file: File | undefined) {
    setFileName(file?.name ?? null);
    setDatasetDocument(null);
    setDatasetFileError(null);
    setValidation([]);
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setDatasetFileError("JSON 文件超过 20 MB，未读取也未上传");
      return;
    }
    try {
      setDatasetDocument(parseDatasetDocument(await file.text()));
    } catch (parseError) {
      setDatasetFileError(
        parseError instanceof Error
          ? parseError.message
          : "无法解析专家数据集 JSON 文件",
      );
    }
  }

  async function registerDataset() {
    if (!datasetDocument || writing) return;
    setWriting(true);
    setValidation([]);
    try {
      await api.post<ExpertDatasetSnapshot>(
        `${endpoint}/datasets`,
        datasetDocument.value,
        { timeoutMs: 300_000 },
      );
      setDatasetDocument(null);
      setFileName(null);
      if (fileInput.current) fileInput.current.value = "";
      if (await load()) {
        void message.success(
          "数据集快照已登记；质量与来源用途状态请以台账为准",
        );
      } else {
        void message.warning(
          "数据集已登记，但权威台账回读失败，请重新读取确认",
        );
      }
    } catch (writeError) {
      setValidation(validationErrors(writeError));
      setError(expertError(writeError));
    } finally {
      setWriting(false);
    }
  }

  async function createTask() {
    if (!resolvedSnapshotId || !idempotencyKey.trim() || writing) return;
    setWriting(true);
    setValidation([]);
    try {
      await api.post<ExpertTrainingTask>(`${endpoint}/tasks`, {
        datasetSnapshotId: resolvedSnapshotId,
        idempotencyKey: idempotencyKey.trim(),
        config,
      });
      setIdempotencyKey("");
      if (await load()) {
        void message.success("专家训练任务已创建，并已从服务端重新读取确认");
      } else {
        void message.warning(
          "训练任务已创建，但权威台账回读失败，请重新读取确认",
        );
      }
    } catch (writeError) {
      setValidation(validationErrors(writeError));
      setError(expertError(writeError));
    } finally {
      setWriting(false);
    }
  }

  async function cancelTask(taskId: string) {
    setCancelling(taskId);
    try {
      await api.post<ExpertTrainingTask>(
        `${endpoint}/tasks/${taskId}/cancel`,
        {},
      );
      if (await load()) {
        void message.success("取消请求已提交，并已从服务端重新读取确认");
      } else {
        void message.warning(
          "取消请求已提交，但权威台账回读失败，请重新读取确认",
        );
      }
    } catch (cancelError) {
      setError(expertError(cancelError));
    } finally {
      setCancelling(null);
    }
  }

  const datasetById = useMemo(
    () =>
      new Map(
        (overview?.datasets ?? []).map((item) => [item.snapshotId, item]),
      ),
    [overview?.datasets],
  );
  const activeTasks = (overview?.tasks ?? []).filter((task) =>
    ["QUEUED", "RUNNING", "CANCEL_REQUESTED"].includes(task.status),
  ).length;

  const datasetColumns = useMemo<ColumnsType<ExpertDatasetSnapshot>>(
    () => [
      {
        title: "数据集",
        render: (_, row) => (
          <span className="risk-expert-primary-cell">
            <strong>{row.datasetId}</strong>
            <small>版本 {row.version}</small>
          </span>
        ),
      },
      {
        title: "训练 / 验证 / 测试",
        width: 156,
        render: (_, row) =>
          `${row.counts.train} / ${row.counts.valid} / ${row.counts.test}`,
      },
      {
        title: "质量与来源",
        width: 164,
        render: (_, row) => (
          <span className="risk-expert-tags">
            <Tag color={row.qualityStatus === "PASSED" ? "green" : "default"}>
              {row.qualityStatus}
            </Tag>
            <Tag
              color={row.provenanceStatus === "VERIFIED" ? "blue" : "default"}
            >
              {row.provenanceStatus}
            </Tag>
          </span>
        ),
      },
      {
        title: "内容指纹",
        dataIndex: "datasetSha256",
        width: 170,
        render: shortHash,
      },
      {
        title: "登记时间",
        dataIndex: "createdAt",
        width: 176,
        render: formatTime,
      },
    ],
    [],
  );

  const taskColumns: ColumnsType<ExpertTrainingTask> = [
    {
      title: "数据集",
      render: (_, row) => {
        const dataset = datasetById.get(row.datasetSnapshotId);
        return dataset
          ? `${dataset.datasetId} · v${dataset.version}`
          : shortHash(row.datasetSnapshotId);
      },
    },
    {
      title: "模型",
      dataIndex: "modelReference",
      width: 176,
    },
    { title: "状态", dataIndex: "status", width: 136, render: taskStatus },
    {
      title: "进度",
      width: 188,
      render: (_, row) => (
        <span className="risk-expert-progress">
          <Progress
            percent={row.progressPercent}
            size="small"
            status={row.status === "FAILED" ? "exception" : undefined}
          />
          <small>{row.progressPhase ?? "等待开始"}</small>
        </span>
      ),
    },
    { title: "尝试", dataIndex: "attemptCount", width: 70 },
    {
      title: "结果",
      width: 260,
      render: (_, row) => {
        if (row.failureCode || row.failureMessage) {
          return (
            <span className="risk-expert-primary-cell">
              <strong>{row.failureCode ?? "TRAINING_FAILED"}</strong>
              <small>{row.failureMessage ?? "训练失败，未返回具体原因"}</small>
            </span>
          );
        }
        if (!row.artifactReference) return "—";
        return (
          <span className="risk-expert-primary-cell">
            <strong title={row.artifactReference}>
              {row.artifactReference}
            </strong>
            <small title={row.artifactSha256 ?? undefined}>
              SHA-256 {shortHash(row.artifactSha256)}
            </small>
          </span>
        );
      },
    },
    {
      title: "取消记录",
      width: 240,
      render: (_, row) => {
        if (!row.cancellationRequestedAt && !row.cancelledAt) return "—";
        return (
          <span className="risk-expert-primary-cell">
            <strong>{row.cancelledAt ? "已取消" : "已提交取消请求"}</strong>
            <small>
              {row.cancellationRequestedBySubject ?? "系统"} ·{" "}
              {formatTime(row.cancelledAt ?? row.cancellationRequestedAt)}
            </small>
          </span>
        );
      },
    },
    {
      title: "更新时间",
      dataIndex: "updatedAt",
      width: 176,
      render: formatTime,
    },
    {
      title: "操作",
      width: 100,
      fixed: "right",
      render: (_, row) =>
        ["QUEUED", "RUNNING"].includes(row.status) ? (
          <Popconfirm
            title="确认取消这项真实训练任务？"
            description="排队任务会直接取消；运行中任务会通知训练节点安全停止。"
            okText="确认取消"
            cancelText="保留任务"
            onConfirm={() => void cancelTask(row.taskId)}
          >
            <Button
              danger
              size="small"
              icon={<StopOutlined />}
              loading={cancelling === row.taskId}
            >
              取消
            </Button>
          </Popconfirm>
        ) : (
          "—"
        ),
    },
  ];

  const auditColumns = useMemo<ColumnsType<ExpertTrainingAuditEvent>>(
    () => [
      {
        title: "事件",
        dataIndex: "eventCode",
        width: 180,
        render: (value: string) => auditLabels[value] ?? value,
      },
      { title: "任务", dataIndex: "taskId", render: shortHash },
      { title: "执行方", dataIndex: "actorType", width: 118 },
      { title: "执行身份", dataIndex: "actorId", ellipsis: true },
      {
        title: "发生时间",
        dataIndex: "occurredAt",
        width: 176,
        render: formatTime,
      },
    ],
    [],
  );

  if (loading && !overview) {
    return (
      <div className="risk-model-loading">
        <Spin tip="读取真实专家训练台账" />
      </div>
    );
  }

  return (
    <div className="risk-expert-center">
      {error && (
        <Alert
          type="error"
          showIcon
          message="专家训练管理请求未完成"
          description={error}
          action={
            <Button icon={<ReloadOutlined />} onClick={() => void load()}>
              重新读取
            </Button>
          }
        />
      )}
      <section className="risk-expert-boundary" aria-label="专家训练治理边界">
        <FileProtectOutlined />
        <div>
          <strong>数据集登记不代表质量评测或训练用途审查通过</strong>
          <span>
            服务端比对来源登记状态和内容哈希；资料权利、目标用途及专家质量仍须分别审查。
          </span>
        </div>
        <Tag color="blue">根管理员专属</Tag>
      </section>

      <section className="risk-expert-facts" aria-label="专家训练实时概况">
        <article>
          <DatabaseOutlined />
          <span>
            <small>已登记数据集</small>
            <strong>{overview ? overview.datasets.length : "—"}</strong>
          </span>
        </article>
        <article>
          <ExperimentOutlined />
          <span>
            <small>活跃训练任务</small>
            <strong>{overview ? activeTasks : "—"}</strong>
          </span>
        </article>
        <article>
          <AuditOutlined />
          <span>
            <small>审计事件</small>
            <strong>{overview ? overview.auditEvents.length : "—"}</strong>
          </span>
        </article>
        <Button
          icon={<ReloadOutlined />}
          loading={loading}
          onClick={() => void load()}
        >
          刷新权威状态
        </Button>
        <span className="risk-expert-refresh-state">
          <Tag
            color={
              error
                ? overview
                  ? "orange"
                  : "red"
                : overview
                  ? "green"
                  : "default"
            }
          >
            {error
              ? overview
                ? "显示上次成功快照"
                : "权威台账读取失败"
              : overview
                ? "权威台账已同步"
                : "等待权威台账"}
          </Tag>
          <small>
            {lastSuccessfulAt
              ? `最近成功读取 ${formatTime(lastSuccessfulAt.toISOString())}`
              : "尚未成功读取"}
          </small>
        </span>
      </section>

      <section className="risk-expert-actions" aria-label="专家训练操作">
        <article>
          <header>
            <CloudUploadOutlined />
            <div>
              <strong>登记数据集快照</strong>
              <small>
                选择本地 JSON 后先预读，最终以服务端逐行校验结果为准
              </small>
            </div>
          </header>
          <label className="risk-expert-file">
            <span>{fileName ?? "选择专家数据集 JSON 文件"}</span>
            <input
              ref={fileInput}
              type="file"
              accept=".json,application/json"
              aria-label="选择专家数据集 JSON 文件"
              onChange={(event) => void selectDataset(event.target.files?.[0])}
            />
          </label>
          {datasetDocument && (
            <dl className="risk-expert-file-summary">
              <div>
                <dt>数据集标识</dt>
                <dd>{datasetDocument.datasetId}</dd>
              </div>
              <div>
                <dt>来源数</dt>
                <dd>{datasetDocument.sourceCount}</dd>
              </div>
              <div>
                <dt>样本数</dt>
                <dd>{datasetDocument.exampleCount}</dd>
              </div>
            </dl>
          )}
          {datasetFileError && (
            <Alert type="error" showIcon message={datasetFileError} />
          )}
          <Button
            type="primary"
            disabled={!datasetDocument}
            loading={writing}
            onClick={() => void registerDataset()}
          >
            校验并登记数据集
          </Button>
        </article>

        <article>
          <header>
            <ExperimentOutlined />
            <div>
              <strong>创建训练任务</strong>
              <small>明确选择不可变快照，并填写可重试的唯一幂等键</small>
            </div>
          </header>
          <label className="risk-expert-field">
            <span>数据集快照</span>
            <Select
              aria-label="专家数据集快照"
              value={resolvedSnapshotId}
              placeholder={
                overview?.datasets.length
                  ? "请选择已登记的数据集快照"
                  : "尚无可用数据集"
              }
              disabled={!overview?.datasets.length}
              onChange={setSnapshotId}
              options={(overview?.datasets ?? []).map((item) => ({
                value: item.snapshotId,
                label: `${item.datasetId} · v${item.version}`,
              }))}
            />
          </label>
          <label className="risk-expert-field">
            <span>幂等键</span>
            <Input
              aria-label="训练请求幂等键"
              value={idempotencyKey}
              maxLength={120}
              placeholder="例如 expert-run-20260922-01"
              onChange={(event) => setIdempotencyKey(event.target.value)}
            />
          </label>
          <div className="risk-expert-config">
            <label>
              <span>迭代次数</span>
              <InputNumber
                min={1}
                max={1000}
                value={config.iterations}
                onChange={(value) =>
                  setConfig((current) => ({
                    ...current,
                    iterations: value ?? initialConfig.iterations,
                  }))
                }
              />
            </label>
            <label>
              <span>最大序列</span>
              <InputNumber
                min={256}
                max={2048}
                step={256}
                value={config.maxSeqLength}
                onChange={(value) =>
                  setConfig((current) => ({
                    ...current,
                    maxSeqLength: value ?? initialConfig.maxSeqLength,
                  }))
                }
              />
            </label>
            <label>
              <span>层数</span>
              <InputNumber
                min={1}
                max={8}
                value={config.numLayers}
                onChange={(value) =>
                  setConfig((current) => ({
                    ...current,
                    numLayers: value ?? initialConfig.numLayers,
                  }))
                }
              />
            </label>
            <label>
              <span>随机种子</span>
              <InputNumber
                min={0}
                max={2147483647}
                value={config.seed}
                onChange={(value) =>
                  setConfig((current) => ({
                    ...current,
                    seed: value ?? initialConfig.seed,
                  }))
                }
              />
            </label>
            <label>
              <span>学习率</span>
              <InputNumber
                min={0.000001}
                max={0.0001}
                step={0.000001}
                stringMode={false}
                value={config.learningRate}
                onChange={(value) =>
                  setConfig((current) => ({
                    ...current,
                    learningRate: value ?? initialConfig.learningRate,
                  }))
                }
              />
            </label>
          </div>
          <Button
            type="primary"
            disabled={!resolvedSnapshotId || !idempotencyKey.trim()}
            loading={writing}
            onClick={() => void createTask()}
          >
            创建训练任务
          </Button>
        </article>
      </section>

      {validation.length > 0 && (
        <Alert
          type="error"
          showIcon
          message="服务端拒绝了本次请求"
          description={
            <ul className="risk-expert-errors">
              {validation.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          }
        />
      )}

      <section className="risk-training-ledger" aria-label="专家数据集台账">
        <header>
          <div>
            <strong>专家数据集登记台账</strong>
            <small>结构校验不代表质量评测或来源使用权通过</small>
          </div>
        </header>
        <Table
          rowKey="snapshotId"
          columns={datasetColumns}
          dataSource={overview?.datasets ?? []}
          pagination={false}
          size="small"
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  overview ? "当前尚未登记专家数据集" : "尚未取得专家数据集台账"
                }
              />
            ),
          }}
          scroll={{ x: 880 }}
        />
      </section>
      <section className="risk-training-ledger" aria-label="专家训练任务台账">
        <header>
          <div>
            <strong>专家训练任务</strong>
            <small>状态、进度、失败原因与工件引用均来自生产服务端</small>
          </div>
        </header>
        <Table
          rowKey="taskId"
          columns={taskColumns}
          dataSource={overview?.tasks ?? []}
          pagination={false}
          size="small"
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  overview
                    ? "当前尚未创建专家训练任务"
                    : "尚未取得专家训练任务台账"
                }
              />
            ),
          }}
          scroll={{ x: 1580 }}
        />
      </section>
      <section className="risk-training-ledger" aria-label="专家训练审计台账">
        <header>
          <div>
            <strong>专家训练审计</strong>
            <small>业务人员、训练节点与系统恢复动作统一留痕</small>
          </div>
        </header>
        <Table
          rowKey="eventId"
          columns={auditColumns}
          dataSource={overview?.auditEvents ?? []}
          pagination={false}
          size="small"
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  overview
                    ? "当前尚无专家训练审计事件"
                    : "尚未取得专家训练审计台账"
                }
              />
            ),
          }}
          scroll={{ x: 820 }}
        />
      </section>
    </div>
  );
}
