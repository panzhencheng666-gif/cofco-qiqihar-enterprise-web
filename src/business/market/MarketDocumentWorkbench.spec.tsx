import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import type { BusinessWorkItem } from "../core/businessWork";
import { businessWorkFixtures } from "../data/businessWorkFixtures";
import { marketDocumentFixtures } from "../data/marketDocumentFixtures";
import { MarketDocumentWorkbench } from "./MarketDocumentWorkbench";

afterEach(cleanup);

function requireBaseItem(): BusinessWorkItem {
  const found = businessWorkFixtures.find(
    ({ workId }) => workId === "WORK-MARKET-FILL-W31",
  );
  if (!found) throw new Error("市场任务测试数据缺失");
  return found;
}

function requireBaseDocument() {
  const found = marketDocumentFixtures.find(
    ({ workId }) => workId === "WORK-MARKET-FILL-W31",
  );
  if (!found) throw new Error("市场单据测试数据缺失");
  return found;
}

const baseItem = requireBaseItem();
const baseDocument = requireBaseDocument();

function readyItem(
  overrides: Partial<BusinessWorkItem> = {},
): BusinessWorkItem {
  return {
    ...baseItem,
    completedFields: baseItem.applicableFields,
    qualityStatus: "passed",
    qualityHistory: [],
    ...overrides,
  };
}

function renderWorkbench(
  item = readyItem(),
  actor = {
    userId: item.responsibleUserId,
    displayName: item.responsiblePerson,
    canRelease: false,
  },
) {
  return render(
    <MarketDocumentWorkbench
      actor={actor}
      document={baseDocument}
      item={item}
    />,
  );
}

function submittedItem(
  overrides: Partial<BusinessWorkItem> = {},
): BusinessWorkItem {
  return readyItem({
    documentStatus: "submitted",
    reviewStatus: "pending",
    submissionHistory: [
      {
        submissionVersionId: "TEST-SUBMISSION-1",
        submittedBy: baseItem.responsiblePerson,
        submittedAt: "2026-07-31T15:00:00+08:00",
        kind: "initial",
        replacesSubmissionVersionId: null,
      },
    ],
    ...overrides,
  });
}

