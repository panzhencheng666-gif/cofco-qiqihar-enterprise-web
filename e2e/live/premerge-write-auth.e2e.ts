import type {
  APIRequestContext,
  APIResponse,
  BrowserContext,
  Page,
  Request,
  Response,
} from "@playwright/test";

import {
  expect,
  liveBrowserAccounts,
  queryE2eDatabase,
  stageThreeBrowserEndpoints,
  test,
  trackBrowserErrors,
} from "./fixtures";

const formalSampleName = "E2E_合并前正式样本_齐齐哈尔";

test.describe.configure({ mode: "serial" });

interface BrowserHttpResult {
  status: number;
  body: unknown;
}

interface ApiEnvelope<T> {
  data: T;
}

interface FormalObservationCommand {
  domain: "PRODUCTION" | "MARKET" | "LOGISTICS";
  samplePointId: string;
  productCode: string;
  observedAt: string;
  payload: Record<string, unknown>;
}

interface FormalObservationResult {
  observationId: string;
  samplePointId: string;
  domain: FormalObservationCommand["domain"];
  productCode: string;
  observedAt: string;
  officialSavedAt: string;
  projectionVersion: string;
  synchronizedModules: string[];
  values: Record<string, string>;
}

interface FormalObservationHistoryPage {
  items: Array<{
    observationId: string;
    observedAt: string;
    officialSavedAt: string;
    actorDisplayName: string;
    projectionVersion: string;
    synchronizedModules: string[];
    values: Record<string, string>;
    latest: boolean;
  }>;
  totalElements: number;
  pageNumber: number;
  pageSize: number;
}

interface CapturedRequest {
  url: string;
  idempotencyKey: string;
  body: FormalObservationCommand;
}

interface RegionalAnnualStat {
  regionCode: string;
  regionName: string;
  prefectureCode: string;
  dataYear: number;
  productCode: string;
  plantedAreaMu: string | null;
  yieldPerMuKg: string | null;
  totalOutputKg: string | null;
  version: number;
  updatedAt: string | null;
}

interface RegionalSummary {
  regionCode: string;
  regionName: string;
  administrativeLevel: string;
  year: number;
  productCode: string;
  plantedAreaMu: string | null;
  yieldPerMuKg: string | null;
  totalOutputKg: string | null;
}

interface SupplyBalanceRow {
  code: string;
  label: string;
  kind: string;
  unit: string;
  value: string | null;
  display: string | null;
  note: string | null;
}

interface SupplyBalanceView {
  regionCode: string;
  regionName: string;
  administrativeLevel: string;
  surveyYear: number;
  productCode: string;
  regionalProductionAvailable: boolean;
  version: number;
  updatedAt: string | null;
  rows: SupplyBalanceRow[];
}

interface SupplyBalanceHistoryEntry {
  sourceVersion: number;
  manualValues: Record<string, number>;
  notes: Record<string, string>;
  replacedBy: string;
  replacedAt: string;
}

async function responseJson<T>(response: APIResponse | Response): Promise<T> {
  return (await response.json()) as T;
}

async function responseData<T>(response: APIResponse | Response): Promise<T> {
  const envelope = await responseJson<ApiEnvelope<T>>(response);
  return envelope.data;
}

async function browserResponseData<T>(response: Response): Promise<T> {
  const envelope = (await response.json()) as ApiEnvelope<T>;
  return envelope.data;
}

function integerQuery(sql: string): number {
  return Number(queryE2eDatabase(sql));
}

function requestBody(request: Request): FormalObservationCommand {
  return jsonRequestBody<FormalObservationCommand>(request);
}

function jsonRequestBody<T>(request: Request): T {
  const raw = request.postData();
  if (!raw) throw new Error(`Expected JSON request body for ${request.url()}`);
  return JSON.parse(raw) as T;
}

function supplyRow(view: SupplyBalanceView, code: string): SupplyBalanceRow {
  const row = view.rows.find((candidate) => candidate.code === code);
  if (!row) throw new Error(`Supply balance response omitted ${code}`);
  return row;
}

async function regionalStats(
  request: APIRequestContext,
  year: number,
  productCode: string,
): Promise<RegionalAnnualStat[]> {
  const response = await request.get(
    "/api/v1/production/regional-annual-stats",
    { params: { year, productCode, prefectureCode: "230200" } },
  );
  expect(response.ok()).toBe(true);
  return responseData<RegionalAnnualStat[]>(response);
}

async function regionalSummary(
  request: APIRequestContext,
  year: number,
  productCode: string,
): Promise<RegionalSummary> {
  const response = await request.get("/api/v1/overview/regional-crop-summary", {
    params: { year, productCode, regionCode: "230200" },
  });
  expect(response.ok()).toBe(true);
  return responseData<RegionalSummary>(response);
}

async function supplyBalance(
  request: APIRequestContext,
  year: number,
  productCode: string,
): Promise<SupplyBalanceView> {
  const response = await request.get("/api/v1/supply-balances", {
    params: { regionCode: "230208", surveyYear: year, productCode },
  });
  expect(response.ok()).toBe(true);
  return responseData<SupplyBalanceView>(response);
}

async function supplyHistory(
  request: APIRequestContext,
  year: number,
  productCode: string,
): Promise<SupplyBalanceHistoryEntry[]> {
  const response = await request.get(
    `/api/v1/supply-balances/230208/${year}/${productCode}/history`,
  );
  expect(response.ok()).toBe(true);
  return responseData<SupplyBalanceHistoryEntry[]>(response);
}

async function openFormalSampleEditor(
  context: BrowserContext,
  route: string,
): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`${liveBrowserAccounts.operatorOne.url}/#/${route}`);
  await page.getByRole("tab", { name: "已有样本数据更新" }).click();
  await expect(
    page.getByRole("region", { name: "已有样本数据更新工作台" }),
  ).toBeVisible();
  await page.getByLabel("搜索样本企业").fill(formalSampleName);
  await page.getByRole("button", { name: "查询正式样本" }).click();
  await page
    .getByRole("button", { name: new RegExp(formalSampleName, "u") })
    .click();
  await expect(
    page.getByRole("group", { name: "正式样本锁定信息" }),
  ).toContainText(formalSampleName);
  return page;
}

