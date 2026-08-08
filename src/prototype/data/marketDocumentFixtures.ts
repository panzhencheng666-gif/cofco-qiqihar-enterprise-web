import { marketTasks } from "../marketMonitoringData";
import { businessWorkFixtures } from "./businessWorkFixtures";
import {
  getApplicableFieldGroups,
  type GrainKind,
  type MarketCollectionMode,
  type MarketFieldGroupKey,
  type MarketTask,
} from "../marketMonitoringModel";

export interface MarketDocumentField {
  fieldId: string;
  label: string;
  value: string;
  unit?: string;
  note?: string;
  countsTowardCompletion?: boolean;
  requiresConfirmation?: boolean;
}

export interface MarketDocumentFieldGroup {
  groupId: MarketFieldGroupKey;
  label: string;
  fields: readonly MarketDocumentField[];
}

export interface MarketCollectionChannel {
  mode: MarketCollectionMode;
  label: string;
  sourceDetail: string;
  validationResult: string;
  instruction: string;
  sourceRows: readonly { name: string; detail: string; state: string }[];
  importRowLimit?: number;
  importSummary?: {
    total: number;
    accepted: number;
    warnings: number;
    errors: number;
  };
  systemSummary?: {
    received: number;
    accepted: number;
    pending: number;
    failed: number;
    latestLabel: string;
  };
}

export interface MarketDocumentFixture {
  documentId: string;
  workId: string;
  documentLabel: string;
  objectName: string;
  businessPeriodLabel: string;
  lastSavedLabel: string;
  fieldGroups: readonly MarketDocumentFieldGroup[];
  validation: {
    title: string;
    detail: string;
    pendingEvidence: string;
  };
  collectionChannels: readonly MarketCollectionChannel[];
}

type GrainEntry = {
  price: string;
  quantity: string;
  form: string;
  variety: string;
  quality: readonly MarketDocumentField[];
  inventory: readonly MarketDocumentField[];
  sales: readonly MarketDocumentField[];
};

const marketGrainEntries: Readonly<Record<GrainKind, GrainEntry>> = {
  corn: {
    price: "2,346",
    quantity: "2,480",
    form: "散粮 · 干粮",
    variety: "德美亚3号",
    quality: [
      { fieldId: "moisture", label: "水分", value: "14.6", unit: "%" },
      { fieldId: "testWeight", label: "容重", value: "716", unit: "克/升" },
      { fieldId: "mildew", label: "霉变粒", value: "0.5", unit: "%" },
      { fieldId: "impurity", label: "杂质", value: "0.9", unit: "%" },
      {
        fieldId: "imperfectGrain",
        label: "不完善粒",
        value: "3.2",
        unit: "%",
      },
      { fieldId: "toxin", label: "毒素检测", value: "合格" },
    ],
    inventory: [
      { fieldId: "cornStock", label: "玉米库存", value: "18,420", unit: "吨" },
      { fieldId: "bulkStock", label: "其中散粮", value: "15,860", unit: "吨" },
      { fieldId: "stockMoment", label: "统计时点", value: "7月31日 08:00" },
      { fieldId: "inventoryNature", label: "库存性质", value: "企业商品库存" },
    ],
    sales: [
      {
        fieldId: "salesPrice",
        label: "销售价",
        value: "2,370",
        unit: "元/吨",
        note: "基础价，不含车板、包装与运费",
      },
      {
        fieldId: "bulkRailPrice",
        label: "车板散粮价",
        value: "2,382",
        unit: "元/吨",
      },
      {
        fieldId: "bagRailPrice",
        label: "车板包粮价",
        value: "2,418",
        unit: "元/吨",
      },
      {
        fieldId: "salesVolume",
        label: "本期销售量",
        value: "1,260",
        unit: "吨",
      },
      { fieldId: "delivery", label: "交付方式", value: "站台交付" },
    ],
  },
  soybean: {
    price: "4,286",
    quantity: "960",
    form: "袋装 · 筛粮",
    variety: "黑农84",
    quality: [
      { fieldId: "protein", label: "蛋白", value: "39.6", unit: "%" },
      { fieldId: "oilYield", label: "出油率", value: "18.7", unit: "%" },
      {
        fieldId: "imperfectGrain",
        label: "不完善粒",
        value: "1.9",
        unit: "%",
      },
      { fieldId: "moisture", label: "水分", value: "12.8", unit: "%" },
      { fieldId: "impurity", label: "杂质", value: "0.7", unit: "%" },
    ],
    inventory: [
      { fieldId: "soyStock", label: "大豆库存", value: "8,760", unit: "吨" },
      {
        fieldId: "proteinSoyStock",
        label: "其中蛋白豆",
        value: "5,420",
        unit: "吨",
      },
      { fieldId: "stockMoment", label: "统计时点", value: "7月31日 08:00" },
      { fieldId: "inventoryNature", label: "库存性质", value: "企业商品库存" },
    ],
    sales: [
      {
        fieldId: "salesPrice",
        label: "销售价",
        value: "4,320",
        unit: "元/吨",
        note: "基础价，不含车板、包装与运费",
      },
      {
        fieldId: "screenedPrice",
        label: "车板筛粮价",
        value: "4,360",
        unit: "元/吨",
      },
      {
        fieldId: "towerPrice",
        label: "车板塔粮价",
        value: "4,520",
        unit: "元/吨",
      },
      { fieldId: "salesVolume", label: "本期销售量", value: "620", unit: "吨" },
      { fieldId: "delivery", label: "交付方式", value: "车板交付" },
    ],
  },
  paddy: {
    price: "3,092",
    quantity: "1,860",
    form: "散粮 · 粳稻",
    variety: "龙粳31",
    quality: [
      { fieldId: "moisture", label: "水分", value: "15.2", unit: "%" },
      { fieldId: "milledRiceRate", label: "出米率", value: "68.1", unit: "%" },
      { fieldId: "brownRiceRate", label: "出糙率", value: "78.4", unit: "%" },
      { fieldId: "impurity", label: "杂质", value: "0.8", unit: "%" },
    ],
    inventory: [
      { fieldId: "paddyStock", label: "稻谷库存", value: "12,680", unit: "吨" },
      { fieldId: "riceStock", label: "成品米库存", value: "3,260", unit: "吨" },
      { fieldId: "stockMoment", label: "统计时点", value: "7月31日 08:00" },
      { fieldId: "inventoryNature", label: "库存性质", value: "企业商品库存" },
    ],
    sales: [
      {
        fieldId: "salesPrice",
        label: "销售价",
        value: "5,126",
        unit: "元/吨",
        note: "成品大米基础价，不含车板、包装与运费",
      },
      { fieldId: "salesVolume", label: "本期销售量", value: "386", unit: "吨" },
      { fieldId: "delivery", label: "交付方式", value: "出厂自提" },
      { fieldId: "salesGrade", label: "销售质量等级", value: "一级粳米" },
    ],
  },
};

