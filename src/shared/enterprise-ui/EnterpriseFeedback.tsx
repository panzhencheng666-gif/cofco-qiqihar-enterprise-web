import { Alert, Button, Empty, Result } from "antd";

export function EnterpriseLoading({ title }: { title: string }) {
  return <Result status="info" title={title} />;
}

export function EnterpriseFailure({
  title,
  description,
  onRetry,
}: {
  title: string;
  description: string;
  onRetry: () => void;
}) {
  return (
    <Alert
      role="alert"
      type="error"
      showIcon
      message={title}
      description={description}
      action={<Button onClick={onRetry}>重新加载</Button>}
    />
  );
}

export function EnterpriseEmpty({ description }: { description: string }) {
  return <Empty description={description} />;
}

export function EnterpriseNotFound({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return <Result status="404" title={title} subTitle={description} />;
}

export function EnterpriseBlocked({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Alert
      role="alert"
      type="error"
      showIcon
      message={title}
      description={description}
    />
  );
}
