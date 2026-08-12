import { writeFile } from "node:fs/promises";
import { expect, test } from "./fixtures";
import {
  evidenceForControl,
  stageThreeRoutes,
  type VisibleActionRow,
} from "./stage-three-contract";

type BrowserControl = {
  controlName: string;
  controlType: string;
  enabled: boolean;
  outerHtml: string;
};

test("maps every visible runtime action on all formal routes to current evidence", async ({
  page,
}, testInfo) => {
  const rows: VisibleActionRow[] = [];
  const unmatched: Array<BrowserControl & { route: string }> = [];

  for (const [route, expectedContent] of stageThreeRoutes) {
    await test.step(route, async () => {
      await page.goto(route);
      const main = page.locator("main").first();
      await expect(main).toBeVisible();
      await expect(main).toContainText(expectedContent, { timeout: 10_000 });

      const controls = await page
        .locator(
          "a:visible, button:visible, input:visible, select:visible, textarea:visible",
        )
        .evaluateAll((elements): BrowserControl[] =>
          elements.map((element) => {
            const input = element as HTMLInputElement;
            const labels =
              "labels" in input
                ? Array.from(input.labels ?? [])
                    .map((label) => label.textContent?.trim() ?? "")
                    .filter(Boolean)
                    .join(" ")
                : "";
            const controlName =
              element.getAttribute("aria-label")?.trim() ||
              element.getAttribute("title")?.trim() ||
              labels ||
              element.textContent?.trim() ||
              input.placeholder?.trim() ||
              input.value?.trim() ||
              "";
            return {
              controlName: controlName.replace(/\s+/gu, " "),
              controlType: element.tagName.toLowerCase(),
              enabled:
                !("disabled" in input) ||
                (!input.disabled &&
                  element.getAttribute("aria-disabled") !== "true"),
              outerHtml: element.outerHTML.slice(0, 500),
            };
          }),
        );

      for (const control of controls) {
        const evidence = evidenceForControl(
          control.controlType,
          control.controlName,
        );
        if (!control.controlName || !evidence) {
          unmatched.push({ ...control, route });
          continue;
        }
        rows.push({
          route,
          role: "LOCAL_BUSINESS_OPERATOR",
          controlName: control.controlName,
          controlType: control.controlType,
          enabled: control.enabled,
          evidenceScenario: evidence,
          status: "PASS",
        });
      }

      for (const reset of await main
        .getByRole("button", { name: /重置|清空/u })
        .all()) {
        if (await reset.isEnabled()) await reset.click();
      }
      for (const query of await main
        .getByRole("button", { name: /^查询$/u })
        .all()) {
        if (await query.isEnabled()) await query.click();
      }
    });
  }

  expect(unmatched, JSON.stringify(unmatched, null, 2)).toEqual([]);
  expect(rows.length).toBeGreaterThan(100);
  expect(new Set(rows.map(({ route }) => route)).size).toBe(
    stageThreeRoutes.length,
  );

  const outputPath = testInfo.outputPath("VISIBLE-ACTIONS.json");
  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        namespace: "S3C-20260812-",
        routeCount: stageThreeRoutes.length,
        rowCount: rows.length,
        rows,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await testInfo.attach("VISIBLE-ACTIONS.json", {
    path: outputPath,
    contentType: "application/json",
  });
});
