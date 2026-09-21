import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EnterprisePlatformHeader } from "./EnterprisePlatformHeader";
import {
  identityNavigationUrl,
  safeWorkbenchReturn,
  workbenchReturn,
} from "./workbenchNavigation";

afterEach(cleanup);
describe("production workbench navigation", () => {
  it("routes application entries to the workbench rather than the portal", () => {
    window.history.replaceState(
      null,
      "",
      "/workbench/?year=2026#/市场监测/玉米市场采集",
    );
    render(
      <EnterprisePlatformHeader
        displayName="员工"
        roleLabel="员工"
        canManage
        activeSection="business"
      />,
    );
    expect(
      screen.getByRole("link", { name: "业务工作台" }),
    ).toHaveAttribute("href", "/workbench/");
    expect(
      screen.getByRole("link", { name: "我的任务" }),
    ).toHaveAttribute("href", "/workbench/?page=work&section=my-tasks");
    expect(
      screen.getByRole("link", { name: "风险研判预警" }),
    ).toHaveAttribute("href", "/risk/");
    expect(
      screen.getByRole("link", { name: "风险研判预警" }),
    ).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "业务通知" })).toHaveAttribute(
      "href",
      "/workbench/?panel=notifications",
    );
    const profile = new URL(
      screen
        .getByRole("link", { name: "当前用户：员工" })
        .getAttribute("href")!,
      window.location.origin,
    );
    expect(profile.searchParams.get("returnTo")).toBe(
      window.location.pathname + window.location.search + window.location.hash,
    );
    const management = new URL(
      screen.getByRole("link", { name: "系统管理" }).getAttribute("href")!,
      window.location.origin,
    );
    expect(management.searchParams.get("returnTo")).toBe(
      profile.searchParams.get("returnTo"),
    );
  });
  it("preserves the original business route across identity views", () => {
    const origin = "https://example.com";
    const returnTo = "/workbench/?year=2026#/市场监测/玉米市场采集";
    const location = {
      origin,
      pathname: "/identity.html",
      search: "?view=profile&returnTo=" + encodeURIComponent(returnTo),
      hash: "",
    };
    expect(decodeURI(workbenchReturn(location))).toBe(returnTo);
    const management = new URL(
      identityNavigationUrl("/identity.html?view=employees", location),
      origin,
    );
    expect(decodeURI(management.searchParams.get("returnTo")!)).toBe(returnTo);
  });
  it("marks the independent risk application as the current platform application", () => {
    render(
      <EnterprisePlatformHeader
        displayName="员工"
        roleLabel="员工"
        canManage={false}
        activeSection="risk"
      />,
    );

    expect(
      screen.getByRole("link", { name: "风险研判预警" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: "业务工作台" }),
    ).not.toHaveAttribute("aria-current");
  });
  it("falls back safely for direct visits and untrusted targets", () => {
    for (const value of [
      null,
      "/",
      "//evil.example/workbench/",
      "https://evil.example/workbench/",
      "javascript:alert(1)",
      "/identity.html",
    ]) {
      expect(safeWorkbenchReturn(value, "https://example.com")).toBe(
        "/workbench/",
      );
    }
  });
});
