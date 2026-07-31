import { useState } from "react";
import type { BusinessReportContext } from "./businessReportModel";
import type { ProductionSection } from "./formalEnterpriseModel";
import {
  productionCropProfiles,
  productionObjectRows,
  productionReviewRows,
} from "./productionMonitoringData";
import {
  getProductionFieldGroups,
  productionCropLabels,
  productionObjectLabels,
  type ProductionCrop,
  type ProductionObjectType,
} from "./productionMonitoringModel";
import {
  BusinessContextBar,
  CollectionModeSwitch,
  type CollectionMode,
  WorkspaceFilterBar,
  WorkspaceHeader,
  WorkspaceStatus,
  WorkspaceSummaryStrip,
  WorkspaceTable,
  WorkspaceTableToolbar,
  type WorkspaceTone,
} from "./UnifiedWorkspacePrimitives";

export interface ProductionMonitoringWorkspaceProps {
  section: ProductionSection;
  onSectionChange?: (section: ProductionSection) => void;
  onComposeReport: (context: BusinessReportContext) => void;
}

const productionReportContext: BusinessReportContext = {
  application: "production",
  applicationLabel: "产情监测",
  product: "玉米",
  region: "齐齐哈尔指定范围",
  regionLevel: "区域正式估计",
  period: "2026 年第 30 周",
  dataCutoff: "7 月 24 日 17:00",
  dataVersion: "产情监测第 30 周正式指标版本",
  author: "王洋",
  reviewer: "赵晨",
};

function statusTone(value: string): WorkspaceTone {
  if (value.includes("缺失") || value.includes("逾期")) return "danger";
  if (
    value.includes("待") ||
    value.includes("退回") ||
    value.includes("警告") ||
    value.includes("复核")
  ) {
    return "warning";
  }
  if (
    value.includes("正常") ||
    value.includes("通过") ||
    value.includes("按时") ||
    value.includes("发布")
  ) {
    return "good";
  }
  return "normal";
}

function ProductionContext({
  object,
  state,
  tone,
}: {
  object: string;
  state: string;
  tone?: WorkspaceTone;
}) {
  return (
    <BusinessContextBar
      items={[
        ["监测区域", "齐齐哈尔指定范围"],
        ["业务对象", object],
        ["监测期间", "2026 年第 31 周 · 灌浆期"],
        ["截止时间", "7 月 31 日 17:00"],
      ]}
      state={state}
      tone={tone}
    />
  );
}

