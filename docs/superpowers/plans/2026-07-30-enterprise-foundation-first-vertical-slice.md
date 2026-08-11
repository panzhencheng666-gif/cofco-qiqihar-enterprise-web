# 企业平台基础与首条责任报送垂直链实施计划

> 日期：2026-07-30
> 状态：复审后的分段执行计划
> 总路线：`docs/superpowers/plans/2026-07-30-enterprise-platform-roadmap.md`
> 规格：`docs/specs/2026-07-30-grain-enterprise-unified-business-architecture-spec.md`
> 逻辑模型：`docs/specs/2026-07-30-grain-enterprise-logical-data-model.md`

## 一、目标和成功路径

在全新后端仓库和新前端仓库中完成第一条可鉴权、可追溯、最终可持久化的责任报送链：

```text
浏览器登录
→ 服务端解析账号、权限、数据范围和会话安全版本
→ 由有效任职定位责任岗位
→ 由无时间责任坐标与有效期确定唯一负责人
→ 报送方案、业务日历和期间生成报送义务
→ “我的工作”只返回本人可处理工作
→ 本人保存并提交规范单据
→ 服务端判定时效
→ 同一事务形成追加式审计和事务发件箱
→ 临时 MySQL 重启后仍可读取同一结果
```

计划分为两段：

- **A 段：无数据库。** 完成保护、技术锁、模块、领域、权限、契约和可交互前端。
- **B 段：门禁后持久化。** 只有物理模型进入门禁通过后，才加入 Flyway、JDBC、MySQL Testcontainers 和真实端到端测试。

本计划不实现产情、市场、供需和报告的完整字段，只建立所有业务共用的身份、责任、报送、安全和追溯基础。

## 二、不可违反的边界

- 不修改 `/Users/federal/Desktop/cofco-qiqihar-dashboard-backend`。
- 不连接、读取或修改旧 MySQL 和云 PostgreSQL。
- 不删除或覆盖旧前端、旧后端、旧迁移、旧备份、被忽略文件或用户未提交修改。
- 新前端只能位于 `/Users/federal/Desktop/cofco-qiqihar-enterprise-web`。
- 新后端只能位于 `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend`。
- 新前端与新后端必须是独立 Git 仓库、独立进程、独立端口、独立构建和独立发布制品；开发期可由 Vite 把同源 `/api` 代理到新后端，但不得因此合并源码或部署单元。
- 新前端只能通过版本化 OpenAPI/HTTP 契约调用后端，不包含 Java 业务实现、数据库驱动、SQL、迁移或数据库连接配置；新后端不包含 React、Node.js 界面源码或前端构建产物。
- 新数据库固定标识为 `qiqihar_grain_enterprise_v1`，连接环境变量只允许使用 `QGE_DB_` 前缀。
- 物理模型进入门禁通过前，后端依赖中不得出现数据库驱动、Flyway 或 Testcontainers。
- 门禁通过后，自动测试数据库只允许由 `@ServiceConnection` 注入的一次性 MySQL 容器。
- 不读取开发机遗留 `SPRING_DATASOURCE_*`、`DATABASE_URL`、`MYSQL_*` 或旧系统环境变量。
- 不 push、不部署、不创建远程仓库、不切换生产、不代签准入项。
- 新前端和新后端各只保留一个活动集成分支。
- 普通业务界面全中文；变量名、状态码、接口地址和诊断信息只进入受限运维入口。

## 三、预期目录和模块边界

### 3.1 新后端

```text
/Users/federal/Desktop/cofco-qiqihar-enterprise-backend
├── pom.xml
├── mvnw
├── mvnw.cmd
├── .mvn/wrapper/
├── api/openapi/enterprise-api.yaml
├── config/technology-lock.json
├── ops/physical-model-entry-gate.schema.json
├── docs/security/threat-model-v1.md
├── docs/operations/recovery-and-rollback-design-v1.md
├── docs/architecture/physical-data-model-v1.md
├── docs/architecture/physical-data-model-v1.json
├── src/main/java/com/cofco/qiqihar/enterprise/
│   ├── GrainEnterpriseApplication.java
│   ├── foundation/
│   ├── masterdata/
│   ├── identityorganization/
│   ├── responsibilityreporting/
│   ├── auditops/
│   └── platform/
├── src/main/resources/
│   ├── application.yml
│   ├── application-no-db.yml
│   └── db/migration/                 # 只在 B 段创建
└── src/test/
```

精确依赖方向：

```text
foundation → 无依赖
masterdata → foundation
identityorganization → foundation、masterdata、auditops 的公开接口
auditops → foundation
responsibilityreporting → foundation、masterdata、identityorganization、auditops 的公开接口
platform → 所有业务模块的公开接口
```

`platform` 是 HTTP、安全和配置等外层适配器。任何业务模块不得反向依赖 `platform`，不得跨模块访问 `internal` 包。

### 3.2 新前端

```text
/Users/federal/Desktop/cofco-qiqihar-enterprise-web/src
├── domains/
│   ├── identity-organization/
│   ├── master-data/
│   └── responsibility-reporting/
├── workflows/
│   ├── current-workspace/
│   ├── my-work/
│   └── document-workspace/
├── platform/api/
│   ├── contracts/
│   ├── mock/
│   └── httpEnterpriseGateway.ts
├── shared/enterprise-ui/
├── app/shell/EnterpriseContextBar.tsx
└── pages/MyWorkPage.tsx
```

前端编译依赖方向固定为：

```text
页面与应用外壳 → 工作流和视图状态 → 领域模型
工作流 → 网关端口
HTTP 适配器、模拟适配器 → 网关端口
页面 → 企业界面适配层 → Ant Design、ProComponents
```

网关端口的精确落点为 `src/workflows/enterprise-gateway/port.ts`。适配器实现端口，但端口、工作流和领域不得反向依赖适配器。不得从后端传输对象反向生成前端领域模型。

### 3.3 前后端独立交付边界

```text
浏览器
  → 新前端独立制品（TypeScript、React）
  → 版本化 /api/v1 契约
  → 新后端独立制品（Java、Spring Boot）
  → 仅门禁通过后的新数据库
```

以下检查全部进入架构门禁：

- 两个仓库不得相互嵌套、共享源码目录、复用构建输出或由一个构建工具同时打包；
- 前端依赖清单不得出现 JDBC、Flyway、数据库客户端或 Java 业务包；后端依赖和源码不得出现 React、Refine、Ant Design、ProComponents、Vite 或浏览器状态实现；
- 前端环境变量只允许公开运行配置和新后端基址，不得包含数据库主机、端口、库名、账号、密码或连接串；
- OpenAPI 是跨仓唯一接口事实源；前后端各自生成或校验契约，禁止复制一套手写且可独立漂移的接口模型；
- 本地联调可以同机运行，但停止任一进程必须能够独立定位故障，且不能让另一仓库退化为内嵌模块。

## 四、A 段：无数据库实施

### 任务 1：固化只读保护检查点

**新增：**

- `docs/superpowers/verification/2026-07-30-enterprise-foundation-baseline.md`
- `docs/superpowers/verification/2026-07-30-protected-path-manifest.sha256`
- `docs/superpowers/verification/2026-07-30-zero-database-connection-evidence.md`

**步骤 1：记录仓库状态**

只读记录以下目录的分支、HEAD、已跟踪变化数、未跟踪变化数和 `git status --porcelain=v2` 哈希：

```text
/Users/federal/Desktop/cofco-qiqihar-enterprise-web
/Users/federal/Desktop/cofco-qiqihar-dashboard-frontend
/Users/federal/Desktop/cofco-qiqihar-dashboard-backend
```

