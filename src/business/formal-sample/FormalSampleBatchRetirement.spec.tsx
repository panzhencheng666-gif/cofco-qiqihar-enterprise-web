import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import type { RealtimeBusinessRepository } from "@/platform/api/realtimeBusinessRepository";
import { RealtimeApiError } from "@/platform/api/realtimeApiClient";
import { FormalSampleBatchRetirement } from "./FormalSampleBatchRetirement";

afterEach(cleanup);
const preview = {
  id: "preview-one",
  businessDate: "2026-09-08",
  expiresAt: "2026-09-08T08:00:00Z",
  candidateCount: 123,
  candidates: [
    { id: "sample-one", name: "测试样本", regionCode: "230202", version: 1 },
  ],
  reason: null,
  retiredCount: null,
};

it("requires full-scope confirmation and recovers the receipt after a lost execution response", async () => {
  const done = vi.fn().mockResolvedValue(undefined);
  const execute = vi.fn().mockRejectedValue(new Error("connection lost"));
  const get = vi
    .fn()
    .mockResolvedValue({ ...preview, retiredCount: 123, reason: "停止经营" });
  const repository = {
    previewFormalSampleRetirement: vi.fn().mockResolvedValue(preview),
    executeFormalSampleRetirement: execute,
    getFormalSampleRetirementPreview: get,
  } as unknown as RealtimeBusinessRepository;
  render(
    <FormalSampleBatchRetirement
      repository={repository}
      regions={[]}
      disabled={false}
      onCompleted={done}
    />,
  );
  await userEvent.click(
    screen.getByRole("button", { name: "批量淘汰现有样本" }),
  );
  expect(await screen.findByText(/共 123 个样本/)).toBeVisible();
  expect(screen.getByRole("button", { name: "确认批量淘汰" })).toBeDisabled();
  await userEvent.type(screen.getByLabelText("批量淘汰原因"), "停止经营");
  await userEvent.click(screen.getByRole("checkbox"));
  await userEvent.click(screen.getByRole("button", { name: "确认批量淘汰" }));
  expect(await screen.findByRole("status")).toHaveTextContent(
    "已淘汰 123 个样本",
  );
  expect(execute).toHaveBeenCalledExactlyOnceWith("preview-one", "停止经营");
  expect(get).toHaveBeenCalledExactlyOnceWith("preview-one");
  expect(done).toHaveBeenCalledOnce();
});

it("keeps a successful receipt when refreshing the ledger fails", async () => {
  const repository = {
    previewFormalSampleRetirement: vi.fn().mockResolvedValue(preview),
    executeFormalSampleRetirement: vi
      .fn()
      .mockResolvedValue({ ...preview, retiredCount: 123 }),
    getFormalSampleRetirementPreview: vi.fn(),
  } as unknown as RealtimeBusinessRepository;
  render(
    <FormalSampleBatchRetirement
      repository={repository}
      regions={[]}
      disabled={false}
      onCompleted={vi.fn().mockRejectedValue(new Error("refresh failed"))}
    />,
  );
  await userEvent.click(
    screen.getByRole("button", { name: "批量淘汰现有样本" }),
  );
  await userEvent.type(
    await screen.findByLabelText("批量淘汰原因"),
    "停止经营",
  );
  await userEvent.click(screen.getByRole("checkbox"));
  await userEvent.click(screen.getByRole("button", { name: "确认批量淘汰" }));
  expect(await screen.findByRole("status")).toHaveTextContent(
    "已淘汰 123 个样本，但列表刷新失败",
  );
  expect(
    screen.queryByRole("button", { name: "确认批量淘汰" }),
  ).not.toBeInTheDocument();
});

it("releases a definitively rejected preview so the user can leave and recheck permissions", async () => {
  const denied = new RealtimeApiError({
    status: 403,
    code: "ACCESS_PERMISSION_DENIED",
    message: "权限已变化",
  });
  const repository = {
    previewFormalSampleRetirement: vi.fn().mockResolvedValue(preview),
    executeFormalSampleRetirement: vi.fn().mockRejectedValue(denied),
    getFormalSampleRetirementPreview: vi.fn().mockRejectedValue(denied),
  } as unknown as RealtimeBusinessRepository;
  render(
    <FormalSampleBatchRetirement
      repository={repository}
      regions={[]}
      disabled={false}
      onCompleted={vi.fn()}
    />,
  );
  await userEvent.click(
    screen.getByRole("button", { name: "批量淘汰现有样本" }),
  );
  await userEvent.type(
    await screen.findByLabelText("批量淘汰原因"),
    "停止经营",
  );
  await userEvent.click(screen.getByRole("checkbox"));
  await userEvent.click(screen.getByRole("button", { name: "确认批量淘汰" }));
  expect(await screen.findByRole("status")).toHaveTextContent("权限已变化");
  expect(
    screen.getByRole("button", { name: "批量淘汰现有样本" }),
  ).toBeEnabled();
  expect(
    screen.queryByLabelText("批量淘汰现有样本确认"),
  ).not.toBeInTheDocument();
});
