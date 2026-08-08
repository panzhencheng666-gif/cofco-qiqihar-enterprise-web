export interface ModuleMetric {
  key: string;
  label: string;
  value: number | string;
  suffix?: string;
  note: string;
  tone?: "default" | "warning" | "danger" | "success";
}

export interface ModuleLifecycleStep {
  key: string;
  label: string;
  detail: string;
  state: "completed" | "current" | "pending";
}

export interface ModuleNotice {
  id: string;
  title: string;
  detail: string;
  tone: "warning" | "danger" | "default";
}

export interface ModuleWorkspaceRecord {
  id: string;
  /**
   * Stable canonical subject/object identity. Task, claim and fact row IDs must
   * remain independent so the same business object can participate in several
   * lifecycles without duplicating its master record.
   */
  businessObjectId: string;
  name: string;
  category: string;
  scope: string;
  period: string;
  status: string;
  quality: string;
  owner: string;
  timeLimit: string;
}

export interface ModuleWorkspaceSection {
  key: string;
  label: string;
  target: string;
}

export interface ModuleControlMetadata {
  label: string;
  value: string;
}

export type ModuleControlMetadataItems =
  | readonly [
      ModuleControlMetadata,
      ModuleControlMetadata,
      ModuleControlMetadata,
    ]
  | readonly [
      ModuleControlMetadata,
      ModuleControlMetadata,
      ModuleControlMetadata,
      ModuleControlMetadata,
    ]
  | readonly [
      ModuleControlMetadata,
      ModuleControlMetadata,
      ModuleControlMetadata,
      ModuleControlMetadata,
      ModuleControlMetadata,
    ];

export interface ModuleWorkspaceView {
  eyebrow: string;
  title: string;
  description: string;
  metrics: readonly ModuleMetric[];
  lifecycleTitle: string;
  lifecycleNote: string;
  lifecycle: readonly ModuleLifecycleStep[];
  notices: readonly ModuleNotice[];
  tableTitle: string;
  tableDescription: string;
  sectionNavigation: readonly ModuleWorkspaceSection[];
  controlTitle: string;
  controlItems: ModuleControlMetadataItems;
  columnLabels: {
    name: string;
    category: string;
    scope: string;
    period: string;
    status: string;
    quality: string;
    owner: string;
    timeLimit: string;
  };
  records: readonly ModuleWorkspaceRecord[];
}