输出不得包含文件内容、凭据或连接串。

**步骤 2：建立保护清单**

清单覆盖：

- 旧前端和旧后端全部已跟踪文件；
- `git status --porcelain=v2` 返回的全部未提交路径；
- `git ls-files --others --ignored --exclude-standard` 返回的迁移、备份、SQL、环境配置和证据文件；
- 旧前端、旧后端中路径匹配 `db/migration`、`migrations`、`backup`、`evidence`、`*.sql`、`*.dump`、`*.gz` 的文件。

对文件只记录绝对路径、字节数、修改时间和 SHA-256。环境文件只记录哈希，不读取或回显内容。

**步骤 3：建立零数据库连接证据**

记录：

- 本轮执行命令清单中不存在 `mysql`、`mysqldump`、`psql`、Flyway 和数据库 URL；
- 新后端尚无数据库驱动；
- 执行前后由本轮新进程建立的数据库端口连接数为零；
- 未读取任何数据库秘密。

现有其他进程的连接只能记录数量和进程标识，不中断、不检查连接内容。

**步骤 4：提交边界**

如创建本地提交，只允许精确暂存：

```text
docs/specs/2026-07-30-grain-enterprise-unified-business-architecture-spec.md
docs/specs/2026-07-30-grain-enterprise-logical-data-model.md
docs/superpowers/plans/2026-07-30-enterprise-platform-roadmap.md
docs/superpowers/plans/2026-07-30-enterprise-foundation-first-vertical-slice.md
docs/superpowers/verification/...
```

提交前必须运行 `git diff --cached --name-status` 并逐项核对；禁止 `git add .`、`git add -A` 和 push。

**退出条件：**

- 三个既有工作区状态与开始记录一致；
- 清单可复验；
- 数据库连接次数为零；
- 无旧文件被写入。

### 任务 2：建立无数据库后端骨架和技术锁

**新增后端：**

- `pom.xml`
- `.gitignore`
- `.editorconfig`
- `.java-version`
- `mvnw`
- `mvnw.cmd`
- `.mvn/wrapper/maven-wrapper.properties`
- `.mvn/wrapper/maven-wrapper.jar`
- `config/technology-lock.json`
- `docs/security/threat-model-v1.md`
- `docs/operations/recovery-and-rollback-design-v1.md`
- `src/main/java/com/cofco/qiqihar/enterprise/GrainEnterpriseApplication.java`
- `src/main/resources/application.yml`
- `src/main/resources/application-no-db.yml`
- `src/test/java/com/cofco/qiqihar/enterprise/TechnologyBaselineTests.java`

**步骤 1：先建立可运行测试框架**

使用官方 Maven Wrapper 分发和官方 SHA-256，固定：

- JDK 发行版和 Java 25；
- Maven Wrapper 版本、分发 URL 与 SHA-256；
- Spring Boot 4.1.0；
- Spring Modulith 2.1.0 BOM；
- 所有直接依赖和构建插件的精确版本；
- 构建使用的时区和字符集。

威胁模型至少覆盖身份冒用、会话劫持、越权代填、责任交接竞争、批量导入、敏感导出、幂等重放、旧库误连、配置覆盖和门禁伪造。恢复设计至少固定候选恢复点目标、恢复时间目标、加密备份、密钥职责、保留期、恢复验证、证据目录和回退条件；未演练时明确写“尚未达到”。

本阶段只加入：

- Spring Web MVC；
- Spring Validation；
- Spring Security；
- Argon2id 所需的受支持密码学提供方；
- Spring Actuator；
- Spring Modulith Core、运行时验证和测试；
- JUnit、AssertJ 和 Spring Security Test；
- 计划实际配置的格式、静态检查、依赖审计和覆盖率插件。

本阶段不得加入 Spring JDBC、Spring Session JDBC、MySQL Connector/J、Flyway 和 Testcontainers。

先完成最小启动测试并运行一次绿色基线；从下一步开始才执行红—绿—重构。

**步骤 2：无数据库配置**

`application-no-db.yml` 必须：

- 排除数据源、事务管理器和 Flyway 自动配置；
- 使用业务端口 `63280`；
- 使用独立管理端口 `63281`；
- 只暴露受保护的健康与信息端点；
- 默认时区 `Asia/Shanghai`；
- 结构化日志不记录会话、凭据、请求正文和敏感字段。

**步骤 3：技术基线测试**

测试断言：

1. Java 主版本为 25；
2. `no-db` 上下文可启动；
3. 数据源、Flyway 和 JDBC Bean 数量为零；
4. 旧数据库变量不能进入 Spring Environment；
5. 管理端口与业务端口不同；
6. 技术锁文件与 Maven 有效模型一致；
7. 依赖树不存在旧后端构件和付费 Flyway 构件。

**验证：**

```bash
cd /Users/federal/Desktop/cofco-qiqihar-enterprise-backend
./mvnw -B -ntp -Dspring.profiles.active=no-db test
./mvnw -B -ntp help:effective-pom
./mvnw -B -ntp dependency:tree
```

### 任务 3：建立模块边界和构建门禁

**新增后端：**

- `src/main/java/com/cofco/qiqihar/enterprise/foundation/package-info.java`
- `src/main/java/com/cofco/qiqihar/enterprise/masterdata/package-info.java`
- `src/main/java/com/cofco/qiqihar/enterprise/identityorganization/package-info.java`
- `src/main/java/com/cofco/qiqihar/enterprise/auditops/package-info.java`
- `src/main/java/com/cofco/qiqihar/enterprise/responsibilityreporting/package-info.java`
- `src/main/java/com/cofco/qiqihar/enterprise/platform/package-info.java`
- `src/test/java/com/cofco/qiqihar/enterprise/ArchitectureModuleTests.java`
- `docs/architecture/backend-module-structure.md`

**红灯测试：**

- 模块名称精确等于六个预期模块；
- 依赖方向精确符合第 3.1 节；
- 模块无环；
- 外部模块不能访问 `internal`；
- `platform` 可以适配业务公开接口，但业务模块不能依赖 `platform`。
- 公开接口使用领域值对象，不暴露 Spring、Servlet、JDBC 或传输对象；
- 不允许只有逐字段转发的空应用层、通用工具大杂烩和跨模块共享可变状态。

**实现：**

- `foundation` 只保存无基础设施依赖的值对象；
- 每个业务模块根包只保存公开接口、公开事件和模块声明；
- 实现放在 `internal`；
- HTTP、Spring Security、环境配置和数据库防护放在 `platform`。
- 对每个公开接口记录不变量、错误、权限、顺序和性能特征；内部复杂度不得扩散给调用方。

**验证：**

```bash
./mvnw -B -ntp -Dtest=ArchitectureModuleTests test
```

### 任务 4：建立物理模型门禁模式和连接前防护

**新增后端：**

- `ops/physical-model-entry-gate.schema.json`
- `ops/trusted-gate-signers.json`
- `src/main/java/com/cofco/qiqihar/enterprise/platform/bootstrap/VerifiedGrainEnterpriseLauncher.java`
- `src/main/java/com/cofco/qiqihar/enterprise/platform/database/PhysicalModelGate.java`
- `src/main/java/com/cofco/qiqihar/enterprise/platform/database/DatabaseConnectionPreflight.java`
- `src/main/java/com/cofco/qiqihar/enterprise/platform/database/TrustedGateSignerRegistry.java`
- `src/test/java/com/cofco/qiqihar/enterprise/platform/database/PhysicalModelGateTests.java`
- `src/test/java/com/cofco/qiqihar/enterprise/platform/database/DatabaseConnectionPreflightTests.java`
- `src/test/java/com/cofco/qiqihar/enterprise/platform/database/VerifiedLauncherTests.java`

