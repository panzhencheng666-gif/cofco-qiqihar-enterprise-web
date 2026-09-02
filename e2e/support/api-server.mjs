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
    sourceType: "MARKET",
    sourceId: "E2E-MARKET-WORK-001",
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
const formalSamplePoints = [
  {
    id: "E2E-FORMAL-SAMPLE-001",
    kindCode: "MARKET_SUBJECT",
    canonicalName: "龙江县粮食贸易样本一号",
    regionCode: "230221101001",
    objectTypeCode: "TRADER",
    objectTypeName: "贸易商",
    businessDomain: "MARKET",
    address: "龙江县龙江镇通齐村",
    approvalState: "APPROVED",
    locationState: "VERIFIED",
    longitude: 123.9182,
    latitude: 47.3543,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    version: 3,
    annualObservationCount: 2,
    networkMembershipCount: 0,
  },
];
const eligibleFormalSamples = formalSamplePoints.map((point) => ({
  samplePointId: point.id,
  sampleName: point.canonicalName,
  objectTypeCode: point.objectTypeCode,
  objectTypeName: point.objectTypeName,
  domain: "MARKET",
  productCode: "CORN",
  regionCode: point.regionCode,
  regionName: "通齐村",
  latitude: String(point.latitude),
  longitude: String(point.longitude),
  effectiveFrom: point.effectiveFrom,
  effectiveTo: point.effectiveTo,
  latestObservationId: "E2E-OBSERVATION-002",
  latestObservedAt: "2026-08-25T10:58:50Z",
  latestValues: {
    MKT_PURCHASE_BASE_PRICE: "2410.00",
    MKT_SALE_BASE_PRICE: "2430.00",
  },
}));
const marketWorkRecord = {
  id: "E2E-MARKET-WORK-001",
  productCode: "CORN",
  surveyYear: "2026",
  surveyMonth: "8",
  fillingDate: "2026-08-09",
  coreValues: {
    MKT_OBJECT_TYPE: "TRADER",
    MKT_REGION: "230221101001",
    MKT_PURCHASE_BASE_PRICE: "2410.00",
    MKT_SALE_BASE_PRICE: "2430.00",
    MKT_REPORTER_NAME: "已认证用户",
  },
  facts: {},
  status: "DRAFT",
  returnReason: null,
  allowedActions: ["SAVE", "SUBMIT"],
  version: 1,
};
const marketObjectTypes = [
  { code: "TRADER", name: "贸易商", domain: "MARKET" },
];
const productionObjectTypes = [
  { code: "FARMER", name: "农户", domain: "PRODUCTION" },
  { code: "VILLAGE_COMMITTEE", name: "村委会", domain: "PRODUCTION" },
  {
    code: "AGRICULTURAL_TECH_STATION",
    name: "农技站",
    domain: "PRODUCTION",
  },
];
const cultivars = [
  {
    code: "E2E-CORN-CULTIVAR",
    name: "服务端试验品种",
    productCode: "CORN",
  },
  {
    code: "E2E-SOYBEAN-CULTIVAR",
    name: "服务端大豆试验品种",
    productCode: "SOYBEAN",
  },
  {
    code: "E2E-RICE-CULTIVAR",
    name: "服务端稻谷试验品种",
    productCode: "RICE",
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
      code: "MKT_PURCHASE_BASE_PRICE",
      label: "采集对象收购价格",
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
      code: "MKT_SALE_BASE_PRICE",
      label: "采集对象销售价格",
      controlType: "DECIMAL",
      unit: "元/吨",
      description: null,
      capability: null,
      required: true,
      precision: 12,
      scale: 2,
      sortOrder: 4,
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
      sortOrder: 5,
      options: [],
    },
  ],
  groups: [],
};

