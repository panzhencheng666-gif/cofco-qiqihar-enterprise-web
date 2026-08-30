import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("formal enterprise responsive shell", () => {
  it("applies the mobile shell fallback after the desktop reference workbench rules", () => {
    const css = readFileSync("src/business/formal-enterprise.css", "utf8");
    const desktopWorkbench = css.indexOf(
      "/* reference-workbench-shell:start */",
    );
    const mobileFallback = css.indexOf(
      "/* enterprise-mobile-shell-cascade:start */",
    );

    expect(desktopWorkbench).toBeGreaterThan(-1);
    expect(mobileFallback).toBeGreaterThan(desktopWorkbench);
    const effectiveMobileRules = css.slice(
      mobileFallback,
      css.indexOf("/* enterprise-mobile-shell-cascade:end */"),
    );
    expect(effectiveMobileRules).toMatch(
      /\.formal-enterprise\s*\{[^}]*min-width:\s*0/s,
    );
    expect(effectiveMobileRules).toMatch(
      /\.formal-enterprise-shell,[\s\S]*?display:\s*grid/s,
    );
    expect(effectiveMobileRules).toMatch(
      /\.formal-sidebar\s*\{[^}]*display:\s*none/s,
    );
  });
});
