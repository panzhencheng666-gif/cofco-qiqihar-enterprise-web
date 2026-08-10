import { expect, queryE2eDatabase, test } from "./fixtures";

const sourceOrganization = "E2E-PHASE3-物流调查与填报时间";

test("filters a real logistics draft by survey period, created filling date and status", async ({
  page,
  request,
}) => {
  await page.goto("/#/市场监测/大豆物流监测");
  await expect(
    page.getByRole("table", { name: "粮食物流节点监测表" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "新建监测记录" }).click();
  const dialog = page.getByRole("dialog", { name: "新建物流监测填报" });
  const form = dialog.getByRole("region", { name: "物流监测填报" });
  await form.getByLabel("物流监测期").selectOption("2026-W32");
  await form.getByLabel("物流采集日期").fill("2026-08-09");
  await form.getByLabel("物流起运节点").selectOption("E2E_QQ_RAIL");
  await form.getByLabel("物流到达节点").selectOption("E2E_QQ_ROAD");
  await form.getByLabel("物流运输方式").selectOption("RAIL");
  await form.getByLabel("物流流向类型").selectOption("INFLOW");
  await form.getByLabel("物流运量").fill("25");
  await form.getByLabel("物流运价").fill("80");
  await form.getByLabel("物流在途时间").fill("4");
  await form.getByLabel("物流来源单位").fill(sourceOrganization);
  await form.getByRole("button", { name: "保存物流记录" }).click();
  await expect(dialog).toHaveCount(0);

  const unfilteredResponse = await request.get(
    "/api/v1/logistics-records?productCode=SOYBEAN&pageNumber=0&pageSize=100",
  );
  expect(unfilteredResponse.ok()).toBe(true);
  const unfiltered = (await unfilteredResponse.json()) as {
    data: {
      items: Array<{ id: string; values: Record<string, string> }>;
    };
  };
  const recordId =
    unfiltered.data.items.find(
      ({ values }) => values.LOG_SOURCE_ORGANIZATION === sourceOrganization,
    )?.id ?? "";
  expect(recordId).not.toBe("");

  queryE2eDatabase(
    `UPDATE logistics.route_event SET reported_at=TIMESTAMPTZ '2030-01-01 12:00:00+08' WHERE event_id='${recordId}'`,
  );
  const fillingDate = queryE2eDatabase(
    `SELECT to_char(created_at AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD') FROM logistics.route_event WHERE event_id='${recordId}'`,
  );

  await page.getByRole("combobox", { name: "调查月份" }).selectOption("8");
  await page.getByLabel("填报日期起").fill(fillingDate);
  await page.getByLabel("填报日期止").fill(fillingDate);
  await page.getByRole("combobox", { name: "填报状态" }).selectOption("DRAFT");

  const recordRow = page
    .getByRole("table", { name: "粮食物流节点监测表" })
    .getByRole("row")
    .filter({ hasText: sourceOrganization });
  await expect(recordRow).toHaveCount(1);
  await expect(recordRow).toContainText("2026年8月");
  await expect(recordRow).toContainText("草稿创建");
  await expect(page.getByRole("combobox", { name: "监测期" })).toHaveCount(0);

  const filteredResponse = await request.get(
    `/api/v1/logistics-records?productCode=SOYBEAN&pageNumber=0&pageSize=100&filter.surveyYear=2026&filter.surveyMonth=8&filter.fillingDateFrom=${fillingDate}&filter.fillingDateTo=${fillingDate}&filter.status=DRAFT`,
  );
  expect(filteredResponse.ok()).toBe(true);
  const filtered = (await filteredResponse.json()) as {
    data: {
      items: Array<{
        id: string;
        status: string;
        values: Record<string, string>;
      }>;
    };
  };
  expect(filtered.data.items).toContainEqual(
    expect.objectContaining({
      id: recordId,
      status: "DRAFT",
      values: expect.objectContaining({
        LOG_SURVEY_YEAR: "2026",
        LOG_SURVEY_MONTH: "8",
        LOG_SURVEY_PERIOD_PRECISION: "YEAR_MONTH",
        LOG_FILLING_TIME_BASIS: "DRAFT_CREATED_AT",
      }),
    }),
  );
  expect(
    queryE2eDatabase(
      `SELECT to_char(reported_at AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD') || '|' ||
              COALESCE(to_char(submitted_at AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD'),'NO_SUBMISSION')
       FROM logistics.route_event WHERE event_id='${recordId}'`,
    ),
  ).toBe("2030-01-01|NO_SUBMISSION");
});
