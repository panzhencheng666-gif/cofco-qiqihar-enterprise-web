import { useState } from "react";

const DEFAULT_OVERVIEW_PORT = 63200;
const DEFAULT_MAP_ROUTE = "/#/overview";

const env = (
  import.meta as ImportMeta & {
    env: {
      VITE_OVERVIEW_MAP_HOST?: string;
      VITE_OVERVIEW_MAP_PORT?: string;
      VITE_OVERVIEW_MAP_URL?: string;
    };
  }
).env;

function normalizeOverviewMapUrl(value: string): string {
  return value.replace(/\/+$/u, "");
}

function parsePositivePort(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535)
    return undefined;
  return parsed;
}

function overviewHost(): string {
  const configured = (env.VITE_OVERVIEW_MAP_HOST || "").trim();
  if (configured) return configured;
  if (typeof window === "undefined") return "127.0.0.1";
  return window.location.hostname;
}

function overviewPort(): number {
  const configuredPort = parsePositivePort(
    (env.VITE_OVERVIEW_MAP_PORT || "").trim(),
  );
  if (configuredPort) return configuredPort;
  return DEFAULT_OVERVIEW_PORT;
}

function overviewProtocol(): string {
  if (typeof window === "undefined") return "http:";
  return window.location.protocol;
}

/**
 * Keep the map entry point stable and make every navigation load the current
 * map shell.  The route belongs to the map application (not the business
 * prototype), so a stale cached document must never fall back to the generic
 * “页面地址无效” shell.
 */
function withMapEntryVersion(url: string): string {
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("embed"))
      parsed.searchParams.set("embed", "1");
    return parsed.toString();
  } catch {
    return url;
  }
}

function mapOverviewUrl(): string {
  const configured = env.VITE_OVERVIEW_MAP_URL;
  if (configured) return normalizeOverviewMapUrl(configured);
  const origin = `${overviewProtocol()}//${overviewHost()}:${overviewPort()}`;
  return `${origin}${DEFAULT_MAP_ROUTE}`;
}

export function OverviewMonitoringFrame() {
  const [failed, setFailed] = useState(false);
  const src = withMapEntryVersion(mapOverviewUrl());

  return (
    <main aria-label="总览监测" className="overview-monitoring-entry">
      <iframe
        className="overview-monitoring-entry__frame"
        title="齐齐哈尔粮食商情总览监测地图"
        src={src}
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
