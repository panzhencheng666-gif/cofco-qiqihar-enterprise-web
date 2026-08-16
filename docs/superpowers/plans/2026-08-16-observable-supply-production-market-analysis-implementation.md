# 可观测供需、产情与市场分析实施计划

> 规格来源：`docs/superpowers/specs/2026-08-16-current-template-observable-balance-and-analysis-design.md`

## 目标

在隔离的 Web 与 Backend 分支内，把“供需平衡、产情分析、市场分析”切换为同一核定事实快照驱动的三个只读实时菜单。供需自动计算且没有人工填报入口；产情、市场按主题展示指标卡、图表、规则化摘要和来源追溯。全程不改冻结候选、不触碰云端。

## 仓库与运行环境

- Web：`/Users/federal/Documents/Codex/2026-08-15/cofco-security-incident-finalization-sol-high/work/observable-analysis-20260816/cofco-qiqihar-enterprise-web`
- Backend：`/Users/federal/Documents/Codex/2026-08-15/cofco-security-incident-finalization-sol-high/work/observable-analysis-20260816/cofco-qiqihar-enterprise-backend`
- 参考前端：同级 `cofco-qiqihar-enterprise-frontend`，只读，不修改。
- Backend 固定 JDK：`/opt/homebrew/Cellar/openjdk@21/21.0.12/libexec/openjdk.jdk/Contents/Home`
- Web 固定 Node：`/Users/federal/.cache/codex-runtimes/codex-primary-runtime/dependencies/node`
- Web 包管理器：上述 Node 目录下 `node_modules/pnpm/bin/pnpm.cjs`

每项任务严格执行 RED → GREEN → REFACTOR；先看到目标测试因缺少行为而失败，再写最小实现。每个任务完成后运行定向测试、`git diff --check` 和 `git status`，形成边界清晰的提交。

## Task 1：建立后端分析领域与纯计算规则

**新增文件**

- `src/main/java/com/cofco/qiqihar/graintrade/analysis/domain/AnalysisQualityState.java`
- `src/main/java/com/cofco/qiqihar/graintrade/analysis/domain/ObservableQuantityInput.java`
- `src/main/java/com/cofco/qiqihar/graintrade/analysis/domain/ObservableSupplyCalculation.java`
- `src/main/java/com/cofco/qiqihar/graintrade/analysis/domain/ObservableSupplyCalculator.java`
- `src/main/java/com/cofco/qiqihar/graintrade/analysis/domain/ProductionSourceBalance.java`
- `src/test/java/com/cofco/qiqihar/graintrade/analysis/domain/ObservableSupplyCalculatorTest.java`

**测试先行**

1. 写失败测试覆盖：公斤转吨、生产端理论期末余粮、勾稽差额、区域供需残差、负残差阻断、关键值缺失不按零、市场采购销售不得进入供需。
2. 运行：

```bash
JAVA_HOME=/opt/homebrew/Cellar/openjdk@21/21.0.12/libexec/openjdk.jdk/Contents/Home \
PATH="/opt/homebrew/Cellar/openjdk@21/21.0.12/libexec/openjdk.jdk/Contents/Home/bin:$PATH" \
mvn -Dtest=ObservableSupplyCalculatorTest test
```

3. 实现只依赖 JDK `BigDecimal` 的纯领域计算；汇总后统一 4 位小数。
4. 再运行同一测试并确认通过。

**提交**：`feat: define observable supply calculation`

## Task 2：建立核定事实快照应用契约

**新增文件**

- `src/main/java/com/cofco/qiqihar/graintrade/analysis/application/ObservableAnalysisScope.java`
- `src/main/java/com/cofco/qiqihar/graintrade/analysis/application/ObservableMetric.java`
- `src/main/java/com/cofco/qiqihar/graintrade/analysis/application/AnalysisCoverage.java`
- `src/main/java/com/cofco/qiqihar/graintrade/analysis/application/AnalysisLineage.java`
- `src/main/java/com/cofco/qiqihar/graintrade/analysis/application/ProductionAnalysisView.java`
- `src/main/java/com/cofco/qiqihar/graintrade/analysis/application/MarketAnalysisView.java`
- `src/main/java/com/cofco/qiqihar/graintrade/analysis/application/LogisticsAnalysisView.java`
- `src/main/java/com/cofco/qiqihar/graintrade/analysis/application/ObservableSupplyView.java`
- `src/main/java/com/cofco/qiqihar/graintrade/analysis/application/ObservableAnalysisSnapshot.java`
- `src/main/java/com/cofco/qiqihar/graintrade/analysis/application/ObservableAnalysisRepository.java`
- `src/main/java/com/cofco/qiqihar/graintrade/analysis/application/ObservableAnalysisService.java`
- `src/test/java/com/cofco/qiqihar/graintrade/analysis/application/ObservableAnalysisServiceTest.java`

