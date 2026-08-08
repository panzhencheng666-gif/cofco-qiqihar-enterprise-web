import type { CSSProperties } from "react";

export interface EnterpriseLifecycleStep {
  key: string;
  label: string;
  detail: string;
  state: "completed" | "current" | "pending";
}

export function EnterpriseLifecyclePanel({
  title,
  note,
  steps,
}: {
  title: string;
  note: string;
  steps: readonly EnterpriseLifecycleStep[];
}) {
  return (
    <section className="enterprise-work-panel enterprise-lifecycle-panel">
      <header className="enterprise-panel-heading">
        <div>
          <h2>{title}</h2>
          <p>{note}</p>
        </div>
      </header>
      <ol
        aria-label={title}
        style={
          {
            "--enterprise-lifecycle-step-count": steps.length,
          } as CSSProperties
        }
      >
        {steps.map((step, index) => (
          <li key={step.key} data-state={step.state}>
            <span className="enterprise-lifecycle-index" aria-hidden="true">
              {step.state === "completed" ? "✓" : index + 1}
            </span>
            <div>
              <strong>{step.label}</strong>
              <span>{step.detail}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
