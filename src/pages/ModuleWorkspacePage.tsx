import { useState } from "react";
import { useLocation } from "react-router";
import { implementedNavigation } from "@/app/router/navigation";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { SupplyBalancePanel } from "@/pages/supply/SupplyBalancePanel";
import {
  EnterpriseControlStrip,
  EnterpriseLifecyclePanel,
  EnterpriseMetricGrid,
  EnterpriseNoticePanel,
  EnterpriseObjectDrawer,
  EnterprisePage,
  EnterpriseSecondaryAction,
  EnterpriseStatusTag,
  EnterpriseTable,
  EnterpriseTextAction,
  EnterpriseWorkspaceTabs,
  type EnterpriseColumn,
} from "@/shared/enterprise-ui";
import { resolveModuleWorkspace } from "@/workflows/module-workspace/catalog";
import type { ModuleWorkspaceRecord } from "@/workflows/module-workspace/model";
import { buildObjectPanorama } from "@/workflows/module-workspace/panorama";
import {
  buildWorkspaceCsv,
  filterWorkspaceRecords,
  listWorkspaceFilterOptions,
  type WorkspaceFilters,
} from "@/workflows/module-workspace/operations";

function statusTone(value: string) {
  if (value.includes("阻断") || value.includes("重复")) {
    return "danger" as const;
  }
  if (
    value.includes("等待") ||
    value.includes("警告") ||
    value.includes("解释") ||
    value.includes("复核")
  ) {
    return "warning" as const;
  }
  if (
    value.includes("通过") ||
    value.includes("完成") ||
    value.includes("提交") ||
    value.includes("生成")
  ) {
    return "success" as const;
  }
  return "default" as const;
}

