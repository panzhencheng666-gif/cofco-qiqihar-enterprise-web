import { useMemo, useState } from "react";
import type {
  CurrentSession,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";
import type { OperationalScope } from "./core/operationalScope";
import type {
  BusinessCoordinates,
  FormalSelection,
} from "./formalEnterpriseModel";
import { MarketMonitoringWorkspace } from "./MarketMonitoringWorkspace";
import { ProductionMonitoringWorkspace } from "./ProductionMonitoringWorkspace";

import { taskRepository } from "./taskRepository";

export function MyTasksWorkspace({
  initialDomain = "market",
  repository,
  session,
  scope,
  onScopeChange,
  refreshToken,
  selection,
  onSelectionChange,
  onSelectionClear,
  onCreateRecord,
  onViewRecord,
}: {
  initialDomain?: "market" | "production" | "logistics";
  repository: RealtimeBusinessRepository;
  session: CurrentSession;
  scope: OperationalScope;
  onScopeChange: (coordinates: Partial<BusinessCoordinates>) => void;
  refreshToken: number;
  selection?: FormalSelection;
  onSelectionChange: (selection: FormalSelection) => void;
  onSelectionClear: () => void;
  onCreateRecord: (
    domain: "market" | "production" | "logistics",
    product: "CORN" | "SOYBEAN" | "RICE",
  ) => void;
  onViewRecord: (
    domain: "market" | "production" | "logistics",
    product: "CORN" | "SOYBEAN" | "RICE",
    id: string,
  ) => void;
}) {
  const [domain, setDomain] = useState<"market" | "production" | "logistics">(
    initialDomain,
  );
  const [product, setProduct] = useState<"CORN" | "SOYBEAN" | "RICE">("CORN");
  const scopedRepository = useMemo(
    () => taskRepository(repository),
    [repository, session],
  );
  const assigned =
    session.roleCodes.includes("ADMIN") ||
    session.rootAdministrator ||
    session.regionCodes.length > 0;
  const common = {
    scope: {
      ...scope,
      authorization: {
        ...scope.authorization,
        authorizedRegionIds: (session.roleCodes.includes("ADMIN") ||
        session.rootAdministrator
          ? ["*"]
          : session.regionCodes) as typeof scope.authorization.authorizedRegionIds,
      },
    },
    onScopeChange,
    selection,
    onSelectionChange,
    onSelectionClear,
    queryAllowed: true,
    realtimeRepository: scopedRepository,
    realtimeRefreshToken: refreshToken,
    permissions: session.permissions.includes("BUSINESS_CREATE")
      ? [
          ...new Set([
            ...session.permissions,
            "FORMAL_SAMPLE_MANAGE",
            "FORMAL_SAMPLE_DELETE",
          ]),
        ]
      : session.permissions,
    readOnly: false,
    onComposeReport: () => undefined,
    onCreateRecord: (code: "CORN" | "SOYBEAN" | "RICE") =>
      onCreateRecord(domain, code),
  };
  const prefix =
    product === "CORN" ? "corn" : product === "SOYBEAN" ? "soybean" : "paddy";
  return (
    <section aria-label="我的任务">
      <h1>我的任务</h1>
      <div className="enterprise-ledger-table__toolbar">
        <div role="tablist" aria-label="任务业务类型">
          {(
            [
              ["market", "市场"],
              ["production", "产情"],
              ["logistics", "物流"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={domain === value}
              onClick={() => {
                setDomain(value);
                onSelectionClear();
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <label>
          品种{" "}
          <select
            aria-label="任务品种"
            value={product}
            onChange={(event) => {
              setProduct(event.target.value as typeof product);
              onSelectionClear();
            }}
          >
            <option value="CORN">玉米</option>
            <option value="SOYBEAN">大豆</option>
            <option value="RICE">稻谷</option>
          </select>
        </label>
      </div>
      {!assigned ? (
        <p role="status">暂未分配责任地区</p>
      ) : domain === "production" ? (
        <ProductionMonitoringWorkspace
          key={`${domain}:${product}`}
          {...common}
          section={
            product === "RICE"
              ? "rice-collection"
              : `${prefix as "corn" | "soybean"}-collection`
          }
          onEditRecord={(code, id) => onViewRecord(domain, code, id)}
        />
      ) : (
        <MarketMonitoringWorkspace
          key={`${domain}:${product}`}
          {...common}
          section={`${prefix}-${domain === "logistics" ? "logistics" : "collection"}`}
          onEditRecord={onViewRecord}
        />
      )}
    </section>
  );
}
