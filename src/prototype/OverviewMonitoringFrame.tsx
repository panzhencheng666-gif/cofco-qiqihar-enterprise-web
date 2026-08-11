import { useState } from "react";

const overviewMapEntry = "/overview-monitoring/?embed=1#/overview";

export function OverviewMonitoringFrame() {
  const [failed, setFailed] = useState(false);

  return (
    <main aria-label="总览监测" className="overview-monitoring-entry">
      <iframe
        className="overview-monitoring-entry__frame"
        title="齐齐哈尔粮食商情总览监测地图"
        src={overviewMapEntry}
        loading="eager"
        onLoad={() => setFailed(false)}
        onError={() => setFailed(true)}
      />
      {failed && (
        <div className="overview-monitoring-entry__fallback" role="alert">
          <strong>总览监测地图暂时无法打开</strong>
          <span>请联系系统管理员确认总揽监测服务配置后重试。</span>
        </div>
      )}
    </main>
  );
}
