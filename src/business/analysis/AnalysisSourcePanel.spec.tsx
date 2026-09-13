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
    within(screen.getByRole("complementary")).queryByRole("button", {
      pressed: true,
    }),
  ).not.toBeInTheDocument();
});
