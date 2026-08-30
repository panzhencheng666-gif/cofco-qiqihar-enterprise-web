# 本地受管运行副本发布与恢复

## 边界

- 本仓库是业务 Web 源码唯一原件。
- 运行目录由 `COFCO_ENTERPRISE_WEB_ROOT` 指定；未设置时使用当前用户目录下的标准 COFCO 本地运行路径。该目录只是 63182 的受管部署目标，不是第二个源码仓库。
- 发布不复制数据库，不改 Backend 或独立 Frontend，也不生成静态业务数据；63182 继续通过同源代理读取 8090 权威服务。

## 发布

确认 `node --version` 为 Node 24 后执行：

```bash
npm run publish:local-runtime -- --manifest /absolute/path/to/release-manifest.json
```

也可显式设置命名环境变量 `COFCO_RELEASE_MANIFEST_PATH`。新流程没有无 manifest 的兼容分支：路径缺失、文件不存在、符号链接、未知字段、自哈希不符，或 `environment` 不是精确的 `local`、`candidate`、`non-production` 时，发布在构建和切换前失败；`production` 不能冒充本地候选。

命令按固定顺序执行 release-manifest/local-runtime 脚本测试、六个分析页聚焦测试、Node 24 构建、bundle budget、格式与静态检查。构建后重新核对当前 Web 仓库的 origin、不可变 HEAD、干净状态、完整 `dist`、关键 bundle、合同、配置、SBOM 与 `package-lock.json` 等 manifest 绑定，再在 runtime 同级目录准备独立候选副本。63182 的受管启动器当前执行 Vite 开发服务，因此候选副本同步启动所需的项目源码、配置和构建后的 `dist`；不会复制 `.git`、本机 `.env`、coverage、历史 evidence、测试报告或源码 `node_modules`。依赖锁文件一致时复用受管副本的独立依赖目录。运行目录仍只是由本脚本覆盖和校验的部署目标，禁止在其中继续开发。

候选副本包含只读 canonical `.cofco-release-manifest.json`；`.cofco-runtime-release.json` 记录该 manifest 的 SHA-256、releaseId、environment、Backend/Frontend/Web 三仓 commit、自哈希和逐文件 SHA-256/字节数，并固定标记 `local-web-only`，不能替代完整三仓 manifest。发布锁阻止并发切换；路径穿越、符号链接、读取期间变化、源码/资产/metadata 漂移均失败。只有候选清单核对成功后才切换目录并重启受管服务；随后验证 8090/63182 健康、同源 API 和产情分析、市场分析、供需平衡三条只读浏览器路由。任一验证失败都会恢复原运行目录、清理失败候选并重新拉起原服务，不覆盖最近一次成功 runtime。

单独复核当前受管副本：

```bash
npm run verify:local-runtime
```

默认验证只读取 runtime 内 canonical manifest，复核自哈希、manifest-bound runtime metadata、Web 全量构建资产和关键文件，并明确输出 `local-web-only`；这不是三仓激活证据。需要额外复核三仓 runtime 绑定时，必须同时显式提供：

```bash
export COFCO_ENTERPRISE_BACKEND_ROOT=/absolute/path/to/backend-runtime
export COFCO_ENTERPRISE_FRONTEND_ROOT=/absolute/path/to/frontend-runtime
export COFCO_RUNTIME_NODE_VERSION='v24.x.y'
export COFCO_RUNTIME_NPM_VERSION='11.x.y'
export COFCO_RUNTIME_JDK_VERSION='21.x.y'
npm run verify:local-runtime
```

Backend/Frontend root 只能成对出现；任一缺仓、版本或 manifest 绑定漂移均 fail-closed。即使三仓 runtime 绑定复核通过，结果仍是本地 Web 发布后的绑定证据，不宣称三仓已经联合激活或进入预生产。

## 恢复

成功发布会保留命令输出所示的 `cofco-qiqihar-enterprise-web.previous.*` 目录。需要人工回退时，先停止 `com.cofco.qiqihar.enterprise.local-stack`，核对该备份路径；再将当前 Web runtime 改名留存、把指定备份原子改名回固定 runtime 路径，最后重新启动受管服务并执行 Backend runtime 的 `scripts/healthcheck-local.sh`。恢复后必须执行 `npm run verify:local-runtime`。旧单仓 `.cofco-runtime-release.json` 或缺少 `.cofco-release-manifest.json` 的备份会明确失败；它只能作为紧急人工恢复候选，不能成为新流程发布证据，必须从干净源码与有效三仓 manifest 重新发布后才完成迁移。不要复制或替换数据库，也不要把备份目录作为源码继续修改。
