import type {
  FormalApplication,
  FormalSection,
} from "./formalEnterpriseModel";
import {
  BusinessContextBar,
  CompactMetricStrip,
  WorkspaceHeader,
  WorkspacePanel,
  WorkspaceStatus,
  WorkspaceTable,
} from "./UnifiedWorkspacePrimitives";

export function ExecutiveOverviewWorkspace({
  onOpenApplication,
}: {
  onOpenApplication: (
    application: FormalApplication,
    section: FormalSection,
  ) => void;
}) {
  return (
    <div className="unified-workspace">
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
      <BusinessContextBar
        items={[
          ["组织", "东北区域经营中心"],
          ["业务区域", "三大区域 · 当前授权范围"],
          ["经营期间", "2026 年第 31 周"],
          ["数据截止", "7 月 31 日 17:00"],
        ]}
        state="正式与初步数据已区分"
      />
      <CompactMetricStrip
        metrics={[
          {
            label: "产情正式指标",
            value: "36",
            unit: "项",
            note: "第 30 周正式版本",
            tone: "good",
          },
          {
            label: "市场运行态势",
            value: "79",
            unit: "家已报",
            note: "本期应报 86 家",
            tone: "warning",
          },
          {
            label: "供需账户状态",
            value: "12",
            unit: "项核定",
            note: "14 项账户输入",
            tone: "warning",
          },
          {
            label: "今日业务风险",
            value: "5",
            unit: "项",
            note: "2 项影响正式发布",
            tone: "danger",
          },
        ]}
      />
      <div className="unified-three-column">
        <WorkspacePanel
          kicker="产情"
          title="产情正式指标"
          note="正式区域估计 · 第 30 周"
          actions={
            <button
              type="button"
              onClick={() => onOpenApplication("production", "overview")}
            >
              进入产情监测
            </button>
          }
        >
          <div className="unified-domain-summary">
            <strong>玉米预计单产 468.2 公斤/亩</strong>
            <p>覆盖 16 个县区，样本响应率 92.4%，正式版本已发布。</p>
            <WorkspaceStatus tone="good">正式发布</WorkspaceStatus>
          </div>
        </WorkspacePanel>
        <WorkspacePanel
          kicker="市场"
          title="市场运行态势"
          note="第 31 周初步数据"
          actions={
            <button
              type="button"
              onClick={() => onOpenApplication("market", "overview")}
            >
              进入市场监测
            </button>
          }
        >
          <div className="unified-domain-summary">
            <strong>玉米主流收购价 2,346 元/吨</strong>
            <p>79 家已报，7 家待报；当前结果不得冒充正式周报。</p>
            <WorkspaceStatus tone="warning">初步数据</WorkspaceStatus>
          </div>
        </WorkspacePanel>
        <WorkspacePanel
          kicker="供需"
          title="供需账户状态"
          note="2026/27 年度账户"
          actions={
            <button
              type="button"
              onClick={() => onOpenApplication("supply", "overview")}
            >
              进入供需账户
            </button>
          }
        >
          <div className="unified-domain-summary">
            <strong>调整前账面期末 103.9 万吨</strong>
            <p>两项流向资料待核，库存平衡差额需要解释。</p>
            <WorkspaceStatus tone="warning">待补数据</WorkspaceStatus>
          </div>
        </WorkspacePanel>
      </div>
      <WorkspacePanel
        kicker="跨业务风险"
        title="需要管理层关注"
        note="风险只读展示，处置回到对应业务工作区。"
      >
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
      </WorkspacePanel>
    </div>
  );
}
