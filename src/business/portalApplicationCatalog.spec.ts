import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  applicationCatalog,
  availableApps,
} from "../../portal/applicationCatalog";

describe("portal application center", () => {
  it("loads portal assets from the production portal directory", () => {
    const html = readFileSync("portal/index.html", "utf8");

    expect(html).toContain(
      'href="/enterprise-portal/depth-7/portal.css?v=selected-depth-7"',
    );
    expect(html).toContain(
      'src="/enterprise-portal/depth-7/portal.js?v=risk-center-1"',
    );
  });

  it("lists the market screen beside the existing applications", () => {
    expect(applicationCatalog.map((app) => app.id)).toEqual([
      "grain-workbench",
      "risk-warning",
      "market-intelligence",
    ]);
    expect(availableApps()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "risk-warning",
          name: "风险研判预警",
          href: "/risk/",
          published: true,
        }),
        expect.objectContaining({
          id: "market-intelligence",
          name: "全球商情监测",
          href: "/overview-monitoring/#/market-intelligence",
          published: true,
        }),
      ]),
    );
  });

  it("keeps the current business workbench address unchanged", () => {
    expect(applicationCatalog[0]).toMatchObject({
      id: "grain-workbench",
      href: "/workbench/",
    });
  });
});