function fieldRows(
  task: MarketTask,
  groupId: MarketFieldGroupKey,
): readonly MarketDocumentField[] {
  const grain =
    task.grain === "agri-input"
      ? marketGrainEntries.corn
      : marketGrainEntries[task.grain];
  const groups: Record<MarketFieldGroupKey, readonly MarketDocumentField[]> = {
    purchase: [
      {
        fieldId: "quote",
        label: task.target === "logistics" ? "即期报价" : "采购价",
        value: grain.price,
        unit: "元/吨",
        note:
          task.target === "logistics"
            ? "站点即期报价"
            : "基础价，不含车板、包装与运费",
      },
      {
        fieldId: "transactionPrice",
        label: task.target === "logistics" ? "即期成交价" : "实际成交价",
        value:
          task.target === "logistics"
            ? "2,332"
            : task.grain === "soybean"
              ? "4,360"
              : task.grain === "paddy"
                ? "3,168"
                : "2,418",
        unit: "元/吨",
        note: "已计入车板、包装与运费",
      },
      {
        fieldId: "purchaseVolume",
        label: "采购量",
        value: grain.quantity,
        unit: "吨",
      },
      {
        fieldId: "wagonPrice",
        label: "车板价",
        value:
          task.target === "logistics"
            ? "2,348"
            : task.grain === "soybean"
              ? "4,312"
              : task.grain === "paddy"
                ? "3,126"
                : "2,382",
        unit: "元/吨",
      },
      {
        fieldId: "freight",
        label: "运费",
        value: task.target === "logistics" ? "86" : "72",
        unit: "元/吨",
      },
      {
        fieldId: "packaging",
        label: "包装形态",
        value: grain.form.includes("袋装") ? "包粮" : "散粮",
      },
      {
        fieldId: "delivery",
        label: "交货方式",
        value: task.target === "logistics" ? "站台交付" : "到厂交货",
      },
      {
        fieldId: "settlement",
        label: "结算条件",
        value: "含税现款 · 过磅结算",
      },
      { fieldId: "productForm", label: "商品形态", value: grain.form },
      { fieldId: "cultivar", label: "品种名称", value: grain.variety },
      { fieldId: "cropYear", label: "作物年度", value: "2025年产" },
    ],
    quality: grain.quality,
    processing: [
      {
        fieldId: "dailyInput",
        label: "日加工投入量",
        value: "420",
        unit: "吨/日",
      },
      {
        fieldId: "runningLines",
        label: "运行生产线",
        value: "2 / 3",
        unit: "条",
      },
      {
        fieldId: "dailyCapacity",
        label: "设计日产能",
        value: "600",
        unit: "吨/日",
      },
      {
        fieldId: "operatingRate",
        label: "开机率",
        value: "70.0",
        unit: "%",
        note: "自动计算",
      },
      {
        fieldId: "mainOutput",
        label: "主产品产出量",
        value: "298",
        unit: "吨/日",
      },
      {
        fieldId: "byproductOutput",
        label: "副产品产出量",
        value: "112",
        unit: "吨/日",
      },
      {
        fieldId: "processingLoss",
        label: "加工损耗",
        value: "10",
        unit: "吨/日",
      },
      { fieldId: "shutdownReason", label: "停机原因", value: "1号线计划检修" },
    ],
    inventory:
      task.role === "agri-dealer"
        ? [
            {
              fieldId: "seedStock",
              label: "种子库存",
              value: "1,180",
              unit: "袋",
            },
            {
              fieldId: "pesticideStock",
              label: "农药库存",
              value: "460",
              unit: "件",
            },
            {
              fieldId: "fertilizerStock",
              label: "化肥库存",
              value: "286",
              unit: "吨",
            },
            {
              fieldId: "stockMoment",
              label: "统计时点",
              value: "7月31日 08:00",
            },
          ]
        : [
            ...grain.inventory,
            { fieldId: "owner", label: "货权人", value: task.targetName },
            {
              fieldId: "storage",
              label: "保管库点",
              value: `${task.region}一号库区`,
            },
            { fieldId: "batch", label: "库存批次", value: "2025-C-0731-01" },
            {
              fieldId: "custodian",
              label: "保管责任方",
              value: task.targetName,
            },
          ],
    sales:
      task.role === "agri-dealer"
        ? [
            { fieldId: "category", label: "商品类别", value: "种子" },
            {
              fieldId: "commodity",
              label: "商品名称 / 品种",
              value: "德美亚3号",
            },
            {
              fieldId: "salesPrice",
              label: "销售价格",
              value: "48",
              unit: "元/袋",
            },
            {
              fieldId: "salesVolume",
              label: "本期销售量",
              value: "326",
              unit: "袋",
            },
            { fieldId: "packageSpec", label: "包装规格", value: "25 公斤/袋" },
          ]
        : grain.sales,
    movement:
      task.role === "road-node"
        ? [
            {
              fieldId: "roadInflow",
              label: "公路流入量",
              value: "5,480",
              unit: "吨",
            },
            {
              fieldId: "roadOutflow",
              label: "公路流出量",
              value: "6,920",
              unit: "吨",
            },
            { fieldId: "packaging", label: "包装形态", value: "散粮" },
            { fieldId: "origin", label: "主要起点", value: "扎兰屯市周边" },
            {
              fieldId: "destination",
              label: "主要目的地",
              value: "黑龙江南部",
            },
          ]
        : [
            {
              fieldId: "railArrival",
              label: "铁路到达量",
              value: "8,260",
              unit: "吨",
            },
            {
              fieldId: "railDispatch",
              label: "铁路发运量",
              value: "12,580",
              unit: "吨",
            },
            { fieldId: "packaging", label: "包装形态", value: "散粮" },
            { fieldId: "origin", label: "主要起点", value: "讷河市、龙江县" },
            {
              fieldId: "destination",
              label: "主要目的地",
              value: "辽宁鲅鱼圈",
            },
          ],
    evidence:
      task.role === "road-node"
        ? [
            { fieldId: "transportBatches", label: "运输批次", value: "12 批" },
            {
              fieldId: "matchedWaybills",
              label: "已匹配运单",
              value: "36 / 38",
              unit: "张",
            },
            {
              fieldId: "weighingEvidence",
              label: "过磅凭证",
              value: "已上传 38 张",
            },
            {
              fieldId: "source",
              label: "数据来源",
              value: "公路运单与过磅记录",
            },
          ]
        : [
            { fieldId: "waybillBatches", label: "运单批次", value: "3 批" },
            {
              fieldId: "matchedWaybills",
              label: "已匹配运单",
              value: "18 / 20",
              unit: "张",
            },
            {
              fieldId: "weighingEvidence",
              label: "过磅凭证",
              value: "已上传 20 张",
            },
            {
              fieldId: "source",
              label: "数据来源",
              value: "铁路运单与站点台账",
            },
          ],
  };
  return groups[groupId];
}

