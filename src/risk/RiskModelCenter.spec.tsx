import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App } from "antd";
import { describe, expect, it, vi } from "vitest";
import type * as RealtimeApiClientModule from "@/platform/api/realtimeApiClient";
import { RiskModelCenter } from "./RiskModelCenter";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

mocks.get.mockResolvedValue({
  models: [
    {
      modelId: "21500000-0000-0000-0000-000000000001",
      modelName: "风险案例领域分类模型",
      modelKind: "RISK_CLASSIFIER",
      domainCode: "CROSS_DOMAIN",
      statusCode: "ACTIVE",
      policyEnabled: true,
      scheduledLocalTime: "02:15:00",
      scheduleTimezone: "Asia/Shanghai",
      trainingWindowDays: 90,
      minimumNewLabels: 10,
      automaticCandidateEnabled: true,
      autoActivationEnabled: true,
      lastScheduledDate: null,
      lastExecutionStatus: null,
      lastOutcomeCode: null,
      lastOutcomeMessage: null,
      lastCompletedAt: null,
      latestVersion: null,
      latestVersionStatus: null,
    },
  ],
  recentExecutions: [],
  recentActivationEvents: [
    {
      eventId: "21600000-0000-0000-0000-000000000099",
      modelId: "21500000-0000-0000-0000-000000000001",
      modelName: "风险案例领域分类模型",
      fromVersion: null,
      toVersion: 1,
      eventCode: "AUTO_ACTIVATED",
      reasonCode: "PROMOTION_GATES_PASSED",
      occurredAt: "2026-09-21T03:20:00Z",
    },
  ],
  readAt: "2026-09-21T03:00:00Z",
});
mocks.post.mockResolvedValue({
  executionId: "21500000-0000-0000-0000-000000000099",
  modelId: "21500000-0000-0000-0000-000000000001",
  statusCode: "QUEUED",
  createdAt: "2026-09-21T03:00:00Z",
});

vi.mock("@/platform/api/realtimeApiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof RealtimeApiClientModule>();
  return {
    ...actual,
    createRealtimeApiClient: () => ({ get: mocks.get, post: mocks.post }),
  };
});

describe("RiskModelCenter", () => {
  it("shows only server-backed policy and queues a real training request", async () => {
    render(
      <App>
        <RiskModelCenter />
      </App>,
    );

    expect(await screen.findAllByText("风险案例领域分类模型")).toHaveLength(2);
    expect(screen.getByText("每日 02:15 Asia/Shanghai")).toBeInTheDocument();
    expect(screen.getByText("自动受控上线")).toBeInTheDocument();
    expect(screen.getByText(/真实影子结果达到门槛后自动灰度切换/)).toBeInTheDocument();
    expect(screen.queryByText("禁止自动上线")).not.toBeInTheDocument();
    expect(screen.getByText("自动晋级记录")).toBeInTheDocument();
    expect(screen.getByText("自动上线 v1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "立即训练" }));
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith(
        "/api/v1/risk/models/21500000-0000-0000-0000-000000000001/training-requests",
        {},
      ),
    );
  });
});
