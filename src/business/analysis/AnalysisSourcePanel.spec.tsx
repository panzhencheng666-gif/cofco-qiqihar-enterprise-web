import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { validSnapshot } from "@/platform/api/observableAnalysisContract.fixture";
import { AnalysisSourcePanel } from "./AnalysisSourcePanel";
afterEach(cleanup);
it("filters the source preview by region and clears a stale region after realtime replacement", () => {
  const source = validSnapshot().lineage[0];
  const sources = [
    { ...source, regionLabel: "甲县", subjectLabel: "甲来源" },
    { ...source, regionLabel: "乙县", subjectLabel: "乙来源" },
  ];
  const { rerender } = render(<AnalysisSourcePanel sources={sources} />);
  fireEvent.click(screen.getByRole("button", { name: /甲县/u }));
  expect(screen.getByText("甲来源")).toBeVisible();
  expect(screen.queryByText("乙来源")).not.toBeInTheDocument();
  rerender(<AnalysisSourcePanel sources={[sources[1]]} />);
  expect(screen.getByText("乙来源")).toBeVisible();
  expect(
    within(
      screen.getByRole("region", { name: "本期数据来源分布" }),
    ).queryByRole("button", {
      pressed: true,
    }),
  ).not.toBeInTheDocument();
});

it("combines source search with the selected region without losing the complete ledger", () => {
  const source = validSnapshot().lineage[0];
  render(
    <AnalysisSourcePanel
      sources={[
        { ...source, regionLabel: "甲县", subjectLabel: "甲企业" },
        { ...source, regionLabel: "乙县", subjectLabel: "乙企业" },
      ]}
    />,
  );
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "乙企业" },
  });
  expect(screen.getByText("乙企业")).toBeVisible();
  expect(screen.queryByText("甲企业")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /甲县/u }));
  expect(screen.getByText("没有符合当前筛选条件的来源记录")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "清除地区筛选" }));
  expect(screen.getByText("乙企业")).toBeVisible();
});