async function formalHistory(
  request: APIRequestContext,
  domain: FormalObservationCommand["domain"],
): Promise<FormalObservationHistoryPage> {
  const response = await request.get(
    "/api/v1/formal-sample-observations/observations",
    {
      params: {
        domain,
        samplePointId: "e2e00000-0000-0000-0000-000000000001",
        productCode: "CORN",
        year: "2026",
      },
    },
  );
  expect(response.ok()).toBe(true);
  return responseData<FormalObservationHistoryPage>(response);
}

async function captureFormalSave(
  page: Page,
): Promise<{ request: CapturedRequest; result: FormalObservationResult }> {
  const requestPromise = page.waitForRequest(
    (candidate) =>
      candidate.method() === "POST" &&
      new URL(candidate.url()).pathname ===
        "/api/v1/formal-sample-observations/observations",
  );
  const responsePromise = page.waitForResponse(
    (candidate) =>
      candidate.request().method() === "POST" &&
      new URL(candidate.url()).pathname ===
        "/api/v1/formal-sample-observations/observations",
  );
  await page.getByRole("button", { name: "保存并正式入库" }).click();
  const [captured, response] = await Promise.all([
    requestPromise,
    responsePromise,
  ]);
  expect(response.status()).toBe(201);
  const idempotencyKey = captured.headers()["idempotency-key"];
  if (!idempotencyKey) throw new Error("UI save omitted Idempotency-Key");
  return {
    request: {
      url: captured.url(),
      idempotencyKey,
      body: requestBody(captured),
    },
    result: await responseData<FormalObservationResult>(response),
  };
}

async function replayFormalSave(
  page: Page,
  captured: CapturedRequest,
  body: FormalObservationCommand = captured.body,
): Promise<BrowserHttpResult> {
  return browserFetch(page, "/api/v1/formal-sample-observations/observations", {
    method: "POST",
    headers: { "Idempotency-Key": captured.idempotencyKey },
    body,
  });
}

async function browserFetch(
  page: Page,
  path: string,
  init: { method: "POST" | "PUT"; body: unknown; headers?: object },
): Promise<BrowserHttpResult> {
  const response = await page
    .context()
    .request.fetch(new URL(path, page.url()).toString(), {
      method: init.method,
      headers: {
        "Content-Type": "application/json",
        ...init.headers,
      },
      data: init.body,
    });
  return { status: response.status(), body: await response.json() };
}

function errorCode(result: BrowserHttpResult): string | undefined {
  return (result.body as { error?: { code?: string } } | null | undefined)
    ?.error?.code;
}

test("loads the isolated premerge formal-sample fixture", async ({
  request,
}) => {
  const response = await request.get(
    "/api/v1/formal-sample-observations/eligible-samples",
    {
      params: {
        domain: "PRODUCTION",
        productCode: "CORN",
        year: "2026",
        observedAt: new Date().toISOString(),
      },
    },
  );

  expect(response.ok()).toBe(true);
  const body = (await response.json()) as {
    data: Array<{ sampleName: string }>;
  };
  expect(body.data.map(({ sampleName }) => sampleName)).toContain(
    formalSampleName,
  );

  const regionalResponse = await request.get(
    "/api/v1/production/regional-annual-stats",
    {
      params: {
        year: "2026",
        productCode: "CORN",
        prefectureCode: "230200",
      },
    },
  );
  expect(regionalResponse.ok()).toBe(true);
  const regional = (await regionalResponse.json()) as {
    data: Array<{
      regionCode: string;
      plantedAreaMu: string | null;
      yieldPerMuKg: string | null;
      version: number;
    }>;
  };
  expect(
    regional.data.find(({ regionCode }) => regionCode === "230208"),
  ).toMatchObject({
    plantedAreaMu: "80000.0000",
    yieldPerMuKg: "500.0000",
    version: 0,
  });

  const supplyResponse = await request.get("/api/v1/supply-balances", {
    params: {
      regionCode: "230208",
      surveyYear: "2026",
      productCode: "CORN",
    },
  });
  expect(supplyResponse.ok()).toBe(true);
  const supply = (await supplyResponse.json()) as {
    data: {
      version: number;
      rows: Array<{ code: string; value: string | null }>;
    };
  };
  expect(supply.data.version).toBe(0);
  expect(
    supply.data.rows.find(({ code }) => code === "OPENING_INVENTORY")?.value,
  ).toBe("10");
});

