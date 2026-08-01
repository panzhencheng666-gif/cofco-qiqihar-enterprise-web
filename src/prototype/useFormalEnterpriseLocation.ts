import { useCallback, useEffect, useRef, useState } from "react";
import {
  readFormalLocation,
  writeFormalLocation,
  type BusinessCoordinates,
  type FormalLocation,
  type FormalLocationAuthority,
  type FormalLocationReadResult,
  type FormalRoute,
  type FormalSelection,
} from "./formalEnterpriseModel";
import type { OperationalScope } from "./core/operationalScope";

function readCurrentLocation(
  authority: FormalLocationAuthority,
  search = window.location.search,
): FormalLocationReadResult {
  return readFormalLocation(search, authority);
}

function writeLocation(location: FormalLocation, mode: "push" | "replace") {
  const url = new URL(window.location.href);
  const managed = new URLSearchParams(writeFormalLocation(location));
  for (const key of [
    "page", "section", "region", "regionLevel", "businessDomain",
    "businessSubtype", "product", "cultivar", "period", "dataCutoff",
    "dataLayer", "releaseVersion", "riskState", "selectedMetric",
    "selectionType", "selectionId", "savedView",
  ]) url.searchParams.delete(key);
  managed.forEach((value, key) => url.searchParams.set(key, value));
  window.history[mode === "push" ? "pushState" : "replaceState"]({}, "", url);
}

function defaultCoordinates(): BusinessCoordinates {
  return { regionId: "authorized-all" };
}

export function useFormalEnterpriseLocation(
  authority: FormalLocationAuthority,
  initialSearch?: string,
) {
  const [result, setResult] = useState<FormalLocationReadResult>(() =>
    readCurrentLocation(authority, initialSearch),
  );
  const coordinatesByApplication = useRef<Partial<Record<FormalRoute["application"], BusinessCoordinates>>>({
    [result.location.route.application]: result.location.coordinates,
  });

  const apply = useCallback((location: FormalLocation, mode?: "push" | "replace") => {
    const next = readFormalLocation(writeFormalLocation(location), authority);
    coordinatesByApplication.current[next.location.route.application] = next.location.coordinates;
    if (mode) writeLocation(next.location, mode);
    setResult(next);
  }, [authority]);

  useEffect(() => {
    const onPopState = () => {
      const next = readCurrentLocation(authority);
      coordinatesByApplication.current[next.location.route.application] = next.location.coordinates;
      setResult(next);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [authority]);

  const navigate = useCallback((route: FormalRoute, selection?: FormalSelection) => {
    const current = result.location;
    coordinatesByApplication.current[current.route.application] = current.coordinates;
    const coordinates =
      route.application === current.route.application
        ? current.coordinates
        : coordinatesByApplication.current[route.application] ?? defaultCoordinates();
    apply(
      {
        route,
        coordinates,
        ...(selection ? { selection } : {}),
      },
      "push",
    );
  }, [apply, result.location]);

  const updateCoordinates = useCallback((coordinates: Partial<BusinessCoordinates>) => {
    apply(
      {
        ...result.location,
        coordinates: { ...result.location.coordinates, ...coordinates },
      },
      "replace",
    );
  }, [apply, result.location]);

  const setSavedViewId = useCallback((savedViewId?: string) => {
    const next = { ...result.location, ...(savedViewId ? { savedViewId } : {}) };
    if (!savedViewId) delete next.savedViewId;
    apply(next, "replace");
  }, [apply, result.location]);

  return {
    location: result.location,
    scope: result.location && ({
      ...toScope(authority, result.location.coordinates),
      savedView: null,
    } satisfies OperationalScope),
    issues: result.issues,
    queryAllowed: result.queryAllowed,
    navigate,
    updateCoordinates,
    setSavedViewId,
  };
}

function toScope(authority: FormalLocationAuthority, coordinates: BusinessCoordinates) {
  if ("workUnit" in authority) return { ...authority, coordinates };
  return {
    workUnit: { organizationId: "current-organization", unitId: "current-unit", label: "当前工作单位" },
    identity: { userId: "current-user", postId: "current-post" },
    authorization: authority,
    coordinates,
  };
}
