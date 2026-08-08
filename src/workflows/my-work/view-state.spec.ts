import { describe, expect, it } from "vitest";
import {
  buildMyWorkSummary,
  filterMyWork,
  resolveMyWorkViewState,
} from "./view-state";
import type { MyWorkItem } from "./model";

const items: readonly MyWorkItem[] = [
  {
    id: "work-1",
    taskId: "task-1",
    kind: "审核",
    title: "玉米市场日报区域复核",
    businessModule: "市场监测",
    regionName: "齐齐哈尔市",
    dueAt: "2026-07-31T12:00:00+08:00",
    deadlineOwnerName: "王洋",
    obligationStatus: "进行中",
    timeliness: "按时提交",
    documentStatus: "审核中",
    qualityStatus: "通过",
    documentPath: "/objects/site-1/documents/document-1",
  },
  {
    id: "work-2",
    taskId: "task-2",
    kind: "异常处置",
    title: "大豆农户样本质量修正",
    businessModule: "产情监测",
    regionName: "讷河市",
    dueAt: "2026-07-31T16:30:00+08:00",
    deadlineOwnerName: "李敏",
    obligationStatus: "进行中",
    timeliness: "按时提交",
    documentStatus: "已退回",
    qualityStatus: "阻断",
    documentPath: "/objects/farmer-1/documents/document-2",
  },
  {
    id: "work-3",
    taskId: "task-3",
    kind: "填报",
    title: "水稻余粮月度调查",
    businessModule: "产情监测",
    regionName: "龙江县",
    dueAt: "2026-07-30T17:00:00+08:00",
    deadlineOwnerName: "李敏",
    obligationStatus: "已到期",
    timeliness: "仍未提交",
    documentStatus: "草稿",
    qualityStatus: "警告",
    documentPath: "/objects/farmer-2/documents/document-3",
  },
  {
    id: "work-4",
    taskId: "task-4",
    kind: "发布",
    title: "玉米供需结果发布",
    businessModule: "市场监测",
    regionName: "齐齐哈尔市",
    dueAt: "2026-07-29T17:00:00+08:00",
    deadlineOwnerName: "赵晨",
    obligationStatus: "已关闭",
    timeliness: "按时提交",
    documentStatus: "已发布",
    qualityStatus: "通过",
    documentPath: "/objects/site-1/documents/document-4",
  },
];

describe("my work view state", () => {
  it("summarizes the authoritative work projection without inventing business state", () => {
    expect(buildMyWorkSummary(items)).toEqual({
      pending: 3,
      qualityBlocking: 1,
      overdue: 1,
      completed: 1,
    });
  });

  it("projects each contextual work view from the same authoritative queue", () => {
    expect(filterMyWork(items, "reporting").map((item) => item.id)).toEqual([
      "work-3",
    ]);
    expect(filterMyWork(items, "review").map((item) => item.id)).toEqual([
      "work-1",
    ]);
    expect(filterMyWork(items, "exception").map((item) => item.id)).toEqual([
      "work-2",
      "work-3",
    ]);
    expect(filterMyWork(items, "completed").map((item) => item.id)).toEqual([
      "work-4",
    ]);
    expect(filterMyWork(items, "unknown").map((item) => item.id)).toEqual(
      items.map((item) => item.id),
    );
  });

  it("distinguishes loading, failure, empty and ready states", () => {
    expect(
      resolveMyWorkViewState({
        isLoading: true,
        isError: false,
        itemCount: 0,
      }),
    ).toBe("loading");
    expect(
      resolveMyWorkViewState({
        isLoading: false,
        isError: true,
        itemCount: 0,
      }),
    ).toBe("error");
    expect(
      resolveMyWorkViewState({
        isLoading: false,
        isError: false,
        itemCount: 0,
      }),
    ).toBe("empty");
    expect(
      resolveMyWorkViewState({
        isLoading: false,
        isError: false,
        itemCount: items.length,
      }),
    ).toBe("ready");
  });
});
