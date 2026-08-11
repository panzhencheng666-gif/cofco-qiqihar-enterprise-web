import { readFileSync } from "node:fs";

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { fixedDecimal } from "../core/fixedDecimal";
import type { MetricComparisonViewModel } from "../core/metricComparisonViewModel";
import { comparisonYearColors, ComparisonCharts } from "./ComparisonCharts";

afterEach(cleanup);

function areaModel(): MetricComparisonViewModel {
  return {
    metricId: "production.planted-area",
    metricLabel: "种植面积",
    unit: "万亩",
    currentValue: "1284.6",
    currentChangeText: "2.8%",
    yearCells: [
      {
        year: 2023,
        valueText: "1198.4",
        availabilityLabel: "可用",
        releaseVersionLabel: "M-AREA-V1",
        reason: null,
      },
      {
        year: 2024,
        valueText: "1226.7",
        availabilityLabel: "可用",
        releaseVersionLabel: "M-AREA-V2",
        reason: null,
      },
      {
        year: 2025,
        valueText: "1249.6",
        availabilityLabel: "可用",
        releaseVersionLabel: "M-AREA-V3",
        reason: null,
      },
      {
        year: 2026,
        valueText: "1284.6",
        availabilityLabel: "可用",
        releaseVersionLabel: "M-AREA-V4",
        reason: null,
      },
    ],
    pairCells: [
      {
        label: "2024 同比",
        changeText: "2.4%",
        state: "comparable",
        reason: null,
      },
      {
        label: "2025 同比",
        changeText: "1.9%",
        state: "comparable",
        reason: null,
      },
      {
        label: "当前同比",
        changeText: "2.8%",
        state: "comparable",
        reason: null,
      },
    ],
    cagrText: "年均复合增长率 2.3%",
    comparabilityText: "四年口径连续可比",
    levelSeries: [
      { year: 2023, rawValue: fixedDecimal("1198.4"), valueText: "1198.4" },
      { year: 2024, rawValue: fixedDecimal("1226.7"), valueText: "1226.7" },
      { year: 2025, rawValue: fixedDecimal("1249.6"), valueText: "1249.6" },
      { year: 2026, rawValue: fixedDecimal("1284.6"), valueText: "1284.6" },
    ],
    annualChangeSeries: [
      {
        label: "2024 同比",
        changeKind: "relative-rate",
        rawChange: fixedDecimal("2.4"),
        changeText: "2.4%",
        reason: null,
      },
      {
        label: "2025 同比",
        changeKind: "relative-rate",
        rawChange: fixedDecimal("1.9"),
        changeText: "1.9%",
        reason: null,
      },
      {
        label: "当前同比",
        changeKind: "relative-rate",
        rawChange: fixedDecimal("2.8"),
        changeText: "2.8%",
        reason: null,
      },
    ],
    currentVsBaselineSeries: [
      {
        fromYear: 2023,
        label: "较 2023 年变化",
        changeKind: "relative-rate",
        rawChange: fixedDecimal("7.2"),
        changeText: "7.2%",
        state: "comparable",
        reason: null,
      },
      {
        fromYear: 2024,
        label: "较 2024 年变化",
        changeKind: "relative-rate",
        rawChange: fixedDecimal("4.7"),
        changeText: "4.7%",
        state: "comparable",
        reason: null,
      },
      {
        fromYear: 2025,
        label: "较 2025 年变化",
        changeKind: "relative-rate",
        rawChange: fixedDecimal("2.8"),
        changeText: "2.8%",
        state: "comparable",
        reason: null,
      },
    ],
  };
}

function markLevelUnavailableWithStaleComparisons(
  model: MetricComparisonViewModel,
  index: number,
): void {
  model.yearCells = model.yearCells.map((cell, cellIndex) =>
    cellIndex === index
      ? {
          ...cell,
          valueText: "未采集",
          availabilityLabel: "未采集",
          reason: "本年度未组织采集",
        }
      : cell,
  );
  model.levelSeries = model.levelSeries.map((point, pointIndex) =>
    pointIndex === index
      ? { ...point, rawValue: null, valueText: "未采集" }
      : point,
  );
  if (index === 3) model.currentValue = "未采集";
}