**测试先行**

1. 写失败测试固定：查询范围校验、质量状态合并、稳定 `analysisVersion`、事实或方法变化后版本变化、权限校验委托、同一快照同时提供三个菜单的数据。
2. 用内存仓储替身实现服务最小行为，不引入 HTTP 或 JDBC。
3. 运行：

```bash
JAVA_HOME=/opt/homebrew/Cellar/openjdk@21/21.0.12/libexec/openjdk.jdk/Contents/Home \
PATH="/opt/homebrew/Cellar/openjdk@21/21.0.12/libexec/openjdk.jdk/Contents/Home/bin:$PATH" \
mvn -Dtest=ObservableAnalysisServiceTest test
```

**提交**：`feat: define approved fact snapshot contract`

## Task 3：从现有三类核定记录生成快照

**新增/修改文件**

- 新增 `src/main/java/com/cofco/qiqihar/graintrade/analysis/infrastructure/JdbcObservableAnalysisRepository.java`
- 新增 `src/test/java/com/cofco/qiqihar/graintrade/analysis/infrastructure/JdbcObservableAnalysisRepositoryTest.java`
- 如确实需要数据库只读视图，新增 `src/main/resources/db/migration/V121__create_observable_analysis_projection.sql`
- 如使用 V121，新增 `src/test/java/com/cofco/qiqihar/graintrade/analysis/infrastructure/ObservableAnalysisMigrationTest.java`

**事实规则**

- 只读取 `APPROVED + CONFIRMED`；
- 同一业务键只采用最高有效版本；
- 产情预计总产校验面积×单产；
- 产情数量从公斤或吨规范为吨；
- 市场价格与适用购销量按对象类型聚合；
- 库存采用时点语义，年度不求和；
- 物流只计已确认流入/流出，不计在途；
- 生产余粮与市场库存无法证明互斥时返回 `COVERAGE_REVIEW_REQUIRED`，不相加；
- 缺失、重复、身份不可解析、期间冲突保留为阻断原因；
- 来源追溯只返回允许的业务标签，不返回私有身份键。

**测试数据至少覆盖**

- 齐齐哈尔、黑河、呼伦贝尔三个根地区之一及其子级；
- 产情、市场、物流各一条有效记录；
- 草稿、待审、作废记录被排除；
- 年度/月度不重复；
- 旧批准版本被新批准版本替代；
- 库存跨域互斥与不确定两种分支；
- 地区权限隔离。

**定向验证**

```bash
JAVA_HOME=/opt/homebrew/Cellar/openjdk@21/21.0.12/libexec/openjdk.jdk/Contents/Home \
PATH="/opt/homebrew/Cellar/openjdk@21/21.0.12/libexec/openjdk.jdk/Contents/Home/bin:$PATH" \
mvn -Dtest=JdbcObservableAnalysisRepositoryTest,ObservableAnalysisMigrationTest test
```

如果无需迁移，不创建空迁移或占位迁移；如果创建 V121，则验证 fresh `V1→V121` 与 `V120→V121`，绝不修改 V1–V120。

**提交**：`feat: build observable snapshot from approved records`

## Task 4：发布严格只读 HTTP 契约

**新增文件**

- `src/main/java/com/cofco/qiqihar/graintrade/analysis/interfaceadapter/ObservableAnalysisController.java`
- `src/test/java/com/cofco/qiqihar/graintrade/analysis/interfaceadapter/ObservableAnalysisRestIntegrationTest.java`

**接口**

```text
GET /api/v1/observable-analysis/snapshots
```

