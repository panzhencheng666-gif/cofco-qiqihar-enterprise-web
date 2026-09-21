# 齐齐哈尔粮食商情平台预警系统：开源项目调研与框架建议

> 调研日期：2026-09-20
>
> 调研性质：只读研究与架构建议，不包含业务代码、数据库、云环境或公网发布变更
>
> 目标技术栈：Java / Spring Boot 模块化单体、PostgreSQL / Flyway、React / TypeScript、现有 Prometheus + Alertmanager 运维监控
>
> 证据范围：只使用项目官方 GitHub 仓库、官方文档、官方许可证、官方 release 和当前仓库已提交配置
>
> 结论边界：本文提出的是可实施框架，不替业务负责人决定具体预警指标、阈值和通知责任人

## 一、结论先行

### 1.1 推荐结论

应用中心可以增加“预警中心”，但第一版不应把任一外部项目的控制台直接嵌进来，也不应先造几条看起来完整的演示预警。

推荐采用下面的组合架构：

1. **业务预警权威内核由现有 Spring Boot + PostgreSQL 承担。** 规则版本、评估批次、事实证据、预警实例、确认、指派、静默、解除、通知结果和审计历史都保存在本平台数据库中，继续使用现有身份、区域权限、审核发布和事务发件箱边界。
2. **保留现有 Prometheus + Alertmanager 专门处理技术运维告警。** Alertmanager 的分组、抑制、静默、重复通知策略值得复用，但它不能替代业务预警的确认、责任人、整改、证据和审计模型。
3. **借鉴 Alerta 的告警状态机和历史模型，借鉴 Apache HertzBeat 的中文告警中心、收敛、抑制、静默和国内通知通道设计。** 两者适合做领域模型和交互参考，不适合直接嵌入现有应用中心。
4. **通知通道先用本地适配层；达到多渠道编排规模后再评估自建 Novu。** Novu 适合通知工作流，不是业务规则引擎或预警事实库；社区自建版没有企业所需的 RBAC、OIDC/SSO 等能力，因此不能把它的管理台当作本平台管理入口。
5. **当前不为预警系统单独引入 OpenSearch。** 只有平台已经因日志检索或全文搜索正式采用 OpenSearch 时，才考虑让它对派生索引运行查询型监控；PostgreSQL 仍必须是业务事实与预警处置的权威来源。

一句话方案：

```text
正式业务事实 / 审核结果 / 任务事件
              │
              ▼
Spring Boot 预警模块 ── PostgreSQL 权威台账
   │ 规则评估             │ 状态机、证据、处置、审计
   │                      │
   ├── 事务发件箱 ──> 通知适配器 ──> 站内信 / SMTP / 企业微信或批准 Webhook
   │
   └── React“预警中心” ──> 规则、活动预警、详情历史、静默、通知策略

Prometheus ──> Alertmanager ──> 技术运维告警（保持独立）
```

### 1.2 为什么不是“找一个开源项目直接装上”

候选项目分属不同问题域：

- Prometheus Alertmanager 管理已经产生的技术告警，规则由 Prometheus 评估。
- OpenSearch Alerting 对 OpenSearch 索引运行查询或脚本。
- Alerta 汇集和处置来自外部系统的告警，本身不是业务规则计算器。
- Novu 编排消息发送，不负责判断粮食业务事实是否达到预警条件。
- Apache HertzBeat 是监控、阈值告警与通知一体化平台，模型仍以监控对象和指标为中心。

本平台的业务预警还必须理解地区、品种、期间、数据层、审核状态、来源版本、填报责任、权限范围和整改闭环。以上项目都不会自动提供这些语义，更不能自动证明输入是真实提交数据。

## 二、现有平台边界

### 2.1 已有运维告警能力不能重复建设

当前仓库已经部署 Prometheus 与 Alertmanager 的预生产配置：普通运维告警按 `alertname + instance` 分组，严重告警立即升级，Webhook 接收地址通过秘密文件注入，并发送恢复通知。[现有 Alertmanager 配置](../../ops/alicloud-preproduction/monitoring/alertmanager.yml)

现有 Stage 9 设计也明确把 Prometheus 指标限制为计数、状态、时长和年龄，不允许在指标中放入业务值、请求正文或秘密，并把真实在线告警送达与本地配置验证分开。[Stage 9 可观测性设计](../superpowers/specs/2026-08-13-stage-nine-observability-dr-design.md)

因此新“预警中心”应当增加的是**业务预警管理能力**，而不是复制另一个基础设施监控台。技术告警可以在未来通过只读适配器汇总展示，但不能与业务预警共用规则、权限和事实口径。

