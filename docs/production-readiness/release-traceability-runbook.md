# 三仓发布清单与可追溯运行手册

## 适用边界

本手册只定义 Backend、Frontend、Web 三仓候选版本的生成、校验、激活和回退门禁。它不授权合并 `main`、发布本地运行态、连接云环境或执行数据库操作。JSON Schema 位于 `docs/releases/release-manifest.schema.json`，版本固定为 `schemaVersion: 1`；代码校验器仍负责 canonical 自哈希、秘密扫描、排序、迁移顺序、Git 可达性和逐文件内容绑定等 JSON Schema 无法表达的语义。

清单必须同时绑定三仓的官方 origin、完整 commit SHA、Git ref、构建工具版本、构建产物、完整前端资产、关键 bundle、数据库迁移、合同、配置、SBOM、依赖锁和不可变容器 digest。所有对象均拒绝未知字段；路径必须是仓库内安全相对路径；清单和运行态均不得含密码、Token、私钥、数据库、业务导出或测试账号。

## 当前基线与 non-release fixture

当前 D1/D2a/D2b/D2c 尚在 Web 任务分支，不能与未合并的 Task A/B/C 分支拼成正式候选。CLI 只允许以下两种生成结果：

- `environment: non-release-fixture` 且 `releaseId` 明确包含 `fixture`；用于确定性自动化测试，不是候选发布物。
- `candidate` 或 `preproduction-candidate`；三仓必须使用官方 origin、`refs/heads/main`，且每个 commit 必须精确等于实时 `origin/main` tip。任一仓仍在任务分支时都会失败关闭。

仓库中的 `scripts/release-manifest.spec.mjs` 会临时创建三座无秘密的最小 Git 仓库，确定性生成 `non-release-fixture`，再验证 schema、代码、CLI 和 runtime 漂移拒绝。仓库不提交一个可能被误认成生产候选的静态 manifest。

## 最终三仓准备条件

只有 Task A/B/C/D 均经 PR 进入各自 `origin/main` 后才能准备真实候选。三个源码根目录必须相互独立、无符号链接、工作树干净，并分别满足：

```bash
git fetch --prune origin
test "$(git branch --show-current)" = main
test -z "$(git status --porcelain)"
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"
git rev-list --left-right --count HEAD...origin/main
```

最后一条必须输出 `0 0`。Backend 必须准备已验证 JAR、连续且不可变的 Flyway `V<number>__*.sql`、合同、配置、SBOM、依赖锁和不可变镜像 digest；Frontend/Web 必须准备完整 `dist`、关键 bundle、合同、配置、SBOM、`package-lock.json` 和不可变镜像 digest。descriptor 只通过受控 JSON 文件提供这些路径和证据引用，不把值拼进 shell 命令。

规定工具链为 Node 24、npm 11、JDK 21。本机已定位的 JDK 21 是 Homebrew `openjdk@21`：

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export PATH="$JAVA_HOME/bin:$PATH"
java -version
javac -version
node --version
npm --version
```

在本机的核验版本为 OpenJDK/Javac `21.0.12`、Node `24.19.0`、npm `11.17.0`。系统 `/usr/libexec/java_home` 当前只登记 Corretto 8，因此不得依赖默认 Java 选择器，必须显式设置上面的 `JAVA_HOME`。本轮只取版本证据，没有构建 Backend。

## 生成和静态校验

最终集成后的 descriptor 使用三个正式源码根路径，`ref` 统一为 `refs/heads/main`，`environment` 使用 `candidate` 或 `preproduction-candidate`。生成命令会再次通过 `git ls-remote` 核对精确远端 main SHA，然后由核心生成器核对 origin、HEAD、clean、文件和秘密边界：

```bash
npm run release:manifest -- generate \
  --descriptor /approved/release/release-descriptor.json \
  --output /approved/release/.cofco-release-manifest.json

npm run release:manifest -- validate \
  --manifest /approved/release/.cofco-release-manifest.json
```

CLI 参数只按 argv 解析；descriptor 和 manifest 只按普通文件读取，拒绝符号链接、未知/重复/缺失参数。不要使用 `eval`、`sh -c`、命令替换或字符串拼接来组装这些命令。生成文件采用不可覆盖的原子写入：相同内容可重复确认，不同内容必须换新 release ID 和新路径。

## 构建、同步、激活和验证

候选构建必须先在最终三仓源码集上完成。Backend 使用显式 JDK 21 执行仓库规定的 Maven verify；Frontend/Web 使用 Node 24/npm 11 执行 `npm ci` 和各仓 `npm run verify`。生成 manifest 后不得修改被绑定的文件；若重建，必须重新生成新清单。

同步到三仓 staging/runtime 后，在激活前执行完整 runtime 绑定校验：

```bash
npm run release:manifest -- verify \
  --manifest /approved/release/.cofco-release-manifest.json \
  --backend-root /approved/runtime/backend \
  --frontend-root /approved/runtime/frontend \
  --web-root /approved/runtime/web \
  --node-version 24.19.0 \
  --npm-version 11.17.0 \
  --jdk-version 21.0.12
```

本地 Web 受管副本的 build、候选同步和原子 activate 由一个事务命令完成，不提供可绕过校验的独立同步/激活入口：

```bash
npm run publish:local-runtime -- \
  --manifest /approved/release/.cofco-release-manifest.json
npm run verify:local-runtime
```

其完整边界和人工恢复步骤见 `docs/production-readiness/local-runtime-publish.md`。本轮禁止执行上述命令，也没有触碰 8090、63182 或 63200。

预生产的 bundle 同步和 activate 同样由 deploy 事务串行完成；只有外部输入、审批和精确 manifest 都齐备后才允许执行：

```bash
COFCO_PREPROD_APPLY=APPLY_PREPRODUCTION \
  ops/alicloud-preproduction/scripts/deploy.sh apply \
  ops/alicloud-preproduction/config/preproduction.env \
  /approved/release/.cofco-release-manifest.json

ops/alicloud-preproduction/scripts/verify.sh \
  /approved/release/release.env \
  /approved/release/evidence
```

本轮不执行云命令；完整外部参数和隔离条件以 `ops/alicloud-preproduction/README.md` 为准。

## 失败处理与回退

任何 schema、self-hash、origin/main、工作树、文件摘要、迁移顺序、工具版本、runtime 内容或证据不一致都必须停止激活；不得手工改 manifest、忽略未知字段、改用旧单仓 metadata 或在 runtime 内修补源码。修正源码或 descriptor 后，以新 release ID 重新构建、生成、校验和审批。

本地发布事务失败会恢复原 runtime；人工回退只允许选择命令输出保留且可重新通过 manifest 校验的 previous 副本，之后必须执行 `npm run verify:local-runtime`。预生产只允许回到已验证的 `previous` 检查点：

```bash
COFCO_PREPROD_ROLLBACK=ROLLBACK_PREPRODUCTION \
  ops/alicloud-preproduction/scripts/rollback.sh \
  ops/alicloud-preproduction/config/preproduction.env
```

回退只切换不可变应用制品，不逆向执行破坏性数据库迁移。补偿或回退复验失败时保持失败状态，保存无秘密日志和清单 SHA，停止继续发布并升级人工处置。

## 证据结论边界

本地测试通过只证明代码门禁；分支推送只证明远端任务分支可追溯。它们不等于外部 CI、PR 人工批准、三仓 `main` 集成、签名/证明基础设施、预生产部署、浏览器验收或生产发布。只有真实候选在最终三仓 main、不可变产物、运行态校验和相应外部证据全部闭环后，P1-05 的发布实例证据才完整。