export function ModuleWorkspacePage() {
  const location = useLocation();
  const view = resolveModuleWorkspace(location.pathname);
  const [filterState, setFilterState] = useState<
    WorkspaceFilters & { pathname: string }
  >({
    pathname: location.pathname,
    search: "",
    status: "",
    category: "",
  });
  const [selectedRecord, setSelectedRecord] = useState<ModuleWorkspaceRecord>();

  if (!view) {
    return <NotFoundPage />;
  }

  const isSupplyBalance = location.pathname === "/supply/balance";
  const activeSection =
    view.sectionNavigation.find((item) => item.target === location.hash)?.key ??
    "overview";
  const filters =
    filterState.pathname === location.pathname
      ? filterState
      : {
          pathname: location.pathname,
          search: "",
          status: "",
          category: "",
        };
  const filteredRecords = filterWorkspaceRecords(view.records, filters);
  const filterOptions = listWorkspaceFilterOptions(view.records);
  const activeApplication = implementedNavigation.find(
    (item) =>
      item.path !== "/" &&
      (location.pathname === item.path ||
        location.pathname.startsWith(`${item.path}/`)),
  );
  const panoramaSources =
    activeApplication?.contextItems.flatMap((item) => {
      const relatedView = resolveModuleWorkspace(item.path);
      return relatedView
        ? [{ label: item.label, records: relatedView.records }]
        : [];
    }) ?? [];
  const selectedPanorama = selectedRecord
    ? buildObjectPanorama(selectedRecord, panoramaSources)
    : undefined;
  const exportColumnLabels = view.columnLabels;
  const exportTitle = view.title;

  function updateFilter(key: keyof WorkspaceFilters, value: string) {
    setFilterState({
      ...filters,
      pathname: location.pathname,
      [key]: value,
    });
  }

  function exportCurrentList() {
    const csv = buildWorkspaceCsv(filteredRecords, exportColumnLabels);
    const anchor = document.createElement("a");
    anchor.href = `data:text/csv;charset=utf-8,${encodeURIComponent(`\uFEFF${csv}`)}`;
    anchor.download = `${exportTitle}-当前清单.csv`;
    anchor.click();
  }

  const columns: EnterpriseColumn<ModuleWorkspaceRecord>[] = [
    { title: view.columnLabels.name, dataIndex: "name" },
    { title: view.columnLabels.category, dataIndex: "category" },
    { title: view.columnLabels.scope, dataIndex: "scope" },
    { title: view.columnLabels.period, dataIndex: "period" },
    {
      title: view.columnLabels.status,
      dataIndex: "status",
      render: (_, row) => (
        <EnterpriseStatusTag tone={statusTone(row.status)}>
          {row.status}
        </EnterpriseStatusTag>
      ),
    },
    {
      title: view.columnLabels.quality,
      dataIndex: "quality",
      render: (_, row) => (
        <EnterpriseStatusTag tone={statusTone(row.quality)}>
          {row.quality}
        </EnterpriseStatusTag>
      ),
    },
    { title: view.columnLabels.owner, dataIndex: "owner" },
    { title: view.columnLabels.timeLimit, dataIndex: "timeLimit" },
    {
      title: "操作",
      width: 96,
      pinned: "right",
      render: (_, row) => (
        <EnterpriseTextAction
          ariaLabel={`查看 ${row.name}`}
          onClick={() => setSelectedRecord(row)}
        >
          查看
        </EnterpriseTextAction>
      ),
    },
  ];

  return (
    <EnterprisePage
      eyebrow={view.eyebrow}
      title={view.title}
      description={view.description}
      actions={
        !isSupplyBalance ? (
          <EnterpriseSecondaryAction onClick={exportCurrentList}>
            导出当前清单
          </EnterpriseSecondaryAction>
        ) : undefined
      }
    >
      <EnterpriseWorkspaceTabs
        items={view.sectionNavigation}
        activeKey={activeSection}
      />

      {isSupplyBalance ? (
        <div className="enterprise-section-anchor" id="section-overview">
          <SupplyBalancePanel />
        </div>
      ) : (
        <div className="enterprise-section-anchor" id="section-overview">
          <EnterpriseMetricGrid metrics={view.metrics} />
        </div>
      )}

      <div className="enterprise-operational-grid">
        <div className="enterprise-section-anchor" id="section-lifecycle">
          <EnterpriseLifecyclePanel
            title={view.lifecycleTitle}
            note={view.lifecycleNote}
            steps={view.lifecycle}
          />
        </div>
        <div className="enterprise-section-anchor" id="section-quality">
          <EnterpriseNoticePanel notices={view.notices} />
        </div>
      </div>

      {!isSupplyBalance && (
        <section
          className="enterprise-section-anchor enterprise-work-panel"
          id="section-worklist"
        >
          <header className="enterprise-panel-heading">
            <div>
              <h2>{view.tableTitle}</h2>
              <p>{view.tableDescription}</p>
            </div>
          </header>
          <div className="enterprise-table-toolbar" aria-label="工作区筛选">
            <label className="enterprise-search-control">
              <span>搜索</span>
              <input
                type="search"
                aria-label="搜索当前工作区"
                placeholder="输入对象、地区、事项或责任人"
                value={filters.search}
                onChange={(event) =>
                  updateFilter("search", event.currentTarget.value)
                }
              />
            </label>
            <label>
              <span>对象类型</span>
              <select
                aria-label="按对象类型筛选"
                value={filters.category}
                onChange={(event) =>
                  updateFilter("category", event.currentTarget.value)
                }
              >
                <option value="">全部类型</option>
                {filterOptions.categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>业务状态</span>
              <select
                aria-label="按业务状态筛选"
                value={filters.status}
                onChange={(event) =>
                  updateFilter("status", event.currentTarget.value)
                }
              >
                <option value="">全部状态</option>
                {filterOptions.statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <span className="enterprise-filter-summary" aria-live="polite">
              当前显示 {filteredRecords.length} 项，共 {view.records.length} 项
            </span>
          </div>
          <EnterpriseTable
            ariaLabel={view.tableTitle}
            columns={columns}
            rows={filteredRecords}
            onRowOpen={setSelectedRecord}
          />
        </section>
      )}

      {!isSupplyBalance && (
        <div className="enterprise-section-anchor" id="section-controls">
          <EnterpriseControlStrip
            title={view.controlTitle}
            items={view.controlItems}
          />
        </div>
      )}

      {!isSupplyBalance && (
        <EnterpriseObjectDrawer
          open={selectedRecord !== undefined}
          object={
            selectedRecord
              ? {
                  name: selectedRecord.name,
                  regionPath: selectedRecord.scope.split(" / "),
                  contextLabel: "当前业务信息",
                  contextValues: [
                    selectedRecord.category,
                    selectedRecord.period,
                    selectedRecord.status,
                    selectedRecord.quality,
                  ],
                  relatedWorkspaces: selectedPanorama?.relatedWorkspaces,
                }
              : undefined
          }
          onClose={() => setSelectedRecord(undefined)}
        />
      )}
    </EnterprisePage>
  );
}
