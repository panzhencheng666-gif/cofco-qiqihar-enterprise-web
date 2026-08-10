import { useMemo, useState } from "react";

import type { MasterRegion } from "@/platform/api/realtimeBusinessRepository";

const levels = [
  { code: "PREFECTURE", label: "地级市" },
  { code: "COUNTY", label: "区县" },
  { code: "TOWNSHIP", label: "乡镇" },
  { code: "VILLAGE", label: "行政村" },
] as const;

function pathTo(
  regions: readonly MasterRegion[],
  regionCode: string,
): readonly MasterRegion[] {
  const byCode = new Map(regions.map((region) => [region.code, region]));
  const path: MasterRegion[] = [];
  let current = byCode.get(regionCode);
  const visited = new Set<string>();
  while (current && !visited.has(current.code)) {
    path.unshift(current);
    visited.add(current.code);
    current = current.parentCode ? byCode.get(current.parentCode) : undefined;
  }
  return path;
}

export function RealtimeRegionCascadePicker({
  regions,
  value,
  onChange,
  ariaLabel = "所在地区",
  requireVillage = true,
  disabled = false,
}: {
  regions: readonly MasterRegion[];
  value: string;
  onChange: (regionCode: string) => void;
  ariaLabel?: string;
  requireVillage?: boolean;
  disabled?: boolean;
}) {
  const [queries, setQueries] = useState<Record<string, string>>({});
  const selectedPath = useMemo(() => pathTo(regions, value), [regions, value]);
  const selectedByLevel = new Map(
    selectedPath.map((region) => [region.level.toUpperCase(), region.code]),
  );

  return (
    <div
      aria-label={ariaLabel}
      className="realtime-region-cascade"
      role="group"
    >
      {levels.map((level, index) => {
        const parentLevel = levels[index - 1]?.code;
        const parentCode = parentLevel
          ? selectedByLevel.get(parentLevel)
          : null;
        const query = queries[level.code]?.trim().toLocaleLowerCase() ?? "";
        const options = regions.filter((region) => {
          if (region.level.toUpperCase() !== level.code) return false;
          if (index > 0 && region.parentCode !== parentCode) return false;
          return (
            !query ||
            region.name.toLocaleLowerCase().includes(query) ||
            region.code.toLocaleLowerCase().includes(query)
          );
        });
        const enabled = index === 0 || Boolean(parentCode);
        const selected = selectedByLevel.get(level.code) ?? "";

        return (
          <label key={level.code}>
            <span>
              {level.label}
              {requireVillage && level.code === "VILLAGE" ? " *" : ""}
            </span>
            <input
              aria-label={`搜索${level.label}`}
              disabled={disabled || !enabled}
              placeholder={`搜索${level.label}名称或代码`}
              type="search"
              value={queries[level.code] ?? ""}
              onChange={(event) =>
                setQueries((current) => ({
                  ...current,
                  [level.code]: event.target.value,
                }))
              }
            />
            <select
              aria-label={level.label}
              disabled={disabled || !enabled}
              required={requireVillage && level.code === "VILLAGE"}
              value={selected}
              onChange={(event) => {
                onChange(event.target.value);
                setQueries((current) =>
                  Object.fromEntries(
                    Object.entries(current).filter(([code]) =>
                      levels
                        .slice(0, index + 1)
                        .some((candidate) => candidate.code === code),
                    ),
                  ),
                );
              }}
            >
              <option value="">请选择{level.label}</option>
              {options.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.name}（{option.code}）
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
  );
}
