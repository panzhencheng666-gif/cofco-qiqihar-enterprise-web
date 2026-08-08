import { describe, expect, it } from "vitest";

import {
  createPrototypeBusinessReportSeeds,
  type BusinessReportRecord,
} from "../businessReportWorkflow";
import { businessWorkFixtures } from "../data/businessWorkFixtures";
import { projectReportWorkflowIntoWorkItems } from "./reportWorkItemProjection";

const reportWorkItemSeed = businessWorkFixtures.find(
  ({ workId }) => workId === "WORK-REPORT-REVIEW-W31",
);
const mappedReportSeed = createPrototypeBusinessReportSeeds().find(
  ({ id }) => id === "初始报告-第31周粮食商情周报",
);

if (!reportWorkItemSeed || !mappedReportSeed) {
  throw new Error("报告工作事项或映射报告测试数据缺失");
}

const reportWorkItem = reportWorkItemSeed;
const mappedReport: BusinessReportRecord = mappedReportSeed;

function reportAtStatus(
  status: BusinessReportRecord["status"],
): BusinessReportRecord {
  return { ...mappedReport, status };
}

describe("report workflow work-item projection", () => {
  it.each([
    ["草稿", "draft", "pending", "unreleased"],
    ["待复核", "submitted", "pending", "unreleased"],
    ["退回修改", "returned", "returned", "unreleased"],
    ["待发布", "submitted", "approved", "pending"],
    ["已发布", "submitted", "approved", "published"],
    ["已替代", "submitted", "approved", "superseded"],
  ] as const)(
    "projects %s into the unified document, review and release states",
    (status, documentStatus, reviewStatus, releaseStatus) => {
      const projected = projectReportWorkflowIntoWorkItems(
        [reportWorkItem],
        [reportAtStatus(status)],
      );

      expect(projected[0]).toMatchObject({
        documentStatus,
        reviewStatus,
        releaseStatus,
      });
    },
  );

  it("does not guess by title when a report task has no explicit mapped instance", () => {
    const unrelated: BusinessReportRecord = {
      ...mappedReport,
      id: "同名但未映射的报告",
      status: "已发布",
    };

    const projected = projectReportWorkflowIntoWorkItems(
      [reportWorkItem],
      [unrelated],
    );

    expect(projected).toEqual([]);
  });

  it("removes unresolved report work when the valid workflow snapshot is empty", () => {
    const projected = projectReportWorkflowIntoWorkItems([reportWorkItem], []);

    expect(projected).toEqual([]);
  });

  it("preserves non-report work items by reference", () => {
    const production = businessWorkFixtures.find(
      ({ domain }) => domain === "production",
    );
    expect(production).toBeDefined();

    const projected = projectReportWorkflowIntoWorkItems(
      production ? [production] : [],
      [mappedReport],
    );

    expect(projected[0]).toBe(production);
  });
});
