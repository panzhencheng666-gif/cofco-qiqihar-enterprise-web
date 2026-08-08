import type { CurrentWorkspace, DocumentOperation } from "./model";

export function resolveDocumentAccess(
  workspace: CurrentWorkspace,
  objectId: string,
  documentId: string,
): ReadonlySet<DocumentOperation> {
  const projection = workspace.documentAccess.find(
    (candidate) =>
      candidate.objectId === objectId && candidate.documentId === documentId,
  );
  return new Set(projection?.operations ?? []);
}