**新增前端验证材料：**

- `docs/superpowers/verification/physical-model-entry-gate.example.json`

**红灯测试：**

1. 门禁文件缺失、模式错误、签署项缺失或文档哈希变化时拒绝；
2. 数据库名不是 `qiqihar_grain_enterprise_v1` 时拒绝；
3. 连接配置不是全部来自 `QGE_DB_` 前缀时拒绝；
4. 命中旧库名、旧账号、旧地址或旧连接指纹黑名单时拒绝；连接指纹固定包含协议、规范化主机、端口、数据库名、账号、传输安全配置和环境，并使用外置密钥的 HMAC-SHA-256、密钥标识和轮换版本；
5. `DATABASE_URL`、`SPRING_DATASOURCE_*`、`MYSQL_*`、`SPRING_APPLICATION_JSON`、`SPRING_CONFIG_IMPORT`、数据库系统属性或命令行覆盖存在时拒绝；
6. 环境不是显式允许的 `ephemeral-test` 或经签署的新环境时拒绝；
7. 门禁规范化清单的分离式数字签名必须由受控公钥、签署角色和有效轮换记录验证；只有签署标识而没有有效签名时拒绝；
8. 所有拒绝都发生在 `SpringApplication.run`、Spring 配置导入、驱动加载或网络套接字之前；
9. 直接调用普通应用类、其他 Spring 配置、数据库启用 Maven 配置或打包入口都不能绕过验证；
10. 日志只返回中文拒绝原因和关联号，不回显连接值、HMAC 密钥或签名私钥。

唯一可执行入口固定为 `VerifiedGrainEnterpriseLauncher`：它使用最小 JDK 能力读取原始进程参数并完成预检，只有通过后才调用 `SpringApplication.run`。打包清单只指向该入口；普通应用配置不提供第二个可执行 `main`。数据库启用 Maven 配置在 `validate` 和 `verify` 阶段强制运行同一门禁验证，且不配置可绕过的 Flyway Maven 直连目标。可信签署人清单只保存公钥、角色、有效期和轮换记录，私钥与 HMAC 密钥均在仓库外。

本任务只实现纯配置验证和不可绕过执行挂点，不加入数据库依赖，不创建通过版门禁，不代签。

**验证：**

```bash
./mvnw -B -ntp \
  -Dtest=PhysicalModelGateTests,DatabaseConnectionPreflightTests,VerifiedLauncherTests test
```

### 任务 5：建立最小版本化主数据

**新增后端：**

- `src/main/java/com/cofco/qiqihar/enterprise/foundation/EffectiveInterval.java`
- `src/main/java/com/cofco/qiqihar/enterprise/foundation/ExpectedVersion.java`
- `src/main/java/com/cofco/qiqihar/enterprise/masterdata/AdministrativeRegionId.java`
- `src/main/java/com/cofco/qiqihar/enterprise/masterdata/AdministrativeRegionVersion.java`
- `src/main/java/com/cofco/qiqihar/enterprise/masterdata/ProductId.java`
- `src/main/java/com/cofco/qiqihar/enterprise/masterdata/ProductVersion.java`
- `src/main/java/com/cofco/qiqihar/enterprise/masterdata/UnitDefinitionId.java`
- `src/main/java/com/cofco/qiqihar/enterprise/masterdata/UnitDefinition.java`
- `src/main/java/com/cofco/qiqihar/enterprise/masterdata/UnitConversionVersion.java`
- `src/main/java/com/cofco/qiqihar/enterprise/masterdata/RegionHierarchy.java`
- `src/test/java/com/cofco/qiqihar/enterprise/masterdata/VersionedMasterDataTests.java`
- `src/test/java/com/cofco/qiqihar/enterprise/masterdata/RegionHierarchyTests.java`

**红灯测试：**

- 有效期为左闭右开且不能倒置；
- 相邻版本允许，重叠版本拒绝；
- 责任范围只能引用有效行政区划、产品和单位版本；
- 父区域可以稳定展开到互不重叠的叶子；
- 行政村类型与自然村类型不可混用；
- 产品“全部”只能由明确范围展开，不能使用隐式通配字符串。

**实现原则：**

- 主数据版本不可覆盖；
- 业务事实引用稳定标识和当时版本；
- 本任务使用内存仓储端口，不持久化。

### 任务 6：建立身份、权限、会话和当前工作空间

**新增后端：**

- `src/main/java/com/cofco/qiqihar/enterprise/identityorganization/PersonId.java`
- `src/main/java/com/cofco/qiqihar/enterprise/identityorganization/AccountId.java`
- `src/main/java/com/cofco/qiqihar/enterprise/identityorganization/OrganizationUnitId.java`
- `src/main/java/com/cofco/qiqihar/enterprise/identityorganization/ResponsibilityPositionId.java`
- `src/main/java/com/cofco/qiqihar/enterprise/identityorganization/ResponsibilityPosition.java`
- `src/main/java/com/cofco/qiqihar/enterprise/identityorganization/AppointmentId.java`
- `src/main/java/com/cofco/qiqihar/enterprise/identityorganization/PermissionId.java`
- `src/main/java/com/cofco/qiqihar/enterprise/identityorganization/RoleId.java`
- `src/main/java/com/cofco/qiqihar/enterprise/identityorganization/EffectiveAppointment.java`
- `src/main/java/com/cofco/qiqihar/enterprise/identityorganization/RolePermissionVersion.java`
- `src/main/java/com/cofco/qiqihar/enterprise/identityorganization/RoleGrantSubject.java`
- `src/main/java/com/cofco/qiqihar/enterprise/identityorganization/RoleGrant.java`
- `src/main/java/com/cofco/qiqihar/enterprise/identityorganization/DataAccessScope.java`
- `src/main/java/com/cofco/qiqihar/enterprise/identityorganization/SegregationRule.java`
- `src/main/java/com/cofco/qiqihar/enterprise/identityorganization/SecuritySession.java`
- `src/main/java/com/cofco/qiqihar/enterprise/identityorganization/CurrentActor.java`
- `src/main/java/com/cofco/qiqihar/enterprise/identityorganization/CurrentWorkspace.java`
- `src/main/java/com/cofco/qiqihar/enterprise/identityorganization/IdentityAccess.java`
- `src/main/java/com/cofco/qiqihar/enterprise/auditops/SecurityAuditEvent.java`
- `src/main/java/com/cofco/qiqihar/enterprise/auditops/SecurityAuditPort.java`
- `src/test/java/com/cofco/qiqihar/enterprise/identityorganization/IdentityAuthorizationTests.java`
- `src/test/java/com/cofco/qiqihar/enterprise/identityorganization/SessionRevocationTests.java`
- `src/test/java/com/cofco/qiqihar/enterprise/identityorganization/CurrentWorkspaceTests.java`

**红灯测试：**

1. 账号、人员、责任岗位和任职标识不能混用；任职必须引用一个责任岗位；
2. 停用、锁定或失效账号不能登录；
3. 角色授权主体排他地引用账号或责任岗位，角色授权、角色权限和数据范围按各自有效期解析；
4. 缺权限、缺数据范围或缺责任时默认拒绝；
5. 管理员拥有管理权限不等于拥有业务代填责任；
6. 会话记录账号安全版本；密码变更、账号停用、角色撤销或强制登出后，下一次请求拒绝；
7. 登录轮换会话标识，退出和超时使会话失效；
8. 当前工作空间只返回当前有效组织、地区、年度和用户可见能力；
9. 填报、审核和发布职责分离；
10. 登录失败计数、账号/IP 组合限流、渐进延迟和锁定不泄漏账号是否存在；
11. 密码使用技术锁与威胁模型批准的版本化 Argon2id 参数和外置密钥材料，验证成功后按新参数升级摘要；
12. 会话同时执行空闲超时和绝对超时，敏感导出、安全设置和账号恢复要求近期再次认证；
13. 登录、失败、拒绝、撤权、恢复、导出和敏感访问形成安全审计，不与业务审计混用。

