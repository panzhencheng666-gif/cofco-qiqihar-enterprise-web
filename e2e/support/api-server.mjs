import { createServer } from "node:http";

const host = "127.0.0.1";
const port = 63181;

const products = [{ code: "CORN", name: "服务端玉米" }];
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
const objectTypes = [{ code: "TRADER", name: "贸易商", domain: "MARKET" }];
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

let mode = "normal";
let marketRecords = [];
let writes = [];
let actorHeaders = [];

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

function reset() {
  mode = "normal";
  marketRecords = [];
  writes = [];
  actorHeaders = [];
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
    data(response, { actorHeaders, mode, writes });
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
    data(response, empty ? [] : objectTypes);
    return;
  }
  if (
    method === "GET" &&
    url.pathname === "/api/v1/market-record-definitions"
  ) {
    data(response, marketDefinition);
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
