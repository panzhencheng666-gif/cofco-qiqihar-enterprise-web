import { createServer } from "node:http";

const host = "127.0.0.1";
const port = 63181;

const products = [
  { code: "CORN", name: "玉米" },
  { code: "SOYBEAN", name: "大豆" },
  { code: "RICE", name: "稻谷" },
];
const periods = [
  {
    code: "2026-W32",
    name: "2026 年第 32 周",
    startsOn: "2026-08-03",
    endsOn: "2026-08-09",
  },
];
const regions = [
  {
    code: "230200",
    name: "齐齐哈尔市",
    parentCode: null,
    level: "PREFECTURE",
  },
  {
    code: "230221",
    name: "龙江县",
    parentCode: "230200",
    level: "COUNTY",
  },
  {
    code: "230221101",
    name: "龙江镇",
    parentCode: "230221",
    level: "TOWNSHIP",
  },
  {
    code: "230221101001",
    name: "通齐村",
    parentCode: "230221101",
    level: "VILLAGE",
  },
];
const workItems = [
  {
    id: "E2E-WORK-MARKET-001",
    task: "服务端玉米市场采集任务",
    domain: "MARKET",
    regionCode: "230221",
    region: "龙江县",
    product: "CORN",
    businessPeriod: "2026-W32",
    dueAt: "2026-08-09T12:00:00Z",
    workflowNode: "市场采集",
    statusCode: "DRAFT",
    status: "草稿",
    responsiblePartyCode: "server-user",
    responsibleParty: "服务端授权用户",
  },
];
const marketObjectTypes = [
  { code: "TRADER", name: "贸易商", domain: "MARKET" },
];
const productionObjectTypes = [
  { code: "FARMER", name: "农户", domain: "PRODUCTION" },
];
const cultivars = [
  {
    code: "E2E-CORN-CULTIVAR",
    name: "服务端试验品种",
    productCode: "CORN",
  },
];
const marketDefinition = {
  productCode: "CORN",
  objectTypeCode: "TRADER",
  coreFields: [
    {
      code: "MKT_OBJECT_TYPE",
      label: "对象类型",
      controlType: "SELECT",
      unit: null,
      description: null,
      capability: null,
      required: true,
      precision: null,
      scale: null,
      sortOrder: 1,
      options: [],
    },
    {
      code: "MKT_REGION",
      label: "所在地区",
      controlType: "SELECT",
      unit: null,
      description: null,
      capability: null,
      required: true,
      precision: null,
      scale: null,
      sortOrder: 2,
      options: [],
    },
    {
      code: "MKT_PRICE",
      label: "服务端采集价格",
      controlType: "DECIMAL",
      unit: "元/吨",
      description: null,
      capability: null,
      required: true,
      precision: 12,
      scale: 2,
      sortOrder: 3,
      options: [],
    },
    {
      code: "MKT_REPORTER_NAME",
      label: "填报人",
      controlType: "TEXT",
      unit: null,
      description: null,
      capability: null,
      required: true,
      precision: null,
      scale: null,
      sortOrder: 4,
      options: [],
    },
  ],
  groups: [],
};

function productionDefinition(productCode, objectTypeCode) {
  return {
    productCode,
    objectTypeCode,
    groups: [
      {
        category: "DETAIL",
        label: "调查明细",
        sortOrder: 10,
        fields: [
          factField("PROD_SAMPLE_NAME", "填报对象", "TEXT", null, 10),
          factField("PROD_OPENING_INVENTORY", "期初库存", "DECIMAL", "吨", 20),
          factField("PROD_SALES_VOLUME", "销售数量", "DECIMAL", "吨", 30),
          factField("PROD_SELF_USE", "自用数量", "DECIMAL", "吨", 40),
          factField("PROD_ENDING_INVENTORY", "期末余粮", "DECIMAL", "吨", 50),
        ],
      },
      {
        category: "QUALITY",
        label: "质量指标",
        sortOrder: 20,
        fields: [factField("MOISTURE", "水分", "DECIMAL", "%", 10)],
      },
    ],
  };
}

function factField(code, label, valueType, unit, sortOrder) {
  return {
    code,
    label,
    valueType,
    unit,
    description: null,
    precision: 18,
    scale: 4,
    sortOrder,
  };
}

