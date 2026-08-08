import type { MyWorkItem, MyWorkSummary } from "./model";

export type MyWorkViewState = "loading" | "error" | "empty" | "ready";
export type MyWorkView = "reporting" | "review" | "exception" | "completed";

export function resolveMyWorkViewState({
  isLoading,
  isError,
  itemCount,
}: {
  isLoading: boolean;
  isError: boolean;
  itemCount: number;
}): MyWorkViewState {
  if (isLoading) return "loading";
  if (isError) return "error";
  if (itemCount === 0) return "empty";
  return "ready";
}

export function buildMyWorkSummary(
  items: readonly MyWorkItem[],
): MyWorkSummary {
  return {
    pending: items.filter((item) => !isMyWorkCompleted(item)).length,
    qualityBlocking: items.filter((item) => item.qualityStatus === "阻断")
      .length,
    overdue: items.filter((item) =>
      ["逾期补填", "仍未提交"].includes(item.timeliness),
    ).length,
    completed: items.filter(isMyWorkCompleted).length,
  };
}

export function isMyWorkCompleted(item: MyWorkItem): boolean {
  return (
    item.documentStatus === "已发布" ||
    item.obligationStatus === "已关闭" ||
    item.obligationStatus === "免报"
  );
}

export function filterMyWork(
  items: readonly MyWorkItem[],
  view?: string | null,
): readonly MyWorkItem[] {
  if (view === "reporting") {
    return items.filter((item) => item.kind === "填报");
  }
  if (view === "review") {
    return items.filter(
      (item) => item.kind === "审核" && !isMyWorkCompleted(item),
    );
  }
  if (view === "exception") {
    return items.filter(
      (item) =>
        item.documentStatus === "已退回" ||
        item.timeliness === "逾期补填" ||
        item.timeliness === "仍未提交" ||
        item.qualityStatus === "阻断",
    );
  }
  if (view === "completed") {
    return items.filter(isMyWorkCompleted);
  }
  return items;
}
