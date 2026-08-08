import type { ModuleWorkspaceRecord } from "./model";

export interface ObjectPanoramaSource {
  label: string;
  records: readonly ModuleWorkspaceRecord[];
}

export interface ObjectPanoramaProjection {
  businessObjectId: string;
  name: string;
  scope: string;
  relatedWorkspaces: readonly {
    label: string;
    recordId: string;
    period: string;
    status: string;
    quality: string;
  }[];
}

export function buildObjectPanorama(
  selectedRecord: ModuleWorkspaceRecord,
  sources: readonly ObjectPanoramaSource[],
): ObjectPanoramaProjection {
  return {
    businessObjectId: selectedRecord.businessObjectId,
    name: selectedRecord.name,
    scope: selectedRecord.scope,
    relatedWorkspaces: sources.flatMap((source) =>
      source.records
        .filter(
          (record) =>
            record.businessObjectId === selectedRecord.businessObjectId,
        )
        .map((record) => ({
          label: source.label,
          recordId: record.id,
          period: record.period,
          status: record.status,
          quality: record.quality,
        })),
    ),
  };
}