test("denies reporter and cross-region writes without changing persisted state", async ({
  browser,
  request,
}) => {
  const reporterContext = await browser.newContext();
  const reporterPage = await reporterContext.newPage();
  const regionalUrl = "/api/v1/production/regional-annual-stats/230208";
  const regionalBody = {
    dataYear: 2026,
    productCode: "SOYBEAN",
    plantedAreaMu: "71000",
    yieldPerMuKg: "460",
    expectedVersion: 0,
  };
  const supplyUrl = "/api/v1/supply-balances/230208/2026/SOYBEAN";
  const supplyBody = {
    version: 0,
    manualValues: {
      OPENING_INVENTORY: "21",
      IMPORTS: "1",
      INFLOW: "2",
      FOOD_USE: "3",
      CRUSH_USE: "4",
      PROTEIN_PROCESSING: "5",
      POLICY_RESERVE: "6",
      RAIL_OUTFLOW: "7",
      ROAD_OUTFLOW: "8",
    },
    notes: { OPENING_INVENTORY: "E2E_拒绝请求不得保存" },
  };
  const formalBody = {
    domain: "PRODUCTION",
    samplePointId: "e2e00000-0000-0000-0000-000000000001",
    productCode: "CORN",
    observedAt: new Date().toISOString(),
    payload: {
      productCode: "CORN",
      objectTypeCode: "FARMER",
      regionCode: "230208",
      surveyDate: "2026-08-29",
      surveyYear: 2026,
      surveyMonth: 8,
      cultivatedAreaMu: "101",
      yieldPerMuKilograms: "501",
      quality: {},
      costs: {},
      insurance: {},
      subsidies: {},
      submissionMetadata: {},
      evidencePhotoIds: [],
    },
  };

  const regionalBeforeResponse = await request.get(
    "/api/v1/production/regional-annual-stats",
    {
      params: {
        year: "2026",
        productCode: "SOYBEAN",
        prefectureCode: "230200",
      },
    },
  );
  const regionalBefore = await responseJson<unknown>(regionalBeforeResponse);
  const supplyBeforeResponse = await request.get("/api/v1/supply-balances", {
    params: {
      regionCode: "230208",
      surveyYear: "2026",
      productCode: "SOYBEAN",
    },
  });
  const supplyBefore = await responseJson<unknown>(supplyBeforeResponse);
  const formalBeforeResponse = await request.get(
    "/api/v1/formal-sample-observations/observations",
    {
      params: {
        domain: "PRODUCTION",
        samplePointId: "e2e00000-0000-0000-0000-000000000001",
        productCode: "CORN",
        year: "2026",
      },
    },
  );
  const formalBefore = await responseJson<unknown>(formalBeforeResponse);
  const databaseCountsBefore = queryE2eDatabase(`
    SELECT concat_ws('|',
      (SELECT count(*) FROM production.regional_crop_annual_stat_history
       WHERE region_code='230208' AND data_year=2026 AND product_code='SOYBEAN'),
      (SELECT count(*) FROM production.supply_demand_balance_history
       WHERE region_code='230208' AND survey_year=2026 AND product_code='SOYBEAN'),
      (SELECT count(*) FROM platform.formal_sample_observation
       WHERE sample_point_id='e2e00000-0000-0000-0000-000000000001'))
  `);

  await reporterPage.goto(
    `${liveBrowserAccounts.reporter.url}/#/产情监测/地区产情填报`,
  );
  await expect(
    reporterPage.getByRole("heading", { name: "地区产情填报" }),
  ).toBeVisible();
  const reporterRegionalResponse = reporterPage.waitForResponse(
    (candidate) =>
      candidate.request().method() === "PUT" &&
      new URL(candidate.url()).pathname === regionalUrl,
  );
  await reporterPage
    .getByRole("button", { name: "保存梅里斯达斡尔族区" })
    .click();
  const reporterRegional = await reporterRegionalResponse;
  expect(reporterRegional.status()).toBe(403);
  expect(
    errorCode({
      status: reporterRegional.status(),
      body: await responseJson<unknown>(reporterRegional),
    }),
  ).toBe("ACCESS_PERMISSION_DENIED");
  await expect(reporterPage.getByRole("alert")).toContainText("保存失败");

  await reporterPage.goto(
    `${liveBrowserAccounts.reporter.url}/#/供需分析/供需平衡`,
  );
  await expect(
    reporterPage.getByRole("heading", { name: "供需平衡" }),
  ).toBeVisible();
  await reporterPage.getByLabel("供需地区").selectOption("230208");
  await reporterPage.getByLabel("供需品种").selectOption("SOYBEAN");
  await expect(reporterPage.getByLabel("期初库存填报值")).toHaveValue("20");

  const reporterSupply = await browserFetch(reporterPage, supplyUrl, {
    method: "PUT",
    body: supplyBody,
  });
  expect(reporterSupply.status).toBe(403);
  expect(errorCode(reporterSupply)).toBe("ACCESS_PERMISSION_DENIED");

  await reporterPage.goto(
    `${liveBrowserAccounts.reporter.url}/#/产情监测/玉米产情填报`,
  );
  await reporterPage.getByRole("tab", { name: "已有样本数据更新" }).click();
  await expect(
    reporterPage.getByRole("region", { name: "已有样本数据更新工作台" }),
  ).toBeVisible();
  await expect(
    reporterPage.getByRole("button", { name: "保存并正式入库" }),
  ).toHaveCount(0);

  const reporterFormal = await browserFetch(
    reporterPage,
    "/api/v1/formal-sample-observations/observations",
    {
      method: "POST",
      headers: { "Idempotency-Key": "E2E_reporter-denied-20260829" },
      body: formalBody,
    },
  );
  expect(reporterFormal.status).toBe(403);
  expect(errorCode(reporterFormal)).toBe("ACCESS_PERMISSION_DENIED");

  const outsideContext = await browser.newContext();
  const outsidePage = await outsideContext.newPage();
  const outsideErrors = trackBrowserErrors(outsidePage);
  await outsidePage.goto(`${stageThreeBrowserEndpoints.outsideOperator.url}/`);

  const outsideRegional = await browserFetch(outsidePage, regionalUrl, {
    method: "PUT",
    body: regionalBody,
  });
  expect(outsideRegional.status).toBe(403);
  expect(errorCode(outsideRegional)).toBe("ACCESS_REGION_DENIED");

  const outsideSupply = await browserFetch(outsidePage, supplyUrl, {
    method: "PUT",
    body: supplyBody,
  });
  expect(outsideSupply.status).toBe(403);
  expect(errorCode(outsideSupply)).toBe("ACCESS_REGION_DENIED");

  const outsideFormal = await browserFetch(
    outsidePage,
    "/api/v1/formal-sample-observations/observations",
    {
      method: "POST",
      headers: { "Idempotency-Key": "E2E_outside-denied-20260829" },
      body: formalBody,
    },
  );
  expect(outsideFormal.status).toBe(404);
  expect(errorCode(outsideFormal)).toBe("FORMAL_SAMPLE_NOT_AVAILABLE");
  outsideErrors.assertClean();
  await outsideContext.close();

  const regionalAfter = await responseJson<unknown>(
    await request.get("/api/v1/production/regional-annual-stats", {
      params: {
        year: "2026",
        productCode: "SOYBEAN",
        prefectureCode: "230200",
      },
    }),
  );
  const supplyAfter = await responseJson<unknown>(
    await request.get("/api/v1/supply-balances", {
      params: {
        regionCode: "230208",
        surveyYear: "2026",
        productCode: "SOYBEAN",
      },
    }),
  );
  const formalAfter = await responseJson<unknown>(
    await request.get("/api/v1/formal-sample-observations/observations", {
      params: {
        domain: "PRODUCTION",
        samplePointId: "e2e00000-0000-0000-0000-000000000001",
        productCode: "CORN",
        year: "2026",
      },
    }),
  );
  expect(regionalAfter).toEqual(regionalBefore);
  expect(supplyAfter).toEqual(supplyBefore);
  expect(formalAfter).toEqual(formalBefore);
  expect(
    queryE2eDatabase(`
      SELECT concat_ws('|',
        (SELECT count(*) FROM production.regional_crop_annual_stat_history
         WHERE region_code='230208' AND data_year=2026 AND product_code='SOYBEAN'),
        (SELECT count(*) FROM production.supply_demand_balance_history
         WHERE region_code='230208' AND survey_year=2026 AND product_code='SOYBEAN'),
        (SELECT count(*) FROM platform.formal_sample_observation
         WHERE sample_point_id='e2e00000-0000-0000-0000-000000000001'))
    `),
  ).toBe(databaseCountsBefore);

  await reporterPage.goto(
    `${liveBrowserAccounts.reporter.url}/#/供需分析/供需平衡`,
  );
  await reporterPage.getByLabel("供需地区").selectOption("230208");
  await reporterPage.getByLabel("供需品种").selectOption("SOYBEAN");
  await expect(reporterPage.getByLabel("期初库存填报值")).toHaveValue("20");
  await expect(
    reporterPage.getByRole("button", { name: "保存供需平衡" }),
  ).toBeDisabled();
  await reporterContext.close();
});

