import { canonicalDocumentPath } from "@/workflows/document-workspace/routing";
import type { MyWorkItem, MyWorkKind } from "./model";
import type { WorkTask } from "@/workflows/task-inbox/model";

const businessModuleByDomain = {
  "production-monitoring": "产情监测",
  "market-monitoring": "市场监测",
} as const;

export function projectMyWorkItem(
  task: WorkTask,
  {
    kind,
    regionName,
  }: {
    kind: MyWorkKind;
    regionName: string;
  },
): MyWorkItem {
  return {
    id: `work:${task.id}`,
    taskId: task.id,
    kind,
    title: task.title,
    businessModule: businessModuleByDomain[task.domain],
    regionName,
    dueAt: task.dueAt,
    deadlineOwnerName: task.ownerSnapshot.deadlineOwnerDisplayName,
    obligationStatus: task.obligationStatus,
    timeliness: task.timeliness,
    documentStatus: task.documentStatus,
    qualityStatus: task.qualityStatus,
    documentPath: canonicalDocumentPath(task.objectId, task.documentId),
  };
}