**无数据库实现：**

- 使用明确的内存身份适配器；
- 密码只使用测试哈希，不在代码或文档保存真实凭据；
- 账号恢复使用一次性、短时、不可回显的恢复凭据并吊销既有会话；
- Cookie 规则固定为 HttpOnly、同源、生产 Secure、合理 SameSite；
- 状态写请求要求防跨站请求伪造令牌；
- 页面导航不参与授权判定。

### 任务 7：建立无时间责任坐标、指派和交接申请

**新增后端：**

- `src/main/java/com/cofco/qiqihar/enterprise/responsibilityreporting/ResponsibilityScopeKey.java`
- `src/main/java/com/cofco/qiqihar/enterprise/responsibilityreporting/ResponsibilityScopeLeaf.java`
- `src/main/java/com/cofco/qiqihar/enterprise/responsibilityreporting/ResponsibilityScopeVersion.java`
- `src/main/java/com/cofco/qiqihar/enterprise/responsibilityreporting/ResponsibilityAssignmentId.java`
- `src/main/java/com/cofco/qiqihar/enterprise/responsibilityreporting/ResponsibilityAssignment.java`
- `src/main/java/com/cofco/qiqihar/enterprise/responsibilityreporting/ResponsibilityTransfer.java`
- `src/main/java/com/cofco/qiqihar/enterprise/responsibilityreporting/ResponsibilityTransferReview.java`
- `src/main/java/com/cofco/qiqihar/enterprise/responsibilityreporting/internal/ResponsibilityAssignmentService.java`
- `src/main/java/com/cofco/qiqihar/enterprise/responsibilityreporting/internal/ResponsibilityAssignmentRepository.java`
- `src/test/java/com/cofco/qiqihar/enterprise/responsibilityreporting/ResponsibilityScopeTests.java`
- `src/test/java/com/cofco/qiqihar/enterprise/responsibilityreporting/ResponsibilityAssignmentConcurrencyTests.java`
- `src/test/java/com/cofco/qiqihar/enterprise/responsibilityreporting/ResponsibilityTransferTests.java`

责任坐标不含时间：

```text
组织空间、业务域、报送事项、地区范围、对象范围、产品范围、频率
```

生效期只属于范围版本、任职、指派和交接，不重复嵌入坐标。

**红灯测试：**

1. 同一叶子坐标和重叠生效期分配给两个岗位；
2. 父区域与子区域重叠；
3. “全部产品”与指定产品重叠；
4. 对象组与组内对象重叠；
5. 多叶子请求顺序相反仍按同一排序锁定，不发生死锁；
6. 相邻但不重叠的有效期允许；
7. 指派必须引用有效 `AppointmentId`，不能直接引用 `PersonId`；
8. 任职引用的责任岗位必须具备该责任范围能力，指派有效期必须被任职与范围版本有效期同时包含；
9. 交接必须经过申请、审核和生效，不能覆盖原指派；
10. 交接生效后原任职失去写权，历史归责不改变；
11. 管理员没有有效任职和指派时不能代填。

**仓储端口：**

```java
ResponsibilityAssignment assign(
    AppointmentId appointmentId,
    ResponsibilityScopeVersion scopeVersion,
    EffectiveInterval effectiveInterval,
    ExpectedVersion expectedVersion);
```

端口必须提供：

- 把范围展开为规范叶子；
- 通过 `AppointmentId` 读取唯一岗位、人员和任职有效期，不接受第二份岗位或人员参数；
- 按稳定键排序后一次锁定全部叶子；
- 在同一原子边界检查全部重叠；
- 校验指派有效期同时包含于任职与范围版本有效期；
- 对乐观版本冲突返回业务冲突。

A 段使用可重复并发测试的内存实现；数据库锁实现在 B 段。

### 任务 8：建立报送方案、日历、期间、义务和六套状态

**新增后端：**

- `src/main/java/com/cofco/qiqihar/enterprise/responsibilityreporting/ReportingPlanVersion.java`
- `src/main/java/com/cofco/qiqihar/enterprise/responsibilityreporting/BusinessCalendarVersion.java`
- `src/main/java/com/cofco/qiqihar/enterprise/responsibilityreporting/ReportingPeriod.java`
- `src/main/java/com/cofco/qiqihar/enterprise/responsibilityreporting/ReportingObligation.java`
- `src/main/java/com/cofco/qiqihar/enterprise/responsibilityreporting/ObligationLifecycleState.java`
- `src/main/java/com/cofco/qiqihar/enterprise/responsibilityreporting/TimelinessOutcome.java`
- `src/main/java/com/cofco/qiqihar/enterprise/responsibilityreporting/DocumentRevisionState.java`
- `src/main/java/com/cofco/qiqihar/enterprise/responsibilityreporting/QualityState.java`
- `src/main/java/com/cofco/qiqihar/enterprise/responsibilityreporting/ReviewState.java`
- `src/main/java/com/cofco/qiqihar/enterprise/responsibilityreporting/ReleaseState.java`
- `src/main/java/com/cofco/qiqihar/enterprise/responsibilityreporting/DeadlineSnapshot.java`
- `src/main/java/com/cofco/qiqihar/enterprise/responsibilityreporting/ObligationOwnerSnapshot.java`
- `src/main/java/com/cofco/qiqihar/enterprise/responsibilityreporting/ObligationCutoffSnapshot.java`
- `src/main/java/com/cofco/qiqihar/enterprise/responsibilityreporting/internal/ReportingObligationService.java`
- `src/test/java/com/cofco/qiqihar/enterprise/responsibilityreporting/ReportingStateModelTests.java`
- `src/test/java/com/cofco/qiqihar/enterprise/responsibilityreporting/DeadlineCalculationTests.java`

精确状态：

```text
义务生命周期：未开放、进行中、已到期、已关闭；正式免报、正式取消
时效结果：待判定、按时提交、截止未提交、逾期后补交、不适用
单据修订：草稿、已提交、已撤回、已作废、已被新修订替代
质量状态：使用规格锁定枚举
审核状态：使用规格锁定枚举；“退回”是审核结果，不是单据状态
发布状态：使用规格锁定枚举
```

**红灯测试：**

- 六套状态不能压成一个 `status`；
- 未开放不能提交，已关闭不能改写；
- 免报和取消需要正式依据；
- 节假日、调休和正式延期可重现；
- 原始截止和生效截止都保留；
- 原时效结果和当前有效时效结果都保留；
- 截止时已完整接收但阻断校验稍后通过，按服务端完整接收时间判定；
- 设备时间不参与判定；
- 逾期补交不能改写“截止未提交”的原截止快照。
- 截止任务为每个义务恰好形成一个不可变 `ObligationCutoffSnapshot`；后续补填只追加事件。

时效公式：

```text
有效提交 = 服务端完整接收并持久化，且阻断校验最终通过
按时提交 = 有效提交的服务端完整接收时间 <= 生效截止时间
```

### 任务 9：建立单据、幂等、追加式审计和发件箱领域端口

**新增后端：**