test("saves and requeries production, market, and logistics formal observations idempotently", async ({
  browser,
  request,
}) => {
  const cases: Array<{
    domain: FormalObservationCommand["domain"];
    route: string;
    fieldCode: string;
    inputValue: string;
    additionalInputs?: Record<string, string>;
    persistedValue: RegExp;
    synchronizedModules: string[];
  }> = [
    {
      domain: "PRODUCTION",
      route: "产情监测/玉米产情填报",
      fieldCode: "cultivatedAreaMu",
      inputValue: "111.25",
      persistedValue: /^111\.25(?:0+)?$/u,
      synchronizedModules: ["OVERVIEW", "PRODUCTION_ANALYSIS", "REPORTS"],
    },
    {
      domain: "MARKET",
      route: "市场监测/玉米市场采集",
      fieldCode: "MKT_PURCHASE_BASE_PRICE",
      inputValue: "2311",
      persistedValue: /^2311(?:\.0+)?$/u,
      synchronizedModules: ["OVERVIEW", "MARKET_ANALYSIS", "REPORTS"],
    },
    {
      domain: "LOGISTICS",
      route: "市场监测/玉米物流监测",
      fieldCode: "LOG_ROUTE_VOLUME",
      inputValue: "13.5",
      additionalInputs: {
        LOG_FREIGHT_RATE: "81.25",
        LOG_BOARD_PRICE: "2650",
      },
      persistedValue: /^13\.5(?:0+)?$/u,
      synchronizedModules: ["OVERVIEW", "LOGISTICS_ANALYSIS", "REPORTS"],
    },
  ];
  test.setTimeout(90_000);

  for (const scenario of cases) {
    const historyBefore = await formalHistory(request, scenario.domain);
    const receiptsBefore = integerQuery(`
      SELECT count(*) FROM platform.formal_sample_observation
      WHERE sample_point_id='e2e00000-0000-0000-0000-000000000001'
        AND source_domain='${scenario.domain}' AND product_code='CORN'
    `);
    const auditsBefore = integerQuery(`
      SELECT count(*) FROM platform.business_audit_event
      WHERE aggregate_type='FORMAL_SAMPLE_OBSERVATION'
        AND action_code='FORMAL_SAMPLE_OBSERVATION_SAVED'
        AND actor_subject_id='e2e-operator-one'
    `);

    const context = await browser.newContext();
    const page = await openFormalSampleEditor(context, scenario.route);
    const errors = trackBrowserErrors(page);
    const field = page.locator(`[data-field-code="${scenario.fieldCode}"]`);
    await expect(field).toBeVisible();
    await field.fill(scenario.inputValue);
    for (const [fieldCode, value] of Object.entries(
      scenario.additionalInputs ?? {},
    )) {
      await page.locator(`[data-field-code="${fieldCode}"]`).fill(value);
    }
    const saved = await captureFormalSave(page);
    expect(saved.request.url).toContain(
      "http://127.0.0.1:63184/api/v1/formal-sample-observations/observations",
    );
    expect(saved.request.body).toMatchObject({
      domain: scenario.domain,
      samplePointId: "e2e00000-0000-0000-0000-000000000001",
      productCode: "CORN",
    });
    expect(saved.result).toMatchObject({
      domain: scenario.domain,
      samplePointId: "e2e00000-0000-0000-0000-000000000001",
      productCode: "CORN",
      synchronizedModules: scenario.synchronizedModules,
    });
    expect(saved.result.observationId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(saved.result.observedAt).toBeTruthy();
    expect(saved.result.officialSavedAt).toBeTruthy();
    expect(saved.result.values[scenario.fieldCode]).toMatch(
      scenario.persistedValue,
    );
    await expect(page.getByRole("status")).toContainText("已正式入库");

    const historyAfterSave = await formalHistory(request, scenario.domain);
    expect(historyAfterSave.totalElements).toBe(
      historyBefore.totalElements + 1,
    );
    expect(historyAfterSave.items[0]).toMatchObject({
      observationId: saved.result.observationId,
      actorDisplayName: liveBrowserAccounts.operatorOne.name,
      latest: true,
      synchronizedModules: scenario.synchronizedModules,
    });
    expect(historyAfterSave.items[0]?.values[scenario.fieldCode]).toMatch(
      scenario.persistedValue,
    );
    expect(receiptsBefore + 1).toBe(
      integerQuery(`
        SELECT count(*) FROM platform.formal_sample_observation
        WHERE sample_point_id='e2e00000-0000-0000-0000-000000000001'
          AND source_domain='${scenario.domain}' AND product_code='CORN'
      `),
    );
    expect(auditsBefore + 1).toBe(
      integerQuery(`
        SELECT count(*) FROM platform.business_audit_event
        WHERE aggregate_type='FORMAL_SAMPLE_OBSERVATION'
          AND action_code='FORMAL_SAMPLE_OBSERVATION_SAVED'
          AND actor_subject_id='e2e-operator-one'
      `),
    );

    const replay = await replayFormalSave(page, saved.request);
    expect(replay.status).toBe(201);
    expect(replay.body).toEqual({ data: saved.result });
    const conflict = await replayFormalSave(page, saved.request, {
      ...saved.request.body,
      payload: {
        ...saved.request.body.payload,
        E2E_CONFLICT_PROBE: scenario.domain,
      },
    });
    expect(conflict.status).toBe(409);
    expect(errorCode(conflict)).toBe(
      "FORMAL_SAMPLE_OBSERVATION_IDEMPOTENCY_CONFLICT",
    );

    const historyAfterReplay = await formalHistory(request, scenario.domain);
    expect(historyAfterReplay).toEqual(historyAfterSave);
    expect(receiptsBefore + 1).toBe(
      integerQuery(`
        SELECT count(*) FROM platform.formal_sample_observation
        WHERE sample_point_id='e2e00000-0000-0000-0000-000000000001'
          AND source_domain='${scenario.domain}' AND product_code='CORN'
      `),
    );
    expect(auditsBefore + 1).toBe(
      integerQuery(`
        SELECT count(*) FROM platform.business_audit_event
        WHERE aggregate_type='FORMAL_SAMPLE_OBSERVATION'
          AND action_code='FORMAL_SAMPLE_OBSERVATION_SAVED'
          AND actor_subject_id='e2e-operator-one'
      `),
    );
    errors.assertClean();
    await context.close();

    const requeryContext = await browser.newContext();
    const requeryPage = await openFormalSampleEditor(
      requeryContext,
      scenario.route,
    );
    const requeryErrors = trackBrowserErrors(requeryPage);
    await expect(
      requeryPage.locator(`[data-field-code="${scenario.fieldCode}"]`),
    ).toHaveValue(scenario.persistedValue);
    const historyRegion = requeryPage.getByRole("region", {
      name: "历史观测记录",
    });
    await expect(historyRegion).toContainText(
      `共 ${historyAfterSave.totalElements} 条`,
    );
    await expect(historyRegion).toContainText(
      liveBrowserAccounts.operatorOne.name,
    );
    await expect(historyRegion).toContainText("当前最新");
    requeryErrors.assertClean();
    await requeryContext.close();
  }
});

test("persists regional annual production through UI, requeries, versions, archives, and rejects stale writes", async ({
  browser,
  request,
}) => {
  test.setTimeout(60_000);
  const initial = (await regionalStats(request, 2026, "CORN")).find(
    ({ regionCode }) => regionCode === "230208",
  );
  expect(initial).toMatchObject({
    plantedAreaMu: "80000.0000",
    yieldPerMuKg: "500.0000",
    totalOutputKg: "40000000.0000",
    version: 0,
  });
  const historyBefore = integerQuery(`
    SELECT count(*) FROM production.regional_crop_annual_stat_history
    WHERE region_code='230208' AND data_year=2026 AND product_code='CORN'
  `);

  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = trackBrowserErrors(page);
  await page.goto(
    `${liveBrowserAccounts.operatorOne.url}/#/产情监测/地区产情填报`,
  );
  await expect(page.getByLabel("梅里斯达斡尔族区播种面积")).toHaveValue("8");
  await expect(page.getByLabel("梅里斯达斡尔族区单产")).toHaveValue(
    /^500(?:\.0+)?$/u,
  );

  const firstRequest = page.waitForRequest(
    (candidate) =>
      candidate.method() === "PUT" &&
      new URL(candidate.url()).pathname ===
        "/api/v1/production/regional-annual-stats/230208",
  );
  const firstResponse = page.waitForResponse(
    (candidate) =>
      candidate.request().method() === "PUT" &&
      new URL(candidate.url()).pathname ===
        "/api/v1/production/regional-annual-stats/230208",
  );
  await page.getByLabel("梅里斯达斡尔族区播种面积").fill("8.125");
  await page.getByLabel("梅里斯达斡尔族区单产").fill("510");
  await page.getByRole("button", { name: "保存梅里斯达斡尔族区" }).click();
  const [firstCaptured, firstSavedResponse] = await Promise.all([
    firstRequest,
    firstResponse,
  ]);
  expect(firstSavedResponse.status()).toBe(200);
  expect(firstCaptured.url()).toBe(
    "http://127.0.0.1:63184/api/v1/production/regional-annual-stats/230208",
  );
  const firstBody = jsonRequestBody<{
    dataYear: number;
    productCode: string;
    plantedAreaMu: string;
    yieldPerMuKg: string;
    expectedVersion: number;
  }>(firstCaptured);
  expect(firstBody).toEqual({
    dataYear: 2026,
    productCode: "CORN",
    plantedAreaMu: "81250",
    yieldPerMuKg: "510",
    expectedVersion: 0,
  });
  const firstSaved =
    await browserResponseData<RegionalAnnualStat>(firstSavedResponse);
  expect(firstSaved).toMatchObject({
    plantedAreaMu: "81250.0000",
    yieldPerMuKg: "510.0000",
    totalOutputKg: "41437500.0000",
    version: 1,
  });
  await expect(
    page.getByRole("row", { name: /梅里斯达斡尔族区/u }),
  ).toContainText("已保存");
  errors.assertClean();
  await context.close();

  const requeryContext = await browser.newContext();
  const requeryPage = await requeryContext.newPage();
  const requeryErrors = trackBrowserErrors(requeryPage);
  await requeryPage.goto(
    `${liveBrowserAccounts.operatorOne.url}/#/产情监测/地区产情填报`,
  );
  await expect(requeryPage.getByLabel("梅里斯达斡尔族区播种面积")).toHaveValue(
    "8.125",
  );
  await expect(requeryPage.getByLabel("梅里斯达斡尔族区单产")).toHaveValue(
    /^510(?:\.0+)?$/u,
  );

  const afterFirst = (await regionalStats(request, 2026, "CORN")).find(
    ({ regionCode }) => regionCode === "230208",
  );
  expect(afterFirst).toEqual(firstSaved);
  expect(await regionalSummary(request, 2026, "CORN")).toMatchObject({
    regionCode: "230200",
    plantedAreaMu: "81250.0000",
    yieldPerMuKg: "510.0000",
    totalOutputKg: "41437500.0000",
  });

  const secondResponse = requeryPage.waitForResponse(
    (candidate) =>
      candidate.request().method() === "PUT" &&
      new URL(candidate.url()).pathname ===
        "/api/v1/production/regional-annual-stats/230208",
  );
  await requeryPage.getByLabel("梅里斯达斡尔族区播种面积").fill("8.25");
  await requeryPage.getByLabel("梅里斯达斡尔族区单产").fill("520");
  await requeryPage
    .getByRole("button", { name: "保存梅里斯达斡尔族区" })
    .click();
  const secondSavedResponse = await secondResponse;
  expect(secondSavedResponse.status()).toBe(200);
  const secondBody = jsonRequestBody<{
    expectedVersion: number;
    plantedAreaMu: string;
    yieldPerMuKg: string;
  }>(secondSavedResponse.request());
  expect(secondBody).toMatchObject({
    expectedVersion: 1,
    plantedAreaMu: "82500",
    yieldPerMuKg: "520",
  });
  const secondSaved =
    await browserResponseData<RegionalAnnualStat>(secondSavedResponse);
  expect(secondSaved).toMatchObject({
    plantedAreaMu: "82500.0000",
    yieldPerMuKg: "520.0000",
    totalOutputKg: "42900000.0000",
    version: 2,
  });
  expect(
    (await regionalStats(request, 2026, "CORN")).find(
      ({ regionCode }) => regionCode === "230208",
    ),
  ).toEqual(secondSaved);
  expect(await regionalSummary(request, 2026, "CORN")).toMatchObject({
    plantedAreaMu: "82500.0000",
    yieldPerMuKg: "520.0000",
    totalOutputKg: "42900000.0000",
  });
  expect(
    queryE2eDatabase(`
      SELECT string_agg(source_version::text || ':' || planted_area_mu::text,
                        ',' ORDER BY source_version)
      FROM production.regional_crop_annual_stat_history
      WHERE region_code='230208' AND data_year=2026 AND product_code='CORN'
    `),
  ).toBe("0:80000.0000,1:81250.0000");
  expect(historyBefore + 2).toBe(
    integerQuery(`
      SELECT count(*) FROM production.regional_crop_annual_stat_history
      WHERE region_code='230208' AND data_year=2026 AND product_code='CORN'
    `),
  );

  const stale = await browserFetch(
    requeryPage,
    "/api/v1/production/regional-annual-stats/230208",
    { method: "PUT", body: firstBody },
  );
  expect(stale.status).toBe(409);
  expect(errorCode(stale)).toBe("REGIONAL_ANNUAL_STAT_VERSION_CONFLICT");
  expect(
    (await regionalStats(request, 2026, "CORN")).find(
      ({ regionCode }) => regionCode === "230208",
    ),
  ).toEqual(secondSaved);
  requeryErrors.assertClean();
  await requeryContext.close();
});

test("persists supply balance through UI, requeries automatic and derived rows, and archives updates", async ({
  browser,
  request,
}) => {
  test.setTimeout(60_000);
  const initial = await supplyBalance(request, 2026, "CORN");
  expect(initial.version).toBe(0);
  expect(supplyRow(initial, "OPENING_INVENTORY").value).toBe("10");
  const historyBefore = await supplyHistory(request, 2026, "CORN");

  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = trackBrowserErrors(page);
  await page.goto(`${liveBrowserAccounts.operatorOne.url}/#/供需分析/供需平衡`);
  await page.getByLabel("供需地区").selectOption("230208");
  await expect(page.getByLabel("期初库存填报值")).toHaveValue("10");

  const firstResponse = page.waitForResponse(
    (candidate) =>
      candidate.request().method() === "PUT" &&
      new URL(candidate.url()).pathname ===
        "/api/v1/supply-balances/230208/2026/CORN",
  );
  await page.getByLabel("期初库存填报值").fill("12.5");
  await page.getByLabel("期初库存说明").fill("E2E_合并前供需首次更新");
  await page.getByRole("button", { name: "保存供需平衡" }).click();
  const firstSavedResponse = await firstResponse;
  expect(firstSavedResponse.status()).toBe(200);
  expect(firstSavedResponse.url()).toBe(
    "http://127.0.0.1:63184/api/v1/supply-balances/230208/2026/CORN",
  );
  const firstBody = jsonRequestBody<{
    version: number;
    manualValues: Record<string, string>;
    notes: Record<string, string>;
  }>(firstSavedResponse.request());
  expect(firstBody.version).toBe(0);
  expect(firstBody.manualValues.OPENING_INVENTORY).toBe("12.5");
  expect(firstBody.notes.OPENING_INVENTORY).toBe("E2E_合并前供需首次更新");
  const firstSaved =
    await browserResponseData<SupplyBalanceView>(firstSavedResponse);
  expect(firstSaved.version).toBe(1);
  expect(supplyRow(firstSaved, "PLANTED_AREA").value).toBe("0.550000");
  expect(supplyRow(firstSaved, "YIELD").value).toBe("7.800000");
  expect(supplyRow(firstSaved, "OUTPUT").value).toBe("4.290000");
  expect(supplyRow(firstSaved, "TOTAL_SUPPLY").value).toBe("22.790000");
  expect(supplyRow(firstSaved, "TOTAL_DEMAND").value).toBe("49.0");
  expect(supplyRow(firstSaved, "CLOSING_INVENTORY").value).toBe("-26.210000");
  errors.assertClean();
  await context.close();

  const requeryContext = await browser.newContext();
  const requeryPage = await requeryContext.newPage();
  const requeryErrors = trackBrowserErrors(requeryPage);
  await requeryPage.goto(
    `${liveBrowserAccounts.operatorOne.url}/#/供需分析/供需平衡`,
  );
  await requeryPage.getByLabel("供需地区").selectOption("230208");
  await expect(requeryPage.getByLabel("期初库存填报值")).toHaveValue("12.5");
  await expect(
    requeryPage.getByRole("row", { name: /播种面积/u }),
  ).toContainText("0.55");
  await expect(requeryPage.getByRole("row", { name: /总供给/u })).toContainText(
    "22.79",
  );
  expect(await supplyBalance(request, 2026, "CORN")).toEqual(firstSaved);

  const secondResponse = requeryPage.waitForResponse(
    (candidate) =>
      candidate.request().method() === "PUT" &&
      new URL(candidate.url()).pathname ===
        "/api/v1/supply-balances/230208/2026/CORN",
  );
  await requeryPage.getByLabel("期初库存填报值").fill("13.5");
  await requeryPage.getByLabel("期初库存说明").fill("E2E_合并前供需第二次更新");
  await requeryPage.getByRole("button", { name: "保存供需平衡" }).click();
  const secondSavedResponse = await secondResponse;
  expect(secondSavedResponse.status()).toBe(200);
  const secondBody = jsonRequestBody<{
    version: number;
    manualValues: Record<string, string>;
  }>(secondSavedResponse.request());
  expect(secondBody.version).toBe(1);
  expect(secondBody.manualValues.OPENING_INVENTORY).toBe("13.5");
  const secondSaved =
    await browserResponseData<SupplyBalanceView>(secondSavedResponse);
  expect(secondSaved.version).toBe(2);
  expect(supplyRow(secondSaved, "OPENING_INVENTORY").value).toBe("13.5");
  expect(supplyRow(secondSaved, "TOTAL_SUPPLY").value).toBe("23.790000");
  expect(supplyRow(secondSaved, "CLOSING_INVENTORY").value).toBe("-25.210000");
  expect(await supplyBalance(request, 2026, "CORN")).toEqual(secondSaved);

  const history = await supplyHistory(request, 2026, "CORN");
  expect(history).toHaveLength(historyBefore.length + 2);
  expect(history[0]).toMatchObject({
    sourceVersion: 1,
    replacedBy: "e2e-operator-one",
    manualValues: { OPENING_INVENTORY: 12.5 },
    notes: { OPENING_INVENTORY: "E2E_合并前供需首次更新" },
  });
  expect(history[1]).toMatchObject({
    sourceVersion: 0,
    manualValues: { OPENING_INVENTORY: 10 },
  });
  requeryErrors.assertClean();
  await requeryContext.close();
});

test("keeps a delayed regional annual PUT bound to the old scope without overwriting the new UI", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(60_000);
  const oldBefore = (await regionalStats(request, 2026, "RICE")).find(
    ({ regionCode }) => regionCode === "230208",
  );
  const newBefore = (await regionalStats(request, 2026, "SOYBEAN")).find(
    ({ regionCode }) => regionCode === "230208",
  );
  expect(oldBefore).toMatchObject({
    plantedAreaMu: "55000.0000",
    yieldPerMuKg: "560.0000",
    version: 0,
  });
  expect(newBefore).toMatchObject({
    plantedAreaMu: "70000.0000",
    yieldPerMuKg: "450.0000",
    version: 0,
  });
  const oldHistoryBefore = integerQuery(`
    SELECT count(*) FROM production.regional_crop_annual_stat_history
    WHERE region_code='230208' AND data_year=2026 AND product_code='RICE'
  `);
  const newHistoryBefore = integerQuery(`
    SELECT count(*) FROM production.regional_crop_annual_stat_history
    WHERE region_code='230208' AND data_year=2026 AND product_code='SOYBEAN'
  `);

  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = trackBrowserErrors(page);
  const timeline: Array<Record<string, unknown>> = [];
  const putRequests: Request[] = [];
  let releaseRoute!: () => void;
  let markCaptured!: (request: Request) => void;
  const routeRelease = new Promise<void>((resolve) => {
    releaseRoute = resolve;
  });
  const captured = new Promise<Request>((resolve) => {
    markCaptured = resolve;
  });
  await page.route(
    "**/api/v1/production/regional-annual-stats/230208",
    async (route) => {
      const routeRequest = route.request();
      if (routeRequest.method() !== "PUT") {
        await route.continue();
        return;
      }
      putRequests.push(routeRequest);
      timeline.push({
        event: "old-put-paused",
        at: new Date().toISOString(),
        url: routeRequest.url(),
        body: jsonRequestBody<unknown>(routeRequest),
      });
      markCaptured(routeRequest);
      await routeRelease;
      timeline.push({
        event: "old-put-released",
        at: new Date().toISOString(),
      });
      await route.continue();
    },
  );

  await page.goto(
    `${liveBrowserAccounts.operatorOne.url}/#/产情监测/地区产情填报`,
  );
  await page.getByLabel("地区产情品种").selectOption("RICE");
  await expect(page.getByLabel("梅里斯达斡尔族区播种面积")).toHaveValue("5.5");

  const oldResponsePromise = page.waitForResponse(
    (candidate) =>
      candidate.request().method() === "PUT" &&
      new URL(candidate.url()).pathname ===
        "/api/v1/production/regional-annual-stats/230208",
  );
  await page.getByLabel("梅里斯达斡尔族区播种面积").fill("5.6");
  await page.getByLabel("梅里斯达斡尔族区单产").fill("561");
  await page.getByRole("button", { name: "保存梅里斯达斡尔族区" }).click();
  const oldRequest = await captured;
  const oldBody = jsonRequestBody<{
    dataYear: number;
    productCode: string;
    plantedAreaMu: string;
    yieldPerMuKg: string;
    expectedVersion: number;
  }>(oldRequest);

  try {
    await page.getByLabel("地区产情品种").selectOption("SOYBEAN");
    await expect(page.getByLabel("梅里斯达斡尔族区播种面积")).toHaveValue("7");
    await expect(page.getByLabel("梅里斯达斡尔族区单产")).toHaveValue(
      /^450(?:\.0+)?$/u,
    );
    timeline.push({
      event: "new-scope-get-rendered",
      at: new Date().toISOString(),
      scope: "230208/2026/SOYBEAN",
    });
  } finally {
    releaseRoute();
  }

  const oldResponse = await oldResponsePromise;
  expect(oldResponse.status()).toBe(200);
  timeline.push({
    event: "old-put-response",
    at: new Date().toISOString(),
    status: oldResponse.status(),
  });
  expect(oldRequest.url()).toBe(
    "http://127.0.0.1:63184/api/v1/production/regional-annual-stats/230208",
  );
  expect(oldBody).toEqual({
    dataYear: 2026,
    productCode: "RICE",
    plantedAreaMu: "56000",
    yieldPerMuKg: "561",
    expectedVersion: 0,
  });
  expect(putRequests).toHaveLength(1);
  await expect(page.getByLabel("地区产情品种")).toHaveValue("SOYBEAN");
  await expect(page.getByLabel("梅里斯达斡尔族区播种面积")).toHaveValue("7");
  await expect(page.getByLabel("梅里斯达斡尔族区单产")).toHaveValue(
    /^450(?:\.0+)?$/u,
  );

  const oldAfter = (await regionalStats(request, 2026, "RICE")).find(
    ({ regionCode }) => regionCode === "230208",
  );
  const newAfter = (await regionalStats(request, 2026, "SOYBEAN")).find(
    ({ regionCode }) => regionCode === "230208",
  );
  expect(oldAfter).toMatchObject({
    plantedAreaMu: "56000.0000",
    yieldPerMuKg: "561.0000",
    totalOutputKg: "31416000.0000",
    version: 1,
  });
  expect(newAfter).toEqual(newBefore);
  expect(oldHistoryBefore + 1).toBe(
    integerQuery(`
      SELECT count(*) FROM production.regional_crop_annual_stat_history
      WHERE region_code='230208' AND data_year=2026 AND product_code='RICE'
    `),
  );
  expect(newHistoryBefore).toBe(
    integerQuery(`
      SELECT count(*) FROM production.regional_crop_annual_stat_history
      WHERE region_code='230208' AND data_year=2026 AND product_code='SOYBEAN'
    `),
  );
  await testInfo.attach("regional-delayed-put-timeline.json", {
    body: JSON.stringify(timeline, null, 2),
    contentType: "application/json",
  });
  errors.assertClean();
  await context.close();
});

