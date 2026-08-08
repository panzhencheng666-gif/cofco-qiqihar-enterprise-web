import type { CSSProperties, ReactNode } from "react";

export interface EnterpriseControlMetadata {
  label: string;
  value: ReactNode;
}

export type EnterpriseControlMetadataItems =
  | readonly [
      EnterpriseControlMetadata,
      EnterpriseControlMetadata,
      EnterpriseControlMetadata,
    ]
  | readonly [
      EnterpriseControlMetadata,
      EnterpriseControlMetadata,
      EnterpriseControlMetadata,
      EnterpriseControlMetadata,
    ]
  | readonly [
      EnterpriseControlMetadata,
      EnterpriseControlMetadata,
      EnterpriseControlMetadata,
      EnterpriseControlMetadata,
      EnterpriseControlMetadata,
    ];

export function EnterpriseControlStrip({
  title,
  items,
}: {
  title: string;
  items: EnterpriseControlMetadataItems;
}) {
  return (
    <section className="enterprise-control-strip" aria-label={title}>
      <header>
        <strong>{title}</strong>
      </header>
      <dl
        style={
          {
            "--enterprise-control-count": items.length,
          } as CSSProperties
        }
      >
        {items.map((item, index) => (
          <div key={`${item.label}-${index}`}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
