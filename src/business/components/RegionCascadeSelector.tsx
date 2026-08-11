import { useEffect, useMemo, useRef } from "react";

import {
  getAuthorizedRegionChildren,
  getAuthorizedRegionsByLevel,
  getEnterpriseRegionPath,
  type EnterpriseAdministrativeLevel,
  type EnterpriseRegionNode,
} from "../data/enterpriseRegionHierarchy";

export interface RegionCascadeValue {
  cityId?: string;
  countyId?: string;
  townshipId?: string;
  villageId?: string;
}

export interface RegionCascadeSelectorProps {
  authorizedRegionIds: readonly string[];
  maxLevel: Exclude<EnterpriseAdministrativeLevel, "province">;
  value: RegionCascadeValue;
  onChange: (value: RegionCascadeValue) => void;
  disabled?: boolean;
  hideLabel?: boolean;
}

const levelOrder = ["prefecture", "county", "township", "village"] as const;

const levelLabels: Record<(typeof levelOrder)[number], string> = {
  prefecture: "地市",
  county: "区县",
  township: "乡镇",
  village: "行政村",
};

function shouldRenderLevel(
  level: (typeof levelOrder)[number],
  maxLevel: RegionCascadeSelectorProps["maxLevel"],
): boolean {
  return levelOrder.indexOf(level) <= levelOrder.indexOf(maxLevel);
}

function selectedRegionId(value: RegionCascadeValue): string | undefined {
  return value.villageId ?? value.townshipId ?? value.countyId ?? value.cityId;
}

function selectedPathLabel(value: RegionCascadeValue): string {
  const regionId = selectedRegionId(value);
  if (!regionId) return "请选择地区";
  return getEnterpriseRegionPath(regionId)
    .filter(({ level }) => level !== "province")
    .map(({ label }) => label)
    .join(" / ");
}

function RegionLevelColumn({
  label,
  options,
  selectedId,
  emptyText,
  onSelect,
}: {
  label: string;
  options: readonly EnterpriseRegionNode[];
  selectedId?: string;
  emptyText: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section aria-label={`${label}选项`} className="region-cascader__column">
      <h3>{label}</h3>
      {options.length > 0 ? (
        <div className="region-cascader__options">
          {options.map((option) => (
            <button
              aria-pressed={selectedId === option.id}
              className={selectedId === option.id ? "is-selected" : undefined}
              key={option.id}
              onClick={() => onSelect(option.id)}
              type="button"
            >
              <span>{option.label}</span>
              {selectedId === option.id && <span aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      ) : (
        <p className="region-cascader__empty">{emptyText}</p>
      )}
    </section>
  );
}

export function RegionCascadeSelector({
  authorizedRegionIds,
  maxLevel,
  value,
  onChange,
  disabled = false,
  hideLabel = false,
}: RegionCascadeSelectorProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const cities = getAuthorizedRegionsByLevel("prefecture", authorizedRegionIds);
  const counties = value.cityId
    ? getAuthorizedRegionChildren(value.cityId, authorizedRegionIds)
    : [];
  const townships = value.countyId
    ? getAuthorizedRegionChildren(value.countyId, authorizedRegionIds)
    : [];
  const villages = value.townshipId
    ? getAuthorizedRegionChildren(value.townshipId, authorizedRegionIds)
    : [];
  const pathLabel = useMemo(() => selectedPathLabel(value), [value]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      const details = detailsRef.current;
      if (details?.open && !details.contains(event.target as Node)) {
        details.open = false;
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  return (
    <div aria-label="地区" className="region-cascade-selector">
      {!hideLabel && <span className="region-cascader__label">地区</span>}
      <details
        className="region-cascader"
        onToggle={(event) => {
          if (disabled) event.currentTarget.open = false;
        }}
        ref={detailsRef}
      >
        <summary aria-disabled={disabled} aria-label="选择地区">
          <span
            className={selectedRegionId(value) ? undefined : "is-placeholder"}
          >
            {pathLabel}
          </span>
          <span aria-hidden="true" className="region-cascader__arrow">
            ▾
          </span>
        </summary>
        <div className="region-cascader__panel">
          <div className="region-cascader__panel-heading">
            <div>
              <strong>选择地区</strong>
              <span>按地市、区县、乡镇和行政村逐级选择</span>
            </div>
            <button
              aria-label="关闭地区选择"
              onClick={() => {
                if (detailsRef.current) detailsRef.current.open = false;
              }}
              type="button"
            >
              ×
            </button>
          </div>
          <div className="region-cascader__columns">
            <RegionLevelColumn
              emptyText="当前权限范围内暂无地市"
              label={levelLabels.prefecture}
              options={cities}
              selectedId={value.cityId}
              onSelect={(cityId) => onChange({ cityId })}
            />
            {shouldRenderLevel("county", maxLevel) && (
              <RegionLevelColumn
                emptyText={
                  value.cityId ? "当前地市暂无已核定区县" : "请先选择地市"
                }
                label={levelLabels.county}
                options={counties}
                selectedId={value.countyId}
                onSelect={(countyId) =>
                  onChange({ cityId: value.cityId, countyId })
                }
              />
            )}
            {shouldRenderLevel("township", maxLevel) && (
              <RegionLevelColumn
                emptyText={
                  value.countyId ? "当前区县暂无已核定乡镇" : "请先选择区县"
                }
                label={levelLabels.township}
                options={townships}
                selectedId={value.townshipId}
                onSelect={(townshipId) =>
                  onChange({
                    cityId: value.cityId,
                    countyId: value.countyId,
                    townshipId,
                  })
                }
              />
            )}
            {shouldRenderLevel("village", maxLevel) && (
              <RegionLevelColumn
                emptyText={
                  value.townshipId ? "当前乡镇暂无已核定行政村" : "请先选择乡镇"
                }
                label={levelLabels.village}
                options={villages}
                selectedId={value.villageId}
                onSelect={(villageId) =>
                  onChange({
                    cityId: value.cityId,
                    countyId: value.countyId,
                    townshipId: value.townshipId,
                    villageId,
                  })
                }
              />
            )}
          </div>
          <div className="region-cascader__footer">
            <span>当前选择：{pathLabel}</span>
            <div>
              <button onClick={() => onChange({})} type="button">
                清除
              </button>
              <button
                className="is-primary"
                onClick={() => {
                  if (detailsRef.current) detailsRef.current.open = false;
                }}
                type="button"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