function logisticsDefinition(productCode) {
  return {
    productCode,
    fields: [
      logisticsField("LOG_PERIOD", "物流监测期", "TEXT", true, false, 10),
      logisticsField(
        "LOG_COLLECTION_DATE",
        "采集日期",
        "DATE",
        true,
        false,
        20,
      ),
      logisticsField("LOG_ORIGIN", "起运节点", "TEXT", true, false, 30),
      logisticsField("LOG_DESTINATION", "到达节点", "TEXT", true, false, 40),
      logisticsField(
        "LOG_ROUTE_VOLUME",
        "运输数量",
        "DECIMAL",
        true,
        false,
        50,
        "吨",
      ),
      logisticsField("LOG_REPORTER", "填报人", "TEXT", true, false, 60),
      logisticsField(
        "LOG_REPORTED_AT",
        "填报时间",
        "READONLY_DATETIME",
        false,
        true,
        70,
      ),
      logisticsField(
        "LOG_STATUS",
        "业务状态",
        "READONLY_STATUS",
        false,
        true,
        80,
      ),
    ],
    actions: [],
  };
}

function logisticsField(
  code,
  label,
  controlType,
  required,
  readOnly,
  sortOrder,
  unit = null,
) {
  return {
    code,
    label,
    controlType,
    unit,
    precision: controlType === "DECIMAL" ? 18 : null,
    scale: controlType === "DECIMAL" ? 4 : null,
    required,
    readOnly,
    sortOrder,
    options: [],
  };
}

let mode = "normal";
let marketRecords = [];
let productionRecords = [];
let logisticsRecords = [];
let writes = [];
let actorHeaders = [];
let templateDownloads = [];
let workbookImports = [];

function json(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "content-length": Buffer.byteLength(body),
    "content-type": "application/json; charset=utf-8",
  });
  response.end(body);
}

function data(response, value) {
  json(response, 200, { data: value });
}

