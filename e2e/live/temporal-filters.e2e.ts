import { expect, test } from "./fixtures";

const sourceOrganization = "E2E-PHASE3-物流调查与填报时间";
const sampleLatitude = "47.35";
const sampleLongitude = "123.25";

test("filters a real logistics draft by one business region and survey period", async ({
  page,
  request,
}) => {
  await page.goto("/#/市场监测/大豆物流监测");
  await expect(
    page.getByRole("table", { name: "粮食物流监测表" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "新建监测记录" }).click();
  const dialog = page.getByRole("dialog", { name: "新建物流监测填报" });
  const form = dialog.getByRole("region", { name: "物流监测填报" });
  await form.getByLabel("数据年份").fill("2026");
  await form.getByLabel("数据月份").fill("8");
  await form.getByLabel("物流样本点名称").fill(sourceOrganization);
  await form
    .getByRole("combobox", { name: "地区", exact: true })
    .selectOption("230208");
  await form.getByLabel("物流样本点联系方式").fill("13900000013");
  await form.getByLabel("纬度").fill(sampleLatitude);
  await form.getByLabel("经度").fill(sampleLongitude);
  await form.getByLabel("运输方式").selectOption("RAIL");
  await form.getByLabel("运输方向").selectOption("INFLOW");
  await form.getByLabel("运输数量").fill("25");
  await form.getByLabel("物流运价（不含车板价）").fill("80");
  await form.getByLabel("车板价", { exact: true }).fill("2600");
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
      ({ values }) => values.LOG_SAMPLE_NAME === sourceOrganization,
    )?.id ?? "";
  expect(recordId).not.toBe("");

  const businessRegion = page.getByRole("combobox", {
    name: "业务地区",
  });
  const surveyYear = page.getByRole("combobox", { name: "调查年份" });
  const surveyMonth = page.getByRole("combobox", { name: "调查月份" });
  await expect(businessRegion).toHaveCount(1);
  await expect(surveyYear).toHaveCount(1);
  await expect(surveyMonth).toHaveCount(1);
  await businessRegion.selectOption("230208");
  await surveyYear.selectOption("2026");
  await surveyMonth.selectOption("8");

  await expect(page.getByLabel("填报日期起")).toHaveCount(0);
  await expect(page.getByLabel("填报日期止")).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "监测期" })).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "填报状态" }).getByRole("option", {
      name: "填写中",
    }),
  ).toHaveCount(0);

  const filteredResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname.endsWith("/api/v1/logistics-records") &&
      response.request().method() === "GET" &&
      url.searchParams.get("filter.regionCode") === "230208" &&
      url.searchParams.get("filter.surveyYear") === "2026" &&
      url.searchParams.get("filter.surveyMonth") === "8" &&
      !url.searchParams.has("filter.fillingDateFrom") &&
      !url.searchParams.has("filter.fillingDateTo")
    );
  });
  await page.getByRole("button", { name: "查询" }).click();
  const filteredUiResponse = await filteredResponsePromise;
  expect(filteredUiResponse.ok()).toBe(true);

  const recordRow = page
    .getByRole("table", { name: "粮食物流监测表" })
    .getByRole("row")
    .filter({ hasText: sourceOrganization });
  await expect(recordRow).toHaveCount(1);
  await expect(recordRow).toContainText("2026年8月");
  await expect(recordRow).toContainText("填写中");

  const filteredResponse = await request.get(
    "/api/v1/logistics-records?productCode=SOYBEAN&pageNumber=0&pageSize=100&filter.regionCode=230208&filter.surveyYear=2026&filter.surveyMonth=8",
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
  const filteredRecord = filtered.data.items.find(({ id }) => id === recordId);
  expect(filteredRecord).toMatchObject({
    id: recordId,
    status: "DRAFT",
    values: {
      LOG_REGION: "230208",
      surveyYear: "2026",
      surveyMonth: "8",
    },
  });
  expect(filteredRecord?.values).not.toHaveProperty("LOG_SURVEY_YEAR");
  expect(filteredRecord?.values).not.toHaveProperty("LOG_SURVEY_MONTH");
  expect(filteredRecord?.values).not.toHaveProperty("LOG_FILLING_TIME_BASIS");
});
