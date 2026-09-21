import { useState } from "react";

const periodicReportsEntry = "/overview-monitoring/?embed=1#/报表中心";

export function PeriodicReportsFrame() {
  const [failed, setFailed] = useState(false);

  return (
    <section aria-label="周期总结" className="periodic-reports-entry">
      <iframe
        className="periodic-reports-entry__frame"
        title="齐齐哈尔粮食商情周期总结"
        src={periodicReportsEntry}
        loading="eager"
        onLoad={() => setFailed(false)}
        onError={() => setFailed(true)}
      />
      {failed && (
        <div className="periodic-reports-entry__fallback" role="alert">
          <strong>周期总结暂时无法打开</strong>
          <span>请联系系统管理员确认总揽监测服务配置后重试。</span>
        </div>
      )}
    </section>
  );
}
