import { useCallback, useEffect, useRef, useState } from "react";

import type {
  ObservableAnalysisQuery,
  ObservableAnalysisSnapshot,
} from "@/platform/api/observableAnalysisContract";
import type { RealtimeBusinessRepository } from "@/platform/api/realtimeBusinessRepository";

type SeriesRepository = Pick<
  RealtimeBusinessRepository,
  "loadObservableAnalysisSnapshot"
>;

export interface ObservableAnalysisSeriesPoint {
  month: number;
  snapshot: ObservableAnalysisSnapshot | null;
  error: string | null;
}

type SeriesStatus = "loading" | "ready" | "error";

export function useObservableAnalysisSeries({
  query,
  refreshKey = "",
  repository,
}: {
  query: ObservableAnalysisQuery;
  refreshKey?: string;
  repository: SeriesRepository;
}) {
  const [points, setPoints] = useState<
    readonly ObservableAnalysisSeriesPoint[]
  >([]);
  const [status, setStatus] = useState<SeriesStatus>("loading");
  const [refreshToken, setRefreshToken] = useState(0);
  const requestSequence = useRef(0);
  const { cultivarCode, productCode, regionCode, subjectTypeCode, surveyYear } =
    query;

  const refresh = useCallback(() => {
    setRefreshToken((current) => current + 1);
  }, []);

  useEffect(() => {
    const sequence = ++requestSequence.current;
    let cancelled = false;
    queueMicrotask(() => {
      if (sequence === requestSequence.current) setStatus("loading");
    });

    const next: ObservableAnalysisSeriesPoint[] = [];
    let nextMonth = 1;
    const worker = async () => {
      while (!cancelled && nextMonth <= 12) {
        const month = nextMonth;
        nextMonth += 1;
        try {
          const snapshot = await repository.loadObservableAnalysisSnapshot({
            productCode,
            regionCode,
            surveyYear,
            ...(cultivarCode ? { cultivarCode } : {}),
            ...(subjectTypeCode ? { subjectTypeCode } : {}),
            surveyMonth: month,
          });
          next[month - 1] = { month, snapshot, error: null };
        } catch {
          next[month - 1] = {
            month,
            snapshot: null,
            error: "该月数据暂时无法读取",
          };
        }
      }
    };

    void Promise.all([worker(), worker()]).then(() => {
      if (sequence !== requestSequence.current) return;
      setPoints(next);
      setStatus(
        next.every(({ snapshot }) => snapshot === null) ? "error" : "ready",
      );
    });

    return () => {
      cancelled = true;
      requestSequence.current += 1;
    };
  }, [
    cultivarCode,
    productCode,
    regionCode,
    subjectTypeCode,
    surveyYear,
    refreshKey,
    refreshToken,
    repository,
  ]);

  return {
    points,
    status,
    failedMonthCount: points.filter(({ error }) => error !== null).length,
    refresh,
  } as const;
}
