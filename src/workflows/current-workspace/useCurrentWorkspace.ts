import { useCallback, useEffect, useState } from "react";
import { useEnterpriseGateway } from "@/workflows/enterprise-gateway/context";
import type { CurrentWorkspace } from "./model";

export function useCurrentWorkspace() {
  const gateway = useEnterpriseGateway();
  const [requestVersion, setRequestVersion] = useState(0);
  const [result, setResult] = useState<{
    requestVersion: number;
    workspace?: CurrentWorkspace;
    isError: boolean;
  }>({ requestVersion: -1, isError: false });

  const isLoading = result.requestVersion !== requestVersion;
  const isError = !isLoading && result.isError;

  useEffect(() => {
    let active = true;

    void gateway
      .getCurrentWorkspace()
      .then((value) => {
        if (active) {
          setResult({
            requestVersion,
            workspace: value,
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

  const reload = useCallback(() => {
    setRequestVersion((value) => value + 1);
  }, []);

  return {
    workspace: result.workspace,
    isLoading,
    isError,
    reload,
  };
}