test("keeps a delayed supply PUT bound to the old scope without changing the new scope or UI", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(60_000);
  const oldBefore = await supplyBalance(request, 2026, "RICE");
  const newBefore = await supplyBalance(request, 2026, "SOYBEAN");
  const oldHistoryBefore = await supplyHistory(request, 2026, "RICE");
  const newHistoryBefore = await supplyHistory(request, 2026, "SOYBEAN");
  expect(oldBefore.version).toBe(0);
  expect(supplyRow(oldBefore, "OPENING_INVENTORY").value).toBe("40");
  expect(newBefore.version).toBe(0);
  expect(supplyRow(newBefore, "OPENING_INVENTORY").value).toBe("20");

  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = trackBrowserErrors(page);
  const timeline: Array<Record<string, unknown>> = [];
  const putRequests: Request[] = [];
  let releaseRoute!: () => void;
  let markCaptured!: (request: Request) => void;
  const routeRelease = new Promise<void>((resolve) => {
    releaseRoute = resolve;
  });
  const captured = new Promise<Request>((resolve) => {
    markCaptured = resolve;
  });
  await page.route("**/api/v1/supply-balances/**", async (route) => {
    const routeRequest = route.request();
    if (routeRequest.method() !== "PUT") {
      await route.continue();
      return;
    }
    putRequests.push(routeRequest);
    timeline.push({
      event: "old-put-paused",
      at: new Date().toISOString(),
      url: routeRequest.url(),
      body: jsonRequestBody<unknown>(routeRequest),
    });
    markCaptured(routeRequest);
    await routeRelease;
    timeline.push({ event: "old-put-released", at: new Date().toISOString() });
    await route.continue();
  });

  await page.goto(`${liveBrowserAccounts.operatorOne.url}/#/供需分析/供需平衡`);
  await page.getByLabel("供需地区").selectOption("230208");
  await page.getByLabel("供需品种").selectOption("RICE");
  await expect(page.getByLabel("期初库存填报值")).toHaveValue("40");

  const oldResponsePromise = page.waitForResponse(
    (candidate) =>
      candidate.request().method() === "PUT" &&
      new URL(candidate.url()).pathname ===
        "/api/v1/supply-balances/230208/2026/RICE",
  );
  await page.getByLabel("期初库存填报值").fill("41");
  await page.getByLabel("期初库存说明").fill("E2E_延迟旧范围供需已保存");
  await page.getByRole("button", { name: "保存供需平衡" }).click();
  const oldRequest = await captured;
  const oldBody = jsonRequestBody<{
    version: number;
    manualValues: Record<string, string>;
    notes: Record<string, string>;
  }>(oldRequest);

  try {
    await page.getByLabel("供需品种").selectOption("SOYBEAN");
    await expect(page.getByLabel("期初库存填报值")).toHaveValue("20");
    await expect(page.getByLabel("期初库存说明")).toHaveValue(
      "E2E_低权限拒绝基线",
    );
    timeline.push({
      event: "new-scope-get-rendered",
      at: new Date().toISOString(),
      scope: "230208/2026/SOYBEAN",
    });
  } finally {
    releaseRoute();
  }

  const oldResponse = await oldResponsePromise;
  expect(oldResponse.status()).toBe(200);
  timeline.push({
    event: "old-put-response",
    at: new Date().toISOString(),
    status: oldResponse.status(),
  });
  expect(oldRequest.url()).toBe(
    "http://127.0.0.1:63184/api/v1/supply-balances/230208/2026/RICE",
  );
  expect(oldBody.version).toBe(0);
  expect(oldBody.manualValues.OPENING_INVENTORY).toBe("41");
  expect(oldBody.notes.OPENING_INVENTORY).toBe("E2E_延迟旧范围供需已保存");
  expect(putRequests).toHaveLength(1);
  await expect(page.getByLabel("供需品种")).toHaveValue("SOYBEAN");
  await expect(page.getByLabel("期初库存填报值")).toHaveValue("20");
  await expect(page.getByLabel("期初库存说明")).toHaveValue(
    "E2E_低权限拒绝基线",
  );

  const oldAfter = await supplyBalance(request, 2026, "RICE");
  const newAfter = await supplyBalance(request, 2026, "SOYBEAN");
  const oldHistoryAfter = await supplyHistory(request, 2026, "RICE");
  const newHistoryAfter = await supplyHistory(request, 2026, "SOYBEAN");
  expect(oldAfter.version).toBe(1);
  expect(supplyRow(oldAfter, "OPENING_INVENTORY").value).toBe("41.0");
  expect(oldHistoryAfter).toHaveLength(oldHistoryBefore.length + 1);
  expect(oldHistoryAfter[0]).toMatchObject({
    sourceVersion: 0,
    manualValues: { OPENING_INVENTORY: 40 },
  });
  expect(newAfter).toEqual(newBefore);
  expect(newHistoryAfter).toEqual(newHistoryBefore);
  await testInfo.attach("supply-delayed-put-timeline.json", {
    body: JSON.stringify(timeline, null, 2),
    contentType: "application/json",
  });
  errors.assertClean();
  await context.close();
});
