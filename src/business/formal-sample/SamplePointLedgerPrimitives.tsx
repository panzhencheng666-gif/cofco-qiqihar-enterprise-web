import type { ReactNode, RefObject } from "react";

export function SamplePointLedgerPage({
  ariaLabel,
  className,
  children,
}: {
  ariaLabel: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={ariaLabel} className={className}>
      {children}
    </section>
  );
}

export function SamplePointLedgerTitle({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="enterprise-ledger-title enterprise-ledger-title--collection">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {actions}
    </header>
  );
}

export function SamplePointLedgerFilters({
  ariaLabel,
  children,
}: {
  ariaLabel?: string;
  children: ReactNode;
}) {
  return (
    <div
      aria-label={ariaLabel}
      className="enterprise-ledger-query enterprise-ledger-query--design"
      role="search"
    >
      {children}
    </div>
  );
}

export function SamplePointLedgerToolbar({
  ariaLabel,
  count,
  children,
  variant = "table",
}: {
  ariaLabel: string;
  count: ReactNode;
  children: ReactNode;
  variant?: "table" | "header";
}) {
  if (variant === "header") {
    return (
      <div className="formal-sample-ledger__header-actions">
        <strong>{count}</strong>
        {children}
      </div>
    );
  }
  return (
    <div
      aria-label={ariaLabel}
      className="enterprise-ledger-table__toolbar enterprise-ledger-table__toolbar--collection"
      role="toolbar"
    >
      <strong>{count}</strong>
      <div className="enterprise-ledger-table__actions">{children}</div>
    </div>
  );
}

export function SamplePointLedgerTable({
  ariaLabel,
  className,
  headers,
  toolbar,
  children,
  empty,
  footer,
  scrollClassName = "enterprise-ledger-table__scroll",
  scrollAriaLabel,
  scrollTabIndex,
}: {
  ariaLabel?: string;
  className: string;
  headers: readonly string[];
  toolbar?: ReactNode;
  children: ReactNode;
  empty?: ReactNode;
  footer?: ReactNode;
  scrollClassName?: string;
  scrollAriaLabel?: string;
  scrollTabIndex?: number;
}) {
  return (
    <div className={className}>
      {toolbar}
      <div
        aria-label={scrollAriaLabel}
        className={scrollClassName}
        role={scrollAriaLabel ? "region" : undefined}
        tabIndex={scrollTabIndex}
      >
        <table aria-label={ariaLabel}>
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
      {empty}
      {footer}
    </div>
  );
}

export function SamplePointLedgerPagination({
  pageNumber,
  pageCount,
  disabled,
  onPrevious,
  onNext,
}: {
  pageNumber: number;
  pageCount: number;
  disabled?: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="formal-sample-ledger__pagination">
      <button
        disabled={disabled || pageNumber === 0}
        type="button"
        onClick={onPrevious}
      >
        上一页
      </button>
      <span>第 {pageNumber + 1} 页</span>
      <button
        disabled={disabled || pageNumber + 1 >= pageCount}
        type="button"
        onClick={onNext}
      >
        下一页
      </button>
    </div>
  );
}

export function SamplePointLedgerRowActions({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="formal-sample-ledger__row-actions">{children}</div>;
}

export function SamplePointEditorForm({
  ariaLabel,
  title,
  description,
  version,
  children,
  notice,
  actions,
  sectionRef,
  role,
}: {
  ariaLabel: string;
  title: string;
  description: string;
  version?: ReactNode;
  children: ReactNode;
  notice?: ReactNode;
  actions: ReactNode;
  sectionRef?: RefObject<HTMLElement | null>;
  role?: "form";
}) {
  return (
    <section
      ref={sectionRef}
      tabIndex={-1}
      className="formal-sample-page formal-sample-page--form"
      aria-label={ariaLabel}
      role={role}
    >
      <header>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        {version}
      </header>
      <div className="formal-sample-page__field-grid">{children}</div>
      {notice}
      <div className="formal-sample-page__actions">{actions}</div>
    </section>
  );
}
