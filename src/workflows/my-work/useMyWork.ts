import { useCallback, useEffect, useState } from "react";
import { useEnterpriseGateway } from "@/workflows/enterprise-gateway/context";
import type { MyWorkItem } from "./model";

interface MyWorkQuery {
  rows: readonly MyWorkItem[];
  isLoading: boolean;
  isError: boolean;
  reload: () => void;
}

export function useMyWork(): MyWorkQuery {
  const gateway = useEnterpriseGateway();
  const [requestVersion, setRequestVersion] = useState(0);
  const [result, setResult] = useState<{
    requestVersion: number;
    rows: readonly MyWorkItem[];
    isError: boolean;
  }>({ requestVersion: -1, rows: [], isError: false });

  const isLoading = result.requestVersion !== requestVersion;
  const isError = !isLoading && result.isError;

  const reload = useCallback(() => {
    setRequestVersion((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;

    void gateway
      .listMyWork()
      .then((items) => {
        if (active) {
          setResult({
            requestVersion,
            rows: items,
            isError: false,
          });
        }
      })
      .catch(() => {
        if (active) {
          setResult((previous) => ({
            ...previous,
            requestVersion,
            isError: true,
          }));
        }
      });

    return () => {
      active = false;
    };
  }, [gateway, requestVersion]);

  return { rows: result.rows, isLoading, isError, reload };
}
