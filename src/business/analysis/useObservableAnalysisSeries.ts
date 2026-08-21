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
    queueMicrotask(() => {
      if (sequence === requestSequence.current) setStatus("loading");
    });

    const requests = Array.from({ length: 12 }, (_, index) => index + 1).map(
      async (month): Promise<ObservableAnalysisSeriesPoint> => {
        try {
          const snapshot = await repository.loadObservableAnalysisSnapshot({
            productCode,
            regionCode,
            surveyYear,
            ...(cultivarCode ? { cultivarCode } : {}),
            ...(subjectTypeCode ? { subjectTypeCode } : {}),
            surveyMonth: month,
          });
          return { month, snapshot, error: null };
        } catch {
          return {
            month,
            snapshot: null,
            error: "该月数据暂时无法读取",
          };
        }
      },
    );

    void Promise.all(requests).then((next) => {
      if (sequence !== requestSequence.current) return;
      setPoints(next);
      setStatus(
        next.every(({ snapshot }) => snapshot === null) ? "error" : "ready",
      );
    });

    return () => {
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
