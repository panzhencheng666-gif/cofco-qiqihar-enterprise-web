import type { ReactNode } from "react";

interface EnterprisePageProps {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function EnterprisePage({
  eyebrow,
  title,
  description,
  actions,
  children,
}: EnterprisePageProps) {
  return (
    <section className="enterprise-page">
      <header className="enterprise-page-heading">
        <div>
          <div className="enterprise-page-eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {actions && (
          <div className="enterprise-page-actions" aria-label="页面操作">
            {actions}
          </div>
        )}
      </header>
      {children}
    </section>
  );
}