function replaceLevelValues(
  model: MetricComparisonViewModel,
  values: readonly (string | null)[],
): void {
  model.levelSeries = model.levelSeries.map((point, index) => ({
    ...point,
    rawValue: values[index] === null ? null : fixedDecimal(values[index]),
    valueText: values[index] ?? "未采集",
  }));
  model.yearCells = model.yearCells.map((cell, index) =>
    values[index] === null
      ? {
          ...cell,
          valueText: "未采集",
          availabilityLabel: "未采集",
          releaseVersionLabel: "未发起发布",
          reason: `${cell.year} 年未采集`,
        }
      : {
          ...cell,
          valueText: values[index],
          availabilityLabel: "可用",
          reason: null,
        },
  );
  model.currentValue = values[3] ?? "未采集";
  model.pairCells = model.pairCells.map((pair, index) =>
    values[index] === null || values[index + 1] === null
      ? {
          ...pair,
          state: "not-comparable",
          changeText: "相邻年度存在未采集值",
          reason: "相邻年度存在未采集值",
        }
      : pair,
  );
  model.annualChangeSeries = model.annualChangeSeries.map((change, index) =>
    values[index] === null || values[index + 1] === null
      ? {
          ...change,
          rawChange: null,
          changeText: "相邻年度存在未采集值",
          reason: "相邻年度存在未采集值",
        }
      : change,
  );
  model.currentChangeText = model.annualChangeSeries[2].changeText;
  model.currentVsBaselineSeries = model.currentVsBaselineSeries.map(
    (comparison, index) =>
      values[index] === null || values[3] === null
        ? {
            ...comparison,
            rawChange: null,
            changeText: "历史或当前年度未采集",
            state: "not-comparable",
            reason: "历史或当前年度未采集",
          }
        : comparison,
  );
}

