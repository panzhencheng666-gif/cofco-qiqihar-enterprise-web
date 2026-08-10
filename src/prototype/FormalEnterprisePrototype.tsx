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
import { IdentityGovernancePanel } from "./identity/IdentityGovernancePanel";
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
import { RealtimeApiError } from "@/platform/api/realtimeApiClient";
import type {
  BusinessNotificationRow,
  CurrentSession,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";
import { RealtimeBusinessOperationsPanel } from "./realtime/RealtimeBusinessOperationsPanel";
import { RealtimeSupplyBalancePanel } from "./realtime/RealtimeSupplyBalancePanel";
import { RealtimeLogisticsOperationsPanel } from "./realtime/RealtimeLogisticsOperationsPanel";
import { RealtimeReportCenterPanel } from "./realtime/RealtimeReportCenterPanel";
import { RealtimeWorkObligationReportPanel } from "./realtime/RealtimeWorkObligationReportPanel";
import {
  resolveRuntimeDataMode,
  type RuntimeDataMode,
} from "./runtimeDataMode";
import {
  apiPendingOperationalIdentity,
  apiPendingShellIdentity,
} from "./runtimeIdentity";
import { approvedBusinessReportDatasets } from "./data/businessReportDatasets";
import { createFormalRoute } from "./formalEnterpriseModel";

export interface FormalEnterprisePrototypeProps {
  initialSearch?: string;
  operationalIdentity?: OperationalScopeIdentity;
  dataMode?: RuntimeDataMode;
  repository?: RealtimeBusinessRepository;
  identityManagementUrl?: string;
  loginUrl?: string;
  logoutUrl?: string;
}

const reportActorPosts: Readonly<Record<string, string>> = {
  "regional-data-admin": "区域数据管理员",
  "business-reviewer": "报告复核岗",
};

type RealtimeProductCode = "CORN" | "SOYBEAN" | "RICE";
type SessionStatus =
  | "not-required"
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "forbidden"
  | "error";

function EnterpriseSessionBoundary({
  loginUrl,
  status,
}: {
  loginUrl?: string;
  status: Exclude<SessionStatus, "not-required" | "authenticated">;
}) {
  const content =
    status === "loading"
      ? {
          title: "正在确认企业身份",
          detail: "正在校验账号、工作单位、岗位和责任范围。",
        }
      : status === "unauthenticated"
        ? {
            title: "登录企业账号",
            detail: "本系统仅供已由管理员建档的员工使用，不提供公众自行注册。",
          }
        : status === "forbidden"
          ? {
              title: "账号暂不可用",
              detail:
                "账号尚未激活、已停用或未分配岗位与责任范围，请联系本单位系统管理员处理。",
            }
          : {
              title: "身份服务暂时不可用",
              detail: "系统无法完成企业身份校验，请稍后重试或联系系统管理员。",
            };
  return (
    <main className="enterprise-session-boundary">
      <section aria-live="polite" className="enterprise-session-card">
        <div className="enterprise-session-brand" aria-hidden="true">
          齐
        </div>
        <p>齐齐哈尔粮食商情企业平台</p>
        <h1>{content.title}</h1>
        <span>{content.detail}</span>
        {status === "unauthenticated" && loginUrl && (
          <a className="enterprise-session-action" href={loginUrl}>
            进入统一身份认证
          </a>
        )}
        {status === "unauthenticated" && !loginUrl && (
          <small>企业统一身份认证入口尚未配置，请联系系统管理员。</small>
        )}
      </section>
    </main>
  );
}

function normalizeCurrentSession(session: CurrentSession): CurrentSession {
  return {
    ...session,
    workUnitName: session.workUnitName || session.workUnitCode,
    accountStatus: session.accountStatus || "ACTIVE",
    employmentStatus: session.employmentStatus || "ACTIVE",
    roleCodes: session.roleCodes ?? [],
    positions: session.positions ?? [],
    permissions: session.permissions ?? [],
    regionCodes: session.regionCodes ?? [],
  };
}

function routeProductCode(section: string): RealtimeProductCode | null {
  if (section.startsWith("corn-")) return "CORN";
  if (section.startsWith("soybean-")) return "SOYBEAN";
  if (section.startsWith("rice-") || section.startsWith("paddy-"))
    return "RICE";
  return null;
}

function realtimeEntryRoute(
  application: "production" | "market",
  productId: string | null,
  businessSubtypeId?: string,
) {
  const normalizedProduct = productId?.toUpperCase();
  if (
    normalizedProduct !== "CORN" &&
    normalizedProduct !== "SOYBEAN" &&
    normalizedProduct !== "RICE"
  )
    return null;
  const product =
    normalizedProduct === "SOYBEAN"
      ? "soybean"
      : normalizedProduct === "RICE"
        ? "paddy"
        : "corn";
  if (application === "production") {
    if (product === "soybean")
      return createFormalRoute("production", "soybean-collection");
    if (product === "paddy")
      return createFormalRoute("production", "rice-collection");
    return createFormalRoute("production", "corn-collection");
  }
  if (businessSubtypeId === "market.logistics") {
    if (product === "soybean")
      return createFormalRoute("market", "soybean-logistics");
    if (product === "paddy")
      return createFormalRoute("market", "paddy-logistics");
    return createFormalRoute("market", "corn-logistics");
  }
  if (product === "soybean")
    return createFormalRoute("market", "soybean-collection");
  if (product === "paddy")
    return createFormalRoute("market", "paddy-collection");
  return createFormalRoute("market", "corn-collection");
}

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
  identityManagementUrl,
  loginUrl,
  logoutUrl,
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
  const resolvedLoginUrl =
    loginUrl ??
    (typeof environment["VITE_LOGIN_URL"] === "string"
      ? environment["VITE_LOGIN_URL"]
      : undefined);
  const resolvedIdentityManagementUrl =
    identityManagementUrl ??
    (typeof environment["VITE_IDENTITY_MANAGEMENT_URL"] === "string"
      ? environment["VITE_IDENTITY_MANAGEMENT_URL"]
      : undefined);
  const resolvedLogoutUrl =
    logoutUrl ??
    (typeof environment["VITE_LOGOUT_URL"] === "string"
      ? environment["VITE_LOGOUT_URL"]
      : undefined);
  const [currentSession, setCurrentSession] = useState<CurrentSession | null>(
    null,
  );
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>(
    realtimeMode ? "loading" : "not-required",
  );
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (!realtimeMode) {
        setCurrentSession(null);
        setSessionStatus("not-required");
        return;
      }
      if (typeof repository.loadCurrentSession !== "function") {
        setCurrentSession(null);
        setSessionStatus("error");
        return;
      }
      setCurrentSession(null);
      setSessionStatus("loading");
      void repository
        .loadCurrentSession()
        .then((session) => {
          if (cancelled) return;
          setCurrentSession(normalizeCurrentSession(session));
          setSessionStatus("authenticated");
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          setCurrentSession(null);
          const status =
            error instanceof RealtimeApiError
              ? error.status
              : typeof error === "object" && error !== null && "status" in error
                ? Number(error.status)
                : 0;
          setSessionStatus(
            status === 401
              ? "unauthenticated"
              : status === 403
                ? "forbidden"
                : "error",
          );
        });
    });
    return () => {
      cancelled = true;
    };
  }, [realtimeMode, repository]);
  const sessionReady = !realtimeMode || sessionStatus === "authenticated";
  const effectiveOperationalIdentity = useMemo(
    () =>
      operationalIdentity ??
      (realtimeMode
        ? currentSession
          ? {
              ...apiPendingOperationalIdentity,
              workUnit: {
                organizationId: currentSession.workUnitCode,
                unitId: currentSession.workUnitCode,
                label: currentSession.workUnitName,
              },
              identity: {
                userId: currentSession.subjectId,
                postId:
                  currentSession.positions.find(
                    ({ primaryPosition }) => primaryPosition,
                  )?.code ?? "unassigned-position",
                displayName: currentSession.displayName,
              },
              authorization: {
                ...apiPendingOperationalIdentity.authorization,
                authorizedRegionIds:
                  currentSession.regionCodes as OperationalScopeIdentity["authorization"]["authorizedRegionIds"],
                permissionKeys: currentSession.permissions,
              },
            }
          : apiPendingOperationalIdentity
        : prototypeOperationalIdentity),
    [currentSession, operationalIdentity, realtimeMode],
  );
  const shellIdentity = realtimeMode
    ? currentSession
      ? {
          ...apiPendingShellIdentity,
          workUnit: {
            organizationLabel: currentSession.workUnitName,
            currentUnitLabel: currentSession.workUnitName,
            units: [currentSession.workUnitName],
          },
          account: {
            ...apiPendingShellIdentity.account,
            displayName: currentSession.displayName,
            roleLabel:
              currentSession.positions.find(
                ({ primaryPosition }) => primaryPosition,
              )?.name ?? "未分配岗位",
            responsibilityLabel: `${currentSession.regionCodes.length} 个责任地区`,
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
  const [identityPanelView, setIdentityPanelView] = useState<
    "profile" | "organization" | null
  >(null);
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
  const [businessNotifications, setBusinessNotifications] = useState<
    readonly BusinessNotificationRow[]
  >([]);
  const [businessNotificationUnreadCount, setBusinessNotificationUnreadCount] =
    useState(0);
  const notificationsConfigured =
    sessionReady &&
    realtimeMode &&
    typeof repository.listNotifications === "function" &&
    typeof repository.subscribeBusinessEvents === "function";
  const [realtimeEntryDomain, setRealtimeEntryDomain] = useState<
    "production" | "market" | "logistics" | null
  >(null);
  const [realtimeEntryProductCode, setRealtimeEntryProductCode] =
    useState<RealtimeProductCode>("CORN");
  const [realtimeEntryRecordId, setRealtimeEntryRecordId] = useState<string>();
  const [realtimeEntryMode, setRealtimeEntryMode] = useState<
    "entry" | "view" | "review"
  >("entry");
  const closeRealtimeEntry = () => {
    setRealtimeEntryDomain(null);
    setRealtimeEntryRecordId(undefined);
    setRealtimeEntryMode("entry");
  };
  const navigateAndCloseEntry = (
    ...parameters: Parameters<typeof navigate>
  ) => {
    closeRealtimeEntry();
    navigate(...parameters);
  };
  const openBusinessWork = (...parameters: Parameters<typeof navigate>) => {
    const [route, selection] = parameters;
    const selectedWorkItem =
      realtimeMode && selection?.type === "work-item"
        ? operationalState.workItems.find(
            ({ workId }) => workId === selection.id,
          )
        : undefined;
    const resolvedEntryRoute =
      selectedWorkItem &&
      (route.application === "production" || route.application === "market")
        ? realtimeEntryRoute(
            route.application,
            selectedWorkItem.productId,
            selectedWorkItem.businessSubtypeId,
          )
        : null;
    const effectiveRoute = resolvedEntryRoute ?? route;
    const productCode = routeProductCode(effectiveRoute.section);
    if (productCode) setRealtimeEntryProductCode(productCode);
    setRealtimeEntryRecordId(
      selectedWorkItem?.subject.kind === "monitoring-object"
        ? selectedWorkItem.subject.objectId
        : undefined,
    );
    setRealtimeEntryMode(
      selectedWorkItem?.documentStatus === "submitted" &&
        (selectedWorkItem.reviewStatus === "pending" ||
          selectedWorkItem.reviewStatus === "reviewing")
        ? "review"
        : "entry",
    );
    setRealtimeEntryDomain(
      realtimeMode && selection?.type === "work-item" && productCode
        ? effectiveRoute.application === "production"
          ? "production"
          : effectiveRoute.application === "market"
            ? effectiveRoute.section.endsWith("-logistics")
              ? "logistics"
              : "market"
            : null
        : null,
    );
    // Keep the workbench route behind the modal. The resolved business route is only
    // used to select the correct record editor/reviewer; processing a task must not
    // navigate the employee away from "我的工作" into a new-entry page.
    navigate(resolvedEntryRoute ? location.route : route, selection);
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
    if (!realtimeMode || !sessionReady) return;
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
  }, [realtimeMode, realtimeRefreshToken, repository, sessionReady]);

  useEffect(() => {
    if (!notificationsConfigured || !sessionReady) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    const subscribeFrom = (afterSequence: number) => {
      if (cancelled) return;
      unsubscribe = repository.subscribeBusinessEvents(afterSequence, () => {
        setRealtimeRefreshToken((value) => value + 1);
      });
    };
    void repository
      .listNotifications()
      .then((page) => {
        if (cancelled) return;
        setBusinessNotifications(page.items);
        setBusinessNotificationUnreadCount(page.unreadCount);
        subscribeFrom(
          page.items.reduce(
            (latest, notification) => Math.max(latest, notification.sequence),
            0,
          ),
        );
      })
      .catch(() => {
        if (cancelled) return;
        setBusinessNotifications([]);
        setBusinessNotificationUnreadCount(0);
        subscribeFrom(0);
      });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [notificationsConfigured, repository, sessionReady]);

  useEffect(() => {
    if (
      !realtimeMode ||
      !sessionReady ||
      realtimeRefreshToken === 0 ||
      typeof repository.listNotifications !== "function"
    )
      return;
    let cancelled = false;
    void repository
      .listNotifications()
      .then((page) => {
        if (cancelled) return;
        setBusinessNotifications(page.items);
        setBusinessNotificationUnreadCount(page.unreadCount);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [realtimeMode, realtimeRefreshToken, repository, sessionReady]);

  const updateWorkItem = (next: BusinessWorkItem) => {
    setOperationalState((current) => ({
      ...current,
      workItems: current.workItems.map((item) =>
        item.workId === next.workId ? next : item,
      ),
    }));
  };

  const markBusinessNotificationRead = async (id: string) => {
    if (!realtimeMode || typeof repository.markNotificationRead !== "function")
      return;
    const wasUnread = businessNotifications.some(
      (notification) => notification.id === id && !notification.read,
    );
    try {
      const updated = await repository.markNotificationRead(id);
      setBusinessNotifications((current) =>
        current.map((notification) =>
          notification.id === id ? updated : notification,
        ),
      );
      if (wasUnread && updated.read) {
        setBusinessNotificationUnreadCount((current) =>
          Math.max(0, current - 1),
        );
      }
    } catch {
      setBusinessNotifications((current) => [...current]);
    }
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
                ? (productCode) => {
                    setRealtimeEntryProductCode(productCode);
                    setRealtimeEntryRecordId(undefined);
                    setRealtimeEntryMode("entry");
                    setRealtimeEntryDomain("production");
                  }
                : undefined
            }
            onEditRecord={
              realtimeMode
                ? (productCode, recordId) => {
                    setRealtimeEntryProductCode(productCode);
                    setRealtimeEntryRecordId(recordId);
                    setRealtimeEntryMode("view");
                    setRealtimeEntryDomain("production");
                  }
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
                    setRealtimeEntryProductCode(productCode);
                    setRealtimeEntryRecordId(undefined);
                    setRealtimeEntryMode("entry");
                    setRealtimeEntryDomain(
                      location.route.section.endsWith("-logistics")
                        ? "logistics"
                        : "market",
                    );
                  }
                : undefined
            }
            onEditRecord={
              realtimeMode
                ? (domain, productCode, recordId) => {
                    setRealtimeEntryProductCode(productCode);
                    setRealtimeEntryRecordId(recordId);
                    setRealtimeEntryMode("view");
                    setRealtimeEntryDomain(domain);
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
        if (
          realtimeMode &&
          location.route.section === "obligations" &&
          currentSession
        ) {
          return (
            <RealtimeWorkObligationReportPanel
              repository={repository}
              session={currentSession}
            />
          );
        }
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
          label={
            realtimeEntryRecordId
              ? realtimeEntryMode === "review"
                ? "物流监测单据审核"
                : realtimeEntryMode === "view"
                  ? "物流监测记录详情"
                  : "补充物流监测填报"
              : "新建物流监测填报"
          }
          onClose={closeRealtimeEntry}
        >
          <RealtimeLogisticsOperationsPanel
            actorName={currentDisplayName}
            editorOnly
            initialRecordId={realtimeEntryRecordId}
            mode={realtimeEntryMode}
            permissions={currentSession?.permissions ?? []}
            productCode={realtimeEntryProductCode}
            refreshToken={realtimeRefreshToken}
            repository={repository}
            onCancel={closeRealtimeEntry}
            onRecordsChanged={() =>
              setRealtimeRefreshToken((value) => value + 1)
            }
            onSaved={closeRealtimeEntry}
          />
        </RealtimeEntryDialog>
      );
    }
    return (
      <RealtimeEntryDialog
        label={
          realtimeEntryRecordId
            ? realtimeEntryMode === "review"
              ? realtimeEntryDomain === "production"
                ? "产情单据审核"
                : "市场单据审核"
              : realtimeEntryMode === "view"
                ? realtimeEntryDomain === "production"
                  ? "产情记录详情"
                  : "市场记录详情"
                : realtimeEntryDomain === "production"
                  ? "补充产情填报"
                  : "补充市场填报"
            : realtimeEntryDomain === "production"
              ? "新建产情填报"
              : "新建市场填报"
        }
        onClose={closeRealtimeEntry}
      >
        <RealtimeBusinessOperationsPanel
          actorName={currentDisplayName}
          domain={realtimeEntryDomain}
          editorOnly
          initialRecordId={realtimeEntryRecordId}
          lockedProductCode={realtimeEntryProductCode}
          mode={realtimeEntryMode}
          permissions={currentSession?.permissions ?? []}
          refreshToken={realtimeRefreshToken}
          repository={repository}
          onCancel={closeRealtimeEntry}
          onRecordsChanged={() => setRealtimeRefreshToken((value) => value + 1)}
          onSaved={closeRealtimeEntry}
        />
      </RealtimeEntryDialog>
    );
  })();

  if (
    realtimeMode &&
    sessionStatus !== "authenticated" &&
    sessionStatus !== "not-required"
  ) {
    return (
      <EnterpriseSessionBoundary
        loginUrl={resolvedLoginUrl}
        status={sessionStatus}
      />
    );
  }

  return (
    <EnterpriseShell
      location={location}
      marketObjects={marketRegistryObjects}
      onNavigate={navigateAndCloseEntry}
      productionObjects={productionRegistryObjects}
      reportDatasets={realtimeMode ? [] : approvedBusinessReportDatasets}
      businessNotifications={
        realtimeMode
          ? notificationsConfigured
            ? businessNotifications
            : []
          : undefined
      }
      businessNotificationUnreadCount={
        realtimeMode
          ? notificationsConfigured
            ? businessNotificationUnreadCount
            : 0
          : undefined
      }
      onBusinessNotificationRead={markBusinessNotificationRead}
      onIdentityOpen={setIdentityPanelView}
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
      {realtimeMode && currentSession && identityPanelView && (
        <IdentityGovernancePanel
          identityManagementUrl={resolvedIdentityManagementUrl}
          initialView={identityPanelView}
          logoutUrl={resolvedLogoutUrl}
          onClose={() => setIdentityPanelView(null)}
          repository={repository}
          session={currentSession}
        />
      )}
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