### 2.2 业务预警的不可妥协要求

新框架至少必须满足：

- 规则有草稿、审核、启用、停用和不可变版本，不允许直接覆盖已经产生正式预警的规则定义。
- 每次评估记录规则版本、截止时点、输入来源、输入版本、单位、实际值、阈值、结果和错误。
- “没有数据”与“数据为 0”严格分开；缺失只能生成明确的缺数预警或“不足以评估”，不能补成 0。
- 去重键来自稳定业务坐标，不来自页面标题或通知文案。
- 确认只表示人员已看到，不能把仍然存在的条件伪装成已解除。
- 静默只抑制通知，不删除预警、不改写事实、不跳过规则评估。
- 解除必须由规则条件恢复或获授权的人工动作产生，并保留原因和证据。
- 页面只展示真实查询结果；没有预警时显示空状态，不显示模拟数量、样例趋势或虚构命中率。
- 通知失败不能反向修改预警状态，必须留下可重试且幂等的发送记录。

## 三、候选项目总览

### 3.1 维护与成熟度证据

以下证据来自 2026-09-20 对官方 GitHub 仓库、许可证和 release 页的只读核验。仓库活跃只能证明仍在维护，不能单独证明适合本平台生产使用；具体版本必须在真正引入前重新锁定并复核许可证与漏洞信息。

| 项目                    | 许可证                                                | 维护与成熟度证据                                           | 核心定位                                       | 本平台结论                                           |
| ----------------------- | ----------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------- |
| Prometheus Alertmanager | Apache-2.0                                            | 官方仓库和 release 页持续维护；Prometheus 生态长期使用     | 技术告警分组、去重、路由、抑制、静默和通知     | **继续直接用于运维；业务侧只借鉴，不作为权威内核**   |
| OpenSearch Alerting     | Apache-2.0                                            | OpenSearch 官方插件仓库，按 OpenSearch 主版本配套发布       | 对搜索索引运行定时查询、脚本和组合监控         | **未采用 OpenSearch 前不引入**                       |
| Alerta                  | Apache-2.0；contrib 为 MIT                            | 官方 9.x 主线，长期提供 PostgreSQL/MongoDB 告警汇聚能力     | 多源告警汇聚、去重、相关、状态和历史           | **适合借鉴状态机；不直接嵌入**                       |
| Novu                    | 开放核心：核心 MIT，`enterprise` 路径受专有许可证约束 | 官方主仓持续维护，核心与企业功能有明确许可证边界           | 多渠道通知工作流、收件箱、偏好、延时、摘要     | **只作为后期通知适配器候选**                         |
| Apache HertzBeat        | Apache-2.0                                            | Apache 官方项目，仓库和 release 页持续维护                 | 监控采集、阈值、告警中心、收敛、静默和国内渠道 | **最适合做中文交互与告警策略参考；不作为业务事实库** |

活动和许可证来源：