const subjectSourceRows = [
  { name: "企业仓储库存台账", detail: "今日 12:48 · 426条", state: "待审核" },
  { name: "米厂生产日报", detail: "今日 11:32 · 292条", state: "5项异常" },
] as const;

const logisticsSourceRows = [
  { name: "铁路货运运单数据", detail: "今日 13:04 · 438条", state: "审核通过" },
  { name: "公路过磅与运单数据", detail: "今日 12:56 · 130条", state: "待审核" },
] as const;

function channels(task: MarketTask): readonly MarketCollectionChannel[] {
  const sourceRows =
    task.target === "subject" ? subjectSourceRows : logisticsSourceRows;
  return [
    {
      mode: "online",
      label: "在线填报",
      sourceDetail: "责任人在线维护当前角色适用字段和来源凭证",
      validationResult: "保存时执行字段、单位、对象范围和重复数据校验",
      instruction: "继续填写并补齐待提交依据",
      sourceRows: [],
    },
    {
      mode: "excel",
      label: "电子表格批量导入",
      sourceDetail: "地区、期间、责任人和监测对象已经锁定",
      validationResult: "最近预检 228 行：通过 215 行、警告 8 行、错误 5 行",
      instruction: "上传后先预检，错误定位到工作表、行和列，不直接提交",
      sourceRows: [],
      importRowLimit: 5000,
      importSummary: { total: 228, accepted: 215, warnings: 8, errors: 5 },
    },
    {
      mode: "system",
      label: "授权系统接入",
      sourceDetail: "系统接入只改变数据来源，不改变责任、校验和审核流程",
      validationResult: "失败记录不会自动改为零值，确认后进入同一业务单据",
      instruction: "查看最近同步、待确认异常与接入来源",
      sourceRows,
      systemSummary:
        task.target === "subject"
          ? {
              received: 718,
              accepted: 684,
              pending: 29,
              failed: 5,
              latestLabel: "今天 12:48",
            }
          : {
              received: 568,
              accepted: 557,
              pending: 9,
              failed: 2,
              latestLabel: "今天 13:04",
            },
    },
  ];
}

