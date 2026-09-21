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

function similarity(name: string, query: string): number {
  const normalize = (text: string) =>
    text
      .trim()
      .toLocaleLowerCase()
      .replace(
        /(自治县|自治区|地级市|行政村|街道|地区|省|市|区|县|镇|乡|村)$/u,
        "",
      );
  const a = normalize(name),
    b = normalize(query);
  if (!a || !b) return 0;
  if (a === b) return 3;
  if (a.includes(b)) return 2 + b.length / a.length;
  if (b.length < 2) return 0;
  let row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(
        next[j - 1] + 1,
        row[j] + 1,
        row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    row = next;
  }
  return 1 - row[b.length] / Math.max(a.length, b.length);
}

export function RealtimeRegionCascadePicker({
  regions,
  value,
  onChange,
  ariaLabel = "所在地区",
  requireVillage = true,
  disabled = false,
  searchable = true,
  invalid = false,
  describedBy,
}: {
  regions: readonly MasterRegion[];
  value: string;
  onChange: (regionCode: string) => void;
  ariaLabel?: string;
  requireVillage?: boolean;
  disabled?: boolean;
  searchable?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [queries, setQueries] = useState<Record<string, string>>({});
  const selectedPath = useMemo(() => pathTo(regions, value), [regions, value]);
  const selectedByLevel = new Map(
    selectedPath.map((region) => [region.level.toUpperCase(), region.code]),
  );

  return (
    <div
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className="realtime-region-cascade"
      role="group"
    >
      {levels.map((level, index) => {
        const parentLevel = levels[index - 1]?.code;
        const parentCode = parentLevel
          ? selectedByLevel.get(parentLevel)
          : null;
        const query = queries[level.code]?.trim().toLocaleLowerCase() ?? "";
        const candidates = regions.filter((region) => {
          if (region.level.toUpperCase() !== level.code) return false;
          if (index > 0 && region.parentCode !== parentCode) return false;
          return true;
        });
        const enabled = index === 0 || Boolean(parentCode);
        const selected = selectedByLevel.get(level.code) ?? "";
        const ranked = candidates
          .map((region) => ({ region, score: similarity(region.name, query) }))
          .sort(
            (a, b) =>
              b.score - a.score || a.region.code.localeCompare(b.region.code),
          );
        const options = query
          ? ranked
              .filter(
                ({ region, score }) => score >= 0.5 || region.code === selected,
              )
              .map(({ region }) => region)
          : candidates;
        function search(text: string) {
          setQueries((current) =>
            Object.fromEntries([
              ...Object.entries(current).filter(([code]) =>
                levels.slice(0, index).some((item) => item.code === code),
              ),
              [level.code, text],
            ]),
          );
          if (!text.trim()) return;
          const best = candidates
            .map((region) => ({ region, score: similarity(region.name, text) }))
            .sort(
              (a, b) =>
                b.score - a.score || a.region.code.localeCompare(b.region.code),
            )[0];
          if (best && best.score >= 0.5) onChange(best.region.code);
        }

        return (
          <label key={level.code}>
            <span>
              {level.label}
              {searchable ? "搜索栏" : ""}
              {requireVillage && level.code === "VILLAGE" ? " *" : ""}
            </span>
            {searchable ? (
              <input
                aria-label={`搜索${level.label}`}
                disabled={disabled || !enabled}
                placeholder={`搜索${level.label}名称`}
                type="search"
                value={queries[level.code] ?? ""}
                onChange={(event) => search(event.target.value)}
              />
            ) : null}
            <select
              aria-label={level.label}
              data-scrollable-menu="true"
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
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
                  {option.name}
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
  );
}
