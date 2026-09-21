import { describe, expect, it } from "vitest";
import {
  applicationCatalog,
  availableApps,
} from "../../portal/applicationCatalog";

describe("portal application center", () => {
  it("lists the independent risk system beside the existing workbench", () => {
    expect(applicationCatalog.map((app) => app.id)).toEqual([
      "grain-workbench",
      "risk-warning",
    ]);
    expect(availableApps()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "risk-warning",
          name: "风险研判预警",
          href: "/risk/",
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
