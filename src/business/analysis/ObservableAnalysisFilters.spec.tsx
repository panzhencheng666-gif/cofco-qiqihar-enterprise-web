import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";

import type { ObservableAnalysisQuery } from "@/platform/api/observableAnalysisContract";
import type { MasterDataSnapshot } from "@/platform/api/realtimeBusinessRepository";
import { ObservableAnalysisFilters } from "./ObservableAnalysisFilters";

afterEach(cleanup);

const masterData: MasterDataSnapshot = {
  products: [
    { code: "CORN", name: "玉米" },
    { code: "SOYBEAN", name: "大豆" },
    { code: "RICE", name: "稻谷" },
  ],
  periods: [],
  regions: [
    { code: "230200", name: "齐齐哈尔市", parentCode: null, level: "PREFECTURE" },
    { code: "230221", name: "龙江县", parentCode: "230200", level: "COUNTY" },
    { code: "230221101", name: "龙江镇", parentCode: "230221", level: "TOWNSHIP" },
    {
      code: "230221101001",
      name: "新城村",
      parentCode: "230221101",
      level: "VILLAGE",
    },
    { code: "231100", name: "黑河市", parentCode: null, level: "PREFECTURE" },
    { code: "150700", name: "呼伦贝尔市", parentCode: null, level: "PREFECTURE" },
  ],
};

const defaultQuery: ObservableAnalysisQuery = {
  productCode: "CORN",
  regionCode: "230200",
  surveyYear: 2026,
  surveyMonth: 8,
};

function Harness() {
  const [query, setQuery] = useState<ObservableAnalysisQuery>({
    ...defaultQuery,
    regionCode: "230221101001",
  });
  return (
    <>
      <ObservableAnalysisFilters
        authorizedRegionCodes={["230200", "231100", "150700"]}
        defaultQuery={defaultQuery}
        masterData={masterData}
        onChange={setQuery}
        query={query}
      />
      <output aria-label="当前筛选">{JSON.stringify(query)}</output>
    </>
  );
}

describe("observable analysis filters", () => {
  it("uses searchable governed products and responsibility-region cascades", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByRole("searchbox", { name: "搜索产品" }), "大豆");
    expect(screen.getByRole("combobox", { name: "产品或作物" })).toHaveTextContent(
      "大豆",
    );
    expect(screen.getByRole("combobox", { name: "产品或作物" })).not.toHaveTextContent(
      "玉米",
    );

    expect(screen.getByRole("searchbox", { name: "搜索地级市" })).toBeEnabled();
    expect(screen.getByRole("searchbox", { name: "搜索区县" })).toBeEnabled();
    expect(screen.getByRole("searchbox", { name: "搜索乡镇" })).toBeEnabled();
    expect(screen.getByRole("searchbox", { name: "搜索行政村" })).toBeEnabled();
    expect(screen.getByRole("combobox", { name: "地级市" })).toHaveTextContent(
      "齐齐哈尔市",
    );
    expect(screen.getByRole("combobox", { name: "地级市" })).toHaveTextContent(
      "黑河市",
    );
    expect(screen.getByRole("combobox", { name: "地级市" })).toHaveTextContent(
      "呼伦贝尔市",
    );
  });

  it("clears invalid descendants when a parent changes and resets to the last approved scope", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.selectOptions(screen.getByRole("combobox", { name: "地级市" }), "231100");
    expect(screen.getByRole("status", { name: "当前筛选" })).toHaveTextContent(
      '"regionCode":"231100"',
    );
    expect(screen.getByRole("combobox", { name: "区县" })).toHaveValue("");

    await user.selectOptions(screen.getByRole("combobox", { name: "调查年份" }), "2025");
    await user.click(screen.getByRole("button", { name: "重置筛选" }));
    expect(screen.getByRole("status", { name: "当前筛选" })).toHaveTextContent(
      '"regionCode":"230200"',
    );
    expect(screen.getByRole("status", { name: "当前筛选" })).toHaveTextContent(
      '"surveyYear":2026',
    );
  });
});
