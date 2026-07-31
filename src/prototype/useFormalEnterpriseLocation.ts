import { useCallback, useEffect, useState } from "react";
import {
  readFormalLocation,
  writeFormalLocation,
  type BusinessCoordinates,
  type FormalLocation,
  type FormalRoute,
  type FormalSelection,
} from "./formalEnterpriseModel";

const locationAuthorization = {
  authorizedRegionIds: [],
  authorizedBusinessClassificationIds: [],
  authorizedProductIds: [],
  authorizedCultivarIds: [],
  authorizedReleaseVersionIds: [],
  permissionKeys: [],
} as const;

function readCurrentLocation(search = window.location.search): FormalLocation {
  return readFormalLocation(search, locationAuthorization)
    .location;
}

function writeLocation(location: FormalLocation, mode: "push" | "replace") {
  const url = new URL(window.location.href);
  const managed = new URLSearchParams(writeFormalLocation(location));
  for (const key of [
    "page", "section", "region", "regionLevel", "businessDomain",
    "businessSubtype", "product", "cultivar", "period", "dataCutoff",
    "dataLayer", "releaseVersion", "riskState", "selectedMetric",
    "selectionType", "selectionId", "savedView",
  ]) {
    url.searchParams.delete(key);
  }
  managed.forEach((value, key) => url.searchParams.set(key, value));
  window.history[mode === "push" ? "pushState" : "replaceState"]({}, "", url);
}

export function useFormalEnterpriseLocation(initialSearch?: string) {
  const [location, setLocation] = useState<FormalLocation>(() =>
    readCurrentLocation(initialSearch),
  );

  useEffect(() => {
    const onPopState = () => setLocation(readCurrentLocation());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((route: FormalRoute, selection?: FormalSelection) => {
    setLocation((current) => {
      const next: FormalLocation = {
        ...current,
        route,
        ...(selection ? { selection } : {}),
      };
      writeLocation(next, "push");
      return next;
    });
  }, []);

  const updateCoordinates = useCallback(
    (coordinates: Partial<BusinessCoordinates>) => {
      setLocation((current) => {
        const next = {
          ...current,
          coordinates: { ...current.coordinates, ...coordinates },
        };
        writeLocation(next, "replace");
        return next;
      });
    },
    [],
  );

  const setSavedViewId = useCallback((savedViewId?: string) => {
    setLocation((current) => {
      const next = { ...current, ...(savedViewId ? { savedViewId } : {}) };
      if (!savedViewId) delete next.savedViewId;
      writeLocation(next, "replace");
      return next;
    });
  }, []);

  return { location, navigate, updateCoordinates, setSavedViewId };
}
