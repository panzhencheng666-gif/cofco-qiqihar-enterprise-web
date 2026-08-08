import { useCallback, useEffect, useState } from "react";
import type { MonitoringObject } from "@/domains/monitoring-object/model";
import { resolveDocumentAccess } from "@/workflows/current-workspace/document-access";
import type { DocumentOperation } from "@/workflows/current-workspace/model";
import { useEnterpriseGateway } from "@/workflows/enterprise-gateway/context";
import type { BusinessDocument } from "./model";

interface SettledObjectDocument {
  requestVersion: number;
  object?: MonitoringObject;
  document?: BusinessDocument;
  documentOperations: readonly DocumentOperation[];
  accessDenied: boolean;
  objectError?: unknown;
  documentError?: unknown;
  accessError?: unknown;
}

export function useObjectDocument(objectId: string, documentId: string) {
  const gateway = useEnterpriseGateway();
  const [requestVersion, setRequestVersion] = useState(0);
  const [result, setResult] = useState<SettledObjectDocument>({
    requestVersion: -1,
    documentOperations: [],
    accessDenied: false,
  });
  const isLoading = result.requestVersion !== requestVersion;

  useEffect(() => {
    let active = true;

    void Promise.allSettled([
      gateway.getObject(objectId),
      gateway.getDocument(documentId),
      gateway.getCurrentWorkspace(),
    ]).then(([objectResult, documentResult, workspaceResult]) => {
      if (!active) return;
      const documentOperations =
        workspaceResult.status === "fulfilled"
          ? [
              ...resolveDocumentAccess(
                workspaceResult.value,
                objectId,
                documentId,
              ),
            ]
          : [];
      setResult({
        requestVersion,
        object:
          objectResult.status === "fulfilled" ? objectResult.value : undefined,
        document:
          documentResult.status === "fulfilled"
            ? documentResult.value
            : undefined,
        documentOperations,
        accessDenied:
          workspaceResult.status === "fulfilled" &&
          !documentOperations.includes("view"),
        objectError:
          objectResult.status === "rejected" ? objectResult.reason : undefined,
        documentError:
          documentResult.status === "rejected"
            ? documentResult.reason
            : undefined,
        accessError:
          workspaceResult.status === "rejected"
            ? workspaceResult.reason
            : undefined,
      });
    });

    return () => {
      active = false;
    };
  }, [documentId, gateway, objectId, requestVersion]);

  const reload = useCallback(() => {
    setRequestVersion((value) => value + 1);
  }, []);

  return {
    object: result.object,
    document: result.document,
    objectError: result.objectError,
    documentError: result.documentError,
    accessError: result.accessError,
    accessDenied: result.accessDenied,
    isLoading,
    canEdit: result.documentOperations.includes("edit"),
    canReview: result.documentOperations.includes("review"),
    reload,
  };
}
