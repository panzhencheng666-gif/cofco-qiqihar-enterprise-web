import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as RealtimeApiClientModule from "@/platform/api/realtimeApiClient";
import { App } from "@/shared/enterprise-ui/RiskWorkspaceUi";
import { RiskExpertTrainingCenter } from "./RiskExpertTrainingCenter";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("@/platform/api/realtimeApiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof RealtimeApiClientModule>();
  return {
    ...actual,
    createRealtimeApiClient: () => ({ get: mocks.get, post: mocks.post }),
  };
});

const emptyOverview = { datasets: [], tasks: [], auditEvents: [] };

beforeEach(() => {
  mocks.get.mockResolvedValue(emptyOverview);
  mocks.post.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  mocks.get.mockReset();
  mocks.post.mockReset();
  vi.restoreAllMocks();
});

describe("RiskExpertTrainingCenter", () => {
  it("reads the authoritative overview and renders explicit empty states", async () => {
    render(
      <App>
        <RiskExpertTrainingCenter />
      </App>,
    );

    expect(
      await screen.findByText("当前尚未登记专家数据集"),
    ).toBeInTheDocument();
    expect(screen.getByText("当前尚未创建专家训练任务")).toBeInTheDocument();
    expect(screen.getByText("当前尚无专家训练审计事件")).toBeInTheDocument();
    expect(
      screen.getByText("数据集登记不代表质量评测或训练用途审查通过"),
    ).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledWith(
      "/api/v1/risk/expert-training/overview",
    );
    expect(screen.queryByText(/示例任务|演示数据/u)).not.toBeInTheDocument();
  });

  it("registers the selected JSON document unchanged and requeries the overview", async () => {
    const dataset = {
      schemaVersion: 1,
      datasetId: "qiliang-expert-2026-09",
      sources: [{ sourceId: "source-1" }],
      examples: [{ exampleId: "example-1" }],
    };
    const file = new File([JSON.stringify(dataset)], "expert-dataset.json", {
      type: "application/json",
    });
    Object.defineProperty(file, "text", {
      value: () => Promise.resolve(JSON.stringify(dataset)),
    });
    mocks.post.mockResolvedValueOnce({
      snapshotId: "22000000-0000-0000-0000-000000000001",
      datasetId: dataset.datasetId,
      version: 1,
      datasetSha256: "a".repeat(64),
      counts: { train: 1, valid: 1, test: 1 },
      qualityStatus: "PASSED",
      provenanceStatus: "VERIFIED",
      createdAt: "2026-09-22T03:00:00Z",
    });

    render(
      <App>
        <RiskExpertTrainingCenter />
      </App>,
    );
    await screen.findByText("当前尚未登记专家数据集");
    fireEvent.change(screen.getByLabelText("选择专家数据集 JSON 文件"), {
      target: { files: [file] },
    });
    expect(
      await screen.findByText("qiliang-expert-2026-09"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "校验并登记数据集" }));

    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith(
        "/api/v1/risk/expert-training/datasets",
        dataset,
        { timeoutMs: 300_000 },
      ),
    );
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
  });

  it("creates a task from an authoritative snapshot with an explicit idempotency key", async () => {
    mocks.get.mockResolvedValue({
      datasets: [
        {
          snapshotId: "22000000-0000-0000-0000-000000000001",
          datasetId: "qiliang-expert-2026-09",
          version: 1,
          datasetSha256: "a".repeat(64),
          counts: { train: 12, valid: 3, test: 3 },
          qualityStatus: "PASSED",
          provenanceStatus: "VERIFIED",
          createdAt: "2026-09-22T03:00:00Z",
        },
      ],
      tasks: [],
      auditEvents: [],
    });
    mocks.post.mockResolvedValueOnce({ taskId: "task-1", status: "QUEUED" });

    render(
      <App>
        <RiskExpertTrainingCenter />
      </App>,
    );
    expect(
      await screen.findByText("qiliang-expert-2026-09"),
    ).toBeInTheDocument();
    const createButton = screen.getByRole("button", {
      name: "创建训练任务",
    });
    expect(createButton).toBeDisabled();
    fireEvent.mouseDown(
      screen.getByRole("combobox", { name: "专家数据集快照" }),
    );
    fireEvent.click(await screen.findByTitle("qiliang-expert-2026-09 · v1"));
    fireEvent.change(screen.getByLabelText("训练请求幂等键"), {
      target: { value: "expert-run-20260922-01" },
    });
    fireEvent.click(createButton);

    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith(
        "/api/v1/risk/expert-training/tasks",
        {
          datasetSnapshotId: "22000000-0000-0000-0000-000000000001",
          idempotencyKey: "expert-run-20260922-01",
          config: {
            iterations: 100,
            maxSeqLength: 1024,
            numLayers: 8,
            seed: 42,
            learningRate: 0.00001,
          },
        },
      ),
    );
  });

  it("requires confirmation before cancelling a queued production task", async () => {
    mocks.get.mockResolvedValue({
      datasets: [],
      tasks: [
        {
          taskId: "22000000-0000-0000-0000-000000000099",
          datasetSnapshotId: "22000000-0000-0000-0000-000000000001",
          status: "QUEUED",
          modelReference: "qiliang-risk-llm-v1",
          attemptCount: 0,
          progressPercent: 0,
          progressPhase: null,
          failureCode: null,
          failureMessage: null,
          artifactReference: null,
          artifactSha256: null,
          cancellationRequestedBySubject: null,
          cancellationRequestedAt: null,
          cancelledAt: null,
          completedAt: null,
          createdAt: "2026-09-22T03:00:00Z",
          updatedAt: "2026-09-22T03:00:00Z",
        },
      ],
      auditEvents: [],
    });
    mocks.post.mockResolvedValueOnce({ status: "CANCELLED" });

    render(
      <App>
        <RiskExpertTrainingCenter />
      </App>,
    );
    expect(await screen.findByText("等待训练节点")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /取消/u }));
    fireEvent.click(await screen.findByRole("button", { name: "确认取消" }));

    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith(
        "/api/v1/risk/expert-training/tasks/22000000-0000-0000-0000-000000000099/cancel",
        {},
      ),
    );
  });

  it("distinguishes an unavailable overview from a confirmed empty ledger", async () => {
    mocks.get.mockRejectedValueOnce(new Error("network unavailable"));

    render(
      <App>
        <RiskExpertTrainingCenter />
      </App>,
    );

    expect(
      await screen.findByText("专家训练管理请求未完成"),
    ).toBeInTheDocument();
    expect(screen.getByText("权威台账读取失败")).toBeInTheDocument();
    expect(screen.queryByText("权威台账已同步")).not.toBeInTheDocument();
    expect(screen.getByText("尚未取得专家数据集台账")).toBeInTheDocument();
    expect(screen.getByText("尚未取得专家训练任务台账")).toBeInTheDocument();
    expect(screen.getByText("尚未取得专家训练审计台账")).toBeInTheDocument();
    expect(
      screen.queryByText("当前尚未登记专家数据集"),
    ).not.toBeInTheDocument();
  });
});
