import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { RealtimeRegionCascadePicker } from "./RealtimeRegionCascadePicker";
import type { MasterRegion } from "@/platform/api/realtimeBusinessRepository";

afterEach(cleanup);
const regions = [
  { code: "230200", name: "齐齐哈尔市", level: "PREFECTURE", parentCode: null },
  { code: "231100", name: "黑河市", level: "PREFECTURE", parentCode: null },
  { code: "230208", name: "梅里斯区", level: "COUNTY", parentCode: "230200" },
  {
    code: "230208101",
    name: "雅尔塞镇",
    level: "TOWNSHIP",
    parentCode: "230208",
  },
  {
    code: "230208101001",
    name: "音钦村",
    level: "VILLAGE",
    parentCode: "230208101",
  },
] as readonly MasterRegion[];
function Picker() {
  const [value, setValue] = useState("");
  return (
    <RealtimeRegionCascadePicker
      regions={regions}
      value={value}
      onChange={setValue}
    />
  );
}
it("selects closest options through all levels and clears descendants when the city changes", () => {
  render(<Picker />);
  for (const [label, query, value] of [
    ["地级市", "齐齐哈尔", "230200"],
    ["区县", "梅里斯", "230208"],
    ["乡镇", "雅尔寨", "230208101"],
    ["行政村", "音钦", "230208101001"],
  ]) {
    fireEvent.change(screen.getByRole("searchbox", { name: `搜索${label}` }), {
      target: { value: query },
    });
    expect(screen.getByRole("combobox", { name: label })).toHaveValue(value);
  }
  fireEvent.change(screen.getByRole("searchbox", { name: "搜索地级市" }), {
    target: { value: "黑河" },
  });
  expect(screen.getByRole("combobox", { name: "地级市" })).toHaveValue(
    "231100",
  );
  expect(screen.getByRole("combobox", { name: "行政村" })).toHaveValue("");
  expect(screen.getByRole("combobox", { name: "乡镇" })).toBeDisabled();
});
it("retains the selected value for empty or unrelated queries", () => {
  render(<Picker />);
  const search = screen.getByRole("searchbox", { name: "搜索地级市" });
  fireEvent.change(search, { target: { value: "齐齐哈尔" } });
  fireEvent.change(search, { target: { value: "不存在" } });
  expect(screen.getByRole("combobox", { name: "地级市" })).toHaveValue(
    "230200",
  );
  fireEvent.change(search, { target: { value: "" } });
  expect(screen.getByRole("combobox", { name: "地级市" })).toHaveValue(
    "230200",
  );
});
