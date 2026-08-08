import { Card, Statistic } from "antd";

export interface EnterpriseMetric {
  key: string;
  label: string;
  value: number | string;
  suffix?: string;
  note: string;
  tone?: "default" | "warning" | "danger" | "success";
}

export function EnterpriseMetricGrid({
  metrics,
}: {
  metrics: readonly EnterpriseMetric[];
}) {
  return (
    <section className="enterprise-metric-grid" aria-label="工作概览">
      {metrics.map((metric) => (
        <Card
          key={metric.key}
          className={`enterprise-metric enterprise-metric-${metric.tone ?? "default"}`}
          variant="borderless"
        >
          <Statistic
            title={metric.label}
            value={metric.value}
            suffix={metric.suffix}
          />
          <p>{metric.note}</p>
        </Card>
      ))}
    </section>
  );
}