- `src/main/java/com/cofco/qiqihar/enterprise/responsibilityreporting/BusinessDocumentId.java`
- `src/main/java/com/cofco/qiqihar/enterprise/responsibilityreporting/DocumentRevision.java`
- `src/main/java/com/cofco/qiqihar/enterprise/responsibilityreporting/SubmissionReceipt.java`
- `src/main/java/com/cofco/qiqihar/enterprise/responsibilityreporting/internal/DocumentRepository.java`
- `src/main/java/com/cofco/qiqihar/enterprise/responsibilityreporting/internal/ReportingSubmissionService.java`
- `src/main/java/com/cofco/qiqihar/enterprise/responsibilityreporting/internal/ResponsibilityTransferUseCase.java`
- `src/main/java/com/cofco/qiqihar/enterprise/responsibilityreporting/internal/ResponsibilityTransferRepository.java`
- `src/main/java/com/cofco/qiqihar/enterprise/auditops/IdempotencyScope.java`
- `src/main/java/com/cofco/qiqihar/enterprise/auditops/CanonicalRequestDigest.java`
- `src/main/java/com/cofco/qiqihar/enterprise/auditops/IdempotencyRecord.java`
- `src/main/java/com/cofco/qiqihar/enterprise/auditops/BusinessAuditEvent.java`
- `src/main/java/com/cofco/qiqihar/enterprise/auditops/TransactionalOutboxEvent.java`
- `src/main/java/com/cofco/qiqihar/enterprise/auditops/OutboxDeliveryAttempt.java`
- `src/main/java/com/cofco/qiqihar/enterprise/auditops/ConsumerInboxRecord.java`
- `src/main/java/com/cofco/qiqihar/enterprise/auditops/AtomicAuditOutboxPort.java`
- `src/main/java/com/cofco/qiqihar/enterprise/auditops/OutboxDeliveryPort.java`
- `src/main/java/com/cofco/qiqihar/enterprise/auditops/ConsumerInboxPort.java`
- `src/test/java/com/cofco/qiqihar/enterprise/responsibilityreporting/ReportingSubmissionServiceTests.java`
- `src/test/java/com/cofco/qiqihar/enterprise/auditops/IdempotencySemanticsTests.java`
- `src/test/java/com/cofco/qiqihar/enterprise/responsibilityreporting/ResponsibilityTransferUseCaseTests.java`
- `src/test/java/com/cofco/qiqihar/enterprise/auditops/SecurityAuditSemanticsTests.java`
- `src/test/java/com/cofco/qiqihar/enterprise/auditops/OutboxDeliverySemanticsTests.java`

幂等作用域固定为：

```text
账号 + 用例 + 资源 + 幂等键
```

摘要由规范化请求语义生成，不包含关联号、网络时间等易变字段。

幂等记录状态固定为处理中、已成功、已失败和已过期，并保存所有者令牌、租约截止、尝试次数、响应快照、失败分类和保留期。事务回滚不得留下孤立占位；进程终止后的租约只能按明确的过期接管规则处理。

**红灯测试：**

1. 当前唯一负责人可以保存和提交；
2. 非负责人、审核人和管理员不能保存；
3. 责任交接后旧负责人不能提交；
4. 期望版本不匹配返回冲突；
5. 相同作用域、幂等键和摘要并发请求共享一个处理中占位；
6. 相同键、不同摘要明确冲突；
7. 不同账号不能读取彼此的幂等结果；
8. 响应丢失后重试返回原业务结果；
9. 阻断校验失败不形成有效提交；
10. 一次成功提交恰好形成一个业务结果、一个审计事件和一个发件箱事件；
11. 任一写入失败时整个原子边界失败；
12. 审计事件只追加，不能更新或删除；
13. 建立占位后进程终止、事务回滚、租约过期接管、长时间处理中、失败终态和响应快照过期均有确定行为；
14. 登录、拒绝、撤权、恢复、导出和敏感访问只形成安全审计，不混入业务审计；
15. 发件箱以租约、退避和至少一次方式投递，消费收件箱唯一键保证同一消费方的可观察副作用不重复。

责任交接跨聚合用例必须在一个原子边界内：

```text
验证交接申请与审核
→ 结束原任职或原指派并启用新任职指派
→ 重归属受影响义务
→ 冻结原草稿
→ 创建引用原草稿的新修订来源
→ 追加业务审计与事务发件箱
```

A 段使用内存事务替身逐点注入失败，证明任一步失败时任职、指派、义务、草稿、来源、审计和发件箱全部保持原状；B 段再用数据库事务重复同一合同测试。

A 段用内存事务测试替身证明端口语义，不宣称数据库原子性已经完成。

### 任务 10：先定义身份和报送 OpenAPI 契约

**新增后端：**

- `api/openapi/enterprise-api.yaml`
- `src/main/java/com/cofco/qiqihar/enterprise/platform/web/ApiErrorResponse.java`
- `src/main/java/com/cofco/qiqihar/enterprise/platform/web/CorrelationIdFilter.java`
- `src/test/java/com/cofco/qiqihar/enterprise/platform/web/OpenApiContractTests.java`
- `src/test/java/com/cofco/qiqihar/enterprise/platform/web/AuthorizationUseCaseTests.java`

固定接口：

```text
POST /api/v1/session/login
POST /api/v1/session/logout
GET  /api/v1/session/workspace
GET  /api/v1/my-work
GET  /api/v1/reporting-obligations/{obligationId}
GET  /api/v1/business-documents/{documentId}
PUT  /api/v1/business-documents/{documentId}/draft
POST /api/v1/business-documents/{documentId}/submissions
GET  /api/v1/business-documents/{documentId}/audit-trail
```

`GET /api/v1/my-work` 服务端支持业务域、工作类型、状态、地区、产品、截止区间、分页和稳定排序。

**红灯测试：**

- 接口、日期时间、六套状态和错误模型与领域一致；
- 写接口要求期望版本、幂等键和防跨站请求伪造令牌；
- 错误含关联号和稳定业务错误码，普通消息全中文；
- 401、403、404、409、422、429 和 503 语义区分；
- 登录成功轮换会话，退出后不可复用；
- 所有资源读取重新执行服务端权限和数据范围校验；
- 管理员没有业务责任时提交返回拒绝；
- 契约不包含数据库表名和内部类名。

控制器和持久化实现不在本任务创建。

### 任务 11：先建立前端领域模型，再建立传输契约

**新增前端领域：**

- `src/domains/identity-organization/model.ts`
- `src/domains/master-data/model.ts`
- `src/domains/responsibility-reporting/model.ts`
- `src/domains/responsibility-reporting/invariants.ts`
- `src/domains/responsibility-reporting/invariants.spec.ts`
- `src/workflows/current-workspace/model.ts`
- `src/workflows/current-workspace/view-state.ts`
- `src/workflows/current-workspace/view-state.spec.ts`
- `src/workflows/my-work/model.ts`
- `src/workflows/my-work/view-state.ts`
- `src/workflows/my-work/view-state.spec.ts`
- `src/workflows/enterprise-gateway/port.ts`
- `docs/architecture/frontend-module-structure.md`

**领域红灯测试：**

- 六套状态独立；
- 生成时负责人、当前唯一写入任职和截止归责人独立；
- 原始截止、生效截止、原时效结果和当前结果同时保留；
- 逾期补交仍展示原逾期；
- 工作项只引用义务或审核任务，不拥有第二套业务事实；
- 前端无权推断服务端权限。
- `domains` 不依赖 React、Refine、Ant Design、ProComponents 或 HTTP；
- `workflows` 不依赖页面，页面不保存第二份领域事实；
- 只有传输适配器可以接触后端 DTO，只有企业组件适配层可以接触第三方组件私有类型；
- 不存在循环依赖、跨层深层导入和通用目录中的业务规则。