- [Prometheus Alertmanager 官方仓库](https://github.com/prometheus/alertmanager)与[官方 releases](https://github.com/prometheus/alertmanager/releases)
- [OpenSearch Alerting 官方仓库](https://github.com/opensearch-project/alerting)与[3.9.0 官方 release note](https://github.com/opensearch-project/alerting/blob/main/release-notes/opensearch-alerting.release-notes-3.9.0.0.md)
- [Alerta 官方仓库](https://github.com/alerta/alerta)与[官方 releases](https://github.com/alerta/alerta/releases)
- [Novu 官方仓库](https://github.com/novuhq/novu)、[MIT 许可证](https://github.com/novuhq/novu/blob/next/LICENSE-MIT)和[企业路径许可证](https://github.com/novuhq/novu/blob/next/LICENSE-ENTERPRISE)
- [Apache HertzBeat 官方仓库](https://github.com/apache/hertzbeat)与[官方 releases](https://github.com/apache/hertzbeat/releases)

### 3.2 能力比较

| 评估项                           | Alertmanager                         | OpenSearch Alerting                          | Alerta                                 | Novu                                           | Apache HertzBeat                                            |
| -------------------------------- | ------------------------------------ | -------------------------------------------- | -------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------- |
| 规则评估                         | 不负责；由 Prometheus 规则完成       | 强；查询、桶、文档、PPL、集群指标和组合监控  | 不负责；接收外部告警                   | 不负责；接收应用事件后编排通知                 | 强于监控指标；实时/定时阈值、表达式、PromQL                 |
| 去重/聚合                        | 强；指纹、分组等待、重复间隔、抑制   | 有告警实例与组合监控，但不是通用业务去重台账 | 强；固定键去重和简单相关               | 摘要、节流针对通知执行，不等同预警去重         | 强；分组、收敛、抑制和重复间隔                              |
| 确认                             | 没有独立业务确认资源                 | 有 `Acknowledged`                            | 有 `ack`                               | 已读/收件箱动作不等于业务确认                  | 有待处理/已处理，可标回未处理                               |
| 静默/抑制                        | 强；Silence、时间区间、Inhibition    | 主要是动作节流和告警确认                     | Shelve、Blackout                       | 偏好、延时、摘要、节流                         | 强；一次性/周期静默、标签匹配、告警抑制                     |
| 自动解除                         | 发送 `resolved`                      | 条件为假进入 `Completed`                     | 正常严重度自动 `closed`，重现可重开    | 只跟踪通知工作流，不负责业务解除               | 有恢复告警状态                                              |
| 指派/整改                        | 无                                   | 无完整责任闭环                               | `assign` 目前是占位状态                | 无预警整改闭环                                 | 有处理状态，但不是粮食业务整改模型                          |
| 多渠道                           | 丰富；Email、Webhook、企业微信等     | SMTP、Webhook、Slack、Teams、SNS/SES 等      | 核心 + contrib 插件；一致性较弱        | 最强项；站内、邮件、短信、推送、聊天           | 丰富且国内友好；邮件、短信、Webhook、钉钉、企业微信、飞书等 |
| 与 Spring Boot / PostgreSQL 匹配 | REST/OpenAPI；独立 Go 服务；已有部署 | JVM 生态但必须作为 OpenSearch 插件运行       | Python 服务，可直接使用 PostgreSQL     | TypeScript 服务；另需 MongoDB、Redis、对象存储 | Java/Spring 生态，但自身是完整平台且前端为 Angular          |
| 部署复杂度                       | 低到中                               | 高                                           | 中                                     | 高                                             | 中到高                                                      |
| 直接嵌入 React 应用              | 不建议                               | 不建议                                       | 不建议，官方 UI 为独立 Vue 应用        | Inbox 可嵌入，但管理面和权限不匹配             | 不建议，独立控制台                                          |
| 业务事实可追溯                   | 不具备                               | 依赖索引中是否携带来源                       | 支持属性和历史，但不理解本平台事实版本 | 只记录通知事件                                 | 以监控数据为中心，不理解本平台业务版本                      |

## 四、逐项研究

### 4.1 Prometheus Alertmanager

#### 已证实能力

Alertmanager 官方定位是接收 Prometheus 等客户端已经产生的告警，负责去重、分组、路由、静默和抑制，再发到正确接收器。[官方仓库说明](https://github.com/prometheus/alertmanager)

Prometheus 自己负责规则表达式、`for` 持续时间、`pending` 和 `firing`；官方文档明确说明 Alertmanager 是在规则之后增加汇总、限流、静默和告警依赖的层。[Prometheus 告警规则](https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/)

Alertmanager 的路由树提供 `group_by`、`group_wait`、`group_interval` 和 `repeat_interval`，抑制规则可让高层故障压住依赖告警。接收器支持 Email、Webhook、企业微信以及多种海外服务。[Alertmanager 配置](https://prometheus.io/docs/alerting/latest/configuration/)；[通知集成列表](https://prometheus.io/docs/alerting/latest/integrations/)

官方 API v2 公开 alerts、alert groups、receivers、silences 和 status；alert 状态为 `unprocessed`、`active` 或 `suppressed`，没有独立的业务确认、指派、整改或关闭资源。这是根据官方 OpenAPI 契约作出的边界判断。[Alertmanager API v2](https://github.com/prometheus/alertmanager/blob/main/api/v2/openapi.yaml)

#### 适合本平台的部分

- 现有技术运维告警继续使用，不重复迁移。
- 复用“稳定标签指纹、分组等待、重复间隔、父告警抑制子告警、带有效期静默”的设计思想。
- 通过通用 Webhook 接收器接入本平台批准的通知适配器。
- 运维告警需要在业务应用中出现时，只做只读镜像，并明确标注“系统运行预警”。

#### 不适合作为业务预警内核的原因

- 不评估 PostgreSQL 中的粮食业务事实。
- 确认、责任人、处置意见和整改证据不是其领域模型。
- Prometheus 标签不适合承载业务正文、身份证明、表单内容或高基数业务坐标。
- 告警恢复不等于业务审核完成或整改关闭。

### 4.2 OpenSearch Alerting

#### 已证实能力

OpenSearch Alerting 支持按查询、桶、PPL、集群指标、文档和组合监控运行规则。[官方监控类型文档](https://docs.opensearch.org/latest/observing-your-data/alerting/monitors/)

查询和桶级规则可使用阈值或 Painless 脚本；组合监控可以顺序执行多个监控，以 `AND`、`OR`、`NOT` 组合审计告警，最终只产生一个链式告警。[触发器文档](https://docs.opensearch.org/latest/observing-your-data/alerting/triggers/)；[组合监控文档](https://docs.opensearch.org/latest/observing-your-data/alerting/composite-monitors/)

其生命周期包括 `Active`、`Acknowledged`、`Completed`、`Error` 和 `Deleted`；条件不再成立时进入 `Completed`，API 可以批量确认活动告警。[Alerting 总览](https://docs.opensearch.org/latest/observing-your-data/alerting/index/)；[Alerting API](https://docs.opensearch.org/latest/observing-your-data/alerting/api/)

通知插件支持 SMTP、Webhook、Slack、Teams、SNS、SES 和 Chime。不过官方文档明确警告：自定义 Webhook 的编码凭据当前可能以未加密、未哈希的形式存于集群并被其他 OpenSearch 用户看到。[Notifications 文档](https://docs.opensearch.org/latest/observing-your-data/notifications/index/)

#### 适合本平台的部分

- 如果未来正式建设日志检索、事件搜索或全文分析索引，可用文档级或桶级监控发现索引异常。
- 组合监控的“多个基础条件汇成一个结论”值得借鉴。
- `Active → Acknowledged → Completed` 是可参考但不够完整的最小状态链。

#### 当前不建议引入的原因

- 现有业务权威库是 PostgreSQL。为预警额外复制到 OpenSearch 会增加 CDC/事务发件箱、延迟、水位、回放、删除和权限同步问题。
- OpenSearch 是完整搜索集群，不是可嵌入 Spring Boot 的轻量规则库。官方安装要求 JVM、磁盘、内核参数和独立端口，建议堆内存约占系统内存一半。[OpenSearch 安装要求](https://docs.opensearch.org/latest/install-and-configure/install-opensearch/index/)
- 告警确认不等于指派、整改、审批或业务关闭。
- 只为首版预警引入它，基础设施成本明显超过收益。

### 4.3 Alerta

#### 已证实能力

Alerta 9 需要 Python 3.9 以上，并可选择 PostgreSQL 13 以上或 MongoDB 6 以上作为唯一强制依赖；核心采用 Apache-2.0。[官方仓库](https://github.com/alerta/alerta)

Alerta 使用 `environment + resource + event` 对同严重度告警去重，并可用同一资源上的相关事件更新一个既有告警。它保留重复次数、前一严重度、趋势、最近接收时间和严重度/状态历史。[Server & API 文档](https://docs.alerta.io/server.html)；[Alert Format](https://docs.alerta.io/api/alert.html)

其状态机包含 `open`、`ack`、`shelved`、`blackout`、`closed` 和 `expired`。已确认告警在严重度真正上升时可重新打开，正常严重度会自动关闭。[Alert Lifecycle](https://docs.alerta.io/lifecycle.html)

Alerta 的插件可在接收前、接收后和状态变化时扩展；大量 Slack、Telegram、钉钉、Teams、短信等通知能力位于单独的 `alerta-contrib` 仓库，属于“有生态但一致性和维护边界需要逐项验证”的模式。[官方插件文档](https://docs.alerta.io/plugins.html)；[alerta-contrib 官方仓库](https://github.com/alerta/alerta-contrib)

#### 适合本平台的部分

- 借鉴“同一稳定业务键只维护一个当前预警实例，同时追加发生次数和状态历史”。
- 借鉴“确认后严重度升级应重新引起注意”。
- 借鉴“静默、黑障、过期和关闭是不同语义”。
- 借鉴详情页对自动变化与人工动作的区分。

#### 不建议直接嵌入的原因

- 它汇聚告警，不负责从粮食业务数据评估正式规则。
- 其 `assign` 状态在官方文档中仍是没有转换的占位项，不能替代责任分派和整改闭环。
- 会引入 Python 服务、独立 API、独立 Web UI、认证授权映射和插件运维。
- 固定的去重键无法直接覆盖“地区 × 品种 × 期间 × 指标 × 规则版本”等本平台业务坐标。

### 4.4 Novu

#### 已证实能力

Novu 的强项是从一个应用事件开始，按条件、延时、摘要和节流步骤编排站内、Email、SMS、Push 和 Chat 通知，并提供 Activity Feed、用户偏好和 React Inbox。[工作流概念](https://docs.novu.co/platform/concepts/workflows)；[工作流总览](https://docs.novu.co/platform/workflow/overview)

官方自建文档显示，单机建议至少 4 vCPU / 8 GB RAM，并需要 MongoDB、Redis 和对象存储；推荐多机架构会拆分 API、Worker、WebSocket、Dashboard、两个 Redis 集群、MongoDB 集群和 S3。[自建要求](https://github.com/novuhq/novu/blob/next/docs/community/self-hosting-novu/overview.mdx)；[Docker 部署文档](https://github.com/novuhq/novu/blob/next/docs/community/self-hosting-novu/deploy-with-docker.mdx)

社区自建版虽然有多渠道、工作流和 Inbox，但官方对比表明确列出：没有自定义 OIDC/SAML SSO、没有 RBAC、没有 MFA、团队成员上限为 1，并且没有邮件送达/参与度追踪、Inbox Snooze 等能力。[社区自建与云版对比](https://github.com/novuhq/novu/blob/next/docs/community/self-hosted-and-novu-cloud.mdx)

Novu 是开放核心：`enterprise` 目录受专有许可证约束，其他未受限内容按 MIT 提供。采用前必须做精确路径和制品许可证清单，不能笼统写成“全部 MIT”。[许可证边界](https://github.com/novuhq/novu/blob/next/LICENSE-ENTERPRISE)

#### 适合本平台的部分

- 当通知渠道增长到站内、邮件、短信、Push、企业 IM 且需要摘要、延时、偏好和升级链时，可作为独立发送编排器。
- 官方提供 Java SDK 和自定义服务地址，Spring Boot 可通过事务发件箱异步调用自建 API。[自建 Java SDK 配置示例](https://github.com/novuhq/novu/blob/next/docs/community/self-hosting-novu/deploy-with-docker.mdx)
- React Inbox 可作为交互参考，但“已读”仍不能等同于预警确认。

#### 首版不建议部署的原因

- 它不判断业务条件，也不保存预警整改事实。
- 社区版身份治理与现有企业 OIDC、职责分离不匹配，不能公开暴露管理台。
- MongoDB、Redis、Worker、WebSocket 和对象存储显著扩大生产运维面。
- 多数外部通道最终仍依赖具体供应商；自建 Novu 不等于国内链路已经可达。

### 4.5 Apache HertzBeat

#### 已证实能力

HertzBeat 是 Apache-2.0 的 Java / Spring Boot 监控平台，支持实时和计划阈值、表达式、PromQL、自定义监控模板以及第三方告警接入。[官方仓库](https://github.com/apache/hertzbeat)；[阈值规则](https://hertzbeat.apache.org/docs/help/alert_threshold_expr/)

其告警链包含分组收敛、重复去重、抑制和静默。分组策略提供与 Alertmanager 相似的等待时间、组间隔和重复间隔；抑制按源标签、目标标签和相等标签建立依赖；静默支持一次性和周期时间段。[告警分组](https://hertzbeat.apache.org/ko/docs/help/alarm_group/)；[告警抑制](https://hertzbeat.apache.org/ko/docs/help/alarm_inhibit/)；[告警静默](https://hertzbeat.apache.org/docs/help/alarm_silence/)

HertzBeat 的 Webhook 状态包含待处理、未达到触发次数、恢复和已处理；告警中心支持处理、标回未处理和清除。通知渠道包括 Email、SMS、Webhook、钉钉、企业微信和飞书等，符合国内常见接入面。[Webhook 通知契约](https://hertzbeat.apache.org/docs/help/alert_webhook/)；[官方告警能力总览](https://hertzbeat.apache.org/docs/next/)

#### 适合本平台的部分

- 是本次候选中最值得参考的中文告警中心信息架构。
- 分组、抑制、静默与国内通知策略可以作为首版产品框架参考。
- Webhook 可用于接收现有 Alertmanager 技术告警，适合未来独立运维告警中心的概念验证。

#### 不建议直接作为应用中心业务预警的原因

- 它的核心仍是监控对象、采集任务和指标阈值，不理解业务填报、审核、发布、地区权限和事实版本。
- 它带有完整监控平台和 Angular 控制台，直接嵌入会破坏现有 React 应用外壳、导航、权限和视觉一致性。
- “已处理/未处理”不足以表达责任人、整改、审核关闭和证据链。
- 自定义 JDBC 或 HTTP 采集业务数据会绕过现有业务 API、数据授权与审计，不应采用。

## 五、推荐的业务预警框架

### 5.1 模块边界

在现有 Spring Boot 模块化单体中增加独立 `warning-management` 领域模块，而不是新建第二个业务平台。模块只通过明确的领域事件或版本化只读查询读取以下来源：

- 正式提交、审核、退回、发布和逾期任务事件；
- 已发布指标及其来源版本；
- 数据质量阻断/警告结果；
- 经批准接入的外部公共数据，必须保留来源、采集时间和“发布/估计/预测”标识；
- 经批准映射的 Prometheus/Alertmanager 运维告警，只进入独立的“系统运行”分类。

禁止规则模块绕过服务直接拼任意业务表，也禁止前端计算正式预警。

### 5.2 最小领域对象

| 对象                           | 责任                         | 必须保存的关键字段                                                                |
| ------------------------------ | ---------------------------- | --------------------------------------------------------------------------------- |
| `warning_rule`                 | 稳定规则身份                 | 规则编码、业务域、所有者、适用权限范围                                            |
| `warning_rule_version`         | 不可变规则版本               | 表达式类型、参数、持续时间、解除条件、严重度、有效期、审批状态、创建/审批人       |
| `warning_evaluation_run`       | 一次可重放评估               | 规则版本、计划/事件触发、截止水位、开始结束时间、输入数量、命中数量、错误         |
| `warning_instance`             | 一个稳定业务坐标上的当前预警 | 指纹、规则、地区、对象、品种、期间、严重度、条件状态、处置状态、首次/最近命中时间 |
| `warning_occurrence`           | 每次命中或恢复证据           | 来源记录 ID/版本、实际值、单位、阈值、质量状态、评估时间、结果摘要                |
| `warning_transition`           | 状态审计                     | 前后状态、动作类型、自动/人工、操作者、原因、时间、traceId                        |
| `warning_silence`              | 有时限的通知抑制             | 匹配范围、开始/结束、原因、创建/批准人、失效状态                                  |
| `warning_notification_attempt` | 通知送达记录                 | 预警、通道、接收策略、幂等键、尝试次数、供应商回执、失败原因、时间                |

### 5.3 指纹与去重

推荐指纹基于稳定业务坐标：

```text
ruleKey + domain + regionId + subjectType + subjectId + commodity + period + dimensionKey
```

规则版本不应默认进入指纹，否则每次改阈值都会制造一批重复活动预警；每个 occurrence 必须保存实际采用的规则版本。只有规则语义被正式拆分为新规则时才改变 `ruleKey`。

同一指纹重复命中时：

- 不创建第二个活动实例；
- 追加 occurrence，更新最近命中时间和当前严重度；
- 严重度上升时重新要求确认并按升级策略通知；
- 条件恢复时进入已解除，不删除历史；
- 已关闭后再次命中应重新打开或创建新 episode，具体策略必须按规则配置并可审计。

### 5.4 生命周期

建议把“事实条件”和“人员处置”分开保存，避免一个状态字段表达两件事：

| 维度     | 状态               | 含义                                         |
| -------- | ------------------ | -------------------------------------------- |
| 条件状态 | `PENDING`          | 已命中但尚未达到持续时间或次数               |
| 条件状态 | `ACTIVE`           | 条件仍成立                                   |
| 条件状态 | `CLEARED`          | 条件已恢复或收到正式解除事件                 |
| 条件状态 | `NO_DATA`          | 输入不足，不能判定正常或异常                 |
| 条件状态 | `EVALUATION_ERROR` | 规则执行失败，不能静默当作正常               |
| 处置状态 | `UNACKNOWLEDGED`   | 尚无人确认                                   |
| 处置状态 | `ACKNOWLEDGED`     | 已确认看到，不代表问题消失                   |
| 处置状态 | `IN_PROGRESS`      | 已指派并处置中                               |
| 处置状态 | `CLOSED`           | 条件已清除且闭环完成，或有授权的人工关闭原因 |

静默是独立策略，不进入上述状态。通知送达、已读和预警确认也分别记录，不能互相代替。

### 5.5 规则类型

第一版框架只需支持有限且可审计的规则类型，不应一开始引入任意脚本：

1. 数值阈值：大于、小于、区间外，明确单位和小数精度。
2. 期限规则：到期未提交、未审核、未发布。
3. 数据质量：已有校验结果为阻断或警告。
4. 缺失/中断：预期数据在明确截止时间后仍未到达。
5. 变化率：必须指定基期、可比范围、最小样本量和缺失处理。
6. 组合规则：有限的 `AND` / `OR`，引用已批准的基础规则结果。

所有表达式必须由后端白名单解析为类型化结构，不允许在数据库中保存并执行任意 JavaScript、SpEL、SQL 或 Painless。

### 5.6 应用中心首版信息架构

“预警中心”应用建议包含：

1. **预警总览**：只显示真实活动预警、待确认、处置中、已解除和评估异常数量；每个数字可下钻到同一查询结果。
2. **活动预警**：按严重度、业务域、地区、品种、期间、责任人和状态筛选。
3. **预警详情**：显示为什么触发、实际值/阈值/单位、来源记录、规则版本、发生历史、确认、指派、处置和通知历史。
4. **规则管理**：草稿、试算、提交审核、批准启用、停用和版本历史；规则编制与规则批准分权。
5. **静默与维护窗口**：有明确范围、期限、原因和审批；过期自动失效。
6. **通知策略**：站内、邮件、企业微信/批准 Webhook 的接收人和升级链；不在浏览器保存通道秘密。
7. **审计记录**：所有规则和处置动作可按操作者、时间和对象查询。

在没有获批规则前，应用入口可以正常上线，但页面应显示“尚未启用预警规则”，不得预置虚构的高风险、趋势或命中数量。

### 5.7 权限建议

权限必须复用现有身份和区域授权：

- `WARNING_READ`：读取授权业务范围内的预警；
- `WARNING_ACKNOWLEDGE`：确认预警；
- `WARNING_ASSIGN`：指派责任人；
- `WARNING_HANDLE`：填写处置和整改证据；
- `WARNING_RULE_PROPOSE`：起草规则；
- `WARNING_RULE_APPROVE`：批准规则，与起草职责分离；
- `WARNING_SILENCE`：申请静默；
- `WARNING_SILENCE_APPROVE`：批准高影响静默；
- `WARNING_ADMIN`：管理通道和字典，不自动获得全部业务数据读取权。

普通启用员工可以在其业务授权范围内读取和处理预警；身份管理、跨区域规则批准、全局静默和通道秘密仍属于管理职责。

## 六、通知架构与国内网络边界

### 6.1 首版建议

首版使用事务发件箱连接三个可控通道：

1. 站内通知：写入本平台通知表，通过现有实时机制或轮询展示。
2. SMTP：对接已批准的企业邮件服务。
3. 通用 Webhook：由服务器端适配企业微信、钉钉或其他批准目标。

通道适配器只接收最小通知载荷，详细业务内容通过登录后的站内详情查看。Webhook 和邮件中不放身份证明、原始表单、秘密或超出接收人权限的数据。

### 6.2 国内网络判断

| 项目                | 可完全自建 | 可不用海外 SaaS 完成基本通知            | 仍需处理的网络依赖                                          |
| ------------------- | ---------- | --------------------------------------- | ----------------------------------------------------------- |
| Alertmanager        | 是         | 是；SMTP、Webhook、企业微信             | 镜像/二进制应进入批准制品库；外部接收器逐项放行             |
| OpenSearch Alerting | 是         | 是；SMTP、Webhook                       | OpenSearch 制品、插件、JVM 集群；AWS/Slack 等通道可不启用   |
| Alerta              | 是         | 是；自建 SMTP/插件/Webhook              | Python 包和 contrib 插件应镜像并锁版本                      |
| Novu                | 是         | 是；自建 SMTP/通用提供器                | GHCR/npm 制品、MongoDB/Redis/S3；短信/Push/聊天仍依赖供应商 |
| HertzBeat           | 是         | 是；企业微信、钉钉、飞书、SMTP、Webhook | 官方镜像/包应进入批准制品库；具体机器人端点需网络准入       |

“支持某通道”不代表当前公网环境已经送达。每个正式通道都必须分别验证 DNS、TLS、出口、超时、重试、签名、回执、限流和真实接收人，并保留送达证据。

## 七、不建议方案

### 7.1 不把 Alertmanager 当业务工单系统

静默不是确认，`resolved` 不是整改完成，标签也不是业务事实表。强行使用会丢失责任、证据、地区权限和审核闭环。

### 7.2 不为首版预警单独建设 OpenSearch

这会为了规则查询引入第二份业务数据和一个搜索集群。除非已有独立批准的搜索需求和可靠索引血缘，否则收益不足以覆盖一致性和运维成本。

### 7.3 不直接 iframe 外部控制台

Alerta、HertzBeat、OpenSearch Dashboards 和 Novu Dashboard 都有自己的身份、权限、路由和 UI。iframe 会造成双重登录、权限绕过、样式割裂、跨域和审计归属不清。

### 7.4 不把 Novu Inbox 的“已读”当作预警“已确认”

消息已读只证明客户端交互，业务确认必须记录操作者、时间、权限范围和确认意见；严重度升级后还可能需要重新确认。

### 7.5 不上来就引入通用脚本规则引擎

允许业务人员输入任意 SQL、SpEL、JavaScript 或其他脚本，会引入数据越权、资源耗尽、不可复现和代码执行风险。第一版类型化规则足以覆盖阈值、期限、缺失、质量和有限组合。

### 7.6 不采用已归档的 Grafana OnCall OSS

Grafana OnCall 开源仓库已经迁入 `grafana-cold-storage` 并标记 archived；即使其值班和升级模型有参考价值，也不应作为新系统核心依赖。[官方归档仓库](https://github.com/grafana-cold-storage/oncall)

## 八、分阶段落地建议

### 阶段 A：框架与空状态

- 在应用中心增加“预警中心”入口，使用现有登录、导航和权限。
- 建立规则、评估、实例、发生、状态历史、静默、通知和事务发件箱模型。
- 页面不含模拟预警；没有获批规则时显示可解释空状态。
- 先完成规则草稿、试算、审核、启停和审计，不启用未经业务批准的阈值。

### 阶段 B：一个真实闭环

- 只选择一个已有权威事件的规则，例如经批准的“到期未填报”或“质量阻断未处理”，具体由业务负责人决定。
- 使用真实 PostgreSQL 数据完成触发、去重、确认、指派、恢复、关闭和历史回查。
- 打通站内通知，再对一个批准的外部通道做真实送达验收。
- 验证普通员工只能处理其授权地区和业务范围。

### 阶段 C：降噪和组合规则

- 增加 `for` 持续时间、触发次数、冷却期、分组、抑制、静默和严重度升级。
- 增加有限组合规则与规则试算对比。
- 将运维告警以独立分类只读汇总，不改写 Alertmanager 权威状态。

### 阶段 D：通知平台评估

只有满足以下任一条件才启动 Novu 或其他独立通知平台 POC：

- 正式通道达到三种以上且提供者频繁变化；
- 需要复杂延时、摘要、用户偏好或升级序列；
- 自建通知队列和提供者适配器的维护成本已经可量化地超过独立平台成本。

POC 必须先解决社区版 RBAC/OIDC 缺口、许可证路径、国内制品镜像、数据最小化、灾备和升级回滚，不能直接暴露其管理台。

## 九、验收门槛

框架完成不能只以页面出现为准。至少需要：

1. 规则试算与正式评估使用同一后端实现，正式启用必须经过批准。
2. 同一指纹重复输入不产生重复活动实例，并保留 occurrence。
3. 缺失、0、不适用、质量阻断和评估错误分别可见。
4. 确认不解除活动条件；静默不改变事实状态；恢复不删除历史。
5. 所有状态变化都能回查操作者、原因、规则版本和输入证据。
6. 通知发送有幂等键、重试上限、失败原因和回执；通知失败不丢预警。
7. 实际普通员工、规则审批人和管理员分别完成权限验收。
8. 真实 PostgreSQL 重查、真实 HTTP、真实浏览器和至少一个真实通知通道分别验收。
9. 公网发布后从正式入口重新登录、读取和操作；本地测试、健康检查、部署日志和公网验收分别陈述。
10. 正式环境没有 fixtures、mock、样例告警、虚构数量或未落库按钮。

## 十、最终选型

| 层次                         | 选型                           | 决定                                     |
| ---------------------------- | ------------------------------ | ---------------------------------------- |
| 业务规则与预警台账           | 现有 Spring Boot + PostgreSQL  | **自建领域模块，作为唯一权威来源**       |
| 业务预警前端                 | 现有 React 应用中心            | **原生页面，不嵌外部控制台**             |
| 技术运维告警                 | 现有 Prometheus + Alertmanager | **保留并继续完善**                       |
| 状态机与历史参考             | Alerta                         | **借鉴，不直接部署为业务核心**           |
| 分组/抑制/静默与国内渠道参考 | Apache HertzBeat               | **重点借鉴；必要时做独立运维告警 POC**   |
| 搜索索引告警                 | OpenSearch Alerting            | **只有平台正式采用 OpenSearch 后再评估** |
| 多渠道通知编排               | 首版本地适配层；后期 Novu POC  | **Novu 不进入首版关键路径**              |

该选择最大程度复用现有系统框架、身份、权限、数据库、审计和发布方式，同时吸收成熟开源项目已经验证过的告警降噪与生命周期思想，不把外部平台的技术监控模型误当作粮食业务模型。