describe("market document workbench lifecycle actions", () => {
  it("organizes applicable fields into business chapters and confirms by chapter", () => {
    render(
      <MarketDocumentWorkbench
        actor={{
          userId: baseItem.responsibleUserId,
          displayName: baseItem.responsiblePerson,
          canRelease: false,
        }}
        document={baseDocument}
        item={baseItem}
      />,
    );

    for (const chapter of [
      "报价与成交",
      "质量",
      "库存与仓储",
      "销售",
      "来源与校验",
    ]) {
      expect(screen.getByRole("heading", { name: chapter })).toBeVisible();
    }
    expect(
      screen.queryByRole("heading", { name: "加工与转化" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "直接使用" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^确认字段：/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /确认.+章节来源值/ }).length,
    ).toBeGreaterThan(0);
  });

  it("turns the default 18-of-26 task into a complete, shared submission without losing its history", async () => {
    const user = userEvent.setup();
    let sharedItem = baseItem;
    render(
      <MarketDocumentWorkbench
        actor={{
          userId: baseItem.responsibleUserId,
          displayName: baseItem.responsiblePerson,
          canRelease: false,
        }}
        document={baseDocument}
        item={baseItem}
        onItemChange={(next) => {
          sharedItem = next;
        }}
      />,
    );

    expect(screen.getByText("18/26 项")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "执行提交前检查" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "还有 8 项来源值待责任人确认",
    );
    while (
      screen.queryAllByRole("button", { name: /确认.+章节来源值/ }).length > 0
    ) {
      await user.click(
        screen.getAllByRole("button", { name: /确认.+章节来源值/ })[0],
      );
    }
    expect(screen.getByText("26/26 项")).toBeVisible();
    expect(sharedItem.completedFields).toBe(26);

    await user.click(screen.getByRole("button", { name: "执行提交前检查" }));
    expect(screen.getByRole("status")).toHaveTextContent("提交前检查已通过");
    await user.click(screen.getByRole("button", { name: "提交审核" }));
    expect(sharedItem.documentStatus).toBe("submitted");
    expect(sharedItem.submissionHistory).toHaveLength(1);
    expect(sharedItem.submissionHistory[0]?.submittedBy).toBe("王洋");
  });

  it("edits online fields and saves a local draft without implying submission", async () => {
    const user = userEvent.setup();
    renderWorkbench();

    const quote = screen.getByRole("textbox", { name: "采购价" });
    await user.clear(quote);
    await user.type(quote, "2,400");
    expect(screen.getByRole("status")).toHaveTextContent(
      "字段已修改，请重新执行提交前检查",
    );

    await user.click(screen.getByRole("button", { name: "保存草稿" }));

    expect(quote).toHaveValue("2,400");
    expect(screen.getByRole("status")).toHaveTextContent(
      "草稿已保存在当前页面，尚未提交审核",
    );
    expect(screen.getByText(/最近保存：刚刚/)).toBeVisible();
    expect(screen.getByLabelText("任务五状态")).toHaveTextContent("草稿");
  });

  it("completes the governed four-step spreadsheet import without bypassing review", async () => {
    const user = userEvent.setup();
    renderWorkbench();

    await user.click(screen.getByRole("button", { name: "电子表格批量导入" }));
    expect(
      screen.getByRole("link", { name: "下载当前任务模板" }),
    ).toHaveAttribute("download", "市场监测任务导入模板.csv");
    const file = new File(["表头,数据"], "市场采集表.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    await user.upload(screen.getByLabelText("选择待校验文件"), file);

    expect(screen.getByRole("status")).toHaveTextContent(
      "已选择市场采集表.xlsx，文件尚未上传",
    );
    await user.click(screen.getByRole("button", { name: "预检电子表格" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "文件类型和大小校验通过",
    );
    expect(screen.getByRole("status")).toHaveTextContent("发现 5 行错误");
    expect(screen.getByRole("status")).toHaveTextContent("单次不超过5,000行");
    expect(screen.getByLabelText("电子表格最近预检结果")).toHaveTextContent(
      "错误5 行",
    );
    expect(
      screen.queryByRole("button", { name: "确认导入草稿" }),
    ).not.toBeInTheDocument();

    const corrected = new File(["表头,修正数据"], "市场采集表-修正.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    await user.upload(screen.getByLabelText("选择待校验文件"), corrected);
    await user.click(screen.getByRole("button", { name: "预检电子表格" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "错误已清零，可以确认导入",
    );
    await user.click(screen.getByRole("button", { name: "确认导入草稿" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "已合并到当前任务草稿",
    );
    expect(screen.getByRole("button", { name: "已确认导入" })).toBeDisabled();
    expect(screen.getByLabelText("电子表格批量导入步骤")).toHaveTextContent(
      "1. 下载任务模板2. 上传并预检3. 修正错误4. 确认导入",
    );
  });

  it("checks configured system records before sync and does not claim a write", async () => {
    const user = userEvent.setup();
    renderWorkbench();

    await user.click(screen.getByRole("button", { name: "授权系统接入" }));
    expect(screen.getByText("企业仓储库存台账")).toBeVisible();
    expect(screen.getByLabelText("授权系统接入汇总")).toHaveTextContent(
      "今日接收718 条最近接收 今天 12:48自动通过684 条需要确认29 条接入失败5 条",
    );
    await user.click(screen.getByRole("button", { name: "执行同步前校验" }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "同步前校验已完成：已核对 2 个接入来源",
    );
    expect(screen.getByRole("status")).toHaveTextContent("尚未写入当前单据");
  });

  it("keeps responsible-person submission separate from review", async () => {
    const user = userEvent.setup();
    renderWorkbench();

    await user.click(screen.getByRole("button", { name: "提交审核" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "请先执行并通过提交前检查",
    );

    await user.click(screen.getByRole("button", { name: "执行提交前检查" }));
    expect(screen.getByRole("status")).toHaveTextContent("提交前检查已通过");
    await user.click(screen.getByRole("button", { name: "提交审核" }));
    expect(screen.getByLabelText("任务五状态")).toHaveTextContent("已提交");
    expect(screen.getByLabelText("任务五状态")).toHaveTextContent("待审核");
    expect(screen.getByLabelText("任务五状态")).toHaveTextContent("未发布");
    expect(
      screen.queryByRole("button", { name: "领取审核" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/没有此处理节点的操作权限/)).toBeVisible();
  });

  it("lets only the assigned reviewer conclude review and keeps publishing separate", async () => {
    const user = userEvent.setup();
    renderWorkbench(submittedItem(), {
      userId: baseItem.reviewerUserId,
      displayName: baseItem.reviewer,
      canRelease: false,
    });

    await user.click(screen.getByRole("button", { name: "领取审核" }));
    expect(screen.getByLabelText("任务五状态")).toHaveTextContent("审核中");
    await user.click(screen.getByRole("button", { name: "审核通过" }));
    expect(screen.getByLabelText("任务五状态")).toHaveTextContent("审核通过");
    expect(screen.getByLabelText("任务五状态")).toHaveTextContent("未发布");
    expect(screen.getByRole("status")).toHaveTextContent(
      "审核通过，当前结果仍未发布",
    );
    expect(
      screen.queryByRole("button", { name: "申请发布" }),
    ).not.toBeInTheDocument();
  });

  it("requires an explicit publishing permission after business approval", async () => {
    const user = userEvent.setup();
    renderWorkbench(
      submittedItem({ reviewStatus: "approved", releaseStatus: "unreleased" }),
      {
        userId: "publication-operator",
        displayName: "周楠",
        canRelease: true,
      },
    );

    await user.click(screen.getByRole("button", { name: "申请发布" }));
    expect(screen.getByLabelText("任务五状态")).toHaveTextContent("待发布");
    expect(screen.getByRole("status")).toHaveTextContent(
      "发布申请已登记，等待发布岗确认",
    );
    await user.click(screen.getByRole("button", { name: "确认正式发布" }));
    expect(screen.getByLabelText("任务五状态")).toHaveTextContent("已发布");
    expect(screen.getByText(/正式发布 · 周楠/)).toBeVisible();
  });

  it("requires a review reason before returning and supports a corrected draft", async () => {
    const user = userEvent.setup();
    const { unmount } = renderWorkbench(
      submittedItem({ reviewStatus: "reviewing" }),
      {
        userId: baseItem.reviewerUserId,
        displayName: baseItem.reviewer,
        canRelease: false,
      },
    );

    await user.click(screen.getByRole("button", { name: "退回修改" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "退回修改必须填写审核意见",
    );
    await user.type(
      screen.getByRole("textbox", { name: "审核意见" }),
      "请补充质量检验凭证",
    );
    await user.click(screen.getByRole("button", { name: "退回修改" }));
    expect(screen.getByLabelText("任务五状态")).toHaveTextContent("已退回");
    expect(screen.getByLabelText("任务五状态")).toHaveTextContent("审核退回");

    unmount();
    renderWorkbench(
      submittedItem({ documentStatus: "returned", reviewStatus: "returned" }),
      {
        userId: baseItem.responsibleUserId,
        displayName: baseItem.responsiblePerson,
        canRelease: false,
      },
    );

    await user.click(screen.getByRole("button", { name: "保存更正草稿" }));
    expect(screen.getByLabelText("任务五状态")).toHaveTextContent("已更正");
    expect(screen.getByRole("status")).toHaveTextContent(
      "更正草稿已保存在当前页面，尚未重新提交",
    );
  });

  it("blocks incomplete prechecks and exposes only Chinese business labels", async () => {
    const user = userEvent.setup();
    const { container } = renderWorkbench(baseItem);

    await user.clear(screen.getByRole("textbox", { name: "采购价" }));
    await user.click(screen.getByRole("button", { name: "执行提交前检查" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "提交前检查未通过：当前页面仍有必填字段为空",
    );
    expect(container.textContent).not.toMatch(
      /WORK-|DOCUMENT-|OBJ-|METRIC-|RULE-|VERSION-|\d{4}-\d{2}-\d{2}T/,
    );
    const lifecycle = screen.getByLabelText("任务五状态");
    expect(within(lifecycle).getByText("草稿")).toBeVisible();
    for (const input of screen.getAllByRole("textbox")) {
      expect(
        (input as HTMLInputElement | HTMLTextAreaElement).value,
      ).not.toMatch(/^[A-Z0-9-]{8,}$/);
    }
  });
});
