import type { APIRequestContext, Page } from "@playwright/test";
import { expect, queryE2eDatabase, test } from "./fixtures";

const namespace = "S3C-20260812-";
const validPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function uploadEvidence(
  request: APIRequestContext,
  marker: string,
): Promise<string> {
  const response = await request.post("/api/v1/evidence-photos", {
    multipart: {
      file: {
        name: `${marker}.png`,
        mimeType: "image/png",
        buffer: validPng,
      },
      capturedAt: "2026-08-12T01:00:00Z",
      latitude: "47.3543",
      longitude: "123.9182",
      watermarkText: `${namespace}${marker}`,
    },
  });
  expect(response.status()).toBe(201);
  const body = (await response.json()) as { data: { id: string } };
  return body.data.id;
}

async function createDrafts(request: APIRequestContext) {
  const productionEvidence = await uploadEvidence(request, "VOID-PRODUCTION");
  const marketEvidence = await uploadEvidence(request, "VOID-MARKET");

  const production = await request.post("/api/v1/production-records", {
    data: {
      productCode: "RICE",
      objectTypeCode: "FARMER",
      regionCode: "230208101001",
      cultivarCode: null,
      surveyDate: "2026-08-12",
      cultivatedAreaMu: "10",
      yieldPerMuKilograms: "500",
      quality: { MILLING_YIELD: "68" },
      costs: {},
      insurance: {},
      subsidies: {},
      submissionMetadata: {
        PROD_REPORTER_NAME: "验收填报员甲",
        PROD_REPORTER_PHONE: "13800000031",
        PROD_SAMPLE_NAME: `${namespace}VOID-RICE-PRODUCTION`,
        PROD_SAMPLE_CONTACT: "13900000031",
        PROD_SAMPLE_LATITUDE: "47.3543",
        PROD_SAMPLE_LONGITUDE: "123.9182",
      },
      evidencePhotoIds: [productionEvidence],
    },
  });
  expect(production.status()).toBe(201);

  const market = await request.post("/api/v1/market-records", {
    data: {
      productCode: "RICE",
      coreValues: {
        MKT_OBJECT_TYPE: "TRADER",
        MKT_REGION: "230208101001",
        MKT_TRADE_DATE: "2026-08-12",
        MKT_PURCHASE_BASE_PRICE: "2860",
        MKT_SALE_BASE_PRICE: "2920",
        MKT_CARRIAGE_BOARD_AMOUNT: "30",
        MKT_PACKAGING_FORM: "BULK",
        MKT_PACKAGING_AMOUNT: "10",
        MKT_FREIGHT_AMOUNT: "60",
        MKT_REPORTER_NAME: "验收填报员甲",
        MKT_REPORTER_PHONE: "13800000032",
        MKT_SAMPLE_SUBJECT_CODE: `${namespace}VOID-MARKET-SUBJECT`,
        MKT_SAMPLE_NAME: `${namespace}VOID-RICE-MARKET`,
        MKT_SAMPLE_CONTACT: "13900000032",
        MKT_SAMPLE_LATITUDE: "47.3543",
        MKT_SAMPLE_LONGITUDE: "123.9182",
      },
      facts: { PURCHASE_VOLUME: "12", MILLING_YIELD: "68" },
      evidencePhotoIds: [marketEvidence],
    },
  });
  expect(market.status()).toBe(201);

  const logistics = await request.post("/api/v1/logistics-records", {
    data: {
      productCode: "RICE",
      values: {
        LOG_PERIOD: "2026-W32",
        LOG_COLLECTION_DATE: "2026-08-12",
        LOG_ORIGIN: "E2E_QQ_RAIL",
        LOG_DESTINATION: "E2E_QQ_ROAD",
        LOG_TRANSPORT_MODE: "RAIL",
        LOG_DIRECTION: "INFLOW",
        LOG_ROUTE_VOLUME: "33.5",
        LOG_FREIGHT_RATE: "86.25",
        LOG_TRANSIT_TIME: "4.5",
        LOG_SOURCE_ORGANIZATION: `${namespace}VOID-RICE-LOGISTICS`,
      },
    },
  });
  expect(logistics.status()).toBe(201);

  const body = async (response: typeof production) =>
    (
      (await response.json()) as {
        data: { id: string; allowedActions: readonly string[] };
      }
    ).data;
  const created = {
    production: await body(production),
    market: await body(market),
    logistics: await body(logistics),
  };
  for (const [domain, record] of Object.entries(created)) {
    expect(record.allowedActions, `${domain} create response`).toContain(
      "VOID",
    );
    const detail = await request.get(
      `/api/v1/${domain === "production" ? "production-records" : domain === "market" ? "market-records" : "logistics-records"}/${record.id}`,
    );
    expect(detail.status(), `${domain} detail status`).toBe(200);
    const detailBody = (await detail.json()) as {
      data: { allowedActions: readonly string[] };
    };
    expect(
      detailBody.data.allowedActions,
      `${domain} detail response`,
    ).toContain("VOID");
  }
  return {
    productionId: created.production.id,
    marketId: created.market.id,
    logisticsId: created.logistics.id,
  };
}

