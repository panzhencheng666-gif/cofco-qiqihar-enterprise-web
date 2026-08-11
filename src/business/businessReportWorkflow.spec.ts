import { describe, expect, it } from "vitest";
import {
  BusinessReportWorkflow,
  createLocalStorageBusinessReportRepository,
  createMemoryBusinessReportRepository,
  createFixtureBusinessReportWorkflow,
  createFixtureBusinessReportSeeds,
  resolveBusinessReportWorkItem,
  type BusinessReportScopeSnapshot,
} from "./businessReportWorkflow";

const snapshot: BusinessReportScopeSnapshot = {
  application: "market",
  businessClassificationId: "market.quote-trade",
  businessClassificationLabel: "报价与交易",
  region: "齐齐哈尔市全域",
  product: "玉米",
  cultivar: "德美亚3号",
  reportTemplate: "价格与交易监测报告",
  period: "2026年第31周",
  frequency: "周报",
  dataCutoff: "2026-07-31 17:00",
  dataBatchId: "MARKET-2026-W31-APPROVED",
};

function workflowWithDeterministicDependencies() {
  let now = 1_786_000_000_000;
  let sequence = 0;
  return new BusinessReportWorkflow(createMemoryBusinessReportRepository(), {
    now: () => ++now,
    createId: () => `报告-${String(++sequence)}`,
  });
}

function createDraft(workflow: BusinessReportWorkflow) {
  return workflow.createDraft({
    title: "齐齐哈尔市全域玉米市场监测周报",
    summary: "本周市场运行平稳。",
    scope: snapshot,
    dataBatchLabel: "2026年第31周市场已核定数据",
    dataSourceLabel: "2026年第31周市场监测已核定结果",
    authorPost: "市场分析岗",
    reviewerPost: "报告复核岗",
    publisherPost: "报告发布岗",
  });
}