**随后新增传输契约：**

- `src/platform/api/contracts/identityOrganization.ts`
- `src/platform/api/contracts/responsibilityReporting.ts`
- `src/platform/api/httpEnterpriseGateway.ts`
- `src/platform/api/httpEnterpriseGateway.spec.ts`

传输对象使用 Zod 运行时校验，并显式映射到领域模型。测试覆盖缺字段、未知枚举、状态混用、中文错误映射、服务端分页和 401/403/409/422/429/503。

### 任务 12：建立能力投影导航、企业外壳和可交互模拟链

**新增或修改前端：**

- `src/app/router/navigation.ts`
- `src/app/router/navigation.spec.ts`
- `src/app/router/AppRouter.tsx`
- `src/app/shell/EnterpriseContextBar.tsx`
- `src/app/shell/EnterpriseContextBar.spec.tsx`
- `src/app/shell/EnterpriseShell.tsx`
- `src/app/shell/EnterpriseShell.spec.tsx`
- `src/shared/enterprise-ui/EnterprisePage.tsx`
- `src/shared/enterprise-ui/EnterpriseTable.tsx`
- `src/shared/enterprise-ui/EnterpriseResult.tsx`
- `src/pages/LoginPage.tsx`
- `src/pages/MyWorkPage.tsx`
- `src/pages/MyWorkPage.spec.tsx`
- `src/workflows/document-workspace/model.ts`
- `src/workflows/document-workspace/model.spec.ts`
- `src/pages/ObjectDocumentPage.tsx`
- `src/platform/api/mock/mockEnterpriseGateway.ts`
- `src/platform/api/mock/mockEnterpriseGateway.spec.ts`
- `e2e/no-db-responsibility-demo.spec.ts`

**先锁定再退役现有原型：**

1. 先用行为测试锁定当前规范单据地址、对象—单据坐标阻断和错误恢复；
2. 用新领域模型逐路径替换 `domains/review-release`、`workflows/task-inbox` 和旧 `domains/monitoring-object` 中与本切片竞争的状态；
3. 用统一“我的工作”替换产情、市场各自的任务页和独立审核队列；
4. 将业务化的 `DocumentWorkspace`、`ReviewPanel` 从通用 `shared/ui` 移入对应工作流界面目录；
5. 将真正通用且稳定的表格、页面框架、结果和表单原语迁入 `shared/enterprise-ui`，第三方组件私有类型只能停留在该适配层；
6. 新路径全部通过后，删除被替换的旧模型、旧路由、旧模拟状态和 `ModuleLandingPage` 占位页；
7. 运行重复状态源、未使用导出、死路由和空能力扫描，证明没有形成两套工作项或两套单据状态。

导航目录的最终能力集合为：

```text
我的工作
经营总览
产情监测
市场监测
供需与态势
报表中心
数据治理
系统管理
```

实际渲染菜单必须同时满足：

```text
当前账号有权限 + 当前组织有数据范围 + 对应页面有真实能力
```

因此 A 段首个演示只显示已经实现的“我的工作”和必要的账号安全入口，不能为其余七项建立空页面。

**页面验收：**

1. 登录后显示当前组织、责任区域、年度、任务、通知、帮助和账号安全；
2. “我的工作”统一承载填报、审核、发布、异常和逾期筛选；
3. 默认只显示本人可处理项；
4. 打开同一规范单据地址，不复制产情、市场或审核页面；
5. 只有当前唯一负责任职看到保存和提交；
6. 审核人只看到审核动作，不能修改值；
7. 无任务、无权限、会话失效和服务失败分别呈现中文恢复动作；
8. 页面不显示接口、枚举代码、变量名或开发占位；
9. 顶部醒目标注“模拟数据·未连接生产数据”；
10. Playwright 使用实际前端启动命令，不依赖手工已启动进程。

**A 段门禁：**

```bash
cd /Users/federal/Desktop/cofco-qiqihar-enterprise-backend
./mvnw -B -ntp -Dspring.profiles.active=no-db verify

cd /Users/federal/Desktop/cofco-qiqihar-enterprise-web
npm run format:check
npm run lint
npm run architecture
npm run test
npm run build
npm run budget
npm run test:e2e:preview -- e2e/no-db-responsibility-demo.spec.ts
```

代码结构报告必须证明：

- 后端六个模块名称和依赖方向精确匹配计划；
- 前端领域、工作流、平台适配器、应用外壳和页面依赖单向；
- 新前端与新后端是独立仓库、构建、进程、端口和发布制品，跨仓只使用版本化 OpenAPI/HTTP；
- 前端不存在 Java、数据库驱动、SQL、迁移和连接配置，后端不存在 React、Node.js 界面源码和前端构建产物；
- 业务规则没有复制到控制器、页面、表格列配置或模拟数据；
- 同一业务事实只有一个所有者；
- 没有空菜单、占位按钮、未使用导出、循环依赖和未解释的跨模块导入；
- 页面和业务工作流不直接导入 Refine、Ant Design 或 ProComponents 私有类型，应用组合层与企业界面适配层除外；
- 旧 `task-inbox`、`review-release`、重复任务路由和占位模块均已退役；
- 格式、静态检查、类型检查、单元测试、架构测试和构建全部通过。

### 任务 13：设计并验证无数据库物理模型制品

**新增后端：**

- `ops/physical-data-model.schema.json`
- `docs/architecture/physical-data-model-v1.md`
- `docs/architecture/physical-data-model-v1.json`
- `src/test/java/com/cofco/qiqihar/enterprise/platform/database/PhysicalDataModelContractTests.java`

本任务只把已复审逻辑模型转换为可审查的物理设计，不创建 SQL、不加入驱动、不连接数据库。

物理模型 JSON 必须逐表定义：

- 稳定实体、版本实体和关系实体的表名与所有者模块；
- 列名、业务含义、类型、空值语义、默认值和敏感分类；
- 主键、外键、唯一键、检查约束和级联策略；
- 查询索引、唯一性锁键和预期查询；
- 时间精度、UTC 存储与上海时区展示规则；
- 字符集、排序规则；
- 金额、数量、比例和单位精度；
- 追加式、可更新、可停用和禁止物理删除分类；
- 数据保留、归档和法律冻结挂点。

首个切片必须明确包含：

- 区域稳定身份、区划版本与层级；
- 产品和单位稳定身份与版本；
- 责任岗位、有效任职、账号/岗位排他角色授权和职责冲突规则；
- 责任范围叶子、指派、交接和交接审核；
- 报送方案、日历、期间、义务、义务负责人、截止规则和单义务截止快照；
- 单据、修订和提交接收；
- Spring Session 所需表；
- 幂等生命周期、业务审计、安全审计、事务发件箱、投递尝试和消费收件箱。

测试验证 JSON 模式、逻辑实体覆盖、引用完整、无浮点金额/数量、无第二份状态或数量权威、所有索引都有查询依据，以及 Markdown 摘要与 JSON 内容哈希一致。

门禁审批的是该固定物理模型制品及其 SHA-256；任务 14 的 Flyway 迁移只能忠实实现它，不能在迁移阶段临时发明表结构。

## 五、物理模型进入门禁

**正式文件：**

- `docs/superpowers/verification/physical-model-entry-gate.json`

文件必须通过后端 `ops/physical-model-entry-gate.schema.json` 和独立验证命令，且包含：

