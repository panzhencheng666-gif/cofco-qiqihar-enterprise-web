import { Alert, Button, Card, Space, Statistic } from "antd";

export interface ReviewSummaryView {
  blocking: number;
  warning: number;
  passed: number;
}

export function ReviewPanel({ quality }: { quality: ReviewSummaryView }) {
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
          message="兼容阶段为只读模拟，不发送审核命令。"
        />
        <Space>
          <Button disabled>退回更正</Button>
          <Button type="primary" disabled>
            通过初审
          </Button>
        </Space>
      </Space>
    </Card>
  );
}
