import { Route, Routes } from "react-router";
import { lazy, Suspense } from "react";
import { EnterpriseShell } from "@/app/shell/EnterpriseShell";

const OverviewPage = lazy(() =>
  import("@/pages/OverviewPage").then((module) => ({
    default: module.OverviewPage,
  })),
);
const StackCompatibilityPage = lazy(() =>
  import("@/app/compatibility/StackCompatibilityPage").then((module) => ({
    default: module.StackCompatibilityPage,
  })),
);
const ModuleLandingPage = lazy(() =>
  import("@/pages/ModuleLandingPage").then((module) => ({
    default: module.ModuleLandingPage,
  })),
);
const ObjectDocumentPage = lazy(() =>
  import("@/pages/ObjectDocumentPage").then((module) => ({
    default: module.ObjectDocumentPage,
  })),
);
const ReviewQueuePage = lazy(() =>
  import("@/pages/ReviewQueuePage").then((module) => ({
    default: module.ReviewQueuePage,
  })),
);
const TaskInboxPage = lazy(() =>
  import("@/pages/TaskInboxPage").then((module) => ({
    default: module.TaskInboxPage,
  })),
);

export function AppRouter() {
  return (
    <EnterpriseShell>
      <Suspense fallback={<div role="status">正在加载业务页面</div>}>
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route
            path="/production/tasks"
            element={<TaskInboxPage domain="production-monitoring" />}
          />
          <Route
            path="/market/tasks"
            element={<TaskInboxPage domain="market-monitoring" />}
          />
          <Route path="/review" element={<ReviewQueuePage />} />
          <Route
            path="/objects/:objectId/documents/:documentId"
            element={<ObjectDocumentPage />}
          />
          <Route
            path="/system/compatibility"
            element={<StackCompatibilityPage />}
          />
          <Route
            path="/production/*"
            element={
              <ModuleLandingPage
                title="产情监测"
                responsibility="样本主体和产情分析将在产情子项目中接入"
              />
            }
          />
          <Route
            path="/market/*"
            element={
              <ModuleLandingPage
                title="市场监测"
                responsibility="企业、站点、权威台账和市场分析将在市场子项目中接入"
              />
            }
          />
          <Route
            path="/supply-demand/*"
            element={
              <ModuleLandingPage
                title="供需平衡"
                responsibility="只读计算结果和单元格血缘将在供需子项目中接入"
              />
            }
          />
          <Route
            path="/situation/*"
            element={
              <ModuleLandingPage
                title="态势监控"
                responsibility="实时监控平台与区域地图将在态势子项目中接入"
              />
            }
          />
          <Route
            path="/governance/*"
            element={
              <ModuleLandingPage
                title="数据治理"
                responsibility="主数据、指标、单位、表单和质量规则将在治理子项目中接入"
              />
            }
          />
          <Route
            path="/system/*"
            element={
              <ModuleLandingPage
                title="系统管理"
                responsibility="用户、角色、组织、会话和运行健康将在系统管理子项目中接入"
              />
            }
          />
          <Route
            path="*"
            element={
              <ModuleLandingPage
                title="页面不存在"
                responsibility="当前地址没有对应的规范业务能力"
              />
            }
          />
        </Routes>
      </Suspense>
    </EnterpriseShell>
  );
}