async function openDraft(
  page: Page,
  rowText: string,
  actionName: string,
  dialogName: string,
) {
  const row = page
    .getByRole("row")
    .filter({ hasText: rowText })
    .filter({ has: page.getByRole("button", { name: actionName }) });
  await expect(row).toHaveCount(1, { timeout: 10_000 });
  await row.getByRole("button", { name: actionName }).click();
  const dialog = page.getByRole("dialog", { name: dialogName });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("voids production, market, and logistics drafts through Chromium and persists terminal evidence", async ({
  page,
  request,
}) => {
  const ids = await createDrafts(request);
  await page.goto("/#/我的工作/待我处理");

  const production = await openDraft(
    page,
    "稻谷种植生产",
    "继续产情填报",
    "补充产情填报",
  );
  await production.getByRole("button", { name: "作废记录" }).click();
  await expect(production.locator("form > header strong")).toContainText(
    "已作废",
  );
  await expect(
    production.getByRole("button", { name: "保存业务记录" }),
  ).toHaveCount(0);
  await production.getByRole("button", { name: "关闭补充产情填报" }).click();

  const market = await openDraft(
    page,
    "稻谷报价与交易",
    "继续市场填报",
    "补充市场填报",
  );
  await market.getByRole("button", { name: "作废记录" }).click();
  await expect(market.locator("form > header strong")).toContainText("已作废");
  await expect(
    market.getByRole("button", { name: "保存业务记录" }),
  ).toHaveCount(0);
  await market.getByRole("button", { name: "关闭补充市场填报" }).click();

  const logistics = await openDraft(
    page,
    "稻谷物流监测",
    "继续物流填报",
    "补充物流监测填报",
  );
  await logistics.getByRole("button", { name: "作废记录" }).click();
  await expect(logistics.locator("form > header strong")).toContainText(
    "已作废",
  );
  await expect(
    logistics.getByRole("button", { name: "保存物流记录" }),
  ).toHaveCount(0);
  await logistics.getByRole("button", { name: "关闭补充物流监测填报" }).click();

  for (const [table, id] of [
    ["production.production_record", ids.productionId],
    ["market.market_record", ids.marketId],
    ["logistics.route_event", ids.logisticsId],
  ] as const) {
    const idColumn = table.startsWith("logistics") ? "event_id" : "record_id";
    expect(
      queryE2eDatabase(
        `SELECT status_code FROM ${table} WHERE ${idColumn} = '${id}'`,
      ),
    ).toBe("VOIDED");
    expect(
      Number(
        queryE2eDatabase(
          `SELECT count(*) FROM platform.business_audit_event WHERE aggregate_id = '${id}' AND action_code LIKE '%_VOIDED'`,
        ),
      ),
    ).toBe(1);
    expect(
      Number(
        queryE2eDatabase(
          `SELECT count(*) FROM platform.business_event_outbox WHERE aggregate_id = '${id}' AND action_code LIKE '%_VOIDED'`,
        ),
      ),
    ).toBe(1);
  }

  for (const [resource, id, terminalStatus] of [
    ["production-records", ids.productionId, 409],
    ["market-records", ids.marketId, 409],
    ["logistics-records", ids.logisticsId, 400],
  ] as const) {
    const detail = await request.get(`/api/v1/${resource}/${id}`);
    expect(detail.status()).toBe(200);
    const current = (await detail.json()) as { data: { version: number } };
    const submit = await request.post(`/api/v1/${resource}/${id}/submit`, {
      data: { version: current.data.version },
    });
    expect(submit.status(), `${resource} VOIDED submit`).toBe(terminalStatus);
  }
});
