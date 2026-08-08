import { Alert, Card, Space, Statistic } from "antd";

export interface ReviewSummaryView {
  blocking: number;
  warning: number;
  passed: number;
}

export function EnterpriseReviewPanel({
  quality,
}: {
  quality: ReviewSummaryView;
}) {
  return (
    <Card title="审核与质量">
      <Space direction="vertical" style={{ width: "100%" }}>
        <Space>
          <Statistic title="阻断" value={quality.blocking} />
          <Statistic title="警告" value={quality.warning} />
          <Statistic title="通过" value={quality.passed} />
        </Space>
        <Alert
          type="info"
          showIcon
          message="当前单据仅可查看，暂无可执行审核动作。"
        />
      </Space>
    </Card>
  );
}
