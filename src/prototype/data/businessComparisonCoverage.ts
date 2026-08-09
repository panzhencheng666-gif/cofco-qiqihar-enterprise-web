import type { BusinessClassification } from "../core/businessClassification";

export type BusinessComparisonCoverageField =
  | { field: string; metricIds: readonly string[]; notComparableReason?: never }
  | { field: string; metricIds?: never; notComparableReason: string };

export interface BusinessComparisonCoverage {
  classificationId: BusinessClassification["id"];
  fields: readonly BusinessComparisonCoverageField[];
}

const metric = (
  field: string,
  ...metricIds: string[]
): BusinessComparisonCoverageField => ({ field, metricIds });
const governed = (
  field: string,
  notComparableReason: string,
): BusinessComparisonCoverageField => ({ field, notComparableReason });

export const businessComparisonCoverage: readonly BusinessComparisonCoverage[] =
  [
    {
      classificationId: "production.planting-production",
      fields: [
        metric("播种面积", "production.planted-area"),
        metric("收获面积", "production.harvested-area"),
        metric("弃收或未收获面积", "production.unharvested-area"),
        metric("受灾面积", "production.affected-area"),
        metric("成灾面积", "production.disaster-area"),
        metric("绝收面积", "production.total-loss-area"),
        metric("长势", "production.growth-condition"),
        governed("生育阶段", "属于分类坐标，不作为可加总数值"),
        governed("墒情", "当前无统一跨年量纲"),
        metric("预计总产量", "production.estimated-total-output"),
        metric("总产量", "production.total-output"),
      ],
    },
    {
      classificationId: "production.cost-support",
      fields: [
        metric("亩均成本", "production.cost-per-area"),
        metric("地租", "production.land-rent"),
        metric("种子成本", "production.seed-cost"),
        metric("农药成本", "production.pesticide-cost"),
        metric("化肥成本", "production.fertilizer-cost"),
        metric("灌溉成本", "production.irrigation-cost"),
        metric("人工成本", "production.labor-cost"),
        metric("机耕成本", "production.machinery-cost"),
        governed("现金支出", "现金支出口径等待成本规则批准"),
        governed("分摊依据", "属于成本口径坐标"),
        metric("补贴", "production.subsidy"),
        metric("保险", "production.insurance"),
      ],
    },
    {
      classificationId: "production.farmer-stock-sales",
      fields: [
        metric("期初库存", "production.farmer-opening-stock"),
        metric("入库", "production.farmer-stock-inflow"),
        metric("销售", "production.sales-volume"),
        metric("损耗", "production.farmer-stock-loss"),
        metric("期末库存", "production.farmer-stock"),
        metric("销售数量", "production.sales-volume"),
        metric("销售价格", "production.sales-price"),
        governed("买方", "买方属于交易对象维度"),
        governed("质量", "质量属于销售坐标"),
        governed("交付", "交付属于销售坐标"),
      ],
    },
    {
      classificationId: "production.planting-intention",
      fields: [
        metric("意向面积", "production.intended-area"),
        governed("品种调整", "属于品种治理变更"),
        governed("原因", "定性原因不可直接跨年聚合"),
        governed("价格影响", "解释因子不是意向面积结果"),
        governed("成本影响", "解释因子不是意向面积结果"),
      ],
    },
    {
      classificationId: "production.quality-survey",
      fields: [
        metric("水分", "production.quality-moisture"),
        metric("容重", "production.quality-test-weight"),
        metric("杂质", "production.quality-impurity"),
        metric("不完善粒", "production.quality-imperfect-grain"),
        metric("霉变", "production.quality-mildew"),
        metric("毒素", "production.quality-toxin"),
        governed("适用品种质量项目", "属于品种与质量项目治理坐标"),
      ],
    },
    {
      classificationId: "market.quote-trade",
      fields: [
        governed("买卖方向", "属于报价坐标"),
        governed("报价类型", "属于报价坐标"),
        metric("采购价格", "market.purchase-price"),
        metric("成交价格", "market.transaction-price"),
        metric("成交数量", "market.trade-volume"),
        governed("币种", "属于价格坐标"),
        governed("税价", "属于价格坐标"),
        governed("包装", "属于价格坐标"),
        governed("交付", "属于价格坐标"),
        governed("结算", "属于价格坐标"),
        governed("有效时间", "属于报价有效期"),
      ],
    },
    {
      classificationId: "market.quality",
      fields: [
        metric("市场水分", "market.quality-moisture"),
        metric("市场杂质", "market.quality-impurity"),
        governed("报价质量条件", "属于市场指标质量坐标"),
        governed("交易质量条件", "属于市场指标质量坐标"),
        governed("库存批次质量", "属于库存批次坐标"),
        governed("交付质量", "属于交付坐标"),
      ],
    },
    {
      classificationId: "market.inventory",
      fields: [
        metric("期初库存", "market.inventory-opening"),
        metric("入库", "market.inventory-inflow"),
        metric("出库", "market.inventory-outflow"),
        metric("损耗", "market.inventory-loss"),
        metric("期末库存", "market.inventory"),
        governed("库点", "属于设施坐标"),
        governed("仓容", "设施能力不是库存事实"),
        governed("批次", "属于库存批次坐标"),
        governed("库存性质", "属于库存性质坐标"),
      ],
    },
    {
      classificationId: "market.processing",
      fields: [
        metric("原料投入", "market.processing-input"),
        metric("产品产出", "market.processing-output"),
        metric("副产品", "market.byproduct-output"),
        metric("加工损耗", "market.processing-loss"),
        governed("产线", "属于加工设施坐标"),
        metric("产能", "market.processing-capacity"),
        metric("开机率", "market.operating-rate"),
      ],
    },
    {
      classificationId: "market.consumption-use",
      fields: [
        metric("直接使用", "market.direct-use"),
        governed("用途依据", "属于来源证据而非可比数值"),
      ],
    },
    {
      classificationId: "market.sales",
      fields: [
        governed("产品", "属于产品坐标"),
        governed("规格", "属于产品规格坐标"),
        metric("销售量", "market.sales-volume"),
        metric("销售价格", "market.sales-price"),
        governed("客户范围", "属于授权总体坐标"),
      ],
    },
    {
      classificationId: "market.logistics",
      fields: [
        governed("运输方式", "属于物流路线坐标"),
        governed("起讫地点", "属于物流路线坐标"),
        metric("流入", "market.inflow"),
        metric("流出", "market.outflow"),
        metric("运量", "market.freight-volume"),
        metric("运价", "market.freight-rate"),
        governed("过境", "过境定义等待路线规则批准"),
        governed("交付条件", "属于交付坐标"),
      ],
    },
    {
      classificationId: "market.agricultural-input",
      fields: [
        governed("农资品种或规格", "属于商品规格坐标"),
        metric("农资价格", "market.agri-input-price"),
        metric("农资库存", "market.agri-input-inventory"),
        metric("农资销量", "market.agri-input-sales"),
      ],
    },
    {
      classificationId: "supply.supply",
      fields: [
        metric("总供给", "supply.total-supply"),
        governed("期初库存", "当前供需明细尚未形成跨年可比的已核定结果"),
        governed("本地生产", "当前供需明细尚未形成跨年可比的已核定结果"),
        governed("区域外流入", "当前供需明细尚未形成跨年可比的已核定结果"),
        governed("进口", "当前供需明细尚未形成跨年可比的已核定结果"),
        governed("其他供给", "等待业务规则批准"),
      ],
    },
    {
      classificationId: "supply.use-outflow",
      fields: [
        metric("总使用", "supply.total-use"),
        governed("口粮", "当前供需明细尚未形成跨年可比的已核定结果"),
        governed("饲用", "当前供需明细尚未形成跨年可比的已核定结果"),
        governed("种用", "当前供需明细尚未形成跨年可比的已核定结果"),
        governed("加工投入", "当前供需明细尚未形成跨年可比的已核定结果"),
        governed("损耗", "当前供需明细尚未形成跨年可比的已核定结果"),
        governed("区域外流出", "当前供需明细尚未形成跨年可比的已核定结果"),
        governed("出口", "当前供需明细尚未形成跨年可比的已核定结果"),
        metric("其他使用", "supply.other-use"),
      ],
    },
    {
      classificationId: "supply.results",
      fields: [
        metric("调整前账面期末", "supply.book-ending"),
        metric("批准调整", "supply.approved-adjustment"),
        metric("采用后账面期末", "supply.adopted-ending"),
        metric("调查期末", "supply.survey-ending"),
        metric("平衡差额", "supply.inventory-difference"),
      ],
    },
    {
      classificationId: "supply.auxiliary",
      fields: [
        metric("输入覆盖率", "supply.input-coverage-rate"),
        governed("来源数据批次", "属于数据来源关系"),
        governed("合并抵销", "属于合并规则"),
        governed("质量状态", "属于质量管理状态"),
        governed("发布资格", "属于发布审核状态"),
      ],
    },
    {
      classificationId: "operations.obligation-performance",
      fields: [
        metric("报送覆盖率", "operations.coverage-rate"),
        metric("按时率", "operations.on-time-rate"),
        governed("义务状态", "分类状态不作为数值比较"),
      ],
    },
    {
      classificationId: "operations.data-quality",
      fields: [
        metric("质量阻断率", "operations.quality-block-rate"),
        governed("质量状态", "分类状态不作为数值比较"),
      ],
    },
    {
      classificationId: "reporting.production",
      fields: [
        governed(
          "产情监测报告",
          "报告是固定指标结果的发布载体，不是第二份指标事实",
        ),
      ],
    },
    {
      classificationId: "reporting.market",
      fields: [
        governed(
          "市场监测报告",
          "报告是固定指标结果的发布载体，不是第二份指标事实",
        ),
      ],
    },
    {
      classificationId: "reporting.supply",
      fields: [
        governed(
          "供需核算报告",
          "报告是固定指标结果的发布载体，不是第二份指标事实",
        ),
      ],
    },
    {
      classificationId: "reporting.cross-business",
      fields: [
        governed(
          "跨业务综合经营分析",
          "跨业务结论引用各业务已核定指标，不在报告层重复计算",
        ),
      ],
    },
    {
      classificationId: "reporting.duty",
      fields: [governed("履责监督报告", "报告是履责结果的发布载体")],
    },
  ];
