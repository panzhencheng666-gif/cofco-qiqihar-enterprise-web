export interface PortalApplication {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  readonly category: string;
  readonly href: string;
  readonly featured: boolean;
  readonly published: boolean;
}

export const applicationCatalog: readonly PortalApplication[];

export function availableApps(): readonly PortalApplication[];
