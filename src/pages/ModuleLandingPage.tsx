import { Alert, Card, Typography } from "antd";

export function ModuleLandingPage({
  title,
  responsibility,
}: {
  title: string;
  responsibility: string;
}) {
  return (
    <>
      <Typography.Title level={2}>{title}</Typography.Title>
      <Card>
        <Alert
          type="info"
          showIcon
          message="该能力尚未接入正式数据"
          description={`${responsibility}。当前页面只确认导航归属，不产生、修改或伪造业务结果。`}
        />
      </Card>
    </>
  );
}
