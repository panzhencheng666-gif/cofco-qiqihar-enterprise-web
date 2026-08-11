import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RegionCascadeSelector } from "./RegionCascadeSelector";

afterEach(cleanup);

describe("RegionCascadeSelector", () => {
  it("uses one hierarchical entry and does not expose unauthorized regions", async () => {
    const user = userEvent.setup();
    render(
      <RegionCascadeSelector
        authorizedRegionIds={["qiqihar-nehe"]}
        maxLevel="village"
        value={{ cityId: "qiqihar" }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("地区")).toBeVisible();
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    expect(screen.getByLabelText("选择地区")).toHaveTextContent("齐齐哈尔市");

    await user.click(screen.getByLabelText("选择地区"));
    expect(
      within(screen.getByLabelText("区县选项")).getByRole("button", {
        name: "讷河市",
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "爱辉区" }),
    ).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("authorized-all");
  });

  it("clears lower selections when an upper level changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RegionCascadeSelector
        authorizedRegionIds={["qiqihar-nehe", "heihe-aihui"]}
        maxLevel="village"
        value={{
          cityId: "qiqihar",
          countyId: "qiqihar-nehe",
          townshipId: "qiqihar-nehe-tongyi",
        }}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByLabelText("选择地区"));
    await user.click(screen.getByRole("button", { name: "黑河市" }));
    expect(onChange).toHaveBeenCalledWith({ cityId: "heihe" });
  });

  it("shows verified township and administrative-village options", async () => {
    const user = userEvent.setup();
    render(
      <RegionCascadeSelector
        authorizedRegionIds={["qiqihar-nehe"]}
        maxLevel="village"
        value={{
          cityId: "qiqihar",
          countyId: "qiqihar-nehe",
          townshipId: "qiqihar-nehe-tongyi",
        }}
        onChange={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText("选择地区"));
    expect(
      within(screen.getByLabelText("乡镇选项")).getByRole("button", {
        name: "同义镇",
      }),
    ).toBeVisible();
    expect(
      within(screen.getByLabelText("行政村选项")).getByRole("button", {
        name: "保国村",
      }),
    ).toBeVisible();
    expect(
      within(screen.getByLabelText("行政村选项")).getByRole("button", {
        name: "庆宝村",
      }),
    ).toBeVisible();
  });
});
