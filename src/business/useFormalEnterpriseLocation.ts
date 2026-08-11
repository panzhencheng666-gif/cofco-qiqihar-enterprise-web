import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  normalizeFormalLocation,
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
  routeInput = window.location.href,
  storedLocation?: FormalLocation,
): FormalLocationReadResult {
  const routeResult = readFormalLocation(routeInput, authority);
  return storedLocation
    ? normalizeFormalLocation(
        { ...storedLocation, route: routeResult.location.route },
        authority,
      )
    : routeResult;
}

function writeLocation(location: FormalLocation, mode: "push" | "replace") {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = writeFormalLocation(location);
  window.history[mode === "push" ? "pushState" : "replaceState"](
    { formalLocation: location },
    "",
    url,
  );
}

function defaultCoordinates(): BusinessCoordinates {
  return { regionId: "authorized-all" };
}

function historyFormalLocation(state: unknown): FormalLocation | undefined {
  if (!state || typeof state !== "object" || !("formalLocation" in state)) {
    return undefined;
  }
  const location = (state as { formalLocation?: unknown }).formalLocation;
  return location && typeof location === "object"
    ? (location as FormalLocation)
    : undefined;
}

export function useFormalEnterpriseLocation(
  authority: FormalLocationAuthority,
  initialSearch?: string,
) {
  const [result, setResult] = useState<FormalLocationReadResult>(() => {
    const storedLocation =
      initialSearch === undefined
        ? historyFormalLocation(window.history.state)
        : undefined;
    return readCurrentLocation(
      authority,
      initialSearch ?? window.location.href,
      storedLocation,
    );
  });
  const coordinatesByApplication = useRef<
    Partial<Record<FormalRoute["application"], BusinessCoordinates>>
  >({
    [result.location.route.application]: result.location.coordinates,
  });
  const normalizedResult = useMemo(
    () => normalizeFormalLocation(result.location, authority),
    [authority, result.location],
  );

  useLayoutEffect(() => {
    writeLocation(normalizedResult.location, "replace");
  }, [normalizedResult.location]);

  const apply = useCallback(
    (location: FormalLocation, mode?: "push" | "replace") => {
      const next = normalizeFormalLocation(location, authority);
      coordinatesByApplication.current[next.location.route.application] =
        next.location.coordinates;
      if (mode) writeLocation(next.location, mode);
      setResult(next);
    },
    [authority],
  );

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const routeResult = readCurrentLocation(authority);
      const stored = historyFormalLocation(event.state);
      const next = stored
        ? normalizeFormalLocation(
            { ...stored, route: routeResult.location.route },
            authority,
          )
        : {
            ...routeResult,
            location: {
              ...routeResult.location,
              coordinates:
                coordinatesByApplication.current[
                  routeResult.location.route.application
                ] ?? defaultCoordinates(),
            },
          };
      coordinatesByApplication.current[next.location.route.application] =
        next.location.coordinates;
      writeLocation(next.location, "replace");
      setResult(next);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [authority, initialSearch]);

  const navigate = useCallback(
    (route: FormalRoute, selection?: FormalSelection) => {
      const current = normalizedResult.location;
      coordinatesByApplication.current[current.route.application] =
        current.coordinates;
      const coordinates =
        route.application === current.route.application
          ? current.coordinates
          : (coordinatesByApplication.current[route.application] ??
            defaultCoordinates());
      apply(
        {
          route,
          coordinates,
          ...(selection ? { selection } : {}),
        },
        "push",
      );
    },
    [apply, normalizedResult.location],
  );

  const updateCoordinates = useCallback(
    (coordinates: Partial<BusinessCoordinates>) => {
      apply(
        {
          ...normalizedResult.location,
          coordinates: {
            ...normalizedResult.location.coordinates,
            ...coordinates,
          },
        },
        "replace",
      );
    },
    [apply, normalizedResult.location],
  );

  const setSavedViewId = useCallback(
    (savedViewId?: string) => {
      const next = {
        ...normalizedResult.location,
        ...(savedViewId ? { savedViewId } : {}),
      };
      if (!savedViewId) delete next.savedViewId;
      apply(next, "replace");
    },
    [apply, normalizedResult.location],
  );

  return {
    location: normalizedResult.location,
    scope:
      normalizedResult.location &&
      ({
        ...toScope(authority, normalizedResult.location.coordinates),
        savedView: null,
      } satisfies OperationalScope),
    issues: normalizedResult.issues,
    queryAllowed: normalizedResult.queryAllowed,
    navigate,
    updateCoordinates,
    setSavedViewId,
  };
}

function toScope(
  authority: FormalLocationAuthority,
  coordinates: BusinessCoordinates,
) {
  if ("workUnit" in authority) return { ...authority, coordinates };
  return {
    workUnit: {
      organizationId: "current-organization",
      unitId: "current-unit",
      label: "当前工作单位",
    },
    identity: { userId: "current-user", postId: "current-post" },
    authorization: authority,
    coordinates,
  };
}
