import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  ObservableAnalysisQuery,
  ObservableAnalysisSnapshot,
} from "@/platform/api/observableAnalysisContract";
import { ALL_AUTHORIZED_REGION_CODE } from "@/platform/api/observableAnalysisContract";
import { RealtimeApiError } from "@/platform/api/realtimeApiClient";
import type {
  BusinessNotificationRow,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";

type ObservableAnalysisRepository = Pick<
  RealtimeBusinessRepository,
  | "loadObservableAnalysisSnapshot"
  | "listNotifications"
  | "subscribeBusinessEvents"
>;

type SnapshotStatus = "loading" | "ready" | "empty" | "error" | "reconnecting";

interface SnapshotError {
  kind: "access" | "contract" | "network";
  message: string;
}

export function useObservableAnalysisSnapshot({
  query,
  repository,
  relatedRegionCodes = [query.regionCode],
}: {
  query: ObservableAnalysisQuery;
  repository: ObservableAnalysisRepository;
  relatedRegionCodes?: readonly string[];
}) {
  const [snapshot, setSnapshot] = useState<ObservableAnalysisSnapshot | null>(
    null,
  );
  const [status, setStatus] = useState<SnapshotStatus>("loading");
  const [error, setError] = useState<SnapshotError | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [cursorGapDetected, setCursorGapDetected] = useState(false);
  const requestSequence = useRef(0);
  const lastSequence = useRef(0);
  const regionKey = useMemo(
    () => [...new Set(relatedRegionCodes)].sort().join("|"),
    [relatedRegionCodes],
  );

  const refresh = useCallback(() => {
    setRefreshToken((current) => current + 1);
  }, []);

  useEffect(() => {
    const sequence = ++requestSequence.current;
    queueMicrotask(() => {
      if (sequence !== requestSequence.current) return;
      setStatus((current) =>
        current === "reconnecting" ? current : "loading",
      );
      setError(null);
    });
    void repository
      .loadObservableAnalysisSnapshot({
        productCode: query.productCode,
        regionCode: query.regionCode,
        surveyYear: query.surveyYear,
        surveyMonth: query.surveyMonth,
        cultivarCode: query.cultivarCode,
        subjectTypeCode: query.subjectTypeCode,
      })
      .then((next) => {
        if (sequence !== requestSequence.current) return;
        setSnapshot(next);
        setStatus(next.qualityState === "NO_APPROVED_DATA" ? "empty" : "ready");
      })
      .catch((cause: unknown) => {
        if (sequence !== requestSequence.current) return;
        setError(toSnapshotError(cause));
        setStatus("error");
      });
    return () => {
      requestSequence.current += 1;
    };
  }, [
    query.cultivarCode,
    query.productCode,
    query.regionCode,
    query.subjectTypeCode,
    query.surveyMonth,
    query.surveyYear,
    refreshToken,
    repository,
  ]);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    const related = new Set(
      regionKey ? regionKey.split("|") : [query.regionCode],
    );
    const subscribe = (afterSequence: number) => {
      if (cancelled) return;
      lastSequence.current = afterSequence;
      unsubscribe = repository.subscribeBusinessEvents(
        afterSequence,
        (event) => {
          if (event.sequence <= lastSequence.current) return;
          if (
            lastSequence.current > 0 &&
            event.sequence > lastSequence.current + 1
          ) {
            setCursorGapDetected(true);
            refresh();
          }
          lastSequence.current = event.sequence;
          if (matchesScope(event, query.productCode, related)) refresh();
        },
        () =>
          setStatus((current) =>
            current === "error" ? current : "reconnecting",
          ),
      );
    };
    void repository
      .listNotifications()
      .then((page) => {
        if (cancelled) return;
        subscribe(
          page.items.reduce(
            (latest, notification) => Math.max(latest, notification.sequence),
            0,
          ),
        );
      })
      .catch(() => subscribe(0));
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [query.productCode, query.regionCode, refresh, regionKey, repository]);

  return {
    snapshot,
    status,
    error,
    cursorGapDetected,
    refresh,
  } as const;
}

function matchesScope(
  event: BusinessNotificationRow,
  productCode: string,
  relatedRegions: ReadonlySet<string>,
): boolean {
  if (!isAnalysisInvalidatingAction(event.actionCode)) return false;
  if (event.productCode !== productCode) return false;
  const allAuthorizedRegions =
    relatedRegions.has(ALL_AUTHORIZED_REGION_CODE) ||
    relatedRegions.has("") ||
    relatedRegions.has("*");
  if (
    !allAuthorizedRegions &&
    !event.regionCodes.some((regionCode) => relatedRegions.has(regionCode))
  ) {
    return false;
  }
  return ["PRODUCTION_RECORD", "MARKET_RECORD", "LOGISTICS_RECORD"].includes(
    event.aggregateType,
  );
}

function isAnalysisInvalidatingAction(actionCode: string): boolean {
  return ["_APPROVED", "_VOIDED"].some((suffix) => actionCode.endsWith(suffix));
}

function toSnapshotError(cause: unknown): SnapshotError {
  if (cause instanceof RealtimeApiError) {
    if (cause.status === 401 || cause.status === 403) {
      return { kind: "access", message: "当前账号无权读取该分析范围。" };
    }
    if (cause.code === "CONTRACT_MISMATCH") {
      return { kind: "contract", message: cause.message };
    }
  }
  return {
    kind: "network",
    message: "当前分析结果暂时无法读取，请稍后重试。",
  };
}