严格允许 `productCode`、`regionCode`、`surveyYear`、`surveyMonth`、`cultivarCode`、`subjectTypeCode`。未知参数、非法年/月、无权限地区必须失败关闭。接口不提供 POST/PUT/PATCH/DELETE。

**测试先行**

- 合法响应包含 scope/version/quality/production/market/logistics/supply/lineage；
- 价格、数量、单位、缺失原因使用稳定契约；
- 私有字段和技术键静态扫描为零；
- 未授权地区拒绝；
- 网络层没有供需人工写接口。

**验证**

```bash
JAVA_HOME=/opt/homebrew/Cellar/openjdk@21/21.0.12/libexec/openjdk.jdk/Contents/Home \
PATH="/opt/homebrew/Cellar/openjdk@21/21.0.12/libexec/openjdk.jdk/Contents/Home/bin:$PATH" \
mvn -Dtest=ObservableAnalysisRestIntegrationTest test
```

**提交**：`feat: expose read only observable analysis snapshot`

## Task 5：Web 建立快照类型、解析器和仓储方法

**新增/修改文件**

- 新增 `src/platform/api/observableAnalysisContract.ts`
- 新增 `src/platform/api/observableAnalysisContract.spec.ts`
- 修改 `src/platform/api/realtimeBusinessRepository.ts`
- 修改相应 repository 测试文件

**测试先行**

- Zod 严格解析完整合法响应；
- 拒绝缺失版本、非法质量状态、重复来源、非字符串正式小数；
- 拒绝私有身份键和未知顶层契约；
- repository 只发出允许的查询参数；
- 错误保持权限、契约、网络和无数据的差异。

**验证**

```bash
/Users/federal/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  /Users/federal/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pnpm/bin/pnpm.cjs \
  exec vitest run \
  src/platform/api/observableAnalysisContract.spec.ts \
  src/platform/api/realtimeBusinessRepository.spec.ts
```

**提交**：`feat: consume observable analysis snapshot contract`

## Task 6：实现统一可搜索筛选与实时快照状态

**新增/修改文件**

- 新增 `src/business/analysis/ObservableAnalysisFilters.tsx`
- 新增 `src/business/analysis/ObservableAnalysisFilters.spec.tsx`
- 新增 `src/business/analysis/useObservableAnalysisSnapshot.ts`
- 新增 `src/business/analysis/useObservableAnalysisSnapshot.spec.tsx`
- 复用 `src/business/realtime/RealtimeRegionCascadePicker.tsx`
- 必要时修改 `src/business/formal-enterprise.css`

**测试先行**

- 产品、年、月、三地责任地区及子级使用名称搜索；
- 父地区变化清空失效子级；
- 重置回到授权范围和最近有核定数据的期间；
- 没有数据不借用其他范围；
- SSE 范围内事件刷新、范围外事件忽略、重复序号只处理一次；
- 游标缺口完整重取；断线显示明确状态并可重连；
- 组件卸载关闭 EventSource。

**提交**：`feat: add shared analysis scope and realtime state`

## Task 7：把供需菜单替换为只读自动结果

**重写/修改文件**

- 重写 `src/business/realtime/RealtimeSupplyBalancePanel.tsx`
- 重写 `src/business/realtime/RealtimeSupplyBalancePanel.spec.tsx`
- 修改 `src/business/EnterpriseBusinessApplication.tsx`（仅接线需要时）
- 修改 `src/business/formal-enterprise.css`

**测试先行**

- 页面没有数值输入、来源确认、调整、试算和发布按钮；
- 展示状态卡、四个 KPI、供需桥、生产端勾稽、覆盖质量和来源表；
- `AVAILABLE/PARTIAL/COVERAGE_REVIEW_REQUIRED/BLOCKED/NO_APPROVED_DATA` 正确；
- 图表、文字、来源数来自同一 `analysisVersion`；
- 不出现“批准调整”“采用值”、内部字段码和开发术语；
- 断线和刷新状态不遮盖最后数据截止。

**验证**

```bash
/Users/federal/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  /Users/federal/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pnpm/bin/pnpm.cjs \
  exec vitest run src/business/realtime/RealtimeSupplyBalancePanel.spec.tsx
```

**提交**：`feat: render read only observable supply balance`

## Task 8：实现主题化产情分析

**新增/修改文件**

