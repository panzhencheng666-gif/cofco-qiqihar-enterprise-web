import type { ModuleWorkspaceRecord, ModuleWorkspaceView } from "./model";

export interface WorkspaceFilters {
  search: string;
  status: string;
  category: string;
}

const defaultColumnLabels: ModuleWorkspaceView["columnLabels"] = {
  name: "业务对象或任务",
  category: "对象类型",
  scope: "责任区域",
  period: "本期事项",
  status: "业务状态",
  quality: "质量状态",
  owner: "当前责任人",
  timeLimit: "时限",
};

export function filterWorkspaceRecords(
  records: readonly ModuleWorkspaceRecord[],
  filters: WorkspaceFilters,
): readonly ModuleWorkspaceRecord[] {
  const search = filters.search.trim().toLocaleLowerCase("zh-CN");

  return records.filter((record) => {
    const matchesSearch =
      search.length === 0 ||
      [
        record.name,
        record.category,
        record.scope,
        record.period,
        record.status,
        record.quality,
        record.owner,
      ].some((value) => value.toLocaleLowerCase("zh-CN").includes(search));
    const matchesStatus =
      filters.status.length === 0 || record.status === filters.status;
    const matchesCategory =
      filters.category.length === 0 || record.category === filters.category;

    return matchesSearch && matchesStatus && matchesCategory;
  });
}

export function listWorkspaceFilterOptions(
  records: readonly ModuleWorkspaceRecord[],
) {
  return {
    categories: [...new Set(records.map((record) => record.category))],
    statuses: [...new Set(records.map((record) => record.status))],
  };
}

function quoteCsv(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export function buildWorkspaceCsv(
  records: readonly ModuleWorkspaceRecord[],
  labels: ModuleWorkspaceView["columnLabels"] = defaultColumnLabels,
) {
  const headings = [
    labels.name,
    labels.category,
    labels.scope,
    labels.period,
    labels.status,
    labels.quality,
    labels.owner,
    labels.timeLimit,
  ];
  const rows = records.map((record) => [
    record.name,
    record.category,
    record.scope,
    record.period,
    record.status,
    record.quality,
    record.owner,
    record.timeLimit,
  ]);

  return [headings, ...rows]
    .map((row) => row.map(quoteCsv).join(","))
    .join("\r\n");
}