describe("business report workflow", () => {
  it("persists an immutable business-coordinate draft and restores it", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const repository = createLocalStorageBusinessReportRepository(
      storage,
      "报告工作流测试",
    );
    const workflow = new BusinessReportWorkflow(repository, {
      now: () => 1_786_000_000_000,
      createId: () => "报告-一",
    });

    const draft = createDraft(workflow);
    const restored = new BusinessReportWorkflow(repository).getSnapshot()[0];

    expect(draft.scope).toEqual(snapshot);
    expect(Object.isFrozen(draft.scope)).toBe(true);
    expect(draft.status).toBe("草稿");
    expect(draft.currentHandlerPost).toBe("市场分析岗");
    expect(restored).toMatchObject({
      title: draft.title,
      summary: draft.summary,
      scope: snapshot,
      status: "草稿",
    });
    expect(restored.auditTrail[0]).toMatchObject({
      action: "创建草稿",
      toStatus: "草稿",
      actorPost: "市场分析岗",
    });
  });

  it("preserves an incompatible stored structure and exposes a Chinese recovery error", () => {
    const originalValue = JSON.stringify([
      { id: "旧报告", status: "待复核", auditTrail: [] },
    ]);
    const values = new Map<string, string>([
      ["齐齐哈尔粮食商情业务报告工作流-业务真值三", originalValue],
    ]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    const workflow = createFixtureBusinessReportWorkflow(storage);

    expect(workflow.getSnapshot()).toHaveLength(0);
    expect(workflow.getInitializationError()).toMatch(
      /报告工作流存储内容不完整.*保留.*联系系统管理员/,
    );
    expect(values.get("齐齐哈尔粮食商情业务报告工作流-业务真值三")).toBe(
      originalValue,
    );
  });

  it("blocks a semantically invalid report status without overwriting stored records", () => {
    const storageKey = "齐齐哈尔粮食商情业务报告工作流-业务真值三";
    const [seed, ...remainingSeeds] = createFixtureBusinessReportSeeds();
    const originalValue = JSON.stringify([
      { ...seed, status: "未知状态" },
      ...remainingSeeds,
    ]);
    const values = new Map<string, string>([[storageKey, originalValue]]);
    let writeCount = 0;
    const workflow = createFixtureBusinessReportWorkflow({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        writeCount += 1;
        values.set(key, value);
      },
    });

    expect(workflow.getSnapshot()).toHaveLength(0);
    expect(workflow.getInitializationError()).toMatch(
      /无法识别的报告状态.*原始内容已保留/,
    );
    expect(values.get(storageKey)).toBe(originalValue);
    expect(writeCount).toBe(0);
  });

  it("blocks an unrecognized report application in the stored business scope", () => {
    const storageKey = "齐齐哈尔粮食商情业务报告工作流-业务真值三";
    const [seed] = createFixtureBusinessReportSeeds();
    const originalValue = JSON.stringify([
      { ...seed, scope: { ...seed.scope, application: "未知业务" } },
    ]);
    const values = new Map<string, string>([[storageKey, originalValue]]);

    const workflow = createFixtureBusinessReportWorkflow({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    });

    expect(workflow.getSnapshot()).toHaveLength(0);
    expect(workflow.getInitializationError()).toMatch(
      /无法识别的业务应用.*原始内容已保留/,
    );
    expect(values.get(storageKey)).toBe(originalValue);
  });

  it("blocks an unrecognized report frequency in the stored business scope", () => {
    const storageKey = "齐齐哈尔粮食商情业务报告工作流-业务真值三";
    const [seed] = createFixtureBusinessReportSeeds();
    const originalValue = JSON.stringify([
      { ...seed, scope: { ...seed.scope, frequency: "季度报告" } },
    ]);
    const values = new Map<string, string>([[storageKey, originalValue]]);

    const workflow = createFixtureBusinessReportWorkflow({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    });

    expect(workflow.getSnapshot()).toHaveLength(0);
    expect(workflow.getInitializationError()).toMatch(
      /无法识别的报告周期.*原始内容已保留/,
    );
    expect(values.get(storageKey)).toBe(originalValue);
  });

  it("blocks an unrecognized stored audit action", () => {
    const storageKey = "齐齐哈尔粮食商情业务报告工作流-业务真值三";
    const [seed] = createFixtureBusinessReportSeeds();
    const [firstEvent, ...remainingEvents] = seed.auditTrail;
    const originalValue = JSON.stringify([
      {
        ...seed,
        auditTrail: [{ ...firstEvent, action: "跳过复核" }, ...remainingEvents],
      },
    ]);
    const values = new Map<string, string>([[storageKey, originalValue]]);

    const workflow = createFixtureBusinessReportWorkflow({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    });

    expect(workflow.getSnapshot()).toHaveLength(0);
    expect(workflow.getInitializationError()).toMatch(
      /无法识别的审计动作.*原始内容已保留/,
    );
    expect(values.get(storageKey)).toBe(originalValue);
  });

  it("blocks a stored report whose current handler contradicts its lifecycle status", () => {
    const storageKey = "齐齐哈尔粮食商情业务报告工作流-业务真值三";
    const [seed] = createFixtureBusinessReportSeeds();
    const originalValue = JSON.stringify([
      { ...seed, currentHandlerPost: "报告复核岗" },
    ]);
    const values = new Map<string, string>([[storageKey, originalValue]]);

    const workflow = createFixtureBusinessReportWorkflow({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    });

    expect(workflow.getSnapshot()).toHaveLength(0);
    expect(workflow.getInitializationError()).toMatch(
      /报告状态与当前处理岗位不一致.*原始内容已保留/,
    );
    expect(values.get(storageKey)).toBe(originalValue);
  });

  it("blocks a stored report whose audit trail contradicts its lifecycle status", () => {
    const storageKey = "齐齐哈尔粮食商情业务报告工作流-业务真值三";
    const [seed] = createFixtureBusinessReportSeeds();
    const lastEvent = seed.auditTrail.at(-1)!;
    const originalValue = JSON.stringify([
      {
        ...seed,
        auditTrail: [
          ...seed.auditTrail.slice(0, -1),
          { ...lastEvent, toStatus: "待复核" },
        ],
      },
    ]);
    const values = new Map<string, string>([[storageKey, originalValue]]);

    const workflow = createFixtureBusinessReportWorkflow({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    });

    expect(workflow.getSnapshot()).toHaveLength(0);
    expect(workflow.getInitializationError()).toMatch(
      /报告状态与审计轨迹不一致.*原始内容已保留/,
    );
    expect(values.get(storageKey)).toBe(originalValue);
  });

  it("blocks an unrecognized status inside the stored audit trail", () => {
    const storageKey = "齐齐哈尔粮食商情业务报告工作流-业务真值三";
    const [seed] = createFixtureBusinessReportSeeds();
    const lastEvent = seed.auditTrail.at(-1)!;
    const originalValue = JSON.stringify([
      {
        ...seed,
        auditTrail: [
          ...seed.auditTrail.slice(0, -1),
          { ...lastEvent, fromStatus: "未知状态" },
        ],
      },
    ]);
    const values = new Map<string, string>([[storageKey, originalValue]]);

    const workflow = createFixtureBusinessReportWorkflow({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    });

    expect(workflow.getSnapshot()).toHaveLength(0);
    expect(workflow.getInitializationError()).toMatch(
      /无法识别的审计状态.*原始内容已保留/,
    );
    expect(values.get(storageKey)).toBe(originalValue);
  });

  it("preserves unreadable stored text instead of replacing it with demonstration data", () => {
    const storageKey = "齐齐哈尔粮食商情业务报告工作流-业务真值三";
    const values = new Map<string, string>([[storageKey, "{损坏内容"]]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    const workflow = createFixtureBusinessReportWorkflow(storage);

    expect(workflow.getSnapshot()).toHaveLength(0);
    expect(workflow.getInitializationError()).toMatch(
      /报告工作流存储内容无法读取.*保留.*联系系统管理员/,
    );
    expect(values.get(storageKey)).toBe("{损坏内容");
  });

  it("initializes demonstration reports only when storage is normally empty", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    const workflow = createFixtureBusinessReportWorkflow(storage);

    expect(workflow.getInitializationError()).toBeNull();
    expect(workflow.getSnapshot()).toHaveLength(5);
    expect(values.get("齐齐哈尔粮食商情业务报告工作流-业务真值三")).toContain(
      "初始报告-供需待复核",
    );
  });

  it("keeps an explicitly persisted empty report set empty", () => {
    const storageKey = "齐齐哈尔粮食商情业务报告工作流-业务真值三";
    const values = new Map<string, string>([[storageKey, "[]"]]);
    let writeCount = 0;
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        writeCount += 1;
        values.set(key, value);
      },
    };

    const workflow = createFixtureBusinessReportWorkflow(storage);

    expect(workflow.getInitializationError()).toBeNull();
    expect(workflow.getSnapshot()).toHaveLength(0);
    expect(values.get(storageKey)).toBe("[]");
    expect(writeCount).toBe(0);
  });

  it("returns a Chinese recovery state when browser storage access is denied", () => {
    let writeCount = 0;
    const storage = {
      getItem: () => {
        throw new Error("浏览器拒绝访问本地存储");
      },
      setItem: () => {
        writeCount += 1;
      },
    };

    const workflow = createFixtureBusinessReportWorkflow(storage);

    expect(workflow.getSnapshot()).toHaveLength(0);
    expect(workflow.getInitializationError()).toMatch(
      /报告工作流存储暂时无法访问.*未写入预置数据.*联系系统管理员/,
    );
    expect(writeCount).toBe(0);
  });

  it("keeps the committed snapshot unchanged when a later storage write fails", () => {
    const initialReports = createFixtureBusinessReportSeeds();
    const repository = {
      load: () => initialReports,
      save: () => {
        throw new Error("浏览器本地存储空间不足");
      },
    };
    const workflow = new BusinessReportWorkflow(repository, {
      now: () => 1_786_000_000_000,
      createId: () => "报告-写入失败",
    });
    const committedSnapshot = workflow.getSnapshot();
    let notificationCount = 0;
    workflow.subscribe(() => {
      notificationCount += 1;
    });

    expect(() => createDraft(workflow)).toThrow("浏览器本地存储空间不足");
    expect(workflow.getSnapshot()).toBe(committedSnapshot);
    expect(workflow.getSnapshot()).toEqual(initialReports);
    expect(notificationCount).toBe(0);
  });

  it("resolves a report task only through its explicit report identity and scope mapping", () => {
    const reports = createFixtureBusinessReportSeeds();

    const resolved = resolveBusinessReportWorkItem(
      "WORK-REPORT-REVIEW-W31",
      reports,
    );

    expect(resolved).toMatchObject({
      workItemId: "WORK-REPORT-REVIEW-W31",
      target: "distribution",
      report: {
        id: "初始报告-第31周粮食商情周报",
        status: "待发布",
        scope: {
          application: "production",
          businessClassificationId: "reporting.production",
          region: "齐齐哈尔市全域",
          product: "综合粮食品种",
          period: "2026年第31周",
          frequency: "周报",
        },
      },
    });

    const mappedReport = resolved?.report;
    expect(mappedReport).toBeDefined();
    expect(
      resolveBusinessReportWorkItem("WORK-REPORT-UNKNOWN", reports),
    ).toBeNull();
    expect(
      resolveBusinessReportWorkItem("WORK-REPORT-REVIEW-W31", [
        { ...mappedReport!, id: "同名但未映射的报告" },
      ]),
    ).toBeNull();
  });

  it("enforces the review and publication prerequisites with Chinese reasons", () => {
    const workflow = workflowWithDeterministicDependencies();
    const draft = createDraft(workflow);

    expect(
      workflow.transition(draft.id, {
        action: "发布报告",
        actorPost: "报告发布岗",
      }),
    ).toEqual({
      ok: false,
      reason: "当前报告仍为草稿，须先提交复核并通过后才能发布。",
    });

    const submitted = workflow.transition(draft.id, {
      action: "提交复核",
      actorPost: "市场分析岗",
    });
    expect(submitted.ok && submitted.report.status).toBe("待复核");
    expect(submitted.ok && submitted.report.currentHandlerPost).toBe(
      "报告复核岗",
    );

    const approved = workflow.transition(draft.id, {
      action: "复核通过",
      actorPost: "报告复核岗",
    });
    expect(approved.ok && approved.report.status).toBe("待发布");
    expect(approved.ok && approved.report.currentHandlerPost).toBe(
      "报告发布岗",
    );

    const published = workflow.transition(draft.id, {
      action: "发布报告",
      actorPost: "报告发布岗",
    });
    expect(published.ok && published.report.status).toBe("已发布");
    expect(
      published.ok && published.report.auditTrail.map(({ action }) => action),
    ).toEqual(["创建草稿", "提交复核", "复核通过", "发布报告"]);
  });

  it("requires a return reason and lets the author save and resubmit", () => {
    const workflow = workflowWithDeterministicDependencies();
    const draft = createDraft(workflow);
    workflow.transition(draft.id, {
      action: "提交复核",
      actorPost: "市场分析岗",
    });

    expect(
      workflow.transition(draft.id, {
        action: "退回修改",
        actorPost: "报告复核岗",
      }),
    ).toEqual({ ok: false, reason: "退回报告前必须填写具体业务原因。" });

    const returned = workflow.transition(draft.id, {
      action: "退回修改",
      actorPost: "报告复核岗",
      reason: "请补充北部县区价差依据。",
    });
    expect(returned.ok && returned.report.status).toBe("退回修改");
    expect(returned.ok && returned.report.currentHandlerPost).toBe(
      "市场分析岗",
    );

    const saved = workflow.saveDraft(draft.id, {
      actorPost: "市场分析岗",
      summary: "已补充北部县区价差依据。",
    });
    expect(saved.ok && saved.report.status).toBe("草稿");
    expect(saved.ok && saved.report.summary).toContain("已补充");
    expect(
      workflow.transition(draft.id, {
        action: "提交复核",
        actorPost: "市场分析岗",
      }).ok,
    ).toBe(true);
  });

  it("records revision and replacement relationships on both reports", () => {
    const workflow = workflowWithDeterministicDependencies();
    const original = createDraft(workflow);
    workflow.transition(original.id, {
      action: "提交复核",
      actorPost: "市场分析岗",
    });
    workflow.transition(original.id, {
      action: "复核通过",
      actorPost: "报告复核岗",
    });
    workflow.transition(original.id, {
      action: "发布报告",
      actorPost: "报告发布岗",
    });

    const revision = workflow.createRevision(original.id, {
      actorPost: "市场分析岗",
      reason: "补充经复核确认的区域价格资料。",
    });
    expect(revision.ok && revision.report.revisionOfReportId).toBe(original.id);
    if (!revision.ok) throw new Error(revision.reason);
    workflow.transition(revision.report.id, {
      action: "提交复核",
      actorPost: "市场分析岗",
    });
    workflow.transition(revision.report.id, {
      action: "复核通过",
      actorPost: "报告复核岗",
    });
    workflow.transition(revision.report.id, {
      action: "发布报告",
      actorPost: "报告发布岗",
    });

    const replaced = workflow.transition(original.id, {
      action: "确认替代",
      actorPost: "报告发布岗",
      relatedReportId: revision.report.id,
      reason: "修订报告已经完成复核并正式发布。",
    });
    const reports = workflow.getSnapshot();
    const revisedReport = reports.find(({ id }) => id === revision.report.id);

    expect(replaced.ok && replaced.report.status).toBe("已替代");
    expect(replaced.ok && replaced.report.replacedByReportId).toBe(
      revision.report.id,
    );
    expect(revisedReport?.replacesReportId).toBe(original.id);
    expect(revisedReport?.auditTrail.at(-1)?.action).toBe("建立替代关系");
  });
});
