import { describe, expect, it, vi } from "vitest";

import type {
  ProductionImportJob,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";

import {
  awaitBusinessImport,
  businessImportMessage,
} from "./businessImportWorkflow";

const job = (
  statusCode: ProductionImportJob["statusCode"],
): ProductionImportJob => ({
  id: "import-1",
  domainCode: "PRODUCTION",
  statusCode,
  importedRows: statusCode === "COMPLETED" ? 2 : 0,
  failedRows: 0,
  attemptCount: statusCode === "PROCESSING" ? 1 : 0,
});

describe("business import workflow", () => {
  it("follows a durable queued job until its terminal result", async () => {
    const getImportJob = vi
      .fn()
      .mockResolvedValueOnce(job("PROCESSING"))
      .mockResolvedValueOnce(job("COMPLETED"));
    const updates: ProductionImportJob[] = [];

    const result = await awaitBusinessImport({
      repository: { getImportJob } as unknown as RealtimeBusinessRepository,
      domain: "production",
      initial: job("QUEUED"),
      onUpdate: (next) => updates.push(next),
      wait: () => Promise.resolve(),
    });

    expect(result.statusCode).toBe("COMPLETED");
    expect(updates.map(({ statusCode }) => statusCode)).toEqual([
      "QUEUED",
      "PROCESSING",
      "COMPLETED",
    ]);
    expect(getImportJob).toHaveBeenCalledTimes(2);
  });

  it("presents business-only progress and terminal messages", () => {
    expect(businessImportMessage(job("QUEUED"))).toBe(
      "批量导入已提交，正在排队处理。",
    );
    expect(businessImportMessage(job("PROCESSING"))).toBe(
      "批量数据正在导入，请稍候。",
    );
    expect(businessImportMessage(job("COMPLETED"))).toBe(
      "导入完成：2 行已保存到填报草稿，失败 0 行。",
    );
    expect(
      businessImportMessage({
        ...job("FAILED"),
        failureMessage: "文件中的调查日期无效",
      }),
    ).toBe("导入未完成：文件中的调查日期无效");
  });
});