- 规格、逻辑模型、路线图、切片计划、OpenAPI、威胁模型和恢复设计的绝对或仓库相对路径与 SHA-256；
- `physical-data-model-v1.json` 与人类可读摘要的路径、SHA-256 和模式验证结果；
- 数据库标识 `qiqihar_grain_enterprise_v1`；
- `QGE_DB_` 专用变量清单；
- 旧库名、旧账号、旧地址和连接指纹黑名单的 HMAC 摘要、规范化算法、密钥标识和轮换版本；
- 物理表、列、主键、唯一键、外键、检查约束、索引、时间精度、字符集、排序规则和金额/数量精度的评审结果；
- 加密备份、保留期、恢复点目标、恢复时间目标、恢复验证和回退设计；
- 数据所有者、安全负责人、恢复负责人和实施负责人各自的真实签署角色、时间、签署内容哈希和分离式数字签名；
- 与受控可信签署人公钥、角色、有效期和轮换记录的验证结果；
- 自动验证结果为通过。

实施人员不能代签。用户允许自动继续不等于门禁通过。

门禁未通过时：

- 可以继续完善无数据库领域、契约、前端和文档；
- 不创建 `db/migration`；
- 不加入数据库依赖；
- 不运行 Flyway、JDBC、Testcontainers 或数据库端到端测试；
- 不尝试任何本地或远程数据库连接。

## 六、B 段：门禁通过后的持久化实施

### 任务 14：加入固定数据库工具链和从空库迁移

**前置：** 物理模型进入门禁自动验证通过。

**修改后端：**

- `pom.xml`
- `config/technology-lock.json`

**新增后端：**

- `src/main/resources/application-ephemeral-test.yml`
- `src/main/resources/db/migration/V001__versioned_master_and_identity.sql`
- `src/main/resources/db/migration/V002__responsibility_and_reporting.sql`
- `src/main/resources/db/migration/V003__security_audit_idempotency_and_outbox.sql`
- `src/test/java/com/cofco/qiqihar/enterprise/database/MySqlContainerSupport.java`
- `src/test/java/com/cofco/qiqihar/enterprise/database/FlywayFromEmptyMysqlTests.java`
- `src/test/java/com/cofco/qiqihar/enterprise/database/DatabaseIsolationGuardTests.java`
- `src/test/java/com/cofco/qiqihar/enterprise/database/ResponsibilityConstraintMysqlTests.java`

只在本任务加入：

- Spring JDBC；
- Spring Session JDBC；
- MySQL Connector/J；
- 开源 `flyway-core` 和 MySQL 模块；
- Testcontainers MySQL。

技术锁必须记录 MySQL 精确补丁标签和镜像摘要，禁止浮动标签。容器复用必须关闭。

**V001 最小范围：**

```text
region
administrative_region_version
region_hierarchy_version
product
product_version
unit_definition
unit_conversion_version
organization_space
organization_unit
person
account
account_credential
permission
role
role_permission_version
role_grant
data_access_scope
segregation_rule
security_session
spring_session
spring_session_attributes
responsibility_position
effective_appointment
```

**V002 最小范围：**

```text
responsibility_scope_version
responsibility_scope_leaf
responsibility_assignment
responsibility_transfer
responsibility_transfer_review
reporting_plan
reporting_plan_version
business_calendar_version
reporting_period
reporting_obligation
obligation_owner_snapshot
deadline_snapshot
obligation_cutoff_snapshot
business_document
document_revision
submission_receipt
```

**V003 最小范围：**

```text
idempotency_record
business_audit_event
security_audit_event
transactional_outbox
outbox_delivery_attempt
consumer_inbox_record
```

不得创建产情、市场、供需和报告空表。

**测试：**

1. 只允许 `@ServiceConnection` 注入容器连接；
2. 未通过门禁、非固定库名、旧指纹或非专用变量在打开套接字前拒绝；
3. 从空库 V001→V003 成功，重跑无变化，迁移哈希可验证；
4. 表、列、类型、索引和约束与门禁批准的 `physical-data-model-v1.json` 完全一致；
5. 全部时间使用微秒精度并明确 UTC 存储/上海时区显示规则；
6. 金额、数量和比例没有浮点类型；
7. 同一责任范围叶子和重叠有效期的并发指派只允许一个成功；
8. 多叶子锁使用规范排序；
9. 测试结束容器销毁。

### 任务 15：实现 JDBC 仓储和原子提交

**新增后端仓储：**

- `src/main/java/com/cofco/qiqihar/enterprise/masterdata/internal/JdbcMasterDataRepository.java`
- `src/main/java/com/cofco/qiqihar/enterprise/identityorganization/internal/JdbcIdentityAccess.java`
- `src/main/java/com/cofco/qiqihar/enterprise/identityorganization/internal/JdbcSecuritySessionRepository.java`
- `src/main/java/com/cofco/qiqihar/enterprise/identityorganization/internal/JdbcResponsibilityPositionRepository.java`
- `src/main/java/com/cofco/qiqihar/enterprise/identityorganization/internal/JdbcEffectiveAppointmentRepository.java`
- `src/main/java/com/cofco/qiqihar/enterprise/responsibilityreporting/internal/JdbcResponsibilityAssignmentRepository.java`
- `src/main/java/com/cofco/qiqihar/enterprise/responsibilityreporting/internal/JdbcResponsibilityTransferRepository.java`
- `src/main/java/com/cofco/qiqihar/enterprise/responsibilityreporting/internal/JdbcReportingPlanRepository.java`
- `src/main/java/com/cofco/qiqihar/enterprise/responsibilityreporting/internal/JdbcBusinessCalendarRepository.java`
- `src/main/java/com/cofco/qiqihar/enterprise/responsibilityreporting/internal/JdbcReportingPeriodRepository.java`
- `src/main/java/com/cofco/qiqihar/enterprise/responsibilityreporting/internal/JdbcReportingObligationRepository.java`
- `src/main/java/com/cofco/qiqihar/enterprise/responsibilityreporting/internal/JdbcDocumentRepository.java`
- `src/main/java/com/cofco/qiqihar/enterprise/auditops/internal/JdbcIdempotencyRepository.java`
- `src/main/java/com/cofco/qiqihar/enterprise/auditops/internal/JdbcBusinessAuditRepository.java`
- `src/main/java/com/cofco/qiqihar/enterprise/auditops/internal/JdbcSecurityAuditRepository.java`
- `src/main/java/com/cofco/qiqihar/enterprise/auditops/internal/JdbcOutboxRepository.java`
- `src/main/java/com/cofco/qiqihar/enterprise/auditops/internal/JdbcOutboxDeliveryAttemptRepository.java`
- `src/main/java/com/cofco/qiqihar/enterprise/auditops/internal/JdbcConsumerInboxRepository.java`
- `src/main/java/com/cofco/qiqihar/enterprise/platform/messaging/OutboxDispatcher.java`

**测试：**

- 所有 SQL 参数化；
- 所有列表服务端分页并稳定排序；
- 指派锁同时覆盖父子区域、全部/指定产品、对象组/对象和多个叶子；
- 乐观版本冲突不会丢失更新；
- 幂等处理中占位具有所有者令牌、租约、终态和接管规则；
- 业务、幂等结果、追加业务审计和发件箱在同一事务；
- 注入每个写入点失败时无部分提交；
- 一次成功提交恰好产生一个审计和一个发件箱事件；
- 审计更新和删除在应用权限与数据库权限两层拒绝；
- 响应丢失后相同账号重试返回原结果，不同账号不能复用；
- 安全审计独立追加并执行单独的查看、导出和留存权限；
- 发件箱调度器使用租约、心跳、退避和失败终态；网络层只承诺至少一次；
- 每个消费方以消费收件箱唯一键防止可观察副作用重复。

### 任务 16：实现真实安全会话和 HTTP 适配器

**新增后端：**

