import {
  createFormalRoute,
  type FormalApplication,
  type FormalRoute,
  type FormalSection,
} from "./formalEnterpriseModel";
import type { BusinessCoordinates } from "./formalEnterpriseModel";
import type { OperationalScope } from "./core/operationalScope";
import { businessClassificationFixtures } from "./formalEnterpriseData";
import {
  WorkspaceScopeBar,
  WorkspaceHeader,
  WorkspaceStatus,
  WorkspaceInlineStats,
  WorkspaceTable,
  WorkspaceTableToolbar,
} from "./UnifiedWorkspacePrimitives";

export function ExecutiveOverviewWorkspace({
  onOpenApplication,
  onOpenRoute,
}: {
  onOpenApplication?: (
    application: FormalApplication,
    section: FormalSection | "overview",
  ) => void;
  onOpenRoute?: (route: FormalRoute) => void;
  scope?: OperationalScope;
  onScopeChange?: (coordinates: Partial<BusinessCoordinates>) => void;
}) {
  function open(route: FormalRoute) {
    if (onOpenRoute) return onOpenRoute(route);
    onOpenApplication?.(route.application, "overview");
  }
  return (
    <div className="unified-workspace" data-classification-source={businessClassificationFixtures.executiveFilters.join(",")}>
      <WorkspaceHeader
        eyebrow="经营门户 / 经营总览"
        title="粮食商情经营总览"
        summary="集中查看已授权的正式指标、业务风险、任务完成情况和最新发布结果。"
        actions={
          <button className="is-primary" type="button">
            查看最新经营月报
          </button>
        }
      />
      <WorkspaceScopeBar
        items={[
          ["组织", "齐齐哈尔经营部"],
          ["业务区域", "三大区域 · 当前授权范围"],
          ["经营期间", "2026 年第 31 周"],
          ["数据截止", "7 月 31 日 17:00"],
        ]}
      />
      <WorkspaceInlineStats
        label="经营核心摘要"
        items={[
          {
            label: "产情正式指标",
            value: "36 项",
            note: "第 30 周正式版本",
            tone: "good",
          },
          {
            label: "市场运行态势",
            value: "79 家已报",
            note: "本期应报 86 家",
            tone: "warning",
          },
          {
            label: "供需账户状态",
            value: "12 项核定",
            note: "14 项账户输入",
            tone: "warning",
          },
          {
            label: "今日业务风险",
            value: "5 项",
            note: "2 项影响正式发布",
            tone: "danger",
          },
        ]}
      />
      <WorkspaceTableToolbar
        title="业务运行摘要"
        note="正式结果、初步结果和待核事项分开显示"
      />
      <WorkspaceTable
        columns={[
          "业务",
          "核心结果",
          "地区与期间",
          "数据状态",
          "风险或缺口",
          "操作",
        ]}
        label="业务运行摘要"
        rows={[
          [
            <div key="production-name">
              <strong>产情正式指标</strong>
              <p>区域估计与质量调查</p>
            </div>,
            "玉米预计单产 468.2 公斤/亩",
            "16 个县区 · 2026 年第 30 周",
            <WorkspaceStatus key="production-status" tone="good">
              正式发布
            </WorkspaceStatus>,
            "样本响应率 92.4%，无发布阻断",
            <button
              className="unified-table-action"
              key="open-production"
              type="button"
              onClick={() => open(createFormalRoute("production", "tasks"))}
            >
              进入产情监测
            </button>,
          ],
          [
            <div key="market-name">
              <strong>市场运行态势</strong>
              <p>价格、库存、加工与物流</p>
            </div>,
            "玉米主流收购价 2,346 元/吨",
            "三大区域 · 2026 年第 31 周",
            <WorkspaceStatus key="market-status" tone="warning">
              初步数据
            </WorkspaceStatus>,
            "79 家已报，7 家待报",
            <button
              className="unified-table-action"
              key="open-market"
              type="button"
              onClick={() => open(createFormalRoute("market", "tasks"))}
            >
              进入市场监测
            </button>,
          ],
          [
            <div key="supply-name">
              <strong>供需账户状态</strong>
              <p>供给、使用、库存与差异解释</p>
            </div>,
            "调整前账面期末 103.9 万吨",
            "三大区域 · 2026/27 年度",
            <WorkspaceStatus key="supply-status" tone="warning">
              待补数据
            </WorkspaceStatus>,
            "两项流向资料待核，库存差异待解释",
            <button
              className="unified-table-action"
              key="open-supply"
              type="button"
              onClick={() => open(createFormalRoute("supply", "calculation"))}
            >
              进入供需账户
            </button>,
          ],
        ]}
      />
      <WorkspaceTableToolbar
        title="经营风险清单"
        note="处置回到所属业务工作区"
      />
      <WorkspaceTable
        columns={["风险事项", "所属业务", "地区", "影响", "当前状态"]}
        label="经营风险清单"
        rows={[
          [
            "讷河市稻谷质量检验单缺失",
            "产情监测",
            "讷河市",
            "阻断正式发布",
            <WorkspaceStatus key="paddy-risk" tone="danger">
              阻断
            </WorkspaceStatus>,
          ],
          [
            "北部县区玉米价差扩大",
            "市场监测",
            "齐齐哈尔北部",
            "需要补充交易依据",
            <WorkspaceStatus key="price-risk" tone="warning">
              待解释
            </WorkspaceStatus>,
          ],
          [
            "区域流向两项资料待核",
            "供需与态势",
            "讷河市",
            "暂不具备正式发布条件",
            <WorkspaceStatus key="supply-risk" tone="warning">
              待核定
            </WorkspaceStatus>,
          ],
        ]}
      />
    </div>
  );
}