function ProductionScope({
  crop,
  onCropChange,
}: {
  crop: ProductionCrop;
  onCropChange: (crop: ProductionCrop) => void;
}) {
  const profile = productionCropProfiles.find((item) => item.key === crop)!;
  return (
    <section
      aria-label="品种与质量监测范围"
      className="production-scope-panel"
    >
      <WorkspaceTableToolbar
        title="品种与质量监测范围"
        note="保留填报原始品种名称；待映射品种不覆盖原值"
      />
      <div className="production-crop-switch">
        {productionCropProfiles.map((item) => (
          <button
            aria-pressed={item.key === crop}
            className={item.key === crop ? "is-active" : undefined}
            key={item.key}
            type="button"
            onClick={() => onCropChange(item.key)}
          >
            <strong>{item.label}</strong>
            <small>{item.area}</small>
            {item.key !== crop && (
              <em>
                {item.varieties.slice(0, 2).map((variety) => (
                  <span key={variety.name}>{variety.name}</span>
                ))}
              </em>
            )}
          </button>
        ))}
      </div>
      <div className="production-scope-detail">
        <div>
          <small>具体品种</small>
          <div className="production-tag-list">
            {profile.varieties.map((variety) => (
              <span
                className={
                  variety.status === "待映射" ? "is-warning" : undefined
                }
                key={variety.name}
              >
                {variety.name}
                <small>{variety.status}</small>
              </span>
            ))}
          </div>
        </div>
        <div>
          <small>质量指标</small>
          <div className="production-tag-list">
            {profile.quality.map((quality) => (
              <span key={quality}>{quality}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductionOverview({
  onSectionChange,
}: {
  onSectionChange?: (section: ProductionSection) => void;
}) {
  const [crop, setCrop] = useState<ProductionCrop>("corn");
  const profile = productionCropProfiles.find((item) => item.key === crop)!;
  return (
    <div className="unified-workspace production-workspace">
      <WorkspaceHeader
        eyebrow="产情监测 / 产情总览"
        title="种植生产监测工作区"
        summary="在同一工作区查看调查对象、具体品种、质量、样本结果、区域估计和发布状态。"
        actions={
          <>
            <button
              type="button"
              onClick={() => onSectionChange?.("collection")}
            >
              导入调查结果
            </button>
            <button
              className="is-primary"
              type="button"
              onClick={() => onSectionChange?.("collection")}
            >
              进入数据采集
            </button>
          </>
        }
      />
      <ProductionContext
        object={`${productionCropLabels[crop]} · 产情调查与区域估计`}
        state="本期调查进行中"
      />
      <ProductionScope crop={crop} onCropChange={setCrop} />
      <WorkspaceSummaryStrip
        label="产情业务摘要"
        items={[
          {
            label: `${profile.label}监测面积`,
            value: profile.area,
            note: "正式行政台账口径",
            tone: "good",
          },
          {
            label: "预计单产",
            value: profile.expectedYield,
            note: "正式区域估计",
          },
          {
            label: "有效样本",
            value: "554 个",
            note: "样本响应率 92.4%",
          },
          {
            label: "质量阻断",
            value: "5 项",
            note: "关闭前不得正式发布",
            tone: "danger",
          },
        ]}
      />
      <WorkspaceTableToolbar
        title="样本结果与区域估计"
        note="样本观测不直接作为区域总量，发布条件单独核定"
      />
      <WorkspaceTable
        columns={["统计口径", "本期结果", "来源与方法", "状态"]}
        label="样本结果与区域估计"
        rows={[
          [
            "样本结果",
            profile.sampleResult,
            "554 个有效样本 · 样本响应率 92.4%",
            <WorkspaceStatus key="sample-result">
              调查观测
            </WorkspaceStatus>,
          ],
          [
            "区域估计",
            profile.regionalEstimate,
            "分层权重第 7 版 · 95% 区间 ±6.8 公斤/亩",
            <WorkspaceStatus key="regional-estimate" tone="good">
              正式估计
            </WorkspaceStatus>,
          ],
          [
            "有效数据覆盖率",
            "89.7%",
            "按适用字段和正式免报项目计算",
            <WorkspaceStatus key="coverage" tone="warning">
              待提高
            </WorkspaceStatus>,
          ],
          [
            "质量阻断",
            "5 项",
            "稻谷检验单、玉米测产依据等待补充",
            <WorkspaceStatus key="quality-block" tone="danger">
              阻断
            </WorkspaceStatus>,
          ],
        ]}
      />
      <WorkspaceTableToolbar
        title="产情调查任务"
        note="行政台账、农技站观察和农户样本分别展示"
      />
      <WorkspaceTable
        columns={[
          "监测对象",
          "来源通道",
          "行政区划",
          "作物与品种",
          "当前状态",
        ]}
        label="产情调查任务"
        rows={productionObjectRows.slice(0, 4).map((item) => [
          item.name,
          item.source,
          item.region,
          `${item.crops} · ${item.varieties}`,
          <WorkspaceStatus key={item.name} tone={statusTone(item.state)}>
            {item.state}
          </WorkspaceStatus>,
        ])}
      />
    </div>
  );
}

function ProductionObjects() {
  return (
    <div className="unified-workspace production-workspace">
      <WorkspaceHeader
        eyebrow="产情监测 / 监测对象"
        title="产情监测对象名录"
        summary="一个对象只建立一份档案，在档案内连续查看种植、余粮销售、意愿、质量和调查记录。"
        actions={
          <>
            <button type="button">导出对象清单</button>
            <button className="is-primary" type="button">
              新增监测对象
            </button>
          </>
        }
      />
      <ProductionContext object="全部授权产情监测对象" state="对象名录有效" />
      <WorkspaceSummaryStrip
        label="产情对象摘要"
        items={[
          {
            label: "农户样本",
            value: "386 户",
            note: "一户一档",
          },
          {
            label: "家庭农场",
            value: "96 家",
            note: "种植与经营信息合并",
          },
          {
            label: "合作社",
            value: "42 家",
            note: "成员不重复建主体",
          },
          {
            label: "农技站与样方",
            value: "74 个",
            note: "专业观察与田间测产",
            tone: "good",
          },
        ]}
      />
      <WorkspaceTableToolbar
        title="产情监测对象"
        note="面积按耕地实际所在地统计，不按人员居住地替代。"
        actions={
          <>
            <button type="button">全部对象类型</button>
            <button type="button">全部地区</button>
          </>
        }
      />
      <WorkspaceTable
        columns={[
          "对象名称",
          "对象类型",
          "行政区划",
          "作物",
          "具体品种",
          "来源通道",
          "责任人",
          "状态",
        ]}
        label="产情监测对象名录"
        rows={productionObjectRows.map((item) => [
          item.name,
          productionObjectLabels[item.type],
          item.region,
          item.crops,
          item.varieties,
          item.source,
          item.owner,
          <WorkspaceStatus key={item.name} tone={statusTone(item.state)}>
            {item.state}
          </WorkspaceStatus>,
        ])}
      />
    </div>
  );
}

function ProductionOnlineEntry() {
  const [objectType, setObjectType] =
    useState<ProductionObjectType>("family-farm");
  const [crop, setCrop] = useState<ProductionCrop>("corn");
  const profile = productionCropProfiles.find((item) => item.key === crop)!;
  const fieldGroups = getProductionFieldGroups(objectType, crop);
  return (
    <div className="production-entry-layout">
      <aside className="production-entry-aside">
        <span>当前任务</span>
        <strong>梅里斯丰源家庭农场</strong>
        <p>玉米产情、余粮销售与质量调查</p>
        <dl>
          <div>
            <dt>责任人</dt>
            <dd>王洋（本人）</dd>
          </div>
          <div>
            <dt>责任区域</dt>
            <dd>梅里斯达斡尔族区</dd>
          </div>
          <div>
            <dt>截止</dt>
            <dd>今天 17:00</dd>
          </div>
        </dl>
        <WorkspaceStatus tone="warning">填写中 · 18/26 项</WorkspaceStatus>
      </aside>
      <div className="production-entry-body">
        <div className="production-entry-selectors">
          <label>
            <span>对象类型</span>
            <select
              value={objectType}
              onChange={(event) =>
                setObjectType(event.target.value as ProductionObjectType)
              }
            >
              {Object.entries(productionObjectLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>作物</span>
            <select
              value={crop}
              onChange={(event) =>
                setCrop(event.target.value as ProductionCrop)
              }
            >
              {Object.entries(productionCropLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <p>授权范围内唯一可写；审核人和管理员不能代填。</p>
        </div>
        <div className="production-form-sections">
          {fieldGroups.map((group) => (
            <section key={group.key}>
              <header>
                <strong>{group.label}</strong>
                <WorkspaceStatus
                  tone={group.key === "quality" ? "warning" : "good"}
                >
                  {group.key === "quality" ? "依据待补" : "已保存"}
                </WorkspaceStatus>
              </header>
              {group.key === "variety" && (
                <div className="production-inline-fields">
                  <label>
                    <span>具体品种</span>
                    <input
                      key={`variety-${crop}`}
                      defaultValue={profile.varieties[0].name}
                    />
                  </label>
                  <label>
                    <span>品种状态</span>
                    <input defaultValue={profile.varieties[0].status} readOnly />
                  </label>
                </div>
              )}
              {group.key === "area" && (
                <div className="production-inline-fields">
                  <label>
                    <span>播种面积</span>
                    <input defaultValue="4,680 亩" />
                  </label>
                  <label>
                    <span>收获面积预计</span>
                    <input defaultValue="4,590 亩" />
                  </label>
                  <label>
                    <span>灾损面积</span>
                    <input defaultValue="90 亩" />
                  </label>
                </div>
              )}
              {group.key === "growth" && (
                <div className="production-inline-fields">
                  <label>
                    <span>当前生育期</span>
                    <input defaultValue="灌浆期" />
                  </label>
                  <label>
                    <span>长势等级</span>
                    <input defaultValue="一类苗 76%" />
                  </label>
                  <label>
                    <span>灾情与病虫害</span>
                    <input defaultValue="轻度玉米螟" />
                  </label>
                </div>
              )}
              {group.key === "yield" && (
                <div className="production-inline-fields">
                  <label>
                    <span>样方测产</span>
                    <input defaultValue="472.8 公斤/亩" />
                  </label>
                  <label>
                    <span>预计单产</span>
                    <input defaultValue={profile.expectedYield} />
                  </label>
                  <label>
                    <span>估计依据</span>
                    <input defaultValue="3 个田间样方" />
                  </label>
                </div>
              )}
              {group.key === "quality" && (
                <div>
                  <h3>质量与检验依据</h3>
                  <div className="production-inline-fields">
                    {profile.quality.slice(0, 4).map((quality, index) => (
                      <label key={quality}>
                        <span>{quality}</span>
                        <input defaultValue={index === 0 ? "14.2%" : "合格"} />
                      </label>
                    ))}
                  </div>
                  <button type="button">上传检验单或现场照片</button>
                </div>
              )}
              {group.key === "stock-sale" && (
                <div className="production-inline-fields">
                  <label>
                    <span>期初余粮</span>
                    <input defaultValue="1,260 吨" />
                  </label>
                  <label>
                    <span>本期销售</span>
                    <input defaultValue="386 吨" />
                  </label>
                  <label>
                    <span>当前余粮</span>
                    <input defaultValue="862 吨" readOnly />
                  </label>
                </div>
              )}
              {group.key === "intention" && (
                <div className="production-inline-fields">
                  <label>
                    <span>当前正式面积</span>
                    <input defaultValue="4,680 亩" readOnly />
                  </label>
                  <label>
                    <span>下年度意向面积</span>
                    <input defaultValue="4,720 亩" />
                  </label>
                  <label>
                    <span>主要原因</span>
                    <input defaultValue="轮作安排与收益预期" />
                  </label>
                </div>
              )}
              {group.key === "cost-support" && (
                <div className="production-inline-fields">
                  <label>
                    <span>现金投入</span>
                    <input defaultValue="682 元/亩" />
                  </label>
                  <label>
                    <span>政策支持</span>
                    <input defaultValue="38 元/亩" />
                  </label>
                  <label>
                    <span>保险赔付</span>
                    <input defaultValue="0 元/亩" />
                  </label>
                </div>
              )}
              {group.key === "evidence" && (
                <p className="production-evidence-note">
                  已关联 3 张田间照片、1 份测产记录和 1 份调查定位信息。
                </p>
              )}
            </section>
          ))}
        </div>
        <footer className="production-form-footer">
          <small>保存和提交均记录本人账号、时间、设备和单据修订版本。</small>
          <button type="button">保存草稿</button>
          <button className="is-primary" type="button">
            校验并提交
          </button>
        </footer>
      </div>
    </div>
  );
}

function ProductionExcelEntry() {
  return (
    <div className="production-import-panel">
      <div>
        <span>Excel批量导入</span>
        <h2>产情调查批量导入</h2>
        <p>
          使用当前表单版本校验对象、品种、单位和适用字段；通过后进入同一校验与审核流程。
        </p>
      </div>
      <div className="production-import-steps">
        <article>
          <span>01</span>
          <strong>下载当前模板</strong>
          <p>模板已锁定地区、对象范围和第 31 周表单版本。</p>
        </article>
        <article>
          <span>02</span>
          <strong>上传并预检查</strong>
          <p>错误行不创建业务记录，可导出行级错误明细。</p>
        </article>
        <article>
          <span>03</span>
          <strong>进入同一校验与审核流程</strong>
          <p>由责任人确认提交，不绕过本人责任。</p>
        </article>
      </div>
      <button className="unified-button is-primary" type="button">
        选择 Excel 文件
      </button>
    </div>
  );
}

function ProductionSystemEntry() {
  return (
    <div className="production-system-panel">
      <header>
        <div>
          <span>授权系统接入</span>
          <h2>稳定数据来源与异常处理</h2>
          <p>系统接入只改变来源，不改变责任、校验和审核流程。</p>
        </div>
        <button className="unified-button" type="button">
          查看接入记录
        </button>
      </header>
      <WorkspaceTable
        columns={["来源", "最近同步", "接收记录", "异常", "采用状态"]}
        label="产情系统接入"
        rows={[
          [
            "县级农业生产台账",
            "今天 11:32",
            "286 条",
            "3 项品种待映射",
            <WorkspaceStatus key="ledger" tone="warning">
              待责任人确认
            </WorkspaceStatus>,
          ],
          [
            "农技站田间观测",
            "今天 10:48",
            "94 条",
            "0 项",
            <WorkspaceStatus key="station" tone="good">
              已进入校验
            </WorkspaceStatus>,
          ],
          [
            "气象灾情资料",
            "今天 09:20",
            "16 个县区",
            "1 个县区待补",
            <WorkspaceStatus key="weather" tone="warning">
              部分可用
            </WorkspaceStatus>,
          ],
        ]}
      />
    </div>
  );
}

function ProductionCollection() {
  const [mode, setMode] = useState<CollectionMode>("online");
  return (
    <div className="unified-workspace production-workspace">
      <WorkspaceHeader
        eyebrow="产情监测 / 数据采集"
        title="产情数据采集工作台"
        summary="在线填报、Excel批量导入和授权系统接入共用一份任务、表单、责任和审核记录。"
        actions={<button type="button">查看填报说明</button>}
      />
      <ProductionContext
        object="玉米 · 家庭农场产情与余粮调查"
        state="责任人本人可写"
      />
      <WorkspaceTableToolbar
        title="选择当前任务的数据进入方式"
        note="切换方式不会新建第二份业务单据。"
        actions={<CollectionModeSwitch mode={mode} onChange={setMode} />}
      />
      <section className="production-collection-workbench">
        {mode === "online" ? (
          <ProductionOnlineEntry />
        ) : mode === "excel" ? (
          <ProductionExcelEntry />
        ) : (
          <ProductionSystemEntry />
        )}
      </section>
    </div>
  );
}

function ProductionReview() {
  return (
    <div className="unified-workspace production-workspace">
      <WorkspaceHeader
        eyebrow="产情监测 / 审核发布"
        title="产情审核与结果发布"
        summary="履责、单据、质量和发布状态分别判断；审核人员不能直接修改填报值。"
        actions={
          <>
            <button type="button">查看质量规则</button>
            <button className="is-primary" type="button">
              进入发布复核
            </button>
          </>
        }
      />
      <ProductionContext
        object="全部授权产情调查单据"
        state="5 项质量阻断"
        tone="danger"
      />
      <WorkspaceSummaryStrip
        label="产情审核摘要"
        items={[
          {
            label: "待业务审核",
            value: "37 项",
            note: "按授权地区与事项",
            tone: "warning",
          },
          {
            label: "质量警告",
            value: "12 项",
            note: "允许说明后继续",
            tone: "warning",
          },
          {
            label: "质量阻断",
            value: "5 项",
            note: "不得进入正式发布",
            tone: "danger",
          },
          {
            label: "本期正式版本",
            value: "0 个",
            note: "预计今天 19:00 发布",
          },
        ]}
      />
      <WorkspaceTableToolbar
        title="产情单据审核队列"
        note="每列状态独立保存，避免用一个状态覆盖全部过程。"
      />
      <WorkspaceTable
        columns={[
          "单据",
          "地区",
          "责任人",
          "履责状态",
          "单据状态",
          "质量状态",
          "发布状态",
        ]}
        label="产情审核队列"
        rows={productionReviewRows.map((item) => [
          item.document,
          item.region,
          item.owner,
          <WorkspaceStatus
            key={`${item.document}-duty`}
            tone={statusTone(item.duty)}
          >
            {item.duty}
          </WorkspaceStatus>,
          <WorkspaceStatus
            key={`${item.document}-document`}
            tone={statusTone(item.documentState)}
          >
            {item.documentState}
          </WorkspaceStatus>,
          <WorkspaceStatus
            key={`${item.document}-quality`}
            tone={statusTone(item.quality)}
          >
            {item.quality}
          </WorkspaceStatus>,
          <WorkspaceStatus
            key={`${item.document}-publication`}
            tone={statusTone(item.publication)}
          >
            {item.publication}
          </WorkspaceStatus>,
        ])}
      />
    </div>
  );
}

function ProductionReports({
  onComposeReport,
}: {
  onComposeReport: (context: BusinessReportContext) => void;
}) {
  const [crop, setCrop] = useState<ProductionCrop>("corn");
  const product = productionCropLabels[crop];
  const context = { ...productionReportContext, product };
  return (
    <div className="unified-workspace production-workspace">
      <WorkspaceHeader
        eyebrow="产情监测 / 分析与报告"
        title="产情分析与业务报告"
        summary="从正式产情指标版本生成周报和关键农时专题，不重复填报区域汇总数。"
      />
      <ProductionContext
        object={`${product} · 正式产情指标`}
        state="第 30 周正式版本可用"
      />
      <WorkspaceFilterBar
        label="产情报告范围"
      >
        <label>
          <span>报告作物</span>
          <select
            aria-label="报告作物"
            value={crop}
            onChange={(event) =>
              setCrop(event.target.value as ProductionCrop)
            }
          >
            {productionCropProfiles.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>采用版本</span>
          <input
            aria-label="采用版本"
            readOnly
            value="产情监测第 30 周正式指标版本"
          />
        </label>
        <label>
          <span>数据范围</span>
          <input
            aria-label="数据范围"
            readOnly
            value="齐齐哈尔指定范围 · 16 个县区"
          />
        </label>
      </WorkspaceFilterBar>
      <WorkspaceTableToolbar
        title="产情报告清单"
        note="从正式产情指标版本生成，不重复录入汇总数"
      />
      <WorkspaceTable
        columns={["报告类型", "报告名称", "采用内容", "最近版本", "操作"]}
        label="产情报告清单"
        rows={[
          [
            "周报",
            `${product}产情监测周报`,
            "面积、长势、单产、产量和质量",
            "第 30 周正式周报",
            <button
              className="unified-table-action"
              key="weekly-report"
              type="button"
              onClick={() => onComposeReport(context)}
            >
              生成产情周报
            </button>,
          ],
          [
            "关键农时专题",
            `${product}关键农时专题`,
            "播种、灌浆、测产或收获专题",
            "按报告计划开放",
            <button
              className="unified-table-action"
              key="seasonal-report"
              type="button"
            >
              选择专题期间
            </button>,
          ],
          [
            "历史版本",
            "产情报告历史",
            "采用指标版本、文件和发布时间",
            "7 月 25 日 18:40 发布",
            <button
              className="unified-table-action"
              key="report-history"
              type="button"
            >
              查看历史版本
            </button>,
          ],
        ]}
      />
    </div>
  );
}

export function ProductionMonitoringWorkspace({
  section,
  onSectionChange,
  onComposeReport,
}: ProductionMonitoringWorkspaceProps) {
  if (section === "objects") return <ProductionObjects />;
  if (section === "collection") return <ProductionCollection />;
  if (section === "review") return <ProductionReview />;
  if (section === "reports") {
    return <ProductionReports onComposeReport={onComposeReport} />;
  }
  return <ProductionOverview onSectionChange={onSectionChange} />;
}
