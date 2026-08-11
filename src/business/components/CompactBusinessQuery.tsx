import { useState, type ReactNode } from "react";

export function CompactBusinessQuery({
  ariaLabel,
  primaryFields,
  moreFields = [],
  actions,
}: {
  ariaLabel: string;
  primaryFields: readonly ReactNode[];
  moreFields?: readonly ReactNode[];
  actions: ReactNode;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const visiblePrimaryFields = primaryFields.slice(0, 6);
  const secondaryFields = [...primaryFields.slice(6), ...moreFields];

  return (
    <section
      aria-label={ariaLabel}
      className="compact-business-query"
      role="search"
    >
      <div className="compact-business-query__primary">
        {visiblePrimaryFields}
      </div>
      {secondaryFields.length > 0 && (
        <>
          <button
            aria-expanded={moreOpen}
            className="compact-business-query__more-toggle"
            type="button"
            onClick={() => setMoreOpen((current) => !current)}
          >
            {moreOpen ? "收起条件" : "更多条件"}
          </button>
          {moreOpen && (
            <div className="compact-business-query__secondary">
              {secondaryFields}
            </div>
          )}
        </>
      )}
      <div className="compact-business-query__actions">{actions}</div>
    </section>
  );
}