- 新增 `src/business/analysis/ProductionAnalysisPanel.tsx`
- 新增 `src/business/analysis/ProductionAnalysisPanel.spec.tsx`
- 修改 `src/business/ProductionMonitoringWorkspace.tsx`
- 修改 `src/business/ProductionMonitoringWorkspace.spec.tsx`
- 修改 `src/business/formal-enterprise.css`

**测试先行**

- 五个业务区：生产概况、长势与灾损、余粮与去向、质量与成本、下年种植意向；
- 无巨大扁平“分析指标”下拉；
- 只显示产品适用质量字段；
- 图表有可访问名称、表格等价文本和空值说明；
- 规则化摘要只陈述可复核变化；
- 年度趋势作为分区辅助，不作为整页唯一结构。

**提交**：`feat: organize production analysis by business question`

## Task 9：实现主题化市场分析

**新增/修改文件**

- 新增 `src/business/analysis/MarketAnalysisPanel.tsx`
- 新增 `src/business/analysis/MarketAnalysisPanel.spec.tsx`
- 修改 `src/business/MarketMonitoringWorkspace.tsx`
- 修改 `src/business/MarketMonitoringWorkspace.spec.tsx`
- 修改 `src/business/formal-enterprise.css`

**测试先行**

- 六个业务区：价格运行、购销活动、库存监测、流通成本、市场质量、地区与主体对比；
- 不适用购销量的主体不按零参与；
- 收购价、销售价、车板价不混为一个价格；
- 市场购销量不写入供需总量；
- 图表、文字、来源和质量状态使用同一快照；
- 无内部字段码、地区代码墙或开发词汇。

**提交**：`feat: organize market analysis by business question`

## Task 10：跨菜单契约、实时和权限联动验证

**新增/修改文件**

- 新增 `src/business/analysis/ObservableAnalysisIntegration.spec.tsx`
- 扩充 `src/test/java/com/cofco/qiqihar/graintrade/analysis/interfaceadapter/ObservableAnalysisRestIntegrationTest.java`
- 扩充 `src/test/java/com/cofco/qiqihar/graintrade/notification/interfaceadapter/BusinessEventStreamIntegrationTest.java`

**场景**

1. 草稿提交后三个菜单不改变正式值；
2. 审核通过后当前范围事件触发刷新；
3. 三个菜单得到相同 `analysisVersion/dataCutoffAt`；
4. 新版本获批后旧版本退出；
5. 作废后结果回退；
6. 未授权地区拒绝；
7. 两个标签页最终一致；
8. SSE 断开明确提示，重连后补齐游标。

**提交**：`test: verify observable analysis realtime consistency`

## Task 11：全量回归与本地冻结检查点

### Backend

```bash
JAVA_HOME=/opt/homebrew/Cellar/openjdk@21/21.0.12/libexec/openjdk.jdk/Contents/Home \
PATH="/opt/homebrew/Cellar/openjdk@21/21.0.12/libexec/openjdk.jdk/Contents/Home/bin:$PATH" \
mvn test
```

要求：全部测试通过；如果新增迁移，迁移总数和定向升级测试同步更新。

### Web

```bash
NODE_HOME=/Users/federal/.cache/codex-runtimes/codex-primary-runtime/dependencies/node
PATH="$NODE_HOME/bin:$PATH" \
"$NODE_HOME/bin/node" "$NODE_HOME/node_modules/pnpm/bin/pnpm.cjs" test
```

要求：Vitest 全量和现有 Stage 3/5/7/9 门禁全部通过。

### 静态与边界检查

```bash
git diff --check
git status --short --branch
```

核对：

- 两个实现仓库只含已知提交；
- 只读参考前端仍为 detached clean；
- 冻结 release candidate 三仓库无变化；
- 没有秘密、云端配置、镜像、生产迁移或付费服务变更；
- 形成结构化本地检查点，明确“本地证据就绪但未上线”。

**最终提交（如仅剩验证记录）**：`docs: record observable analysis local verification`

## 停止与交接条件

如出现无法说明工作树边界、命令完成后连续两次无状态变化、流断开、两次以上上下文压缩或多个阶段无检查点，立即停止新修改，收取在途命令结果，写明已完成、失败、未完成、分支、未提交文件和风险，随后执行干净接管。不得用交接扩大到云端发布或重复已通过门禁。
