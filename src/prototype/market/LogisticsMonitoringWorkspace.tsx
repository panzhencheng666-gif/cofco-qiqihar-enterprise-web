import { useMemo, useState } from "react";

import {
  RegionCascadeSelector,
  type RegionCascadeValue,
} from "../components/RegionCascadeSelector";
import type { BusinessWorkItem } from "../core/businessWork";
import type { OperationalScope } from "../core/operationalScope";
import { businessWorkFixtures } from "../data/businessWorkFixtures";
import {
  getEnterpriseRegionPath,
  type EnterpriseRegionNode,
} from "../data/enterpriseRegionHierarchy";
import {
  marketDocumentFixtures,
  type MarketDocumentField,
} from "../data/marketDocumentFixtures";
import type {
  BusinessCoordinates,
  FormalSelection,
} from "../formalEnterpriseModel";
import { marketTaskPeriods } from "../marketMonitoringData";
import { marketLifecycleLabels } from "../marketMonitoringModel";
import {
  MarketDocumentWorkbench,
  type MarketDocumentDraft,
} from "./MarketDocumentWorkbench";

const aggregateRegionByCity = {
  qiqihar: "qiqihar-all",
  heihe: "heihe-all",
  hulunbuir: "hulunbuir-designated",
} as const;

const nodeTypeLabels: Readonly<Record<string, string>> = {
  "rail-node": "铁路站点",
  "road-node": "公路物流节点",
};

interface LogisticsRow {
  workId: string;
  number: number;
  node: string;
  nodeType: string;
  region: string;
  inflow: string;
  outflow: string;
  direction: string;
  freightRate: string;
  transitTime: string;
  responsible: string;
  state: string;
}

function pathValue(path: readonly EnterpriseRegionNode[]): RegionCascadeValue {
  return {
    cityId: path.find(({ level }) => level === "prefecture")?.id,
    countyId: path.find(({ level }) => level === "county")?.id,
  };
}

function scopeRegionId(value: RegionCascadeValue): string {
  if (value.countyId) return value.countyId;
  if (value.cityId) {
    return (
      aggregateRegionByCity[
        value.cityId as keyof typeof aggregateRegionByCity
      ] ?? value.cityId
    );
  }
  return "authorized-all";
}

function regionContains(scopeRegion: string, itemRegion: string): boolean {
  if (scopeRegion === "authorized-all") return true;
  const requestedPath = getEnterpriseRegionPath(scopeRegion).map(
    ({ id }) => id,
  );
  const itemPath = getEnterpriseRegionPath(itemRegion).map(({ id }) => id);
  return (
    requestedPath.some((id) => itemPath.includes(id)) ||
    itemPath.some((id) => requestedPath.includes(id))
  );
}

function field(
  workId: string,
  fieldId: string,
): MarketDocumentField | undefined {
  return marketDocumentFixtures
    .find((candidate) => candidate.workId === workId)
    ?.fieldGroups.flatMap(({ fields }) => fields)
    .find((candidate) => candidate.fieldId === fieldId);
}

function fieldValue(workId: string, fieldId: string): string {
  const candidate = field(workId, fieldId);
  if (!candidate) return "—";
  return `${candidate.value}${candidate.unit ? ` ${candidate.unit}` : ""}`;
}

function firstAvailable(workId: string, fieldIds: readonly string[]): string {
  for (const fieldId of fieldIds) {
    const value = fieldValue(workId, fieldId);
    if (value !== "—") return value;
  }
  return "—";
}

