export type ProductionDocumentFieldGroupId =
  | "specific-variety"
  | "area-location"
  | "growth-stage-disaster"
  | "yield-output"
  | "quality-evidence"
  | "stock-sale-use-loss"
  | "planting-intention"
  | "cost-support-insurance"
  | "source-validation";

export interface ProductionDocumentField {
  fieldId: string;
  label: string;
  value: string;
}

export interface ProductionDocumentFieldGroup {
  groupId: ProductionDocumentFieldGroupId;
  label: string;
  fields: readonly ProductionDocumentField[];
}

export interface ProductionCollectionChannel {
  mode: "online" | "excel" | "system";
  label: string;
  sourceDetail: string;
  validationResult: string;
  instruction: string;
}

export interface ProductionDocumentFixture {
  documentId: string;
  workId: string;
  documentLabel: string;
  objectName: string;
  businessPeriodLabel: string;
  lastSavedLabel: string;
  fieldGroups: readonly ProductionDocumentFieldGroup[];
  collectionChannels: readonly ProductionCollectionChannel[];
}

export const productionDocumentFixtures: readonly ProductionDocumentFixture[] =
  [
    {
      documentId: "DOCUMENT-PRODUCTION-W31-01",
      workId: "WORK-PRODUCTION-FILL-W31",
      documentLabel: "第 31 周玉米产情调查单",
      objectName: "讷河市同义镇调查片区",
      businessPeriodLabel: "2026 年第 31 周",
      lastSavedLabel: "2026 年 7 月 31 日 14:26",
      fieldGroups: [
        {
          groupId: "specific-variety",
          label: "具体品种",
          fields: [
            { fieldId: "cultivar", label: "具体品种", value: "京科968" },
            {
              fieldId: "cultivarStatus",
              label: "品种映射状态",
              value: "已核定",
            },
          ],
        },
        {
          groupId: "area-location",
          label: "面积与地块位置",
          fields: [
            { fieldId: "area", label: "监测面积", value: "4,680 亩" },
            {
              fieldId: "location",
              label: "地块位置",
              value: "讷河市同义镇调查片区",
            },
            {
              fieldId: "harvestArea",
              label: "预计收获面积",
              value: "4,590 亩",
            },
            { fieldId: "affectedArea", label: "灾损面积", value: "90 亩" },
          ],
        },
        {
          groupId: "growth-stage-disaster",
          label: "长势、生育阶段与灾情",
          fields: [
            { fieldId: "growth", label: "长势", value: "一类苗占 76%" },
            { fieldId: "stage", label: "生育阶段", value: "灌浆期" },
            { fieldId: "disaster", label: "病虫害与灾情", value: "轻度玉米螟" },
          ],
        },
        {
          groupId: "yield-output",
          label: "测产、单产与产量",
          fields: [
            {
              fieldId: "expectedYield",
              label: "预计单产",
              value: "468.2 公斤/亩",
            },
            {
              fieldId: "sampleResult",
              label: "样本平均结果",
              value: "472.8 公斤/亩",
            },
            {
              fieldId: "regionalEstimate",
              label: "区域加权估计",
              value: "468.2 公斤/亩",
            },
            { fieldId: "yieldRound", label: "测产轮次", value: "第 2 轮" },
            { fieldId: "output", label: "总产量", value: "21,490.4 吨" },
          ],
        },
        {
          groupId: "quality-evidence",
          label: "质量与证据",
          fields: [
            { fieldId: "moisture", label: "水分", value: "14.2%" },
            { fieldId: "testWeight", label: "容重", value: "720 克/升" },
            { fieldId: "toxin", label: "毒素", value: "符合限量要求" },
            { fieldId: "impurity", label: "杂质", value: "1.0%" },
            { fieldId: "imperfectGrain", label: "不完善粒", value: "3.2%" },
            { fieldId: "mildew", label: "霉变", value: "0.4%" },
            { fieldId: "soyProtein", label: "大豆蛋白", value: "本单据不适用" },
            {
              fieldId: "brownRiceRate",
              label: "稻谷出糙率",
              value: "本单据不适用",
            },
            {
              fieldId: "milledRiceRate",
              label: "稻谷出米率",
              value: "本单据不适用",
            },
            {
              fieldId: "evidence",
              label: "现场证据",
              value: "3 张田间照片、1 份测产记录",
            },
          ],
        },
        {
          groupId: "stock-sale-use-loss",
          label: "库存、销售、自用与损耗",
          fields: [
            { fieldId: "openingStock", label: "期初库存", value: "1,260 吨" },
            { fieldId: "stockInflow", label: "入库数量", value: "0 吨" },
            { fieldId: "sales", label: "销售数量", value: "386 吨" },
            { fieldId: "selfUse", label: "自用数量", value: "8 吨" },
            { fieldId: "loss", label: "损耗数量", value: "4 吨" },
            { fieldId: "endingStock", label: "期末余粮", value: "862 吨" },
          ],
        },
        {
          groupId: "planting-intention",
          label: "种植意愿",
          fields: [
            {
              fieldId: "intendedArea",
              label: "下年度意向面积",
              value: "4,720 亩",
            },
            {
              fieldId: "intentionReason",
              label: "调整原因",
              value: "轮作安排与收益预期",
            },
          ],
        },
        {
          groupId: "cost-support-insurance",
          label: "成本、支持、补贴与保险",
          fields: [
            { fieldId: "landRent", label: "地租", value: "480 元/亩" },
            { fieldId: "seedCost", label: "种子费用", value: "74 元/亩" },
            { fieldId: "pesticideCost", label: "农药费用", value: "48 元/亩" },
            {
              fieldId: "fertilizerCost",
              label: "化肥费用",
              value: "196 元/亩",
            },
            { fieldId: "irrigationCost", label: "灌溉费用", value: "32 元/亩" },
            { fieldId: "laborCost", label: "人工费用", value: "86 元/亩" },
            { fieldId: "machineryCost", label: "机耕费用", value: "214 元/亩" },
            { fieldId: "otherCost", label: "其他成本", value: "18 元/亩" },
            { fieldId: "subsidy", label: "补贴", value: "327,600 元" },
            { fieldId: "insurance", label: "保险", value: "187,200 元" },
          ],
        },
        {
          groupId: "source-validation",
          label: "采集来源与校验",
          fields: [
            {
              fieldId: "sourceDetail",
              label: "来源详情",
              value: "责任人在线填报并关联田间测产记录",
            },
            {
              fieldId: "validation",
              label: "校验结果",
              value: "24 项通过，2 项需要补充依据",
            },
          ],
        },
      ],
      collectionChannels: [
        {
          mode: "online",
          label: "在线填报",
          sourceDetail: "责任人在线维护适用字段和来源凭证",
          validationResult: "保存时执行字段、单位和对象范围校验",
          instruction: "继续填写并补齐质量依据",
        },
        {
          mode: "excel",
          label: "Excel批量导入",
          sourceDetail: "使用当前任务模板导入同范围调查记录",
          validationResult: "错误行不入库，可下载逐行校验结果",
          instruction: "下载模板后选择文件进行预检查",
        },
        {
          mode: "system",
          label: "授权系统接入",
          sourceDetail: "接收已授权县级农业生产台账和农技站观测",
          validationResult: "接入记录仍需责任人确认并进入同一审核流程",
          instruction: "查看最近同步与待确认异常",
        },
      ],
    },
  ];
