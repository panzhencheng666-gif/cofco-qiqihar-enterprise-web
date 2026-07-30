import type { MonitoringObject } from "@/domains/monitoring-object/model";
import { isEnterpriseNotFoundError } from "@/workflows/enterprise-gateway/errors";
import type { BusinessDocument } from "./model";

export type DocumentViewState =
  | { kind: "loading" }
  | { kind: "query-error" }
  | { kind: "not-found"; target: "object" | "document" }
  | { kind: "mismatch" }
  | {
      kind: "ready";
      object: MonitoringObject;
      document: BusinessDocument;
    };

export interface DocumentViewStateInput {
  requestedObjectId: string;
  object: MonitoringObject | undefined;
  document: BusinessDocument | undefined;
  objectLoading: boolean;
  documentLoading: boolean;
  accessLoading: boolean;
  objectError: unknown;
  documentError: unknown;
  accessError: unknown;
}

export function resolveDocumentViewState({
  requestedObjectId,
  object,
  document,
  objectLoading,
  documentLoading,
  accessLoading,
  objectError,
  documentError,
  accessError,
}: DocumentViewStateInput): DocumentViewState {
  if (objectLoading || documentLoading || accessLoading) {
    return { kind: "loading" };
  }
  if (isEnterpriseNotFoundError(objectError)) {
    return { kind: "not-found", target: "object" };
  }
  if (isEnterpriseNotFoundError(documentError)) {
    return { kind: "not-found", target: "document" };
  }
  if (objectError || documentError || accessError) {
    return { kind: "query-error" };
  }
  if (!object) return { kind: "not-found", target: "object" };
  if (!document) return { kind: "not-found", target: "document" };
  if (object.id !== requestedObjectId || document.objectId !== object.id) {
    return { kind: "mismatch" };
  }
  return { kind: "ready", object, document };
}
