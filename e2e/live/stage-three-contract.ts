export const stageThreeRoutes = [
  ["/#/我的工作/待我处理", "待我处理"],
  ["/#/我的工作/待我填报", "待我填报"],
  ["/#/我的工作/待我审核", "待我审核"],
  ["/#/我的工作/退回与异常", "退回与异常"],
  ["/#/我的工作/已办事项", "已办事项"],
  ["/#/经营总览/风险关注", "粮食商情经营总览"],
  ["/#/经营总览/履责情况", "粮食商情经营总览"],
  ["/#/经营总览/结果发布", "粮食商情经营总览"],
  ["/#/产情监测/玉米产情填报", "玉米产情调查表"],
  ["/#/产情监测/大豆产情填报", "大豆产情调查表"],
  ["/#/产情监测/稻谷产情填报", "稻谷产情调查表"],
  ["/#/产情监测/产情任务", "产情任务作业"],
  ["/#/产情监测/调查对象", "产情对象名录"],
  ["/#/产情监测/数据审核", "产情任务作业"],
  ["/#/产情监测/产情分析", "产情年度对比分析"],
  ["/#/市场监测/玉米市场采集", "玉米市场采集表"],
  ["/#/市场监测/大豆市场采集", "大豆市场采集表"],
  ["/#/市场监测/稻谷市场采集", "稻谷市场采集表"],
  ["/#/市场监测/玉米物流监测", "粮食物流节点监测表"],
  ["/#/市场监测/大豆物流监测", "粮食物流节点监测表"],
  ["/#/市场监测/稻谷物流监测", "粮食物流节点监测表"],
  ["/#/市场监测/采集任务", "市场任务作业"],
  ["/#/市场监测/监测对象", "市场监测对象名录"],
  ["/#/市场监测/数据审核", "市场任务作业"],
  ["/#/市场监测/市场分析", "市场年度对比分析"],
  ["/#/供需分析/供需平衡", "实时供需平衡"],
  ["/#/供需分析/计算记录", "实时供需平衡"],
  ["/#/报表中心/业务报告", "业务报告"],
] as const;

export type VisibleActionRow = {
  route: string;
  role: string;
  controlName: string;
  controlType: string;
  enabled: boolean;
  evidenceScenario: string;
  status: "PASS";
};

const buttonEvidence = [
  [/新建|添加|创建/u, "menu-dialog-lifecycle"],
  [/下载.*模板|下载.*清单/u, "xlsx-download-and-import"],
  [/导入/u, "three-domain-xlsx-import"],
  [/导出|生成.*报告|报告预览/u, "scoped-report-preview-export"],
  [/查询|搜索|筛选|应用/u, "empty-partial-filter-query"],
  [/重置|清空/u, "filter-reset"],
  [/上一页|下一页|首页|末页|第.*页/u, "pagination-boundary"],
  [/查看|详情|打开/u, "read-only-detail"],
  [/继续.*填报|补充.*填报|提交|审核|退回|作废/u, "workflow-state-transition"],
  [/计算|核算|测算|试算|确认本次数据来源/u, "supply-calculation"],
  [/发布/u, "result-publication"],
  [/刷新|重试|重新|更新/u, "failure-recovery"],
  [/通知|帮助|用户|账号/u, "shell-tooling"],
  [/关闭|取消|返回/u, "dialog-lifecycle"],
  [/展开|收起|切换/u, "display-toggle"],
  [/保存/u, "manual-entry-save"],
  [/全部|待办|已办|异常/u, "work-scope-tab"],
  [/工作单位/u, "work-unit-context"],
  [/柱状图|折线图|环图|图表|数据点/u, "chart-interaction"],
  [/^(?:玉米|大豆|稻谷)$/u, "product-tab"],
  [
    /产情|市场|物流|供需|报表|工作|待我|经营|监测|采集|分析|平衡|报告|任务|对象|总揽|风险|履责|结果|事项|异常/u,
    "module-navigation",
  ],
] as const;

export function evidenceForControl(
  controlType: string,
  controlName: string,
): string | null {
  if (controlType === "a") return "formal-menu-navigation";
  if (controlType === "select") return "filter-or-form-option";
  if (controlType === "input") return "filter-or-form-input";
  if (controlType === "textarea") return "reason-or-form-input";
  for (const [pattern, evidence] of buttonEvidence) {
    if (pattern.test(controlName)) return evidence;
  }
  return null;
}
