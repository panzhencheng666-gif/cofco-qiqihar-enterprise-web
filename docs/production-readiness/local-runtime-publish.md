# 本地受管运行副本发布与恢复

## 边界

- 本仓库是业务 Web 源码唯一原件。
- 运行目录由 `COFCO_ENTERPRISE_WEB_ROOT` 指定；未设置时使用当前用户目录下的标准 COFCO 本地运行路径。该目录只是 63182 的受管部署目标，不是第二个源码仓库。
- 发布不复制数据库，不改 Backend 或独立 Frontend，也不生成静态业务数据；63182 继续通过同源代理读取 8090 权威服务。

## 发布

确认 `node --version` 为 Node 24 后执行：

```bash
npm run publish:local-runtime
```

命令按固定顺序执行发布脚本测试、六个分析页聚焦测试、Node 24 构建、bundle budget、格式与静态检查，然后在 runtime 同级目录准备独立候选副本。候选副本采用允许清单，只包含构建后的 `dist`、运行所需的包清单、Vite 配置和只读冒烟脚本；不会复制源码、`.git`、`.env.local`、coverage、历史 evidence、测试报告或源码 `node_modules`。依赖锁文件一致时复用受管副本的独立依赖目录。

候选副本生成 `.cofco-runtime-release.json`，逐文件记录 SHA-256 与字节数。只有清单核对成功后才切换目录并重启受管服务；随后验证 8090/63182 健康、同源 API 和产情分析、市场分析、供需平衡三条只读浏览器路由。任一验证失败都会恢复原运行目录并重新拉起原服务。

单独复核当前受管副本：

```bash
npm run verify:local-runtime
```

## 恢复

成功发布会保留命令输出所示的 `cofco-qiqihar-enterprise-web.previous.*` 目录。需要人工回退时，先停止 `com.cofco.qiqihar.enterprise.local-stack`，核对该备份路径；再将当前 Web runtime 改名留存、把指定备份原子改名回固定 runtime 路径，最后重新启动受管服务并执行 Backend runtime 的 `scripts/healthcheck-local.sh`。如果所选备份包含 `.cofco-runtime-release.json`，再执行 `npm run verify:local-runtime`；首次采用本流程前的旧备份没有该清单，只能以受管健康和三页只读浏览器冒烟作为恢复证据。不要复制或替换数据库，也不要把备份目录作为源码继续修改。
