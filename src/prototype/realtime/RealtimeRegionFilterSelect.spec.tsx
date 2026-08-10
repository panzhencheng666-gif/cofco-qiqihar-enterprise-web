import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RealtimeRegionFilterSelect } from "./RealtimeRegionFilterSelect";

afterEach(cleanup);

describe("realtime region filter", () => {
  it("shows only real master-data regions authorized for the employee", () => {
    render(
      <RealtimeRegionFilterSelect
        authorizedRegionCodes={["230202"]}
        onChange={vi.fn()}
        regions={[
          {
            code: "230200",
            name: "齐齐哈尔市",
            parentCode: null,
            level: "PREFECTURE",
          },
          {
            code: "230202",
            name: "龙沙区",
            parentCode: "230200",
            level: "COUNTY",
          },
          {
            code: "231100",
            name: "黑河市",
            parentCode: null,
            level: "PREFECTURE",
          },
        ]}
        value=""
      />,
    );

    const options = screen.getByRole("combobox", { name: "业务地区" });
    expect(options).toHaveTextContent("全部授权地区");
    expect(options).toHaveTextContent("齐齐哈尔市 / 龙沙区");
    expect(options).not.toHaveTextContent("黑河市");
  });
});