function page(items, pageSize = 100) {
  return {
    items,
    pageNumber: 0,
    pageSize,
    totalElements: items.length,
    totalPages: items.length === 0 ? 0 : 1,
  };
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

async function readBytes(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function binary(response, bytes, contentType) {
  response.writeHead(200, {
    "content-length": bytes.length,
    "content-type": contentType,
  });
  response.end(bytes);
}

function listItem(record) {
  return {
    id: record.id,
    values: {
      ...record.coreValues,
      ...record.facts,
      MKT_STATUS: record.status,
    },
    allowedActions: record.allowedActions,
    version: record.version,
  };
}

function productionListItem(record) {
  return {
    id: record.id,
    values: {
      PROD_OBJECT_TYPE: record.objectTypeCode,
      PROD_REGION: record.regionCode,
      PROD_SURVEY_DATE: record.surveyDate,
      PROD_CULTIVAR: record.submissionMetadata.PROD_CULTIVAR_NAME,
      PROD_AREA_MU: record.cultivatedAreaMu,
      PROD_YIELD_PER_MU: record.yieldPerMuKilograms,
      PROD_ESTIMATED_OUTPUT: record.estimatedOutputKilograms,
      PROD_REPORTED_AT: record.reportedAt,
      PROD_STATUS: record.status,
      ...record.submissionMetadata,
      ...record.quality,
      ...record.costs,
      ...record.insurance,
      ...record.subsidies,
    },
    allowedActions: record.allowedActions,
    version: record.version,
  };
}

function reset() {
  mode = "normal";
  marketRecords = [];
  productionRecords = [];
  logisticsRecords = [];
  writes = [];
  actorHeaders = [];
  templateDownloads = [];
  workbookImports = [];
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${host}:${port}`);
  const method = request.method ?? "GET";

  if (method === "GET" && url.pathname === "/health") {
    data(response, { status: "ready" });
    return;
  }
  if (method === "POST" && url.pathname === "/__e2e/reset") {
    reset();
    data(response, { mode });
    return;
  }
  if (method === "POST" && url.pathname === "/__e2e/mode") {
    const body = await readBody(request);
    if (!["normal", "empty", "failure"].includes(body.mode)) {
      json(response, 400, {
        code: "INVALID_TEST_MODE",
        message: "Invalid mode",
      });
      return;
    }
    mode = body.mode;
    data(response, { mode });
    return;
  }
  if (method === "GET" && url.pathname === "/__e2e/state") {
    data(response, {
      actorHeaders,
      mode,
      templateDownloads,
      workbookImports,
      writes,
    });
    return;
  }

  if (!url.pathname.startsWith("/api/")) {
    json(response, 404, { code: "NOT_FOUND", message: "Not found" });
    return;
  }
  if (mode === "failure") {
    json(response, 200, {
      error: {
        code: "CONTROLLED_API_FAILURE",
        message: "Controlled API contract failure",
      },
    });
    return;
  }

  const empty = mode === "empty";
  if (method === "GET" && url.pathname === "/api/v1/session/me") {
    data(response, {
      subjectId: "server-user",
      displayName: "已认证用户",
      workUnitCode: "QIQIHAR_BUSINESS",
      permissions: ["BUSINESS_READ", "BUSINESS_CREATE"],
      regionCodes: ["230200", "230221", "230221101", "230221101001"],
    });
    return;
  }
  if (method === "GET" && url.pathname === "/api/v1/master-data/products") {
    data(response, empty ? [] : products);
    return;
  }
  if (
    method === "GET" &&
    url.pathname === "/api/v1/master-data/business-periods"
  ) {
    data(response, empty ? [] : periods);
    return;
  }
  if (method === "GET" && url.pathname === "/api/v1/master-data/regions") {
    data(response, empty ? [] : regions);
    return;
  }
  if (method === "GET" && url.pathname === "/api/v1/work-items") {
    data(response, page(empty ? [] : workItems));
    return;
  }
  if (
    method === "GET" &&
    url.pathname === "/api/v1/reports/parameter-options"
  ) {
    data(response, {
      definitions: [],
      products: [],
      cultivars: [],
      regionLevels: [],
      regions: [],
      periods: [],
      formats: [],
    });
    return;
  }
  if (
    method === "GET" &&
    /^\/api\/v1\/master-data\/products\/[^/]+\/cultivars$/u.test(url.pathname)
  ) {
    data(response, empty ? [] : cultivars);
    return;
  }
  if (method === "GET" && url.pathname === "/api/v1/master-data/object-types") {
    const domain = url.searchParams.get("domain");
    data(
      response,
      empty
        ? []
        : domain === "PRODUCTION"
          ? productionObjectTypes
          : marketObjectTypes,
    );
    return;
  }
  if (
    method === "GET" &&
    url.pathname === "/api/v1/production-record-definitions"
  ) {
    data(
      response,
      productionDefinition(
        url.searchParams.get("productCode") ?? "CORN",
        url.searchParams.get("objectTypeCode") ?? "FARMER",
      ),
    );
    return;
  }
  if (
    method === "GET" &&
    url.pathname === "/api/v1/market-record-definitions"
  ) {
    data(response, {
      ...marketDefinition,
      productCode: url.searchParams.get("productCode") ?? "CORN",
      objectTypeCode: url.searchParams.get("objectTypeCode") ?? "TRADER",
    });
    return;
  }
  if (method === "POST" && url.pathname === "/api/v1/evidence-photos") {
    for await (const chunk of request) {
      // Drain the multipart body so the controlled server exercises a real upload.
      void chunk;
    }
    data(response, {
      id: "E2E-EVIDENCE-001",
      state: "STAGED",
      originalFilename: "market-scene.png",
      mediaType: "image/png",
      byteLength: 4,
      sha256: "0".repeat(64),
      capturedAt: "2026-08-09T08:00:00Z",
      latitude: "",
      longitude: "",
      watermarkText: "通齐村 市场采集 已认证用户",
    });
    return;
  }
  if (method === "GET" && url.pathname === "/api/v1/production-records") {
    const productCode = url.searchParams.get("productCode");
    data(
      response,
      page(
        productionRecords
          .filter(
            (record) => !productCode || record.productCode === productCode,
          )
          .map(productionListItem),
      ),
    );
    return;
  }
  if (method === "POST" && url.pathname === "/api/v1/production-records") {
    const body = await readBody(request);
    const record = {
      id: `E2E-PRODUCTION-${productionRecords.length + 1}`,
      productCode: body.productCode,
      objectTypeCode: body.objectTypeCode,
      regionCode: body.regionCode,
      cultivarCode: null,
      surveyDate: body.surveyDate,
      cultivatedAreaMu: body.cultivatedAreaMu,
      yieldPerMuKilograms: body.yieldPerMuKilograms,
      estimatedOutputKilograms: String(
        Number(body.cultivatedAreaMu) * Number(body.yieldPerMuKilograms),
      ),
      quality: body.quality,
      costs: body.costs,
      insurance: body.insurance,
      subsidies: body.subsidies,
      submissionMetadata: {
        ...body.submissionMetadata,
        PROD_REPORTER_NAME: "已认证用户",
      },
      evidencePhotos: [],
      reportedAt: "2026-08-09T08:00:00Z",
      status: "DRAFT",
      returnReason: null,
      allowedActions: ["SUBMIT"],
      version: 1,
    };
    productionRecords.push(record);
    writes.push({ action: "create-production", body });
    actorHeaders.push(request.headers["x-actor"] ?? null);
    json(response, 201, { data: record });
    return;
  }
  if (method === "GET" && url.pathname === "/api/v1/market-records") {
    data(response, page(marketRecords.map(listItem)));
    return;
  }
  if (method === "POST" && url.pathname === "/api/v1/market-records") {
    const body = await readBody(request);
    const record = {
      id: `E2E-MARKET-${marketRecords.length + 1}`,
      productCode: body.productCode,
      coreValues: body.coreValues,
      facts: body.facts,
      status: "DRAFT",
      returnReason: null,
      allowedActions: ["SUBMIT"],
      version: 1,
    };
    marketRecords.push(record);
    writes.push({ action: "create-market", body });
    actorHeaders.push(request.headers["x-actor"] ?? null);
    data(response, record);
    return;
  }
  if (
    method === "GET" &&
    url.pathname === "/api/v1/logistics-record-definitions"
  ) {
    data(
      response,
      logisticsDefinition(url.searchParams.get("productCode") ?? "CORN"),
    );
    return;
  }
  if (method === "GET" && url.pathname === "/api/v1/logistics-records") {
    const productCode = url.searchParams.get("productCode");
    data(
      response,
      page(
        logisticsRecords.filter(
          (record) => !productCode || record.productCode === productCode,
        ),
      ),
    );
    return;
  }
  if (method === "POST" && url.pathname === "/api/v1/logistics-records") {
    const body = await readBody(request);
    const record = {
      id: `E2E-LOGISTICS-${logisticsRecords.length + 1}`,
      productCode: body.productCode,
      values: {
        ...body.values,
        LOG_REPORTER: "已认证用户",
        LOG_REPORTED_AT: "2026-08-09T08:00:00Z",
        LOG_STATUS: "DRAFT",
      },
      displayValues: {
        ...body.values,
        LOG_REPORTER: "已认证用户",
        LOG_REPORTED_AT: "2026-08-09 16:00",
        LOG_STATUS: "草稿",
      },
      status: "DRAFT",
      returnReason: null,
      allowedActions: ["SUBMIT"],
      version: 1,
    };
    logisticsRecords.push(record);
    writes.push({ action: "create-logistics", body });
    actorHeaders.push(request.headers["x-actor"] ?? null);
    json(response, 201, { data: record });
    return;
  }

  const template =
    /^\/api\/v1\/imports\/(production|market|logistics)\/template$/u.exec(
      url.pathname,
    );
  if (method === "GET" && template) {
    const [, domain] = template;
    templateDownloads.push({
      domain,
      objectTypeCode: url.searchParams.get("objectTypeCode"),
      productCode: url.searchParams.get("productCode"),
    });
    binary(
      response,
      Buffer.from(
        `${domain.toUpperCase()}-${url.searchParams.get("productCode")}-WORKBOOK`,
      ),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    return;
  }

  const workbookImport =
    /^\/api\/v1\/imports\/(production|market|logistics)$/u.exec(url.pathname);
  if (method === "POST" && workbookImport) {
    const [, domain] = workbookImport;
    const bytes = await readBytes(request);
    const body = bytes.toString("utf8");
    const productCode = url.searchParams.get("productCode");
    const embeddedProduct = ["CORN", "SOYBEAN", "RICE"].find((code) =>
      body.includes(`${code}-WORKBOOK`),
    );
    workbookImports.push({
      domain,
      embeddedProduct,
      objectTypeCode: url.searchParams.get("objectTypeCode"),
      productCode,
    });
    if (embeddedProduct && embeddedProduct !== productCode) {
      json(response, 400, {
        error: {
          code: "IMPORT_CONTEXT_MISMATCH",
          message: "工作簿与当前菜单品种不一致",
        },
      });
      return;
    }
    json(response, 201, {
      data: {
        id: `E2E-IMPORT-${workbookImports.length}`,
        domainCode: domain.toUpperCase(),
        statusCode: "COMPLETED",
        importedRows: 1,
        failedRows: 0,
      },
    });
    return;
  }

  const transition =
    /^\/api\/v1\/market-records\/([^/]+)\/(submit|approve|return)$/u.exec(
      url.pathname,
    );
  if (method === "POST" && transition) {
    const [, id, action] = transition;
    const body = await readBody(request);
    const current = marketRecords.find((record) => record.id === id);
    if (!current) {
      json(response, 404, {
        code: "MARKET_RECORD_NOT_FOUND",
        message: "Market record not found",
      });
      return;
    }
    const record = {
      ...current,
      status: action === "submit" ? "PENDING_REVIEW" : action.toUpperCase(),
      allowedActions: [],
      version: Number(body.version) + 1,
    };
    marketRecords = marketRecords.map((candidate) =>
      candidate.id === id ? record : candidate,
    );
    writes.push({ action: `${action}-market`, body });
    actorHeaders.push(request.headers["x-actor"] ?? null);
    data(response, record);
    return;
  }

  json(response, 404, {
    code: "API_ROUTE_NOT_IMPLEMENTED",
    message: `No controlled response for ${method} ${url.pathname}`,
  });
});

server.listen(port, host, () => {
  process.stdout.write(`Controlled API listening on http://${host}:${port}\n`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
