import { useMemo } from "react";

import {
  ALL_AUTHORIZED_REGION_CODE,
  type ObservableAnalysisQuery,
} from "@/platform/api/observableAnalysisContract";
import type {
  MasterDataSnapshot,
  MasterRegion,
} from "@/platform/api/realtimeBusinessRepository";
import { RealtimeRegionCascadePicker } from "@/business/realtime/RealtimeRegionCascadePicker";

interface ObservableAnalysisFiltersProps {
  masterData: MasterDataSnapshot;
  authorizedRegionCodes: readonly string[];
  query: ObservableAnalysisQuery;
  defaultQuery: ObservableAnalysisQuery;
  onChange: (query: ObservableAnalysisQuery) => void;
  disabled?: boolean;
}

export function ObservableAnalysisFilters({
  masterData,
  authorizedRegionCodes,
  query,
  defaultQuery,
  onChange,
  disabled = false,
}: ObservableAnalysisFiltersProps) {
  const regions = useMemo(
    () => relatedAuthorizedRegions(masterData.regions, authorizedRegionCodes),
    [authorizedRegionCodes, masterData.regions],
  );
  const currentYear = new Date().getFullYear();
  const years = [
    ...(masterData.approvedSurveyYears ?? []),
    ...Array.from({ length: 5 }, (_, index) => currentYear - index),
  ];
  if (!years.includes(query.surveyYear)) years.push(query.surveyYear);

  return (
    <fieldset className="observable-analysis-filters" disabled={disabled}>
      <legend>分析范围</legend>
      <div className="observable-analysis-filter-grid">
        <label>
          <span>产品或作物</span>
          <select
            aria-label="产品或作物"
            data-scrollable-menu="true"
            value={query.productCode}
            onChange={(event) =>
              onChange({
                ...query,
                productCode: event.target.value,
                cultivarCode: undefined,
              })
            }
          >
            {masterData.products.map((product) => (
              <option key={product.code} value={product.code}>
                {product.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>调查年份</span>
          <select
            aria-label="调查年份"
            data-scrollable-menu="true"
            value={query.surveyYear}
            onChange={(event) =>
              onChange({ ...query, surveyYear: Number(event.target.value) })
            }
          >
            {[...new Set(years)]
              .sort((left, right) => right - left)
              .map((year) => (
                <option key={year} value={year}>
                  {year} 年
                </option>
              ))}
          </select>
        </label>
        <label>
          <span>调查月份</span>
          <select
            aria-label="调查月份"
            data-scrollable-menu="true"
            value={query.surveyMonth ?? ""}
            onChange={(event) =>
              onChange({
                ...query,
                surveyMonth:
                  event.target.value === ""
                    ? undefined
                    : Number(event.target.value),
              })
            }
          >
            <option value="">全年</option>
            {Array.from({ length: 12 }, (_, index) => index + 1).map(
              (month) => (
                <option key={month} value={month}>
                  {month} 月
                </option>
              ),
            )}
          </select>
        </label>
      </div>
      <button
        aria-pressed={query.regionCode === ALL_AUTHORIZED_REGION_CODE}
        className="observable-analysis-all-regions"
        type="button"
        onClick={() =>
          onChange({ ...query, regionCode: ALL_AUTHORIZED_REGION_CODE })
        }
      >
        全部授权地区
      </button>
      <RealtimeRegionCascadePicker
        ariaLabel="责任地区"
        disabled={disabled}
        onChange={(regionCode) => {
          if (regionCode) onChange({ ...query, regionCode });
        }}
        regions={regions}
        requireVillage={false}
        searchable={false}
        value={query.regionCode}
      />
      <div className="observable-analysis-filter-actions">
        <button
          type="button"
          onClick={() => {
            onChange({ ...defaultQuery });
          }}
        >
          重置筛选
        </button>
      </div>
    </fieldset>
  );
}

function relatedAuthorizedRegions(
  regions: readonly MasterRegion[],
  authorizedRegionCodes: readonly string[],
): readonly MasterRegion[] {
  if (authorizedRegionCodes.includes("*")) return regions;
  const byCode = new Map(regions.map((region) => [region.code, region]));
  const authorized = new Set(authorizedRegionCodes);

  function ancestors(code: string): Set<string> {
    const result = new Set<string>();
    let current = byCode.get(code);
    while (current && !result.has(current.code)) {
      result.add(current.code);
      current = current.parentCode ? byCode.get(current.parentCode) : undefined;
    }
    return result;
  }

  const authorizedAncestors = new Set(
    authorizedRegionCodes.flatMap((code) => [...ancestors(code)]),
  );
  return regions.filter((region) => {
    if (authorizedAncestors.has(region.code)) return true;
    const path = ancestors(region.code);
    return [...authorized].some((code) => path.has(code));
  });
}
