import { useEffect, useState } from "react";

import type {
  MasterDataSnapshot,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";

export function useRealtimeMasterData(
  repository: RealtimeBusinessRepository | undefined,
) {
  const [masterData, setMasterData] = useState<MasterDataSnapshot | null>(null);
  const [masterDataError, setMasterDataError] = useState("");

  useEffect(() => {
    if (!repository || typeof repository.loadMasterData !== "function") {
      let cancelled = false;
      queueMicrotask(() => {
        if (!cancelled) {
          setMasterData(null);
          setMasterDataError("");
        }
      });
      return () => {
        cancelled = true;
      };
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setMasterDataError("");
    });
    void repository
      .loadMasterData()
      .then((snapshot) => {
        if (!cancelled) setMasterData(snapshot);
      })
      .catch(() => {
        if (!cancelled) {
          setMasterData(null);
          setMasterDataError("业务地区读取失败，请稍后重试。");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [repository]);

  return { masterData, masterDataError } as const;
}
