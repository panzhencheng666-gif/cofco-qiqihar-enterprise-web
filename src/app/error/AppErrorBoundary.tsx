import { Alert, Button, Space } from "antd";
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch() {
    reportRenderFailure();
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Alert
        role="alert"
        type="error"
        showIcon
        message="当前页面暂时无法显示"
        description={
          <Space direction="vertical">
            <span>已加载的数据不会因此被修改，请重新加载页面。</span>
            <Button onClick={() => window.location.reload()}>
              重新加载页面
            </Button>
          </Space>
        }
      />
    );
  }
}

export function reportRenderFailure() {
  console.error("page-render-failure");
}