function productionDefinition(productCode, objectTypeCode) {
  const groups = productionFactGroups(productCode);
  const publicGroups = groups.map((group) => ({
    ...group,
    fields: group.fields.filter(
      (field) => !PRODUCTION_PRIVATE_CODES.has(field.code),
    ),
  }));
  return {
    productCode,
    objectTypeCode,
    contractVersion: "production-survey-fields-v4",
    contractDigest:
      "sha256:07806fbda70354ee29b243020cd5508db52271f8d7c88ac540379a7c1c3297fe",
    fields: [
      surveyField(
        "objectTypeCode",
        "样本点类型",
        "CONTEXT",
        "基础信息",
        10,
        10,
        "TEXT",
        "SELECT",
        null,
        true,
        false,
        false,
        false,
        true,
        0,
        0,
        "由当前业务入口受控选择",
      ),
      surveyField(
        "regionCode",
        "所在地区",
        "CONTEXT",
        "基础信息",
        10,
        20,
        "TEXT",
        "REGION",
        null,
        true,
        false,
        false,
        true,
        true,
        0,
        0,
        "完整行政区划路径或有效地区代码",
      ),
      surveyField(
        "surveyYear",
        "数据年份",
        "CONTEXT",
        "基础信息",
        10,
        40,
        "INTEGER",
        "SELECT",
        null,
        true,
        false,
        false,
        true,
        true,
        4,
        0,
        "调查年份",
      ),
      surveyField(
        "surveyMonth",
        "数据月份",
        "CONTEXT",
        "基础信息",
        10,
        50,
        "INTEGER",
        "SELECT",
        null,
        false,
        false,
        false,
        true,
        true,
        2,
        0,
        "调查月份",
      ),
      surveyField(
        "PROD_SAMPLE_NAME",
        "填报对象名称",
        "SUBJECT",
        "调查对象与联系",
        20,
        20,
        "TEXT",
        "TEXT",
        null,
        false,
        false,
        false,
        true,
        true,
        0,
        0,
        "仅作展示名称，不作为稳定主体标识",
      ),
      surveyField(
        "PROD_REPORTER_NAME",
        "填报人",
        "SUBJECT",
        "调查对象与联系",
        20,
        30,
        "TEXT",
        "READONLY_TEXT",
        null,
        true,
        true,
        false,
        false,
        true,
        0,
        0,
        "由登录账号自动记录",
      ),
      surveyField(
        "PROD_SURVEYOR_NAME",
        "调研人",
        "SUBJECT",
        "调查对象与联系",
        20,
        40,
        "TEXT",
        "TEXT",
        null,
        false,
        false,
        false,
        true,
        true,
        0,
        0,
      ),
      surveyField(
        "PROD_SURVEYOR_PHONE",
        "调研人联系方式",
        "SUBJECT",
        "调查对象与联系",
        20,
        50,
        "TEXT",
        "TEXT",
        null,
        false,
        false,
        false,
        true,
        true,
        0,
        0,
      ),
      surveyField(
        "PROD_SAMPLE_CONTACT",
        "填报对象联系方式",
        "SUBJECT",
        "调查对象与联系",
        20,
        50,
        "TEXT",
        "TEXT",
        null,
        true,
        false,
        false,
        true,
        true,
        0,
        0,
      ),
      surveyField(
        "PROD_SAMPLE_LATITUDE",
        "填报对象纬度",
        "SUBJECT",
        "调查对象与联系",
        20,
        60,
        "DECIMAL",
        "DECIMAL",
        "度",
        true,
        false,
        false,
        true,
        true,
        9,
        6,
        "范围 -90 至 90",
      ),
      surveyField(
        "PROD_SAMPLE_LONGITUDE",
        "填报对象经度",
        "SUBJECT",
        "调查对象与联系",
        20,
        70,
        "DECIMAL",
        "DECIMAL",
        "度",
        true,
        false,
        false,
        true,
        true,
        9,
        6,
        "范围 -180 至 180",
      ),
      surveyField(
        "cultivatedAreaMu",
        "种植面积",
        "OUTPUT",
        "产量信息",
        30,
        10,
        "DECIMAL",
        "DECIMAL",
        "亩",
        true,
        false,
        false,
        true,
        true,
        18,
        4,
      ),
      surveyField(
        "yieldPerMuKilograms",
        "权威采用单产",
        "OUTPUT",
        "产量信息",
        30,
        20,
        "DECIMAL",
        "DECIMAL",
        "公斤/亩",
        true,
        false,
        false,
        true,
        true,
        18,
        4,
      ),
      surveyField(
        "estimatedOutputKilograms",
        "预计总产",
        "OUTPUT",
        "产量信息",
        30,
        30,
        "DECIMAL",
        "READONLY_DECIMAL",
        "公斤",
        false,
        true,
        true,
        false,
        true,
        18,
        4,
        "种植面积与权威采用单产的计算值",
      ),
      surveyField(
        "yearOnYear",
        "与上年同比",
        "OUTPUT",
        "产量信息",
        30,
        40,
        "TEXT",
        "READONLY_TEXT",
        null,
        false,
        true,
        true,
        false,
        true,
        0,
        0,
      ),
      ...publicGroups.flatMap((group, groupIndex) =>
        group.fields
          .filter((field) => !PRODUCTION_FIXED_CODES.has(field.code))
          .map((field) =>
            surveyField(
              field.code,
              field.label,
              group.category,
              group.label,
              40 + groupIndex * 10,
              field.sortOrder,
              field.valueType,
              field.valueType === "DECIMAL" ? "DECIMAL" : "TEXT",
              field.unit,
              false,
              false,
              false,
              true,
              true,
              field.precision,
              field.scale,
              field.description,
            ),
          ),
      ),
    ],
    groups: publicGroups,
  };
}

