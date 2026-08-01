import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fixedDecimal } from "../core/fixedDecimal";
import type { MetricComparisonViewModel } from "../core/metricComparisonViewModel";
import { AnnualComparisonTrack } from "./AnnualComparisonTrack";

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

describe("AnnualComparisonTrack", () => {
  it("renders one selectable four-year comparison rail with governed labels", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <AnnualComparisonTrack
        model={areaModel()}
        selected
        onSelect={onSelect}
      />,
    );

    const track = screen.getByRole("button", { name: /种植面积四年比较/ });
    expect(track).toBeVisible();
    expect(track).toHaveAttribute("type", "button");
    expect(track).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("2023")).toBeVisible();
    expect(screen.getByText("2026")).toBeVisible();
    expect(screen.getByText("2026/2025同比 +2.8%")).toBeVisible();
    expect(screen.getByText("指标版本 M-AREA-V4")).toBeVisible();
    expect(screen.getByText("四年口径连续可比")).toBeVisible();

    await user.click(track);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("production.planted-area");
  });

  it("uses governed raw signs only to prefix positive display strings", () => {
    const model = areaModel();
    model.pairCells = [
      { ...model.pairCells[0], changeText: "0.0%" },
      { ...model.pairCells[1], changeText: "-1.9%" },
      model.pairCells[2],
    ];
    model.annualChangeSeries = [
      {
        ...model.annualChangeSeries[0],
        rawChange: fixedDecimal("0"),
        changeText: "0.0%",
      },
      {
        ...model.annualChangeSeries[1],
        rawChange: fixedDecimal("-1.9"),
        changeText: "-1.9%",
      },
      model.annualChangeSeries[2],
    ];

    render(
      <AnnualComparisonTrack
        model={model}
        selected={false}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("2024/2023同比 0.0%")).toBeVisible();
    expect(screen.getByText("2025/2024同比 -1.9%")).toBeVisible();
    expect(screen.getByText("2026/2025同比 +2.8%")).toBeVisible();
  });

  it.each([
    ["缺失", "缺少已核定结果"],
    ["未采集", "本年度未组织采集"],
    ["不适用", "当前业务范围不适用"],
    ["无发布", "未形成正式发布"],
    ["已拒绝", "质量复核未通过"],
    ["待审核", "等待指标发布审核"],
  ])(
    "shows the exact %s availability and governed reason instead of zero",
    (availability, reason) => {
      const model = areaModel();
      model.yearCells = model.yearCells.map((cell, index) =>
        index === 1
          ? {
              ...cell,
              valueText: availability,
              availabilityLabel: availability,
              reason,
            }
          : cell,
      );
      model.levelSeries = model.levelSeries.map((point, index) =>
        index === 1
          ? { ...point, rawValue: null, valueText: availability }
          : point,
      );

      render(
        <AnnualComparisonTrack
          model={model}
          selected={false}
          onSelect={vi.fn()}
        />,
      );

      const year = screen.getByRole("group", { name: "2024 年指标值" });
      expect(year).toHaveClass("is-missing");
      expect(year).toHaveTextContent(availability);
      expect(year).toHaveTextContent(reason);
      expect(year).not.toHaveTextContent(/^0(?:\.0)?$/);
    },
  );

  it("keeps a literal governed zero visible", () => {
    const model = areaModel();
    model.yearCells = model.yearCells.map((cell, index) =>
      index === 1
        ? { ...cell, valueText: "0.0", availabilityLabel: "可用", reason: null }
        : cell,
    );
    model.levelSeries = model.levelSeries.map((point, index) =>
      index === 1
        ? { ...point, rawValue: fixedDecimal("0"), valueText: "0.0" }
        : point,
    );

    render(
      <AnnualComparisonTrack
        model={model}
        selected={false}
        onSelect={vi.fn()}
      />,
    );

    const year = screen.getByRole("group", { name: "2024 年指标值" });
    expect(year).not.toHaveClass("is-missing");
    expect(year).toHaveTextContent("0.0");
  });

  it("keeps the CAGR field identity visible when its governed result is unavailable", () => {
    const model = areaModel();
    model.cagrText = "四年序列存在不可计算的年度增长率";

    render(
      <AnnualComparisonTrack
        model={model}
        selected={false}
        onSelect={vi.fn()}
      />,
    );

    const cagr = screen.getByText(
      "年均复合增长率：四年序列存在不可计算的年度增长率",
    );
    expect(cagr).toBeVisible();
    expect(cagr).toHaveClass("enterprise-comparison-track__cagr");
    expect(screen.getByText("指标版本 M-AREA-V4")).toHaveClass(
      "enterprise-comparison-track__version",
    );
    expect(screen.getByText("四年口径连续可比")).toHaveClass(
      "enterprise-comparison-track__comparability",
    );
  });

  it("distinguishes a coordinate break from a formula-unavailable comparison", () => {
    const model = areaModel();
    model.pairCells = [
      {
        ...model.pairCells[0],
        state: "not-comparable",
        reason: "行政区划边界版本不同",
        changeText: "行政区划边界版本不同",
      },
      model.pairCells[1],
      {
        ...model.pairCells[2],
        state: "comparable",
        reason: "基期为零，无法计算增长率",
        changeText: "基期为零，无法计算增长率",
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

    render(
      <AnnualComparisonTrack
        model={model}
        selected={false}
        onSelect={vi.fn()}
      />,
    );

    expect(
      screen.getByText("2024 与 2023 口径不可比：行政区划边界版本不同"),
    ).toHaveClass("is-coordinate-not-comparable");
    expect(
      screen.getByText("2026/2025同比 基期为零，无法计算增长率"),
    ).toHaveClass("is-formula-unavailable");
  });

  it("supports native Enter and Space activation exactly once per key", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <AnnualComparisonTrack
        model={areaModel()}
        selected={false}
        onSelect={onSelect}
      />,
    );
    const track = screen.getByRole("button", { name: /种植面积四年比较/ });

    track.focus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(1);
    await user.keyboard(" ");
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["yearCells", 3],
    ["levelSeries", 3],
    ["pairCells", 2],
    ["annualChangeSeries", 2],
    ["currentVsBaselineSeries", 2],
  ] as const)(
    "renders a visible error when %s cardinality is malformed",
    (field, length) => {
      const model = areaModel();
      model[field] = model[field].slice(0, length) as never;

      render(
        <AnnualComparisonTrack
          model={model}
          selected={false}
          onSelect={vi.fn()}
        />,
      );

      expect(
        screen.getByRole("alert", { name: "种植面积比较数据无效" }),
      ).toHaveTextContent("四年比较数据结构不完整");
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    },
  );

  it("rejects a non-chronological four-year model", () => {
    const model = areaModel();
    model.yearCells = [
      model.yearCells[1],
      model.yearCells[0],
      model.yearCells[2],
      model.yearCells[3],
    ];

    render(
      <AnnualComparisonTrack
        model={model}
        selected={false}
        onSelect={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("alert", { name: "种植面积比较数据无效" }),
    ).toHaveTextContent("四年比较年份必须连续递增");
  });

  it.each(["level-year", "pair-label", "baseline-year"] as const)(
    "rejects a %s parallel-series misalignment",
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

      render(
        <AnnualComparisonTrack
          model={model}
          selected={false}
          onSelect={vi.fn()}
        />,
      );

      expect(
        screen.getByRole("alert", { name: "种植面积比较数据无效" }),
      ).toBeVisible();
    },
  );

  it("does not append a unit to an unavailable current value", () => {
    const model = areaModel();
    model.currentValue = "无发布";
    model.yearCells = model.yearCells.map((cell, index) =>
      index === 3
        ? {
            ...cell,
            valueText: "无发布",
            availabilityLabel: "无发布",
            releaseVersionLabel: "未发起发布",
            reason: "未形成正式发布",
          }
        : cell,
    );
    model.levelSeries = model.levelSeries.map((point, index) =>
      index === 3 ? { ...point, rawValue: null, valueText: "无发布" } : point,
    );
    model.pairCells = model.pairCells.map((pair, index) =>
      index === 2
        ? {
            ...pair,
            state: "not-comparable",
            changeText: "未形成正式发布",
            reason: "未形成正式发布",
          }
        : pair,
    );
    model.annualChangeSeries = model.annualChangeSeries.map((change, index) =>
      index === 2
        ? {
            ...change,
            rawChange: null,
            changeText: "未形成正式发布",
            reason: "未形成正式发布",
          }
        : change,
    );
    model.currentChangeText = "未形成正式发布";

    render(
      <AnnualComparisonTrack
        model={model}
        selected={false}
        onSelect={vi.fn()}
      />,
    );

    const track = screen.getByRole("button", { name: /当前值 无发布/ });
    expect(track).not.toHaveAccessibleName(/无发布 万亩/);
    expect(screen.getByText(/^当前值 无发布$/)).toBeVisible();
  });

  it.each([
    "current-value",
    "current-change",
    "level-display",
    "pair-display",
  ] as const)(
    "rejects a conflicting %s denormalized display truth",
    (conflict) => {
      const model = areaModel();
      if (conflict === "current-value") model.currentValue = "9999.9";
      if (conflict === "current-change") model.currentChangeText = "99.9%";
      if (conflict === "level-display") {
        model.levelSeries = model.levelSeries.map((point, index) =>
          index === 1 ? { ...point, valueText: "冲突值" } : point,
        );
      }
      if (conflict === "pair-display") {
        model.pairCells = model.pairCells.map((pair, index) =>
          index === 1 ? { ...pair, changeText: "冲突变化" } : pair,
        );
      }

      render(
        <AnnualComparisonTrack
          model={model}
          selected={false}
          onSelect={vi.fn()}
        />,
      );

      expect(
        screen.getByRole("alert", { name: "种植面积比较数据无效" }),
      ).toBeVisible();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    },
  );

  it.each([
    "null-marked-available",
    "available-marked-missing",
    "missing-without-reason",
    "pair-reason-diverged",
    "direct-without-reason",
    "empty-release",
    "zero-unavailable-label",
    "unknown-unavailable-label",
  ] as const)(
    "rejects a %s governed-state association conflict",
    (conflict) => {
      const model = areaModel();
      if (conflict === "null-marked-available") {
        model.levelSeries = model.levelSeries.map((point, index) =>
          index === 1 ? { ...point, rawValue: null, valueText: "可用" } : point,
        );
        model.yearCells = model.yearCells.map((cell, index) =>
          index === 1 ? { ...cell, valueText: "可用" } : cell,
        );
      }
      if (conflict === "available-marked-missing") {
        model.yearCells = model.yearCells.map((cell, index) =>
          index === 1
            ? { ...cell, availabilityLabel: "未采集", valueText: "1226.7" }
            : cell,
        );
      }
      if (conflict === "missing-without-reason") {
        model.levelSeries = model.levelSeries.map((point, index) =>
          index === 1
            ? { ...point, rawValue: null, valueText: "未采集" }
            : point,
        );
        model.yearCells = model.yearCells.map((cell, index) =>
          index === 1
            ? {
                ...cell,
                availabilityLabel: "未采集",
                valueText: "未采集",
                reason: null,
              }
            : cell,
        );
      }
      if (conflict === "pair-reason-diverged") {
        model.pairCells = model.pairCells.map((pair, index) =>
          index === 1 ? { ...pair, reason: "治理原因甲" } : pair,
        );
        model.annualChangeSeries = model.annualChangeSeries.map(
          (change, index) =>
            index === 1 ? { ...change, reason: "治理原因乙" } : change,
        );
      }
      if (conflict === "direct-without-reason") {
        model.currentVsBaselineSeries = model.currentVsBaselineSeries.map(
          (item, index) =>
            index === 1
              ? {
                  ...item,
                  rawChange: null,
                  changeText: "不可计算",
                  state: "not-comparable",
                  reason: null,
                }
              : item,
        );
      }
      if (conflict === "empty-release") {
        model.yearCells = model.yearCells.map((cell, index) =>
          index === 1 ? { ...cell, releaseVersionLabel: " " } : cell,
        );
      }
      if (
        conflict === "zero-unavailable-label" ||
        conflict === "unknown-unavailable-label"
      ) {
        const label =
          conflict === "zero-unavailable-label" ? "0" : "未知不可用状态";
        model.levelSeries = model.levelSeries.map((point, index) =>
          index === 1 ? { ...point, rawValue: null, valueText: label } : point,
        );
        model.yearCells = model.yearCells.map((cell, index) =>
          index === 1
            ? {
                ...cell,
                availabilityLabel: label,
                valueText: label,
                reason: "缺少受治理结果",
              }
            : cell,
        );
      }

      render(
        <AnnualComparisonTrack
          model={model}
          selected={false}
          onSelect={vi.fn()}
        />,
      );

      expect(
        screen.getByRole("alert", { name: "种植面积比较数据无效" }),
      ).toBeVisible();
    },
  );
});
