# 阿里云隔离预生产操作包

本目录只服务于永久台账第 5 项。它不创建或发布生产环境，不执行阶段五至六主数据、性能、安全阶段八、阶段九真实恢复、UAT、RC 冻结或生产灰度。

## 当前状态

本地模板、校验器、dry-run、失败安全、备份和回滚入口已具备。没有批准的 EXT-005 参数、阿里云 CLI/RAM 身份、Terraform、Docker、SSH 主机别名和不可变镜像 digest 时，唯一正确结论是 `LOCAL_COMPLETE + BLOCKED_EXTERNAL`；不得写成预生产已建立或 `PASS / COMPLETE`。

所有秘密只能写成阿里云 KMS 凭据 ARN。配置文件、命令行、日志、Git 和证据禁止出现密码、AccessKey Secret、OIDC client secret、Cookie、Token、私钥或明文数据库凭据。推荐 ECS 使用实例 RAM 角色调用 KMS/RDS 只需权限，避免静态 AccessKey。

## 隔离边界

- 只允许批准 CIDR 访问 ECS 的 443；DNS A 记录必须包含云API确认属于目标 ECS 的批准 HTTPS 入口 IP，验证连接固定到该 IP；本包只接受批准的直连 ECS 拓扑，端口固定 22，禁止 ProxyJump/ProxyCommand，HostName 的全部解析结果必须属于云 API 实时返回的目标 ECS 私网/公网/EIP，且非 root 用户、0600/0400 身份文件和批准 SHA-256 主机键必须逐项吻合。需要跳板时必须先形成独立批准拓扑和包修订，不能借自由 SSH 配置绕过。
- Compose 只发布 TLS 网关的 443。Business、Overview、Backend、Prometheus、Blackbox 和 Alertmanager 均无宿主机公开端口。
- RDS 必须与 ECS 位于批准的同一 VPC/vSwitch 边界，命名预生产白名单只能包含该 vSwitch 内的批准 CIDR，禁止公网端点；PostgreSQL 使用 `sslmode=verify-full` 和 KMS 提供的 CA。
- 网关和 Overview 相邻代理显式清除所有本地/旧代理身份头；身份只来自 Spring OIDC 与 HttpOnly 会话。
- 所有应用和运维镜像必须使用 `@sha256:` digest。首次部署永远标记 `preproduction`。
- Terraform 只允许 OSS 权威远程 state：对象为 private + AES256、bucket 开启版本化，TableStore 表以字符串 `LockID` 主键提供并发锁；plan/apply 必须使用同一受控 backend 指纹，锁冲突立即失败，禁止回退本地 state。
- TLS 网关由批准域名渲染唯一虚拟主机；SNI 正确但 Host 伪造仍返回 421。登录验收只接受精确 302 和批准 issuer 同源的授权入口路径，内部地址或其他 HTTPS Location 均失败关闭。
- 数据库迁移只允许已审查的 expand-only 兼容边界；本包的回滚只切换不可变应用镜像，不执行向后 schema 破坏。

## 安全输入

复制 `config/preproduction.env.example` 为被 Git 忽略的 `config/preproduction.env`，只填批准的非敏感值或 KMS ARN，然后执行：

```bash
chmod 0600 ops/alicloud-preproduction/config/preproduction.env
npm run stage5:preproduction:validate
```

校验器退出码：`0` 表示输入完整、可进入云状态验证；`2` 表示 `BLOCKED_EXTERNAL`；`1` 表示输入不安全或不一致。退出码 `0` 仍不表示云端已通过。

## 顺序

1. 本地静态/单元验证：`npm run stage5:preproduction:test`。
2. 无输入 dry-run：`ops/alicloud-preproduction/scripts/preflight.sh --dry-run` 和 `deploy.sh dry-run`，缺输入应安全退出 `2`。
3. 输入齐全后验证 OSS 版本化/加密、TableStore `LockID` 锁表及最小权限批准，再用唯一远程 backend 执行只读云计划：`infra.sh plan <config>`。人工核对保存的 plan SHA-256 与 backend 指纹。
4. 仅在批准 plan 后，把上一步输出的64位哈希原样绑定到 apply：`COFCO_PREPROD_APPLY=APPLY_PREPRODUCTION COFCO_PREPROD_APPROVED_PLAN_SHA256=<reviewed-sha256> infra.sh apply <config>`；现场 plan 不匹配时在 Terraform 调用前失败。
5. 分别从三个权威仓构建干净候选镜像，推送到批准的 ACR，并把 registry 返回的 digest 写入配置；标签不能代替 digest。
6. 可先用 `rds-whitelist.sh dry-run <config>` 核对命名白名单；真实部署只在安全 SSH 主机别名和云边界均批准后执行：`COFCO_PREPROD_APPLY=APPLY_PREPRODUCTION deploy.sh apply <config>`。
7. 部署包保留 `ops/alicloud-preproduction` 与唯一 Node 配置/运行时校验器的 Web 相对布局，远端在副作用前核对两份校验器 SHA-256。事务在首个云写入前锁定 current/previous 与白名单快照；白名单、实时 vSwitch/VPC/zone/CIDR、秘密、Compose、备份、pull、up、运行验证和检查点任一步失败，都恢复原白名单、原秘密、原运行版本并复验。首次部署失败停止服务、清除候选秘密并恢复拒绝式白名单边界。
8. 已验证回滚：`COFCO_PREPROD_ROLLBACK=ROLLBACK_PREPRODUCTION rollback.sh <config>`。配置中的目标必须与 `previous` 检查点一致；没有旧版本时只允许目标 `undeployed`。

`materialize-secrets.sh` 只把 KMS 返回值写入当前用户运行时目录，目录 `0700`、文件 `0600`，不打印内容。Compose 通过 Spring ConfigTree 文件注入数据库密码和 OIDC client secret；TLS 私钥同样只读挂载。

## 监控与备份边界

Prometheus 每 15 秒通过 Blackbox 检查 Business、Overview 和 Backend 健康，2 分钟不可用触发 Critical，连续 5 分钟超过 3 秒触发 Warning，并经 Alertmanager 的 KMS webhook 引用通知批准目标。该本地模板不冒充告警已送达；必须在真实预生产验证。

`backup-rds.sh` 调用 RDS `CreateBackup`，再用 `DescribeBackupTasks` 等待 `Finished` 并保存不含秘密的任务/备份 ID。它证明“部署前备份可触发并完成”，不替代阶段九的真实恢复、PITR、RPO/RTO 演练。

## 外部输入仍缺失

EXT-005 至少仍需：批准地域/可用区/VPC/vSwitch/专用安全组/ECS、私网 IP 与 HTTPS 入口 IP；SSH 别名和来源 CIDR；RDS 实例/私网端点/库名/账号、命名白名单及 vSwitch 内 CIDR、CA/密码 KMS 引用；TLS 域名、证书/私钥引用及指向该入口 IP 的 DNS；OIDC 回调及真实 IdP 输入；ACR 仓库和全部镜像 digest；ECS 实例 RAM 角色与 ECS/RDS/KMS 最小权限；告警目标；RPO/RTO、备份方法和回滚目标。输入未验证前不运行 apply。

参考：阿里云官方 Terraform Provider 使用 `aliyun/alicloud`；RDS PostgreSQL 手工备份支持 `Physical` 或 `Snapshot`；KMS `GetSecretValue` 默认读取 `ACSCurrent`。具体链接在本阶段证据包中保留。
