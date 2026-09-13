# 独立账号工作区与统一顶部：本地预览检查点

阶段范围：仅 web 仓库，stage/2026-09-13-next-development。没有部署公网、推送或合并。

完成：独立 identity.html；真实 session 控制管理入口和页面；共用 EnterprisePlatformHeader；金色稻穗、单行平台标题与标语、三组导航、真实账号；工作台搜索收进可展开图标，取消第二行白色空栏；侧栏深色滚动条及粮仓水印；员工分页及失败状态；授权选项按可见业务员工单位查询，授权检查按服务端返回的可用单位读取。

验证：TypeScript 构建、Vite 双入口构建、改动业务文件 ESLint、git diff --check；4 个相关测试文件 43 项通过；应用组织绑定导航测试 1 项通过。真实 OIDC admin 本地浏览器：员工及六个业务单位读取正常，授权检查不再报错；工作台无空白工具栏，搜索图标展开正常。没有为截图执行邀请、权限变更、复核提交等真实写入。

本地预览：https://localhost:29445/ 与 /identity.html?view=employees。项目任务目录 work/identity-preview.cjs 代理既有 28090 OIDC 后端并提供 dist；不注入身份。现有后台在运行，后端仓库未修改。

注意：此前 Keycloak 登录模板空值导致登录 500，已仅在本地容器中修复 client.baseUrl 默认值，原模板备份保存在任务目录 work/preview-login.original.ftl；此运行时修复不属于 web Git 提交。普通员工入口隔离由组件测试验证，本次浏览器使用实际 admin 会话。正式部署仍需用户确认预览。

后续仅处理用户对这一实际预览的反馈，不重复全系统验证，不切换开发分支。若批准部署，按既有发布流程处理运行环境和回滚。

## 视觉规范收敛（用户确认后）

保持同一阶段分支，重绘轮廓型金色稻穗；共用顶部采用克制深蓝和统一选中状态；人员入口使用人员图标；侧栏粮仓水印压低对比度；账号页统一标题、下划线页签、筛选输入、表格字号间距及主按钮。表单与数据表没有装饰水印。没有更改角色判断、接口或业务写入流程。

本次验证仅 TypeScript、Vite、改动 TSX 的 ESLint、diff 空白检查，以及实际 admin 账号页/工作台截图；没有重复全系统测试。截图保存为任务输出 identity-enterprise-refined.png 与 workbench-enterprise-refined.png。仍是本地预览，未部署公网。