export function LogisticsMonitoringWorkspace({
  scope,
  onScopeChange,
  selection,
  onSelectionChange,
  queryAllowed,
  workItems = businessWorkFixtures,
  documentDrafts = {},
  onDocumentDraftChange = () => undefined,
  onWorkItemChange = () => undefined,
}: {
  scope: OperationalScope;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  selection?: FormalSelection;
  onSelectionChange: (selection: FormalSelection) => void;
  queryAllowed: boolean;
  workItems?: readonly BusinessWorkItem[];
  documentDrafts?: Readonly<Record<string, MarketDocumentDraft>>;
  onDocumentDraftChange?: (workId: string, draft: MarketDocumentDraft) => void;
  onWorkItemChange?: (item: BusinessWorkItem) => void;
}) {
  const [nodeType, setNodeType] = useState("");
  const [lowerRegion, setLowerRegion] = useState<RegionCascadeValue>({});
  const scopedRegion = pathValue(
    getEnterpriseRegionPath(scope.coordinates.regionId),
  );
  const governedRegion: RegionCascadeValue = scopedRegion.cityId
    ? scopedRegion
    : { cityId: "qiqihar" };
  const regionValue: RegionCascadeValue = {
    ...governedRegion,
    ...(governedRegion.countyId === lowerRegion.countyId ? lowerRegion : {}),
  };
  const items = useMemo(
    () =>
      workItems.filter(
        (item) =>
          queryAllowed &&
          item.domain === "market" &&
          item.businessSubtypeId === "market.logistics" &&
          regionContains(scope.coordinates.regionId, item.regionId) &&
          (!scope.coordinates.periodKey ||
            item.periodKey === scope.coordinates.periodKey) &&
          (!nodeType ||
            (item.subject.kind === "monitoring-object" &&
              item.subject.objectTypeId === nodeType)),
      ),
    [nodeType, queryAllowed, scope.coordinates, workItems],
  );
  const rows: readonly LogisticsRow[] = items.map((item, index) => {
    const objectTypeId =
      item.subject.kind === "monitoring-object"
        ? item.subject.objectTypeId
        : "unknown";
    const origin = fieldValue(item.workId, "origin");
    const destination = fieldValue(item.workId, "destination");
    return {
      workId: item.workId,
      number: index + 1,
      node:
        item.subject.kind === "monitoring-object"
          ? item.subject.objectName
          : "物流节点待维护",
      nodeType: nodeTypeLabels[objectTypeId] ?? "其他物流节点",
      region: item.regionLabel,
      inflow: firstAvailable(item.workId, ["railArrival", "roadInflow"]),
      outflow: firstAvailable(item.workId, ["railDispatch", "roadOutflow"]),
      direction:
        origin !== "—" && destination !== "—"
          ? `${origin} → ${destination}`
          : "待采集",
      freightRate: firstAvailable(item.workId, ["freightRate", "railFreight"]),
      transitTime: firstAvailable(item.workId, [
        "transitTime",
        "averageTransit",
      ]),
      responsible: item.responsiblePerson,
      state: `${marketLifecycleLabels.review[item.reviewStatus]} · ${marketLifecycleLabels.quality[item.qualityStatus]}`,
    };
  });
  const selectedItem =
    selection?.type === "work-item"
      ? items.find(({ workId }) => workId === selection.id)
      : undefined;
  const selectedDocument = selectedItem
    ? marketDocumentFixtures.find(
        ({ workId }) => workId === selectedItem.workId,
      )
    : undefined;
  const completedFields = items.reduce(
    (sum, item) => sum + item.completedFields,
    0,
  );
  const missingFields = items.reduce(
    (sum, item) =>
      sum + Math.max(0, item.applicableFields - item.completedFields),
    0,
  );

  return (
    <div className="enterprise-ledger-workbench">
      <div className="enterprise-ledger-workbench__breadcrumb">
        物流监测 / 物流节点监测
      </div>
      <section
        aria-label="物流节点查询条件"
        className="enterprise-ledger-query enterprise-ledger-query--logistics"
        role="search"
      >
        <RegionCascadeSelector
          authorizedRegionIds={scope.authorization.authorizedRegionIds}
          maxLevel="county"
          value={regionValue}
          onChange={(value) => {
            setLowerRegion(value);
            onScopeChange({ regionId: scopeRegionId(value) });
          }}
        />
        <label>
          <span>节点类型</span>
          <select
            aria-label="节点类型"
            value={nodeType}
            onChange={(event) => setNodeType(event.target.value)}
          >
            <option value="">全部节点类型</option>
            <option value="rail-node">铁路站点</option>
            <option value="road-node">公路物流节点</option>
          </select>
        </label>
        <label>
          <span>监测期</span>
          <select
            aria-label="监测期"
            value={scope.coordinates.periodKey ?? ""}
            onChange={(event) =>
              onScopeChange({ periodKey: event.target.value || undefined })
            }
          >
            <option value="">全部可用监测期</option>
            {marketTaskPeriods.map((period) => (
              <option key={period.id} value={period.id}>
                {period.label}
              </option>
            ))}
          </select>
        </label>
        <div className="enterprise-ledger-query__actions">
          <button className="is-primary" type="button">
            查询
          </button>
          <button
            type="button"
            onClick={() => {
              setNodeType("");
              setLowerRegion({});
              onScopeChange({
                regionId: "qiqihar-all",
                periodKey: undefined,
              });
            }}
          >
            重置
          </button>
        </div>
      </section>

      {!queryAllowed && (
        <div className="market-task6-alert" role="alert">
          当前查询条件超出您的授权范围，系统未展示其他地区的数据。
        </div>
      )}

      <header className="enterprise-ledger-title">
        <h1>粮食物流节点监测表</h1>
        <p>铁路站点与公路物流节点 · 当前监测期 · 当前授权地区</p>
      </header>

      <section
        aria-label="粮食物流节点监测表区域"
        className="enterprise-ledger-table"
      >
        <div className="enterprise-ledger-table__toolbar">
          <strong>
            共 {rows.length} 个物流节点，当前显示 {rows.length > 0 ? 1 : 0}–
            {rows.length}
          </strong>
          <div>
            <button type="button">批量导入</button>
            <button type="button">新建监测记录</button>
          </div>
        </div>
        <div className="enterprise-ledger-table__scroll" tabIndex={0}>
          <table aria-label="粮食物流节点监测表">
            <thead>
              <tr>
                <th rowSpan={2}>序号</th>
                <th rowSpan={2}>物流节点</th>
                <th rowSpan={2}>节点类型</th>
                <th rowSpan={2}>行政区划</th>
                <th colSpan={3}>运输数量与方向</th>
                <th colSpan={2}>运输依据</th>
                <th rowSpan={2}>责任人</th>
                <th rowSpan={2}>业务状态</th>
                <th rowSpan={2}>操作</th>
              </tr>
              <tr>
                <th>流入量</th>
                <th>流出量</th>
                <th>主要流向</th>
                <th>运价</th>
                <th>平均在途时间</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.workId}>
                  <td>{row.number}</td>
                  <th scope="row">{row.node}</th>
                  <td>{row.nodeType}</td>
                  <td>{row.region}</td>
                  <td className="is-operational">{row.inflow}</td>
                  <td className="is-operational">{row.outflow}</td>
                  <td className="is-operational">{row.direction}</td>
                  <td className="is-operational">{row.freightRate}</td>
                  <td className="is-operational">{row.transitTime}</td>
                  <td>{row.responsible}</td>
                  <td>{row.state}</td>
                  <td>
                    <button
                      className="enterprise-ledger-row-action"
                      type="button"
                      onClick={() =>
                        onSelectionChange({ type: "work-item", id: row.workId })
                      }
                    >
                      查看
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="enterprise-ledger-table__empty" colSpan={12}>
                    当前范围暂无粮食物流节点监测记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <footer>
          <span>
            本页已填 {completedFields} 项，缺失 {missingFields} 项
          </span>
          <nav aria-label="物流节点监测表分页">
            <button type="button">‹</button>
            <button className="is-current" type="button">
              1
            </button>
            <button type="button">›</button>
          </nav>
        </footer>
      </section>

      {selectedItem && selectedDocument && (
        <MarketDocumentWorkbench
          actor={{
            userId: scope.identity.userId,
            displayName: scope.identity.displayName ?? "当前登录人员",
            canRelease:
              scope.authorization.permissionKeys.includes("market:release"),
          }}
          document={selectedDocument}
          draft={documentDrafts[selectedItem.workId]}
          item={selectedItem}
          onDraftChange={(draft) =>
            onDocumentDraftChange(selectedItem.workId, draft)
          }
          onItemChange={onWorkItemChange}
        />
      )}
    </div>
  );
}
