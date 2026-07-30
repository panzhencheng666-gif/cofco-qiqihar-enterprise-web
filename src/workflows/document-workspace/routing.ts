export function canonicalDocumentPath(
  objectId: string,
  documentId: string,
): string {
  return `/objects/${encodeURIComponent(objectId)}/documents/${encodeURIComponent(documentId)}`;
}
