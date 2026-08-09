import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type {
  OperationalScopeIdentity,
  OperationalScopeIssue,
} from "./core/operationalScope";
import type { BusinessWorkItem } from "./core/businessWork";
import { BusinessReportComposer } from "./BusinessReportComposer";
import type { BusinessReportContext } from "./businessReportModel";
import {
  createEmptyBusinessReportWorkflow,
  createPrototypeBusinessReportWorkflow,
} from "./businessReportWorkflow";
import { EnterpriseShell } from "./EnterpriseShell";
import { FormalExecutiveOverviewWorkspace } from "./ExecutiveOverviewWorkspace";
import { OverviewMonitoringFrame } from "./OverviewMonitoringFrame";
import { FormalMarketMonitoringWorkspace } from "./MarketMonitoringWorkspace";
import { FormalMyWorkWorkspace } from "./MyWorkWorkspace";
import { FormalProductionMonitoringWorkspace } from "./ProductionMonitoringWorkspace";
import { FormalReportCenterWorkspace } from "./ReportCenterWorkspace";
import { FormalSupplyDemandWorkspace } from "./SupplyDemandWorkspace";
import { useFormalEnterpriseLocation } from "./useFormalEnterpriseLocation";
import {
  prototypeOperationalIdentity,
  prototypeShellIdentity,
} from "./formalEnterpriseData";
import type { MarketDocumentDraft } from "./market/MarketDocumentWorkbench";
import type { ProductionDocumentDraft } from "./production/ProductionDocumentWorkbench";
import {
  createEmptyPrototypeOperationalState,
  loadPrototypeOperationalState,
  savePrototypeOperationalState,
} from "./prototypeOperationalState";
import { projectReportWorkflowIntoWorkItems } from "./application/reportWorkItemProjection";
import { projectRealtimeWorkItems } from "./application/realtimeWorkItemProjection";
import { realtimeBusinessRepository } from "@/platform/api/realtimeBusinessRepository";
import type {
  CurrentSession,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";
import { RealtimeBusinessOperationsPanel } from "./realtime/RealtimeBusinessOperationsPanel";
import { RealtimeSupplyBalancePanel } from "./realtime/RealtimeSupplyBalancePanel";
import { RealtimeLogisticsOperationsPanel } from "./realtime/RealtimeLogisticsOperationsPanel";
import { RealtimeReportCenterPanel } from "./realtime/RealtimeReportCenterPanel";
import {
  resolveRuntimeDataMode,
  type RuntimeDataMode,
} from "./runtimeDataMode";
import {
  apiPendingOperationalIdentity,
  apiPendingShellIdentity,
} from "./runtimeIdentity";
import { approvedBusinessReportDatasets } from "./data/businessReportDatasets";

export interface FormalEnterprisePrototypeProps {
  initialSearch?: string;
  operationalIdentity?: OperationalScopeIdentity;
  dataMode?: RuntimeDataMode;
  repository?: RealtimeBusinessRepository;
}

const reportActorPosts: Readonly<Record<string, string>> = {
  "regional-data-admin": "区域数据管理员",
  "business-reviewer": "报告复核岗",
};

const scopeIssueLabels: Readonly<
  Record<OperationalScopeIssue["code"], string>
> = {
  "unknown-or-unauthorized-region": "地区不在当前授权范围",
  "unknown-or-unauthorized-business-subtype": "业务分类不可用",
  "unknown-or-unauthorized-product": "产品或作物不可用",
  "unknown-or-unauthorized-cultivar": "具体品种不可用",
  "unknown-or-unauthorized-release-version": "采用数据不可用",
  "invalid-data-layer": "数据状态不可用",
};

const localBackendRegionCodes: Readonly<Record<string, string>> = {
  "authorized-all": "230200",
  "qiqihar-all": "230200",
  "qiqihar-longsha": "230202",
  "qiqihar-jianhua": "230203",
  "qiqihar-tiefeng": "230204",
  "qiqihar-angangxi": "230205",
  "qiqihar-fularji": "230206",
  "qiqihar-nianzishan": "230207",
  "qiqihar-meilisi": "230208",
  "qiqihar-nehe": "230281",
  "qiqihar-longjiang": "230221",
  "qiqihar-yian": "230223",
  "qiqihar-tailai": "230224",
  "qiqihar-gannan": "230225",
  "qiqihar-fuyu": "230227",
  "qiqihar-keshan": "230229",
  "qiqihar-kedong": "230230",
  "qiqihar-baiquan": "230231",
};

function realtimeSupplyProductCode(section: string): string {
  if (section === "soybean-balance") return "SOYBEAN";
  if (section === "paddy-balance") return "RICE";
  return "CORN";
}

function realtimeSupplyRegionCode(regionId: string): string {
  return localBackendRegionCodes[regionId] ?? "230200";
}

function realtimeSupplyMarketingYear(periodKey: string | undefined): string {
  return periodKey && periodKey.includes("-") ? periodKey : "2026-W32";
}

function scopeIssueSummary(issues: readonly OperationalScopeIssue[]): string {
  return [...new Set(issues.map(({ code }) => scopeIssueLabels[code]))].join(
    "、",
  );
}

function RealtimeEntryDialog({
  label,
  children,
  onClose,
}: {
  label: string;
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="realtime-entry-overlay">
      <section
        aria-label={label}
        aria-modal="true"
        className="realtime-entry-dialog"
        role="dialog"
      >
        <button
          aria-label={`关闭${label}`}
          className="realtime-entry-dialog__close"
          onClick={onClose}
          type="button"
        >
          ×
        </button>
        {children}
      </section>
    </div>
  );
}

export function FormalEnterprisePrototype({
  initialSearch,
  operationalIdentity,
  dataMode,
  repository = realtimeBusinessRepository,
}: FormalEnterprisePrototypeProps) {
  const environment = import.meta.env as unknown as Readonly<
    Record<string, unknown>
  >;
  const runtimeDataMode =
    dataMode ??
    resolveRuntimeDataMode({
      environmentMode:
        typeof environment["MODE"] === "string"
          ? environment["MODE"]
          : "production",
      requestedMode: environment["VITE_REALTIME_DATA_MODE"],
    });
  const realtimeMode = runtimeDataMode === "api";
  const [currentSession, setCurrentSession] = useState<CurrentSession | null>(
    null,
  );
  useEffect(() => {
    if (!realtimeMode || typeof repository.loadCurrentSession !== "function")
      return;
    let cancelled = false;
    void repository
      .loadCurrentSession()
      .then((session) => {
        if (!cancelled) setCurrentSession(session);
      })
      .catch(() => {
        if (!cancelled) setCurrentSession(null);
      });
    return () => {
      cancelled = true;
    };
  }, [realtimeMode, repository]);
  const effectiveOperationalIdentity =
    operationalIdentity ??
    (realtimeMode
      ? apiPendingOperationalIdentity
      : prototypeOperationalIdentity);
  const shellIdentity = realtimeMode
    ? currentSession
      ? {
          ...apiPendingShellIdentity,
          account: {
            ...apiPendingShellIdentity.account,
            displayName: currentSession.displayName,
          },
        }
      : apiPendingShellIdentity
    : prototypeShellIdentity;
  const { location, scope, issues, queryAllowed, navigate, updateCoordinates } =
    useFormalEnterpriseLocation(effectiveOperationalIdentity, initialSearch);
  const currentDisplayName =
    currentSession?.displayName ??
    ("displayName" in scope.identity
      ? (scope.identity.displayName ?? "当前填报人")
      : "当前填报人");
  const [reportContext, setReportContext] =
    useState<BusinessReportContext | null>(null);
  const [reportWorkflow] = useState(() =>
    realtimeMode
      ? createEmptyBusinessReportWorkflow()
      : createPrototypeBusinessReportWorkflow(
          typeof window === "undefined" ? undefined : window.localStorage,
        ),
  );
  const reportRecords = useSyncExternalStore(
    reportWorkflow.subscribe,
    reportWorkflow.getSnapshot,
    reportWorkflow.getSnapshot,
  );
  const [initialOperationalState] = useState(() =>
    realtimeMode
      ? {
          status: "empty" as const,
          state: createEmptyPrototypeOperationalState(),
        }
      : loadPrototypeOperationalState(
          typeof window === "undefined" ? undefined : window.localStorage,
        ),
  );
  const [operationalState, setOperationalState] = useState(
    initialOperationalState.state,
  );
  const [persistenceBlocked, setPersistenceBlocked] = useState(
    initialOperationalState.status === "blocked",
  );
  const [persistenceMessage, setPersistenceMessage] = useState(
    initialOperationalState.message ?? "",
  );
  const [realtimeStatus, setRealtimeStatus] = useState<
    "connecting" | "connected" | "empty" | "error" | "demo"
  >(realtimeMode ? "connecting" : "demo");
  const [realtimeRefreshToken, setRealtimeRefreshToken] = useState(0);
  const [realtimeEntryDomain, setRealtimeEntryDomain] = useState<
    "production" | "market" | "logistics" | null
  >(null);
  const [realtimeLogisticsProductCode, setRealtimeLogisticsProductCode] =
    useState("CORN");
  const navigateAndCloseEntry = (
    ...parameters: Parameters<typeof navigate>
  ) => {
    setRealtimeEntryDomain(null);
    navigate(...parameters);
  };
  const openBusinessWork = (...parameters: Parameters<typeof navigate>) => {
    const [route, selection] = parameters;
    setRealtimeEntryDomain(
      realtimeMode && selection?.type === "work-item"
        ? route.application === "production"
          ? "production"
          : route.application === "market"
            ? route.section === "logistics"
              ? "logistics"
              : "market"
            : null
        : null,
    );
    navigate(...parameters);
  };
  const {
    workItems,
    marketDocumentDrafts,
    productionDocumentDrafts,
    marketRegistryObjects,
    productionRegistryObjects,
  } = operationalState;
  const currentWorkItems = useMemo(
    () => projectReportWorkflowIntoWorkItems(workItems, reportRecords),
    [reportRecords, workItems],
  );

  useEffect(() => {
    if (realtimeMode || persistenceBlocked) return;
    const result = savePrototypeOperationalState(
      typeof window === "undefined" ? undefined : window.localStorage,
      operationalState,
    );
    if (result.status === "blocked") {
      queueMicrotask(() => {
        setPersistenceBlocked(true);
        setPersistenceMessage(result.message);
      });
    }
  }, [operationalState, persistenceBlocked, realtimeMode]);

  useEffect(() => {
    if (!realtimeMode) return;
    let cancelled = false;
    void Promise.all([
      repository.loadMasterData(),
      repository.listWorkItems({
        scope: "PENDING",
        page: 0,
        pageSize: 100,
      }),
    ])
      .then(([masterData, workPage]) => {
        if (cancelled) return;
        const workItems = projectRealtimeWorkItems(
          workPage.items,
          masterData.products,
        );
        setOperationalState((current) => ({ ...current, workItems }));
        setRealtimeStatus(
          masterData.periods.length === 0 ? "empty" : "connected",
        );
        if (masterData.periods.length === 0) {
          setPersistenceMessage("当前没有可用业务期间或待办记录。");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setRealtimeStatus("error");
        setPersistenceMessage("业务数据读取失败，请稍后重试或联系系统管理员。");
      });
    return () => {
      cancelled = true;
    };
  }, [realtimeMode, realtimeRefreshToken, repository]);

  useEffect(() => {
    if (!realtimeMode) return;
    const timer = window.setInterval(() => {
      setRealtimeRefreshToken((value) => value + 1);
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [realtimeMode]);

  const updateWorkItem = (next: BusinessWorkItem) => {
    setOperationalState((current) => ({
      ...current,
      workItems: current.workItems.map((item) =>
        item.workId === next.workId ? next : item,
      ),
    }));
  };

  const updateMarketDocumentDraft = (
    workId: string,
    draft: MarketDocumentDraft,
  ) => {
    setOperationalState((current) => ({
      ...current,
      marketDocumentDrafts: {
        ...current.marketDocumentDrafts,
        [workId]: draft,
      },
    }));
  };

  const updateProductionDocumentDraft = (
    workId: string,
    draft: ProductionDocumentDraft,
  ) => {
    setOperationalState((current) => ({
      ...current,
      productionDocumentDrafts: {
        ...current.productionDocumentDrafts,
        [workId]: draft,
      },
    }));
  };

  const rebuildOperationalState = () => {
    if (realtimeMode) return;
    const result = savePrototypeOperationalState(
      typeof window === "undefined" ? undefined : window.localStorage,
      operationalState,
    );
    if (result.status === "blocked") {
      setPersistenceMessage(result.message);
      return;
    }
    setPersistenceBlocked(false);
    setPersistenceMessage("");
  };

  const workspace = (() => {
    switch (location.route.application) {
      case "overview":
        if (location.route.section === "map") {
          return <OverviewMonitoringFrame />;
        }
        return (
          <FormalExecutiveOverviewWorkspace
            section={location.route.section}
            onOpenRoute={navigateAndCloseEntry}
            scope={scope}
            onScopeChange={updateCoordinates}
            reportRecords={reportRecords}
            workItems={currentWorkItems}
          />
        );
      case "production":
        return (
          <FormalProductionMonitoringWorkspace
            queryAllowed={queryAllowed}
            scope={scope}
            onScopeChange={updateCoordinates}
            section={location.route.section}
            selection={location.selection}
            onSelectionChange={(selection) =>
              navigateAndCloseEntry(location.route, selection)
            }
            onSelectionClear={() => navigateAndCloseEntry(location.route)}
            onComposeReport={setReportContext}
            registryObjects={productionRegistryObjects}
            onRegistryObjectsChange={(objects) =>
              setOperationalState((current) => ({
                ...current,
                productionRegistryObjects: objects,
              }))
            }
            documentDrafts={productionDocumentDrafts}
            onDocumentDraftChange={updateProductionDocumentDraft}
            onWorkItemChange={updateWorkItem}
            workItems={currentWorkItems}
            onCreateRecord={
              realtimeMode
                ? () => setRealtimeEntryDomain("production")
                : undefined
            }
            realtimeRepository={realtimeMode ? repository : undefined}
            realtimeRefreshToken={realtimeRefreshToken}
          />
        );
      case "market":
        return (
          <FormalMarketMonitoringWorkspace
            queryAllowed={queryAllowed}
            scope={scope}
            onScopeChange={updateCoordinates}
            section={location.route.section}
            selection={location.selection}
            onSelectionChange={(selection) =>
              navigateAndCloseEntry(location.route, selection)
            }
            onSelectionClear={() => navigateAndCloseEntry(location.route)}
            onComposeReport={setReportContext}
            workItems={currentWorkItems}
            documentDrafts={marketDocumentDrafts}
            onDocumentDraftChange={updateMarketDocumentDraft}
            onWorkItemChange={updateWorkItem}
            registryObjects={marketRegistryObjects}
            onRegistryObjectsChange={(objects) =>
              setOperationalState((current) => ({
                ...current,
                marketRegistryObjects: objects,
              }))
            }
            onCreateRecord={
              realtimeMode
                ? (productCode) => {
                    if (location.route.section === "logistics") {
                      setRealtimeLogisticsProductCode(productCode ?? "CORN");
                    }
                    setRealtimeEntryDomain(
                      location.route.section === "logistics"
                        ? "logistics"
                        : "market",
                    );
                  }
                : undefined
            }
            realtimeRepository={realtimeMode ? repository : undefined}
            realtimeRefreshToken={realtimeRefreshToken}
          />
        );
      case "supply":
        if (realtimeMode) {
          return (
            <RealtimeSupplyBalancePanel
              productCode={realtimeSupplyProductCode(location.route.section)}
              regionCode={realtimeSupplyRegionCode(scope.coordinates.regionId)}
              marketingYear={realtimeSupplyMarketingYear(
                scope.coordinates.periodKey,
              )}
            />
          );
        }
        return (
          <FormalSupplyDemandWorkspace
            queryAllowed={queryAllowed}
            scope={scope}
            onScopeChange={updateCoordinates}
            section={location.route.section}
            selection={location.selection}
            onComposeReport={setReportContext}
            onWorkItemChange={updateWorkItem}
            workItems={currentWorkItems}
          />
        );
      case "reporting":
        if (realtimeMode)
          return <RealtimeReportCenterPanel repository={repository} />;
        return (
          <FormalReportCenterWorkspace
            queryAllowed={queryAllowed}
            scope={scope}
            onScopeChange={updateCoordinates}
            section={location.route.section}
            onComposeReport={setReportContext}
            workflow={reportWorkflow}
            requestedDataBatchId={
              location.selection?.type === "report"
                ? location.selection.id
                : undefined
            }
            requestedWorkItemId={
              location.selection?.type === "work-item"
                ? location.selection.id
                : undefined
            }
            workItems={currentWorkItems}
          />
        );
      case "work":
        return (
          <FormalMyWorkWorkspace
            scope={scope}
            onScopeChange={updateCoordinates}
            section={location.route.section}
            onOpenBusiness={openBusinessWork}
            workItems={currentWorkItems}
          />
        );
    }
  })();

  const realtimeEntry = (() => {
    if (!realtimeMode || realtimeEntryDomain === null) return null;
    if (realtimeEntryDomain === "logistics") {
      return (
        <RealtimeEntryDialog
          label="新建物流监测填报"
          onClose={() => setRealtimeEntryDomain(null)}
        >
          <RealtimeLogisticsOperationsPanel
            actorName={currentDisplayName}
            editorOnly
            productCode={realtimeLogisticsProductCode}
            repository={repository}
            onCancel={() => setRealtimeEntryDomain(null)}
            onRecordsChanged={() =>
              setRealtimeRefreshToken((value) => value + 1)
            }
            onSaved={() => setRealtimeEntryDomain(null)}
          />
        </RealtimeEntryDialog>
      );
    }
    return (
      <RealtimeEntryDialog
        label={
          realtimeEntryDomain === "production" ? "新建产情填报" : "新建市场填报"
        }
        onClose={() => setRealtimeEntryDomain(null)}
      >
        <RealtimeBusinessOperationsPanel
          actorName={currentDisplayName}
          domain={realtimeEntryDomain}
          editorOnly
          repository={repository}
          onCancel={() => setRealtimeEntryDomain(null)}
          onRecordsChanged={() => setRealtimeRefreshToken((value) => value + 1)}
          onSaved={() => setRealtimeEntryDomain(null)}
        />
      </RealtimeEntryDialog>
    );
  })();

  return (
    <EnterpriseShell
      location={location}
      marketObjects={marketRegistryObjects}
      onNavigate={navigateAndCloseEntry}
      productionObjects={productionRegistryObjects}
      reportDatasets={realtimeMode ? [] : approvedBusinessReportDatasets}
      shellIdentity={shellIdentity}
      scope={scope}
      queryAllowed={queryAllowed}
      workItems={currentWorkItems}
    >
      {persistenceMessage && (
        <section
          aria-label="工作状态恢复提示"
          className="formal-scope-recovery"
          role="alert"
        >
          <div>
            <strong>工作状态需要处理</strong>
            <span>{persistenceMessage}</span>
          </div>
          {persistenceBlocked && (
            <button type="button" onClick={rebuildOperationalState}>
              重建工作状态
            </button>
          )}
        </section>
      )}
      {!queryAllowed && (
        <section
          aria-live="polite"
          className="formal-scope-recovery"
          role="alert"
        >
          <div>
            <strong>当前筛选条件不可用</strong>
            <span>
              {scopeIssueSummary(issues)}。系统未使用其他地区或产品的数据。
            </span>
          </div>
          <button
            onClick={() =>
              updateCoordinates({
                regionId: "authorized-all",
                businessDomainId: undefined,
                businessSubtypeId: undefined,
                productId: undefined,
                cultivarId: undefined,
                releaseVersion: undefined,
                dataLayer: "official",
              })
            }
            type="button"
          >
            恢复全部已授权范围
          </button>
        </section>
      )}
      {realtimeMode && realtimeStatus !== "connected" && (
        <section
          aria-label="业务数据状态"
          className="formal-scope-recovery"
          role={realtimeStatus === "error" ? "alert" : "status"}
        >
          <div>
            <strong>
              {realtimeStatus === "connecting"
                ? "正在读取业务数据"
                : realtimeStatus === "empty"
                  ? "当前暂无可用业务数据"
                  : "业务数据读取失败"}
            </strong>
            <span>
              {realtimeStatus === "empty"
                ? "请确认业务期间和责任范围后重试。"
                : "请稍后重试或联系系统管理员。"}
            </span>
          </div>
        </section>
      )}
      {workspace}
      {realtimeEntry}
      {!realtimeMode && reportContext && (
        <BusinessReportComposer
          actorPost={reportActorPosts[scope.identity.postId] ?? "当前登录岗位"}
          context={reportContext}
          onClose={() => setReportContext(null)}
          permissionKeys={scope.authorization.permissionKeys}
          workflow={reportWorkflow}
        />
      )}
    </EnterpriseShell>
  );
}