function validation(task: MarketTask): MarketDocumentFixture["validation"] {
  const hasPurchase = getApplicableFieldGroups(task.role, task.grain).some(
    ({ key }) => key === "purchase",
  );
  if (task.role === "agri-dealer") {
    return {
      title: "商品、规格和计量口径",
      detail: "种子品种、农资商品、价格单位和数量已关联",
      pendingEvidence: "2项商品规格或进货凭证待补充",
    };
  }
  if (hasPurchase) {
    return {
      title: "价格与计价条件",
      detail: "品种、质量和交付条件已关联",
      pendingEvidence:
        task.role === "rail-node"
          ? "2张铁路运单尚未匹配"
          : "质量检验单尚未上传",
    };
  }
  return {
    title: "流向与数量口径",
    detail: "起点、终点和运输方向已填写",
    pendingEvidence: "2张公路运单尚未匹配",
  };
}

export const marketDocumentFixtures: readonly MarketDocumentFixture[] =
  marketTasks.map((task) => {
    const workItem = businessWorkFixtures.find(
      ({ workId }) => workId === task.workId,
    );
    if (!workItem) throw new Error("市场任务缺少共享工作项");
    let fieldIndex = 0;
    return {
      documentId: `DOCUMENT-${task.id}`,
      workId: task.workId,
      documentLabel: `${task.targetName}第 31 周市场监测单`,
      objectName: task.targetName,
      businessPeriodLabel: "2026 年第 31 周",
      lastSavedLabel: `今天 13:02 · ${task.owner}`,
      fieldGroups: [
        ...getApplicableFieldGroups(task.role, task.grain),
        ...(task.workId === "WORK-MARKET-FILL-W31"
          ? [{ key: "evidence" as const, label: "来源与凭证" }]
          : []),
      ].map(({ key, label }) => ({
        groupId: key,
        label,
        fields: fieldRows(task, key).map((field) => {
          const currentIndex = fieldIndex;
          fieldIndex += 1;
          return {
            ...field,
            countsTowardCompletion: currentIndex < workItem.applicableFields,
            requiresConfirmation:
              currentIndex >= workItem.completedFields &&
              currentIndex < workItem.applicableFields,
          };
        }),
      })),
      validation: validation(task),
      collectionChannels: channels(task),
    };
  });
