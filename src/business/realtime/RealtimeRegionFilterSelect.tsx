import { useMemo } from "react";

import type { MasterRegion } from "@/platform/api/realtimeBusinessRepository";

const regionLevelOrder: Readonly<Record<string, number>> = {
  PREFECTURE: 1,
  COUNTY: 2,
  TOWNSHIP: 3,
  VILLAGE: 4,
};

function regionPathLabel(
  region: MasterRegion,
  byCode: ReadonlyMap<string, MasterRegion>,
): string {
  const names: string[] = [];
  const visited = new Set<string>();
  let current: MasterRegion | undefined = region;
  while (current && !visited.has(current.code)) {
    names.unshift(current.name);
    visited.add(current.code);
    current = current.parentCode ? byCode.get(current.parentCode) : undefined;
  }
  return names.join(" / ");
}

export function RealtimeRegionFilterSelect({
  regions,
  authorizedRegionCodes,
  value,
  onChange,
  disabled = false,
}: {
  regions: readonly MasterRegion[];
  authorizedRegionCodes: readonly string[];
  value: string;
  onChange: (regionCode: string) => void;
  disabled?: boolean;
}) {
  const options = useMemo(() => {
    const byCode = new Map(regions.map((region) => [region.code, region]));
    const unrestricted = authorizedRegionCodes.includes("*");
    const authorized = new Set(authorizedRegionCodes);
    return regions
      .filter((region) => unrestricted || authorized.has(region.code))
      .map((region) => ({
        ...region,
        pathLabel: regionPathLabel(region, byCode),
      }))
      .sort(
        (left, right) =>
          (regionLevelOrder[left.level.toUpperCase()] ?? 99) -
            (regionLevelOrder[right.level.toUpperCase()] ?? 99) ||
          left.pathLabel.localeCompare(right.pathLabel, "zh-CN"),
      );
  }, [authorizedRegionCodes, regions]);

  return (
    <label>
      <span>业务地区</span>
      <select
        aria-label="业务地区"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">全部授权地区</option>
        {options.map((region) => (
          <option key={region.code} value={region.code}>
            {region.pathLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