describe("ComparisonCharts", () => {
  it("renders exactly two accessible charts and an equivalent governed data table", () => {
    render(<ComparisonCharts model={areaModel()} />);

    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(
      screen.getByRole("img", { name: "种植面积四年数值趋势" }),
    ).toBeVisible();
    expect(
      screen.getByRole("img", { name: "种植面积三段年度同比" }),
    ).toBeVisible();

    const table = screen.getByRole("table", {
      name: "种植面积四年比较分析数据",
    });
    expect(table).toBeVisible();
    expect(within(table).getAllByRole("row")).toHaveLength(11);
    expect(
      within(table).getByRole("cell", { name: "1198.4 万亩" }),
    ).toBeVisible();
    expect(within(table).getAllByRole("cell", { name: /2\.8%/ })).toHaveLength(
      2,
    );
    expect(
      within(table).getAllByRole("cell", {
        name: "已核定数据（当前采用）",
      }),
    ).toHaveLength(4);
    expect(table).not.toHaveTextContent("M-AREA-V1");
    expect(table).not.toHaveTextContent("指标版本");
    expect(
      within(table).getAllByRole("cell", { name: "口径可比" }),
    ).toHaveLength(6);
  });

  it("shows all three direct baselines as supporting analysis without calling them annual comparisons", () => {
    render(<ComparisonCharts model={areaModel()} />);

    const summary = screen.getByRole("region", { name: "当前较前三年" });
    expect(summary).toBeVisible();
    expect(within(summary).getAllByRole("listitem")).toHaveLength(3);
    expect(summary).toHaveTextContent("较 2023 年变化 +7.2%");
    expect(summary).toHaveTextContent("较 2024 年变化 +4.7%");
    expect(summary).toHaveTextContent("较 2025 年变化 +2.8%");
    expect(summary).not.toHaveTextContent("同比");

    const table = screen.getByRole("table", {
      name: "种植面积四年比较分析数据",
    });
    expect(
      within(table).getByRole("cell", { name: "较 2023 年变化" }),
    ).toBeVisible();
  });

  it.each(["", "较 2023 年同比"])(
    "rejects an invalid governed direct-baseline label %j",
    (label) => {
      const model = areaModel();
      model.currentVsBaselineSeries = model.currentVsBaselineSeries.map(
        (comparison, index) =>
          index === 0 ? { ...comparison, label } : comparison,
      );

      render(<ComparisonCharts model={model} />);

      expect(
        screen.getByRole("alert", { name: "种植面积比较数据无效" }),
      ).toBeVisible();
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    },
  );

  it("preserves release, availability, comparability, and every governed reason in the equivalent table", () => {
    const model = areaModel();
    model.yearCells = model.yearCells.map((cell, index) =>
      index === 1
        ? {
            ...cell,
            valueText: "未采集",
            availabilityLabel: "未采集",
            releaseVersionLabel: "未发起发布",
            reason: "本年度未组织采集",
          }
        : cell,
    );
    model.levelSeries = model.levelSeries.map((point, index) =>
      index === 1 ? { ...point, rawValue: null, valueText: "未采集" } : point,
    );
    model.pairCells = [
      {
        ...model.pairCells[0],
        state: "not-comparable",
        changeText: "本年度未组织采集",
        reason: "本年度未组织采集",
      },
      {
        ...model.pairCells[1],
        state: "not-comparable",
        changeText: "本年度未组织采集",
        reason: "本年度未组织采集",
      },
      model.pairCells[2],
    ];
    model.annualChangeSeries = [
      {
        ...model.annualChangeSeries[0],
        rawChange: null,
        changeText: "本年度未组织采集",
        reason: "本年度未组织采集",
      },
      {
        ...model.annualChangeSeries[1],
        rawChange: null,
        changeText: "本年度未组织采集",
        reason: "本年度未组织采集",
      },
      model.annualChangeSeries[2],
    ];
    model.currentVsBaselineSeries = model.currentVsBaselineSeries.map(
      (item, index) =>
        index === 1
          ? {
              ...item,
              rawChange: null,
              changeText: "历史基期未采集",
              state: "not-comparable",
              reason: "历史基期未采集",
            }
          : item,
    );

    render(<ComparisonCharts model={model} />);

    const table = screen.getByRole("table", {
      name: "种植面积四年比较分析数据",
    });
    expect(table).toHaveTextContent("未发起发布");
    expect(table).toHaveTextContent("未采集");
    expect(table).toHaveTextContent("本年度未组织采集");
    expect(table).toHaveTextContent("历史基期未采集");
    expect(table).toHaveTextContent("口径不可比");
  });

  it("generates unique SVG accessibility and pattern IDs for multiple instances", () => {
    const { container } = render(
      <>
        <ComparisonCharts model={areaModel()} />
        <ComparisonCharts model={areaModel()} />
      </>,
    );

    const ids = [...container.querySelectorAll("[id]")].map(
      (element) => element.id,
    );
    expect(ids.length).toBeGreaterThanOrEqual(12);
    expect(new Set(ids).size).toBe(ids.length);
    for (const svg of container.querySelectorAll("svg")) {
      const labelledBy = svg.getAttribute("aria-labelledby");
      const describedBy = svg.getAttribute("aria-describedby");
      expect(
        labelledBy && container.ownerDocument.getElementById(labelledBy),
      ).not.toBeNull();
      expect(
        describedBy && container.ownerDocument.getElementById(describedBy),
      ).not.toBeNull();
    }
  });

  it.each([
    ["yearCells", 3],
    ["levelSeries", 3],
    ["pairCells", 2],
    ["annualChangeSeries", 2],
    ["currentVsBaselineSeries", 2],
  ] as const)(
    "renders a visible accessible error and no SVG when %s cardinality is malformed",
    (field, length) => {
      const model = areaModel();
      model[field] = model[field].slice(0, length) as never;

      render(<ComparisonCharts model={model} />);

      expect(
        screen.getByRole("alert", { name: "种植面积比较数据无效" }),
      ).toHaveTextContent("四年比较数据结构不完整");
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    },
  );

  it("keeps React hook order stable when a malformed model becomes valid", () => {
    const malformed = areaModel();
    malformed.pairCells = malformed.pairCells.slice(0, 2);
    const { rerender } = render(<ComparisonCharts model={malformed} />);
    expect(screen.getByRole("alert")).toBeVisible();

    rerender(<ComparisonCharts model={areaModel()} />);

    expect(screen.getAllByRole("img")).toHaveLength(2);
  });

  it("turns an invalid canonical decimal into a visible error instead of corrupt SVG attributes", () => {
    const model = areaModel();
    model.levelSeries = model.levelSeries.map((point, index) =>
      index === 0 ? { ...point, rawValue: "1e999" as never } : point,
    );

    expect(() => render(<ComparisonCharts model={model} />)).not.toThrow();
    expect(
      screen.getByRole("alert", { name: "种植面积比较数据无效" }),
    ).toHaveTextContent("指标数值格式无效");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it.each(["current-value", "current-change"] as const)(
    "rejects a conflicting %s before rendering an SVG",
    (conflict) => {
      const model = areaModel();
      if (conflict === "current-value") model.currentValue = "9999.9";
      else model.currentChangeText = "99.9%";

      render(<ComparisonCharts model={model} />);

      expect(
        screen.getByRole("alert", { name: "种植面积比较数据无效" }),
      ).toBeVisible();
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    },
  );

  it.each(["adjacent-kind", "direct-kind"] as const)(
    "rejects a mixed %s comparison unit before sharing one chart axis",
    (conflict) => {
      const model = areaModel();
      if (conflict === "adjacent-kind") {
        model.annualChangeSeries = model.annualChangeSeries.map(
          (change, index) =>
            index === 1
              ? { ...change, changeKind: "percentage-point" }
              : change,
        );
      } else {
        model.currentVsBaselineSeries = model.currentVsBaselineSeries.map(
          (change, index) =>
            index === 1 ? { ...change, changeKind: "absolute-delta" } : change,
        );
      }

      render(<ComparisonCharts model={model} />);

      expect(
        screen.getByRole("alert", { name: "种植面积比较数据无效" }),
      ).toBeVisible();
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    },
  );

  it.each(["level-year", "pair-label", "baseline-year"] as const)(
    "rejects a %s parallel-series misalignment before producing geometry",
    (misalignment) => {
      const model = areaModel();
      if (misalignment === "level-year") {
        model.levelSeries = model.levelSeries.map((point, index) =>
          index === 1 ? { ...point, year: 2034 } : point,
        );
      } else if (misalignment === "pair-label") {
        model.annualChangeSeries = model.annualChangeSeries.map(
          (item, index) =>
            index === 1 ? { ...item, label: "错位比较" } : item,
        );
      } else {
        model.currentVsBaselineSeries = model.currentVsBaselineSeries.map(
          (item, index) => (index === 1 ? { ...item, fromYear: 2034 } : item),
        );
      }

      render(<ComparisonCharts model={model} />);

      expect(
        screen.getByRole("alert", { name: "种植面积比较数据无效" }),
      ).toBeVisible();
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    },
  );

  it.each([
    ["Y-3 baseline", 0],
    ["intermediate year", 1],
    ["current year", 3],
  ] as const)(
    "rejects an unavailable %s with stale numeric dependent comparisons",
    (_case, index) => {
      const model = areaModel();
      markLevelUnavailableWithStaleComparisons(model, index);

      render(<ComparisonCharts model={model} />);

      expect(
        screen.getByRole("alert", { name: "种植面积比较数据无效" }),
      ).toBeVisible();
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    },
  );

  it.each([
    ["first adjacent raw result", 0, 0, "raw"],
    ["first adjacent state", 0, 0, "state"],
    ["first adjacent reason", 0, 0, "reason"],
    ["middle adjacent raw result", 1, 1, "raw"],
    ["middle adjacent state", 1, 1, "state"],
    ["middle adjacent reason", 1, 1, "reason"],
    ["last adjacent raw result", 2, 3, "raw"],
    ["last adjacent state", 2, 3, "state"],
    ["last adjacent reason", 2, 3, "reason"],
  ] as const)(
    "rejects an unavailable endpoint with a stale %s dependency",
    (_case, comparisonIndex, unavailableIndex, conflict) => {
      const model = areaModel();
      const values = model.levelSeries.map(({ rawValue }) => rawValue);
      values[unavailableIndex] = null;
      replaceLevelValues(model, values);

      if (conflict === "raw") {
        model.annualChangeSeries = model.annualChangeSeries.map(
          (change, index) =>
            index === comparisonIndex
              ? { ...change, rawChange: fixedDecimal("9.9") }
              : change,
        );
      } else if (conflict === "state") {
        model.pairCells = model.pairCells.map((pair, index) =>
          index === comparisonIndex ? { ...pair, state: "comparable" } : pair,
        );
      } else {
        model.pairCells = model.pairCells.map((pair, index) =>
          index === comparisonIndex
            ? { ...pair, changeText: "", reason: "" }
            : pair,
        );
        model.annualChangeSeries = model.annualChangeSeries.map(
          (change, index) =>
            index === comparisonIndex
              ? { ...change, changeText: "", reason: "" }
              : change,
        );
        if (comparisonIndex === 2) model.currentChangeText = "";
      }

      render(<ComparisonCharts model={model} />);

      const alert = screen.getByRole("alert", {
        name: "种植面积比较数据无效",
      });
      expect(alert).toHaveTextContent("四年比较端点依赖不一致");
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    },
  );

  it.each([
    ["2023 direct baseline raw result", 0, "raw"],
    ["2023 direct baseline state", 0, "state"],
    ["2023 direct baseline reason", 0, "reason"],
    ["2024 direct baseline raw result", 1, "raw"],
    ["2024 direct baseline state", 1, "state"],
    ["2024 direct baseline reason", 1, "reason"],
    ["2025 direct baseline raw result", 2, "raw"],
    ["2025 direct baseline state", 2, "state"],
    ["2025 direct baseline reason", 2, "reason"],
  ] as const)(
    "rejects an unavailable %s dependency",
    (_case, baselineIndex, conflict) => {
      const model = areaModel();
      const values = model.levelSeries.map(({ rawValue }) => rawValue);
      values[baselineIndex] = null;
      replaceLevelValues(model, values);

      model.currentVsBaselineSeries = model.currentVsBaselineSeries.map(
        (comparison, index) => {
          if (index !== baselineIndex) return comparison;
          if (conflict === "raw") {
            return { ...comparison, rawChange: fixedDecimal("9.9") };
          }
          if (conflict === "state") {
            return { ...comparison, state: "comparable" };
          }
          return { ...comparison, changeText: "", reason: "" };
        },
      );

      render(<ComparisonCharts model={model} />);

      const alert = screen.getByRole("alert", {
        name: "种植面积比较数据无效",
      });
      expect(alert).toHaveTextContent("四年比较端点依赖不一致");
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    },
  );

  it.each([
    ["2023 direct result raw value", 0, "raw"],
    ["2023 direct result state", 0, "state"],
    ["2023 direct result reason", 0, "reason"],
    ["2024 direct result raw value", 1, "raw"],
    ["2024 direct result state", 1, "state"],
    ["2024 direct result reason", 1, "reason"],
    ["2025 direct result raw value", 2, "raw"],
    ["2025 direct result state", 2, "state"],
    ["2025 direct result reason", 2, "reason"],
  ] as const)(
    "rejects a stale %s when the current endpoint is unavailable",
    (_case, baselineIndex, conflict) => {
      const model = areaModel();
      const values = model.levelSeries.map(({ rawValue }) => rawValue);
      values[3] = null;
      replaceLevelValues(model, values);

      model.currentVsBaselineSeries = model.currentVsBaselineSeries.map(
        (comparison, index) => {
          if (index !== baselineIndex) return comparison;
          if (conflict === "raw") {
            return { ...comparison, rawChange: fixedDecimal("9.9") };
          }
          if (conflict === "state") {
            return { ...comparison, state: "comparable" };
          }
          return { ...comparison, changeText: "", reason: "" };
        },
      );

      render(<ComparisonCharts model={model} />);

      const alert = screen.getByRole("alert", {
        name: "种植面积比较数据无效",
      });
      expect(alert).toHaveTextContent("四年比较端点依赖不一致");
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    },
  );

  it("breaks the level connector only for unavailable coordinates or governed coordinate discontinuity", () => {
    const model = areaModel();
    model.pairCells = [
      {
        ...model.pairCells[0],
        state: "not-comparable",
        changeText: "行政区划边界版本不同",
        reason: "行政区划边界版本不同",
      },
      model.pairCells[1],
      {
        ...model.pairCells[2],
        state: "comparable",
        changeText: "基期为零，无法计算增长率",
        reason: "基期为零，无法计算增长率",
      },
    ];
    model.annualChangeSeries = [
      {
        ...model.annualChangeSeries[0],
        rawChange: null,
        changeText: "行政区划边界版本不同",
        reason: "行政区划边界版本不同",
      },
      model.annualChangeSeries[1],
      {
        ...model.annualChangeSeries[2],
        rawChange: null,
        changeText: "基期为零，无法计算增长率",
        reason: "基期为零，无法计算增长率",
      },
    ];
    model.currentChangeText = "基期为零，无法计算增长率";

    const { container } = render(<ComparisonCharts model={model} />);

    expect(
      container.querySelector('[data-level-segment="2023-2024"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-level-segment="2024-2025"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-level-segment="2025-2026"]'),
    ).not.toBeNull();
    expect(
      container.querySelector(
        '[data-change-state="coordinate-not-comparable"]',
      ),
    ).toHaveTextContent("各年度统计范围发生变化，暂不可直接比较");
    expect(
      container.querySelector('[data-change-state="formula-unavailable"]'),
    ).toHaveTextContent("基期为零，无法计算增长率");
  });

  it("plots positive, negative, and literal-zero governed changes around a neutral zero axis", () => {
    const model = areaModel();
    model.pairCells = model.pairCells.map((pair, index) => ({
      ...pair,
      changeText: ["5.0%", "-1.0%", "0.0%"][index],
    }));
    model.annualChangeSeries = [
      {
        ...model.annualChangeSeries[0],
        changeKind: "relative-rate",
        rawChange: fixedDecimal("5"),
        changeText: "5.0%",
      },
      {
        ...model.annualChangeSeries[1],
        changeKind: "relative-rate",
        rawChange: fixedDecimal("-1"),
        changeText: "-1.0%",
      },
      {
        ...model.annualChangeSeries[2],
        changeKind: "relative-rate",
        rawChange: fixedDecimal("0"),
        changeText: "0.0%",
      },
    ];
    model.currentChangeText = "0.0%";

    const { container } = render(<ComparisonCharts model={model} />);

    const zeroAxis = container.querySelector(
      ".enterprise-comparison-chart__zero-axis",
    );
    expect(zeroAxis).toHaveAttribute("y1", "140");
    expect(zeroAxis).toHaveAttribute("y2", "140");
    expect(screen.getByText("相对增长率 +5.0%")).toBeVisible();
    expect(screen.getByText("相对增长率 -1.0%")).toBeVisible();
    expect(screen.getByText("相对增长率 0.0%")).toBeVisible();

    const positive = container.querySelector('[data-change-sign="positive"]');
    const negative = container.querySelector('[data-change-sign="negative"]');
    expect(positive).not.toBeNull();
    expect(negative).not.toBeNull();
    expect(parseFloat(positive?.getAttribute("y") ?? "NaN")).toBeLessThan(140);
    expect(parseFloat(negative?.getAttribute("y") ?? "NaN")).toBe(140);
    expect(container.querySelector('[data-change-sign="zero"]')).not.toBeNull();
  });

  it.each([
    ["relative-rate", "相对增长率", ["2.4%", "1.9%", "2.8%"]],
    [
      "percentage-point",
      "百分点变化",
      ["2.4 个百分点", "1.9 个百分点", "2.8 个百分点"],
    ],
    ["absolute-delta", "绝对变化", ["2.4 万亩", "1.9 万亩", "2.8 万亩"]],
  ] as const)(
    "renders one governed %s unit consistently across the shared change axis",
    (changeKind, kindLabel, displayValues) => {
      const model = areaModel();
      model.pairCells = model.pairCells.map((pair, index) => ({
        ...pair,
        changeText: displayValues[index],
      }));
      model.annualChangeSeries = model.annualChangeSeries.map(
        (change, index) => ({
          ...change,
          changeKind,
          changeText: displayValues[index],
        }),
      );
      model.currentVsBaselineSeries = model.currentVsBaselineSeries.map(
        (change, index) => ({
          ...change,
          changeKind,
          changeText: displayValues[index],
        }),
      );
      model.currentChangeText = displayValues[2];

      render(<ComparisonCharts model={model} />);

      expect(
        screen.getByText(`${kindLabel} +${displayValues[0]}`),
      ).toBeVisible();
      expect(screen.getAllByRole("img")).toHaveLength(2);
    },
  );

  it.each([
    ["constant", ["5", "5", "5", "5"], 4, 3],
    ["literal-zero", ["0", "0", "0", "0"], 4, 3],
    ["mixed-sign", ["-5", "0", "10", "-2"], 4, 3],
    [
      "huge-close",
      [
        `${"9".repeat(180)}0`,
        `${"9".repeat(180)}1`,
        `${"9".repeat(180)}2`,
        `${"9".repeat(180)}3`,
      ],
      4,
      3,
    ],
    ["all-null", [null, null, null, null], 0, 0],
    ["partial-null", ["1", null, "3", "4"], 3, 1],
  ] as const)(
    "keeps %s exact-decimal geometry finite and bounded",
    (_name, values, pointCount, segmentCount) => {
      const model = areaModel();
      replaceLevelValues(model, values);

      const { container } = render(<ComparisonCharts model={model} />);

      expect(
        container.querySelectorAll(".enterprise-comparison-chart__level-point"),
      ).toHaveLength(pointCount);
      expect(
        container.querySelectorAll(
          ".enterprise-comparison-chart__level-segment",
        ),
      ).toHaveLength(segmentCount);
      expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
      for (const element of container.querySelectorAll(
        "svg [x], svg [y], svg [x1], svg [x2], svg [y1], svg [y2], svg [height], svg [cx], svg [cy]",
      )) {
        for (const attribute of [
          "x",
          "y",
          "x1",
          "x2",
          "y1",
          "y2",
          "height",
          "cx",
          "cy",
        ]) {
          const raw = element.getAttribute(attribute);
          if (raw !== null) expect(Number.isFinite(parseFloat(raw))).toBe(true);
        }
      }

      if (_name === "constant" || _name === "literal-zero") {
        const pointYs = [
          ...container.querySelectorAll(
            ".enterprise-comparison-chart__level-point",
          ),
        ].map((point) => point.getAttribute("cy"));
        expect(new Set(pointYs).size).toBe(1);
      }
      if (_name === "huge-close") {
        const pointYs = [
          ...container.querySelectorAll(
            ".enterprise-comparison-chart__level-point",
          ),
        ].map((point) => point.getAttribute("cy"));
        expect(new Set(pointYs).size).toBe(4);
      }
      if (_name === "all-null") {
        expect(
          container.querySelectorAll(".enterprise-comparison-chart__level-gap"),
        ).toHaveLength(4);
        expect(screen.getAllByText("2023 年未采集")).toHaveLength(2);
      }
    },
  );

  it("uses the fixed neutral year palette and keeps SVG marks out of the tab order", () => {
    const { container } = render(<ComparisonCharts model={areaModel()} />);

    expect(comparisonYearColors).toEqual({
      previous3: "#C6D1D3",
      previous2: "#91AAA9",
      previous1: "#4D8D87",
      current: "#1E625F",
    });
    expect(
      [
        ...container.querySelectorAll(
          ".enterprise-comparison-chart__level-point",
        ),
      ].map((point) => point.getAttribute("fill")),
    ).toEqual(["#C6D1D3", "#91AAA9", "#4D8D87", "#1E625F"]);
    expect(container.querySelectorAll("svg [tabindex]")).toHaveLength(0);
  });

  it("defines the scoped enterprise comparison states and responsive ledger contract", () => {
    const css = readFileSync("src/business/unified-workspaces.css", "utf8");
    const start = css.indexOf("/* enterprise-comparison:start */");
    const end = css.indexOf("/* enterprise-comparison:end */");
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const comparisonCss = css.slice(start, end);

    expect(comparisonCss).toMatch(
      /\.enterprise-comparison-track\s*\{[^}]*min-height:\s*(?:[4-9]\d|\d{3,})px/s,
    );
    expect(comparisonCss).toMatch(
      /\.enterprise-comparison-track:focus-visible\s*\{[^}]*outline:\s*[2-9]px/s,
    );
    expect(comparisonCss).toContain(".enterprise-comparison-track:hover");
    expect(comparisonCss).toContain(
      '.enterprise-comparison-track[aria-pressed="true"]',
    );
    expect(comparisonCss).toContain(
      ".enterprise-comparison-track__year.is-missing",
    );
    expect(comparisonCss).toContain(
      ".enterprise-comparison-track__pair.is-coordinate-not-comparable",
    );
    expect(comparisonCss).toContain(
      ".enterprise-comparison-track__pair.is-formula-unavailable",
    );
    expect(comparisonCss).toContain(".enterprise-comparison-error");
    expect(comparisonCss).toMatch(
      /\.enterprise-comparison-track__years[^}]*min-width:\s*720px/s,
    );
    expect(comparisonCss).toContain("@media (max-width: 1120px)");
    expect(comparisonCss).toMatch(
      /@media \(max-width: 1120px\)[\s\S]*?\.enterprise-comparison-track__rail\s*\{[^}]*overflow-x:\s*auto/s,
    );
    expect(comparisonCss).toContain("@media (max-width: 1024px)");
    expect(comparisonCss).toMatch(
      /@media \(max-width: 1024px\)[\s\S]*?\.enterprise-comparison-charts__panels\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s,
    );
    expect(comparisonCss).toMatch(
      /\.enterprise-comparison-charts\s*\{[^}]*container-type:\s*inline-size;[^}]*container-name:\s*enterprise-comparison;/s,
    );
    expect(comparisonCss).toMatch(
      /@container enterprise-comparison \(max-width: 1180px\)[\s\S]*?\.enterprise-comparison-charts__panels\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s,
    );
    expect(comparisonCss).toMatch(
      /\.enterprise-comparison-chart__value-label\s*\{[^}]*font-size:\s*1[2-9]px/s,
    );
    expect(comparisonCss).toMatch(
      /\.enterprise-comparison-chart__period-label,\s*\.enterprise-comparison-chart__zero-label\s*\{[^}]*font-size:\s*1[2-9]px/s,
    );
    expect(comparisonCss).toMatch(
      /\.enterprise-comparison-chart__reason-label\s*\{[^}]*font-size:\s*1[2-9]px/s,
    );
    expect(comparisonCss).not.toMatch(/workspace-warning|#a56a05|#d29b33/i);
    expect(comparisonCss).not.toMatch(/font-size:\s*[0-9](?:\.[0-9]+)?px/);
    expect(comparisonCss).not.toContain("#6f8795");
    expect(comparisonCss).toMatch(
      /\.enterprise-comparison-track__identity\s*>\s*\.enterprise-comparison-track__cagr,\s*\.enterprise-comparison-track__identity\s*>\s*\.enterprise-comparison-track__version,\s*\.enterprise-comparison-track__identity\s*>\s*\.enterprise-comparison-track__comparability\s*\{[^}]*white-space:\s*normal;[^}]*overflow-wrap:\s*anywhere;/s,
    );
  });
});