- `src/main/java/com/cofco/qiqihar/enterprise/platform/security/SecurityConfiguration.java`
- `src/main/java/com/cofco/qiqihar/enterprise/platform/security/SessionSecurityVersionFilter.java`
- `src/main/java/com/cofco/qiqihar/enterprise/platform/web/SessionController.java`
- `src/main/java/com/cofco/qiqihar/enterprise/platform/web/CurrentWorkspaceController.java`
- `src/main/java/com/cofco/qiqihar/enterprise/platform/web/MyWorkController.java`
- `src/main/java/com/cofco/qiqihar/enterprise/platform/web/ReportingObligationController.java`
- `src/main/java/com/cofco/qiqihar/enterprise/platform/web/BusinessDocumentController.java`
- `src/main/java/com/cofco/qiqihar/enterprise/platform/web/AuditTrailController.java`
- `src/test/java/com/cofco/qiqihar/enterprise/platform/web/SessionSecurityHttpTests.java`
- `src/test/java/com/cofco/qiqihar/enterprise/platform/web/ReportingAuthorizationHttpTests.java`
- `src/test/java/com/cofco/qiqihar/enterprise/platform/web/OpenApiImplementationTests.java`

**安全测试：**

- 密码验证后轮换会话；
- Argon2id 参数、外置密钥材料和成功登录后的摘要升级符合技术锁；
- 登录失败计数、账号/IP 组合限流、渐进延迟和锁定不泄漏账号存在性；
- 防跨站请求伪造、Cookie 和同源策略生效；
- 普通端口不能访问管理端点；
- 管理端口需要独立授权；
- 每次请求检查账号、会话安全版本、角色权限版本和数据范围；
- 直接地址、列表、搜索、导出和审计轨迹使用同一授权规则；
- 管理员、审核人和其他填报人不能代填；
- 会话吊销后下一次请求拒绝；
- 会话空闲超时、绝对超时、账号恢复和敏感操作再次认证生效；
- 登录、拒绝、撤权、恢复、导出和敏感访问分别形成可授权查询的安全审计；
- OpenAPI 与运行接口双向一致；
- 日志和错误不泄漏凭据、会话、连接配置和业务敏感值。

### 任务 17：把前端从模拟适配器切换到真实网关

**修改前端：**

- `src/platform/api/httpEnterpriseGateway.ts`
- `src/app/providers/AppProviders.tsx`
- `src/pages/LoginPage.tsx`
- `src/pages/MyWorkPage.tsx`
- `src/pages/ObjectDocumentPage.tsx`

**要求：**

- 开发同源 `/api`，Vite 代理到固定新后端端口；
- 不启用通配跨域；
- 页面仍只依赖同一网关端口；
- 模拟标识只在模拟适配器启用时显示；
- 切换真实适配器后不存在模拟数据残留；
- 401 显示重新登录，403 显示权限不足，409 显示版本冲突，422 显示业务校验，429 显示稍后重试，503 显示服务恢复动作；
- 页面不直接解释数据库或后端技术错误。

### 任务 18：真实全栈端到端、重启和故障恢复

**新增：**

- 后端 `src/test/java/com/cofco/qiqihar/enterprise/acceptance/ResponsibilityReportingAcceptanceTests.java`
- 后端 `src/test/java/com/cofco/qiqihar/enterprise/acceptance/RestartAndLostResponseAcceptanceTests.java`
- 后端 `src/test/java/com/cofco/qiqihar/enterprise/acceptance/OutboxContinuationAcceptanceTests.java`
- 后端 `src/test/java/com/cofco/qiqihar/enterprise/acceptance/ConsumerInboxIdempotencyAcceptanceTests.java`
- 前端 `e2e/my-work-responsibility-real-backend.spec.ts`
- 前端 `scripts/start-responsibility-e2e.mjs`

端到端启动脚本必须自行：

1. 创建不可复用的一次性 MySQL；
2. 启动新后端；
3. 等待受限健康检查；
4. 启动新前端；
5. 创建固定测试身份、任职、责任、计划和义务；
6. 运行 Playwright；
7. 清理前后端进程和容器。

不得依赖手工已启动进程或本机数据库。

**最高层验收：**

```text
浏览器登录
→ 解析权限和工作空间
→ 有效任职定位责任岗位
→ 本人的报送义务出现在“我的工作”
→ 保存并提交
→ 同事务形成时效、审计和发件箱
→ 模拟响应丢失后重试返回原结果
→ 重启临时 MySQL 与后端
→ 重新登录后读取同一单据、时效和审计
→ 发件箱从中断位置按至少一次语义继续
→ 消费收件箱保证同一消费方的可观察副作用不重复
```

同时覆盖双负责人、父子范围冲突、非负责人提交、交接跨聚合全成或全败、权限撤销、会话吊销、幂等并发与进程终止、事务回滚、安全审计和旧版本不可变。

### 任务 19：全门禁和检查点报告

**新增：**

- `docs/superpowers/verification/2026-07-30-enterprise-foundation-first-vertical-slice.md`

**后端：**

```bash
cd /Users/federal/Desktop/cofco-qiqihar-enterprise-backend
./mvnw -B -ntp verify
```

**前端：**

```bash
cd /Users/federal/Desktop/cofco-qiqihar-enterprise-web
npm run verify
```

**报告必须包含：**

- 前后端分支、HEAD、精确变更清单和哈希；
- Maven、JDK、Node.js、MySQL 镜像标签与摘要；
- 物理模型门禁文件哈希及真实签署项；
- 全部测试命令、退出码、数量和报告路径；
- 空库迁移、数据库重启、丢失响应、发件箱继续投递证据；
- 双负责人、范围重叠、越权、权限撤销、逾期、幂等和回滚证据；
- 普通界面全中文与开发残留扫描；
- 新旧系统零交叉和旧工作区状态复核；
- 恢复点目标、恢复时间目标和恢复演练状态，未演练时必须明确写“尚未达到”；
- 未关闭风险；
- 明确声明未连接旧数据库、未 push、未部署、未删除。

## 七、完成定义

A 段完成必须同时满足：

1. 新后端与旧后端物理隔离；
2. 新后端无数据库配置启动且数据库依赖数量为零；
3. 最小主数据、身份、权限、任职、责任、报送和六套状态语义通过纯领域测试；
4. OpenAPI 先于持久化；
5. 前端领域模型先于传输对象；
6. 登录—责任—义务—提交—审计的模拟纵向链可交互；
7. 导航只显示有权限且已实现的能力；
8. 新前端与新后端的独立仓库、构建、进程、端口和发布制品门禁通过；
9. 跨仓调用只经版本化 OpenAPI/HTTP，前端不含 Java 或数据库能力，后端不含浏览器界面实现；
10. 无数据库物理模型 JSON 制品、摘要、模式和内容哈希校验通过；
11. 旧系统和数据库未被修改或连接。

B 段完成必须在 A 段基础上同时满足：

1. 物理模型门禁真实签署并自动验证通过；
2. 新 MySQL 只在隔离 Testcontainers 中验证；
3. 唯一负责人由服务端、规范多锁和数据库共同保证；
4. 会话、权限撤销、职责分离和直接地址授权完整；
5. 逾期补交不改写历史；
6. 业务、幂等、审计和发件箱原子提交；
7. 数据库重启、响应丢失和发件箱继续投递测试通过；
8. 前后端完整门禁通过；
9. 旧后端和旧数据库状态与基线一致。

完成 A 段后不等待人工确认：自动继续所有不依赖物理模型门禁的安全工作。门禁未签署时不得进入 B 段，但可以继续完善共用事实治理的无数据库规格、契约和测试。