const PRODUCTION_PRIVATE_CODES = new Set([
  "PROD_SAMPLE_SUBJECT_CODE",
  "PROD_SURPLUS_SUBJECT_CODE",
  "PROD_SURPLUS_CUTOFF_DATE",
  "sample_point_id",
  "evidencePhotoId",
  "surveyDate",
]);

const PRODUCTION_FIXED_CODES = new Set([
  "objectTypeCode",
  "regionCode",
  "surveyDate",
  "PROD_SAMPLE_SUBJECT_CODE",
  "PROD_SAMPLE_NAME",
  "PROD_REPORTER_NAME",
  "PROD_SURVEYOR_NAME",
  "PROD_SURVEYOR_PHONE",
  "PROD_SAMPLE_CONTACT",
  "PROD_SAMPLE_LATITUDE",
  "PROD_SAMPLE_LONGITUDE",
  "cultivatedAreaMu",
  "yieldPerMuKilograms",
  "estimatedOutputKilograms",
  "yearOnYear",
  "evidencePhotoId",
]);

function productionFactGroups(productCode) {
  const detailFields = [
    factField(
      "PROD_SAMPLE_SUBJECT_CODE",
      "样本主体唯一标识",
      "TEXT",
      null,
      1005,
      "同一产情主体跨产品、跨记录稳定且不可复用的业务标识",
    ),
    factField(
      "PROD_SAMPLE_NAME",
      "填报对象",
      "TEXT",
      null,
      1010,
      "被调查的农户、村委会或农技站名称",
    ),
    factField("PROD_HARVEST_AREA_MU", "预计收获面积", "DECIMAL", "亩", 1020),
    factField("PROD_AFFECTED_AREA_MU", "灾损面积", "DECIMAL", "亩", 1030),
    factField("PROD_GROWTH_STATUS", "当前长势", "TEXT", null, 1040),
    factField("PROD_GROWTH_STAGE", "生育阶段", "TEXT", null, 1050),
    factField("PROD_OPENING_INVENTORY", "期初库存", "DECIMAL", "吨", 1060),
    factField("PROD_SALES_VOLUME", "销售数量", "DECIMAL", "吨", 1070),
    factField("PROD_SELF_USE", "自用数量", "DECIMAL", "吨", 1080),
    factField("PROD_ENDING_INVENTORY", "期末余粮", "DECIMAL", "吨", 1090),
    factField("PROD_INTENDED_AREA_MU", "下年度意向面积", "DECIMAL", "亩", 1100),
    factField("PROD_INTENTION_REASON", "调整原因", "TEXT", null, 1110),
    factField(
      "PROD_SURPLUS_SUBJECT_CODE",
      "余粮主体唯一标识",
      "TEXT",
      null,
      1120,
      "同一农户或样本主体跨期稳定且不可复用的业务标识",
    ),
    factField(
      "PROD_SURPLUS_CUTOFF_DATE",
      "余粮统计截止日",
      "TEXT",
      null,
      1130,
      "地区余粮采用的统一统计截止日，格式 YYYY-MM-DD",
    ),
  ];
  const qualityFields =
    {
      CORN: [
        factField("MOISTURE", "水分", "DECIMAL", "%", 100, null, 18, 1),
        factField("TEST_WEIGHT", "容重", "DECIMAL", "克/升", 110, null, 18, 0),
        factField("TOXIN", "毒素", "DECIMAL", "%", 115, null, 18, 1),
        factField("IMPURITY", "杂质", "DECIMAL", "%", 120, null, 18, 1),
        factField(
          "IMPERFECT_GRAIN",
          "不完善粒",
          "DECIMAL",
          "%",
          130,
          null,
          18,
          1,
        ),
        factField("MILDEW", "霉变", "DECIMAL", "%", 140, null, 18, 1),
      ],
      SOYBEAN: [
        factField("PROTEIN", "蛋白", "DECIMAL", "%", 100, null, 18, 1),
        factField("OIL_YIELD", "出油率", "DECIMAL", "%", 110, null, 18, 1),
        factField(
          "IMPERFECT_GRAIN",
          "不完善粒",
          "DECIMAL",
          "%",
          120,
          null,
          18,
          1,
        ),
        factField("MOISTURE", "水分", "DECIMAL", "%", 130, null, 18, 1),
        factField("IMPURITY", "杂质", "DECIMAL", "%", 140, null, 18, 1),
      ],
      RICE: [
        factField("MOISTURE", "水分", "DECIMAL", "%", 100, null, 18, 1),
        factField("MILLING_YIELD", "出米率", "DECIMAL", "%", 110, null, 18, 1),
        factField(
          "BROWN_RICE_YIELD",
          "出糙率",
          "DECIMAL",
          "%",
          120,
          null,
          18,
          1,
        ),
        factField("IMPURITY", "杂质", "DECIMAL", "%", 130, null, 18, 1),
      ],
    }[productCode] ?? [];
  return [
    {
      category: "DETAIL",
      label: "业务调查明细",
      sortOrder: 5,
      fields: detailFields,
    },
    {
      category: "QUALITY",
      label: "质量指标",
      sortOrder: 10,
      fields: qualityFields,
    },
    {
      category: "COST",
      label: "生产成本",
      sortOrder: 20,
      fields: [
        factField("LAND_RENT", "地租", "DECIMAL", "元/亩", 200, null, 18, 0),
        factField(
          "SEED_COST",
          "种子费用",
          "DECIMAL",
          "元/亩",
          210,
          null,
          18,
          0,
        ),
        factField(
          "PESTICIDE_COST",
          "农药费用",
          "DECIMAL",
          "元/亩",
          220,
          null,
          18,
          0,
        ),
        factField(
          "FERTILIZER_COST",
          "化肥费用",
          "DECIMAL",
          "元/亩",
          230,
          null,
          18,
          0,
        ),
        factField(
          "IRRIGATION_COST",
          "灌溉费用",
          "DECIMAL",
          "元/亩",
          240,
          null,
          18,
          0,
        ),
        factField(
          "LABOR_COST",
          "人工费用",
          "DECIMAL",
          "元/亩",
          250,
          null,
          18,
          0,
        ),
        factField(
          "MACHINERY_COST",
          "机耕费用",
          "DECIMAL",
          "元/亩",
          260,
          null,
          18,
          0,
        ),
        factField(
          "OTHER_COST",
          "其他成本",
          "DECIMAL",
          "元/亩",
          270,
          null,
          18,
          0,
        ),
      ],
    },
    {
      category: "INSURANCE",
      label: "农业保险",
      sortOrder: 30,
      fields: [
        factField(
          "INSURANCE_AMOUNT",
          "保险金额",
          "DECIMAL",
          "元",
          300,
          null,
          18,
          0,
        ),
      ],
    },
    {
      category: "SUBSIDY",
      label: "农业补贴",
      sortOrder: 40,
      fields: [
        factField(
          "SUBSIDY_AMOUNT",
          "补贴金额",
          "DECIMAL",
          "元",
          400,
          null,
          18,
          0,
        ),
      ],
    },
  ];
}

