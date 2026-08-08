import type { BusinessReportRecord } from "../businessReportWorkflow";
import { resolveBusinessReportWorkItem } from "../businessReportWorkflow";
import type { BusinessWorkItem } from "../core/businessWork";

type ReportWorkStatuses = Pick<
  BusinessWorkItem,
  "documentStatus" | "reviewStatus" | "releaseStatus"
>;

const reportWorkStatuses: Readonly<
  Record<BusinessReportRecord["status"], ReportWorkStatuses>
> = {
  草稿: {
    documentStatus: "draft",
    reviewStatus: "pending",
    releaseStatus: "unreleased",
  },
  待复核: {
    documentStatus: "submitted",
    reviewStatus: "pending",
    releaseStatus: "unreleased",
  },
  退回修改: {
    documentStatus: "returned",
    reviewStatus: "returned",
    releaseStatus: "unreleased",
  },
  待发布: {
    documentStatus: "submitted",
    reviewStatus: "approved",
    releaseStatus: "pending",
  },
  已发布: {
    documentStatus: "submitted",
    reviewStatus: "approved",
    releaseStatus: "published",
  },
  已替代: {
    documentStatus: "submitted",
    reviewStatus: "approved",
    releaseStatus: "superseded",
  },
};

/**
 * Report workflow owns report lifecycle state. The unified work ledger consumes
 * a projection of that state so a published or returned report cannot remain
 * displayed at an older processing node elsewhere in the application.
 */
export function projectReportWorkflowIntoWorkItems(
  workItems: readonly BusinessWorkItem[],
  reports: readonly BusinessReportRecord[],
): readonly BusinessWorkItem[] {
  return workItems.flatMap((item) => {
    if (item.domain !== "reporting") return [item];
    const resolution = resolveBusinessReportWorkItem(item.workId, reports);
    if (!resolution) return [];
    const statuses = reportWorkStatuses[resolution.report.status];
    if (
      item.documentStatus === statuses.documentStatus &&
      item.reviewStatus === statuses.reviewStatus &&
      item.releaseStatus === statuses.releaseStatus
    ) {
      return [item];
    }
    return [{ ...item, ...statuses }];
  });
}
