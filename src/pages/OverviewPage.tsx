import { Alert, Card, Col, Row, Statistic, Typography } from "antd";

export function OverviewPage() {
  return (
    <>
      <Typography.Title level={2}>经营总览</Typography.Title>
      <Alert
        type="warning"
        showIcon
        message="当前为独立新系统第一阶段，所有记录均为模拟数据。"
      />
      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="待处理任务" value={2} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="待复核" value={1} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="质量异常" value={1} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="正式发布" value={0} />
          </Card>
        </Col>
      </Row>
    </>
  );
}