function surveyField(
  code,
  label,
  groupCode,
  groupLabel,
  groupOrder,
  sortOrder,
  valueType,
  controlType,
  unit,
  required,
  readOnly,
  calculated,
  importable,
  displayed,
  precision,
  scale,
  description = null,
) {
  return {
    code,
    label,
    groupCode,
    groupLabel,
    groupOrder,
    sortOrder,
    valueType,
    controlType,
    unit,
    required,
    options: [],
    readOnly,
    calculated,
    importable,
    displayed,
    description,
    precision,
    scale,
  };
}

function factField(
  code,
  label,
  valueType,
  unit,
  sortOrder,
  description = null,
  precision = 18,
  scale = 4,
) {
  return {
    code,
    label,
    valueType,
    unit,
    description,
    precision,
    scale,
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
      MKT_SURVEY_YEAR: record.surveyYear,
      MKT_SURVEY_MONTH: record.surveyMonth,
      MKT_FILLING_AT: record.fillingDate,
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
      PROD_SURVEY_YEAR: record.surveyYear,
      PROD_SURVEY_MONTH: record.surveyMonth,
      PROD_FILLING_AT: record.fillingDate,
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
  if (method === "GET" && url.pathname === "/api/v1/business-events/stream") {
    response.writeHead(200, {
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
    });
    response.write(": controlled stream ready\n\n");
    return;
  }
  // Identity remains authoritative while downstream business responses are
  // deliberately malformed by the failure-mode tests.
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
  if (method === "GET" && url.pathname === "/api/v1/formal-sample-points") {
    data(response, page(empty ? [] : formalSamplePoints, 20));
    return;
  }
  if (
    method === "GET" &&
    /^\/api\/v1\/formal-sample-points\/[^/]+$/u.test(url.pathname)
  ) {
    const id = decodeURIComponent(url.pathname.split("/").at(-1) ?? "");
    const point = formalSamplePoints.find((item) => item.id === id);
    if (!point || empty) {
      json(response, 404, {
        code: "FORMAL_SAMPLE_POINT_NOT_FOUND",
        message: "Formal sample point not found",
      });
      return;
    }
    data(response, point);
    return;
  }
  if (
    method === "GET" &&
    url.pathname === "/api/v1/formal-sample-observations/eligible-samples"
  ) {
    data(response, empty ? [] : eligibleFormalSamples);
    return;
  }
  if (
    method === "GET" &&
    url.pathname === "/api/v1/formal-sample-observations/observations"
  ) {
    data(response, {
      items: [],
      totalElements: 0,
      pageNumber: 0,
      pageSize: 20,
    });
    return;
  }
  if (method === "GET" && url.pathname === "/api/v1/notifications") {
    data(response, { items: [], unreadCount: 0 });
    return;
  }
  if (method === "GET" && url.pathname === "/api/v1/master-data/products") {
    const domain = url.searchParams.get("domain");
    const pageKind = url.searchParams.get("pageKind");
    const pageScoped = domain !== null || pageKind !== null;
    const enabled =
      pageScoped && (domain !== "PRODUCTION" || pageKind !== "MONITORING")
        ? []
        : products;
    data(response, empty ? [] : enabled);
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
  if (method === "GET" && url.pathname === "/api/v1/overview/options") {
    data(response, { years: empty ? [] : [2026] });
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
  if (
    method === "POST" &&
    [
      "/api/v1/production-records",
      "/api/v1/production-records/submit",
    ].includes(url.pathname)
  ) {
    const submitImmediately = url.pathname.endsWith("/submit");
    const body = await readBody(request);
    const record = {
      id: `E2E-PRODUCTION-${productionRecords.length + 1}`,
      productCode: body.productCode,
      objectTypeCode: body.objectTypeCode,
      regionCode: body.regionCode,
      cultivarCode: null,
      surveyYear: body.surveyYear,
      surveyMonth: body.surveyMonth,
      fillingDate: "2026-08-09",
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
      status: submitImmediately ? "PENDING_REVIEW" : "DRAFT",
      returnReason: null,
      allowedActions: submitImmediately ? [] : ["SUBMIT"],
      version: submitImmediately ? 2 : 1,
    };
    productionRecords.push(record);
    writes.push({
      action: submitImmediately
        ? "create-and-submit-production"
        : "create-production",
      body,
    });
    actorHeaders.push(request.headers["x-actor"] ?? null);
    json(response, 201, { data: record });
    return;
  }
  if (method === "GET" && url.pathname === "/api/v1/market-records") {
    data(response, page(marketRecords.map(listItem)));
    return;
  }
  const marketRecordDetail = /^\/api\/v1\/market-records\/([^/]+)$/u.exec(
    url.pathname,
  );
  if (method === "GET" && marketRecordDetail) {
    const [, id] = marketRecordDetail;
    const record =
      id === marketWorkRecord.id
        ? marketWorkRecord
        : marketRecords.find((candidate) => candidate.id === id);
    if (!record) {
      json(response, 404, {
        code: "MARKET_RECORD_NOT_FOUND",
        message: "Market record not found",
      });
      return;
    }
    data(response, record);
    return;
  }
  if (
    method === "POST" &&
    ["/api/v1/market-records", "/api/v1/market-records/submit"].includes(
      url.pathname,
    )
  ) {
    const submitImmediately = url.pathname.endsWith("/submit");
    const body = await readBody(request);
    const record = {
      id: `E2E-MARKET-${marketRecords.length + 1}`,
      productCode: body.productCode,
      surveyYear: body.surveyYear,
      surveyMonth: body.surveyMonth,
      fillingDate: "2026-08-09",
      coreValues: body.coreValues,
      facts: body.facts,
      status: submitImmediately ? "PENDING_REVIEW" : "DRAFT",
      returnReason: null,
      allowedActions: submitImmediately ? [] : ["SUBMIT"],
      version: submitImmediately ? 2 : 1,
    };
    marketRecords.push(record);
    writes.push({
      action: submitImmediately ? "create-and-submit-market" : "create-market",
      body,
    });
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
