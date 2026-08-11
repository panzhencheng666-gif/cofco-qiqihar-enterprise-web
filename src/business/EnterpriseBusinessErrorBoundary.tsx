import { Component, type ReactNode } from "react";

interface EnterpriseBusinessErrorBoundaryProps {
  children: ReactNode;
}

interface EnterpriseBusinessErrorBoundaryState {
  failed: boolean;
}

export class EnterpriseBusinessErrorBoundary extends Component<
  EnterpriseBusinessErrorBoundaryProps,
  EnterpriseBusinessErrorBoundaryState
> {
  state: EnterpriseBusinessErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): EnterpriseBusinessErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(): void {
    // Production logging is intentionally handled outside the business DOM.
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="enterprise-business-error" role="alert">
        <h1>页面暂时不可用</h1>
        <p>当前页面暂时无法显示，请重新加载或联系系统管理员。</p>
        <button type="button" onClick={() => window.location.reload()}>
          重新加载
        </button>
      </main>
    );
  }
}
