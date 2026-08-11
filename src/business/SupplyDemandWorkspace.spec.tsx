import { readFileSync } from "node:fs";
import { useState } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { OperationalScope } from "./core/operationalScope";
import { businessWorkFixtures } from "./data/businessWorkFixtures";
import { EnterpriseRegionProvider } from "./EnterpriseRegionContext";
import type { EnterpriseRegionId } from "./enterpriseRegions";
import { fixtureOperationalIdentity } from "./formalEnterpriseData";
import type {
  BusinessCoordinates,
  SupplySection,
} from "./formalEnterpriseModel";
import {
  FormalSupplyDemandWorkspace,
  SupplyDemandWorkspace,
  type SupplyDemandWorkspaceProps,
} from "./SupplyDemandWorkspace";

afterEach(cleanup);

function RegionHarness({
  section = "calculation",
  onComposeReport = vi.fn<SupplyDemandWorkspaceProps["onComposeReport"]>(),
}: {
  section?: SupplySection;
  onComposeReport?: SupplyDemandWorkspaceProps["onComposeReport"];
}) {
  const [regionId, setRegionId] = useState<EnterpriseRegionId>("qiqihar-all");
  return (
    <EnterpriseRegionProvider regionId={regionId} onRegionChange={setRegionId}>
      <SupplyDemandWorkspace
        section={section}
        onComposeReport={onComposeReport}
      />
    </EnterpriseRegionProvider>
  );
}

async function selectCompleteAccount(
  user: ReturnType<typeof userEvent.setup>,
  approval = "approval-3",
) {
  await user.selectOptions(
    screen.getByRole("combobox", { name: "产品账户" }),
    "corn",
  );
  await user.selectOptions(
    screen.getByRole("combobox", { name: "营销年度" }),
    "2026-27",
  );
  await user.selectOptions(
    screen.getByRole("combobox", { name: "账户核定记录" }),
    approval,
  );
}

async function selectSupplyRegion(
  user: ReturnType<typeof userEvent.setup>,
  cityName: string,
  countyName?: string,
) {
  const region = screen.getByRole("group", { name: "业务地区" });
  await user.click(within(region).getByLabelText("选择地区"));
  if (cityName !== "齐齐哈尔市") {
    await user.click(
      within(screen.getByLabelText("地市选项")).getByRole("button", {
        name: cityName,
      }),
    );
  }
  if (countyName) {
    await user.click(
      within(screen.getByLabelText("区县选项")).getByRole("button", {
        name: countyName,
      }),
    );
  }
  await user.click(screen.getByRole("button", { name: "完成" }));
}

describe("supply demand workspace", () => {
  it("lets employees choose the product on the unified supply balance page", () => {
    render(<RegionHarness section="balance" />);

    const product = screen.getByRole("combobox", { name: "产品账户" });
    expect(product).toBeVisible();
    expect(product).toHaveTextContent("玉米原粮");
    expect(product).toHaveTextContent("大豆原粮");
    expect(product).toHaveTextContent("稻谷原粮");
  });

  it("lets the selected supply menu own the product instead of repeating a product filter", () => {
    render(<RegionHarness section="corn-balance" />);

    expect(
      screen.queryByRole("combobox", { name: "产品账户" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/齐齐哈尔市全域.*玉米原粮/)).toBeVisible();
    expect(screen.getByRole("combobox", { name: "营销年度" })).toBeVisible();
    expect(
      screen.getByRole("combobox", { name: "账户核定记录" }),
    ).toBeVisible();
  });

  it.each([
    ["soybean-balance", "大豆原粮"],
    ["paddy-balance", "稻谷原粮"],
  ] as const)(
    "queries the governed %s account instead of falling back to corn",
    async (section, productLabel) => {
      const user = userEvent.setup();
      render(<RegionHarness section={section} />);

      await user.selectOptions(
        screen.getByRole("combobox", { name: "营销年度" }),
        "2026-27",
      );
      await user.selectOptions(
        screen.getByRole("combobox", { name: "账户核定记录" }),
        "approval-3",
      );
      await user.click(screen.getByRole("button", { name: "查询" }));

      expect(
        screen.getByRole("region", { name: "本次供需测算结果" }),
      ).toHaveTextContent(`正式计算结果`);
      expect(
        screen.getByRole("table", { name: "区域粮食供需平衡表数据" }),
      ).toHaveAccessibleName("区域粮食供需平衡表数据");
      expect(document.body).toHaveTextContent(productLabel);
      expect(
        screen.getByRole("table", { name: "区域粮食供需平衡表数据" }),
      ).toHaveTextContent("采用后账面期末");
      expect(document.body).not.toHaveTextContent(
        "当前筛选范围尚无已核定供需账户",
      );
    },
  );

  it("requires an explicit product, year and approval record before querying", () => {
    render(<RegionHarness />);

    expect(
      screen.getByRole("heading", { name: "区域粮食供需平衡表" }),
    ).toBeVisible();
    const region = screen.getByRole("group", { name: "业务地区" });
    expect(within(region).getByLabelText("选择地区")).toHaveTextContent(
      "齐齐哈尔市",
    );
    expect(screen.getByRole("combobox", { name: "产品账户" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "营销年度" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "账户核定记录" })).toHaveValue(
      "",
    );
    expect(screen.getByRole("button", { name: "查询" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "编制供需报告" })).toBeDisabled();
    expect(screen.getByText("请完成全部查询条件后查询")).toBeVisible();
    expect(
      screen.queryByRole("table", { name: "区域粮食供需平衡表数据" }),
    ).not.toBeInTheDocument();
  });

  it("does not query or compose when the formal scope contains an unauthorized coordinate", async () => {
    const user = userEvent.setup();
    const onComposeReport = vi.fn();
    const scope: OperationalScope = {
      ...fixtureOperationalIdentity,
      coordinates: {
        regionId: "qiqihar-all",
        productId: "corn",
        dataLayer: "preliminary",
        releaseVersion: "未授权数据批次",
      },
      savedView: null,
    };

    render(
      <FormalSupplyDemandWorkspace
        onComposeReport={onComposeReport}
        onScopeChange={vi.fn()}
        queryAllowed={false}
        scope={scope}
        section="calculation"
      />,
    );

    await user.selectOptions(
      screen.getByRole("combobox", { name: "营销年度" }),
      "2026-27",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "账户核定记录" }),
      "approval-3",
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "当前筛选范围超出您的数据权限",
    );
    expect(screen.getByRole("button", { name: "查询" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "编制供需报告" })).toBeDisabled();
    expect(
      screen.queryByRole("table", { name: "区域粮食供需平衡表数据" }),
    ).not.toBeInTheDocument();
    expect(onComposeReport).not.toHaveBeenCalled();
    expect(document.body).not.toHaveTextContent("未授权数据批次");
  });

  it("allows an authorized account query but blocks report composition without draft permission", async () => {
    const user = userEvent.setup();
    const onComposeReport =
      vi.fn<SupplyDemandWorkspaceProps["onComposeReport"]>();

    function RestrictedReportHarness() {
      const [scope, setScope] = useState<OperationalScope>({
        ...fixtureOperationalIdentity,
        authorization: {
          ...fixtureOperationalIdentity.authorization,
          permissionKeys: ["enterprise:fixtures:read"],
        },
        coordinates: { regionId: "qiqihar-all" },
        savedView: null,
      });
      return (
        <FormalSupplyDemandWorkspace
          onComposeReport={onComposeReport}
          onScopeChange={(coordinates: Partial<BusinessCoordinates>) =>
            setScope((current) => ({
              ...current,
              coordinates: { ...current.coordinates, ...coordinates },
            }))
          }
          queryAllowed
          scope={scope}
          section="calculation"
        />
      );
    }

    render(<RestrictedReportHarness />);
    await selectCompleteAccount(user);
    await user.click(screen.getByRole("button", { name: "查询" }));

    expect(
      screen.getByRole("region", { name: "本次供需测算结果" }),
    ).toBeVisible();
    const composeButton = screen.getByRole("button", {
      name: "编制供需报告",
    });
    expect(composeButton).toBeDisabled();
    await user.click(composeButton);
    expect(onComposeReport).not.toHaveBeenCalled();
  });

  it("calculates the exact approved account and composes a report from its complete scope", async () => {
    const user = userEvent.setup();
    const onComposeReport =
      vi.fn<SupplyDemandWorkspaceProps["onComposeReport"]>();
    const { container } = render(
      <RegionHarness onComposeReport={onComposeReport} />,
    );

    await selectCompleteAccount(user);
    await user.click(screen.getByRole("button", { name: "查询" }));

    const statement = screen.getByRole("table", {
      name: "区域粮食供需平衡表数据",
    });
    const result = screen.getByRole("region", { name: "本次供需测算结果" });
    expect(result).toHaveTextContent("正式计算结果");
    expect(result).toHaveTextContent(
      "计算目标：根据已核定的期初库存、本地生产、流入流出、消费、加工和损耗，计算本营销年度采用后期末库存",
    );
    expect(result).toHaveTextContent(
      "总供给 763.1 万吨 − 总使用与外流 659.2 万吨 = 账面期末库存 103.9 万吨",
    );
    expect(result).toHaveTextContent(
      "采用后期末库存 105.1 万吨 − 调查汇总期末 105.6 万吨 = 账面与调查差额 -0.5 万吨",
    );
    expect(result).toHaveTextContent(
      "总供给 = 期初库存 + 本地生产 + 区域外流入 + 国际进口 + 其他供给",
    );
    expect(result).toHaveTextContent(
      "总使用与外流 = 口粮消费 + 饲用消费 + 种用消费 + 加工投入 + 损耗 + 区域外流出 + 国际出口 + 其他使用",
    );
    expect(result).toHaveTextContent("账面公式已闭合");
    expect(result).toHaveTextContent("库存差额处于说明线以内");
    expect(result).toHaveTextContent(
      "调查库存与采用后账面库存相差0.5万吨，说明线为0.5万吨",
    );
    expect(result).toHaveTextContent("库存核对已通过");
    expect(result).toHaveTextContent("第3次核定库存调整审批记录");
    expect(result).toHaveTextContent("以采用后账面期末库存编制正式报告");
    expect(result).not.toHaveTextContent("待解释");
    for (const item of [
      "期初库存",
      "本地生产",
      "区域外流入",
      "国际进口",
      "其他供给",
      "总供给",
      "口粮消费",
      "饲用消费",
      "种用消费",
      "加工投入",
      "损耗",
      "区域外流出",
      "国际出口",
      "其他使用",
      "总使用与外流",
      "调整前账面期末",
      "批准库存调整",
      "采用后账面期末",
      "调查汇总期末",
      "库存平衡差额",
    ]) {
      expect(statement).toHaveTextContent(item);
    }
    expect(within(statement).getByText("来源业务")).toBeVisible();
    expect(within(statement).getByText("数据来源")).toBeVisible();
    expect(container.querySelector(".unified-metric-strip")).toBeNull();

    await user.click(
      within(statement).getByRole("button", { name: "查看本地生产来源" }),
    );
    const source = screen.getByRole("region", { name: "本地生产来源详情" });
    expect(source).toHaveTextContent("产情监测");
    expect(source).toHaveTextContent("2026年第30周产量已核定数据");
    expect(source).toHaveTextContent("齐齐哈尔市全域");
    expect(source).not.toHaveTextContent(/ACCOUNT-|METRIC-|VERSION-/);
    await user.click(within(source).getByRole("button", { name: "关闭" }));
    expect(
      screen.queryByRole("region", { name: "本地生产来源详情" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "编制供需报告" }));
    expect(onComposeReport).toHaveBeenCalledWith(
      expect.objectContaining({
        application: "supply",
        product: "玉米",
        region: "齐齐哈尔市全域",
        period: "2026/27营销年度",
        frequency: "月报",
        dataVersion: "SUPPLY-2026-MY-APPROVED",
      }),
    );
    expect(document.body).not.toHaveTextContent(
      /METRIC-|SUPPLY-|2026-07-31T|来源版本|数据版本|来源数据批次/,
    );
  });

  it("never treats a county as the citywide factual account", async () => {
    const user = userEvent.setup();
    render(<RegionHarness />);

    await selectSupplyRegion(user, "齐齐哈尔市", "讷河市");
    await selectCompleteAccount(user);
    await user.click(screen.getByRole("button", { name: "查询" }));

    expect(
      screen.getByRole("region", { name: "供需查询结果" }),
    ).toHaveTextContent("当前筛选范围尚无已核定供需账户");
    expect(
      within(screen.getByRole("region", { name: "供需查询结果" })).getByText(
        /讷河市.*玉米原粮/,
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole("table", { name: "区域粮食供需平衡表数据" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "编制供需报告" })).toBeDisabled();
  });

  it("invalidates a previous result when a controlled filter changes", async () => {
    const user = userEvent.setup();
    render(<RegionHarness />);
    await selectCompleteAccount(user);
    await user.click(screen.getByRole("button", { name: "查询" }));
    expect(
      screen.getByRole("table", { name: "区域粮食供需平衡表数据" }),
    ).toBeVisible();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "产品账户" }),
      "soymeal",
    );
    expect(
      screen.queryByRole("table", { name: "区域粮食供需平衡表数据" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("筛选条件已变更，请重新查询")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "查询" }));
    expect(
      screen.getByRole("region", { name: "供需查询结果" }),
    ).toHaveTextContent("当前筛选范围尚无已核定供需账户");
    expect(screen.queryByText("0.0 万吨")).not.toBeInTheDocument();
  });

  it("retains one controlled scope across calculation and four-year comparison views", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<RegionHarness section="calculation" />);
    await selectCompleteAccount(user);
    await user.click(screen.getByRole("button", { name: "查询" }));

    rerender(<RegionHarness section="comparison" />);
    expect(screen.getByRole("combobox", { name: "产品账户" })).toHaveValue(
      "corn",
    );
    expect(screen.getByRole("combobox", { name: "营销年度" })).toHaveValue(
      "2026-27",
    );
    expect(screen.getByRole("combobox", { name: "账户核定记录" })).toHaveValue(
      "approval-3",
    );
    expect(
      screen.getByRole("img", { name: "供需核心指标四年趋势图" }),
    ).toBeVisible();
    const comparison = screen.getByRole("table", {
      name: "供需核心指标四年对比",
    });
    expect(comparison).toHaveTextContent("2026年同比");
    expect(comparison).toHaveTextContent("+3.2%");

    await user.selectOptions(
      screen.getByRole("combobox", { name: "产品账户" }),
      "wheat",
    );
    expect(
      screen.queryByRole("img", { name: "供需核心指标四年趋势图" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "查询" }));
    expect(
      screen.getByRole("region", { name: "供需查询结果" }),
    ).toHaveTextContent("当前筛选范围尚无四年连续已核定数据");
  });

  it("filters the approval ledger instead of displaying fixed records", async () => {
    const user = userEvent.setup();
    render(<RegionHarness section="versions" />);
    await selectCompleteAccount(user, "approval-2");
    await user.click(screen.getByRole("button", { name: "查询" }));

    const ledger = screen.getByRole("table", { name: "供需账户核定记录" });
    expect(within(ledger).getByText("第2次核定")).toBeVisible();
    expect(within(ledger).queryByText("第3次核定")).not.toBeInTheDocument();
    await user.click(
      within(ledger).getByRole("button", { name: "查看核定详情" }),
    );
    expect(
      screen.getByRole("region", { name: "第2次核定详情" }),
    ).toHaveTextContent("已由后续核定记录替代");

    await selectSupplyRegion(user, "黑河市");
    await user.click(screen.getByRole("button", { name: "查询" }));
    expect(
      screen.getByRole("region", { name: "供需查询结果" }),
    ).toHaveTextContent("当前筛选范围尚无供需账户核定记录");
    expect(
      screen.queryByRole("table", { name: "供需账户核定记录" }),
    ).not.toBeInTheDocument();
  });

  it("resets all draft and applied supply filters", async () => {
    const user = userEvent.setup();
    render(<RegionHarness />);
    await selectCompleteAccount(user);
    await user.click(screen.getByRole("button", { name: "查询" }));
    await user.click(screen.getByRole("button", { name: "重置" }));

    expect(screen.getByRole("combobox", { name: "产品账户" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "营销年度" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "账户核定记录" })).toHaveValue(
      "",
    );
    expect(
      screen.queryByRole("table", { name: "区域粮食供需平衡表数据" }),
    ).not.toBeInTheDocument();
  });

  it("uses authorized supply products and never falls back to the first option", async () => {
    const user = userEvent.setup();
    function FormalHarness() {
      const [scope, setScope] = useState<OperationalScope>({
        ...fixtureOperationalIdentity,
        authorization: {
          ...fixtureOperationalIdentity.authorization,
          authorizedProductIds: ["soybean", "wheat", "agri-input"],
        },
        coordinates: { regionId: "authorized-all" },
        savedView: null,
      });
      return (
        <FormalSupplyDemandWorkspace
          section="calculation"
          scope={scope}
          onScopeChange={(coordinates: Partial<BusinessCoordinates>) =>
            setScope((current) => ({
              ...current,
              coordinates: { ...current.coordinates, ...coordinates },
            }))
          }
          onComposeReport={vi.fn<
            SupplyDemandWorkspaceProps["onComposeReport"]
          >()}
        />
      );
    }
    render(<FormalHarness />);

    const product = screen.getByRole("combobox", { name: "产品账户" });
    expect(product).toHaveValue("");
    expect(
      within(product).getByRole("option", { name: "大豆原粮" }),
    ).toBeVisible();
    expect(
      within(product).getByRole("option", { name: "小麦原粮" }),
    ).toBeVisible();
    expect(
      within(product).queryByRole("option", { name: "玉米原粮" }),
    ).not.toBeInTheDocument();
    expect(
      within(product).queryByRole("option", { name: "农资" }),
    ).not.toBeInTheDocument();
    await user.selectOptions(product, "soybean");
    expect(product).toHaveValue("soybean");
    const region = screen.getByRole("group", { name: "业务地区" });
    await selectSupplyRegion(user, "黑河市");
    await user.click(screen.getByRole("button", { name: "重置" }));
    expect(within(region).getByLabelText("选择地区")).toHaveTextContent(
      "请选择地区",
    );
    expect(screen.getByRole("combobox", { name: "产品账户" })).toHaveValue("");
  });

  it("does not resolve or expose a requested supply task outside the authorized scope", () => {
    const scope: OperationalScope = {
      ...fixtureOperationalIdentity,
      authorization: {
        ...fixtureOperationalIdentity.authorization,
        authorizedRegionIds: ["heihe-all"],
      },
      coordinates: { regionId: "authorized-all" },
      savedView: null,
    };

    render(
      <FormalSupplyDemandWorkspace
        onComposeReport={vi.fn()}
        onScopeChange={vi.fn()}
        queryAllowed
        scope={scope}
        section="calculation"
        selection={{
          type: "work-item",
          id: "WORK-SUPPLY-EXPLANATION-2026",
        }}
        workItems={businessWorkFixtures}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "该任务不存在、已超出授权范围或不属于供需核算",
    );
    expect(document.body).not.toHaveTextContent("2026 年玉米供需差额说明复核");
    expect(
      screen.queryByRole("region", { name: "当前供需复核任务" }),
    ).not.toBeInTheDocument();
  });

  it("rejects a requested supply task whose account revision is unknown", () => {
    const unsupportedTask = {
      ...businessWorkFixtures.find(
        ({ workId }) => workId === "WORK-SUPPLY-EXPLANATION-2026",
      )!,
      subject: {
        kind: "supply-account" as const,
        productAccountId: "PRODUCT-ACCOUNT-CORN-2026",
        accountVersionId: "ACCOUNT-VERSION-CORN-2026-UNKNOWN",
        accountLabel: "未知供需账户修订记录",
      },
    };

    render(
      <FormalSupplyDemandWorkspace
        onComposeReport={vi.fn()}
        onScopeChange={vi.fn()}
        queryAllowed
        scope={{
          ...fixtureOperationalIdentity,
          coordinates: { regionId: "authorized-all" },
          savedView: null,
        }}
        section="calculation"
        selection={{ type: "work-item", id: unsupportedTask.workId }}
        workItems={[unsupportedTask]}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "该任务不存在、已超出授权范围或不属于供需核算",
    );
    expect(document.body).not.toHaveTextContent("未知供需账户修订记录");
    expect(screen.getByRole("button", { name: "编制供需报告" })).toBeDisabled();
  });

  it("approves the requested supply explanation through governed work transitions", async () => {
    const user = userEvent.setup();
    const onWorkItemChange =
      vi.fn<NonNullable<SupplyDemandWorkspaceProps["onWorkItemChange"]>>();
    const scope: OperationalScope = {
      ...fixtureOperationalIdentity,
      authorization: {
        ...fixtureOperationalIdentity.authorization,
        permissionKeys: [
          ...fixtureOperationalIdentity.authorization.permissionKeys,
          "business-work:review",
          "business-work:quality-review",
        ],
      },
      coordinates: { regionId: "authorized-all" },
      savedView: null,
    };

    render(
      <FormalSupplyDemandWorkspace
        onComposeReport={vi.fn()}
        onScopeChange={vi.fn()}
        onWorkItemChange={onWorkItemChange}
        queryAllowed
        scope={scope}
        section="calculation"
        selection={{
          type: "work-item",
          id: "WORK-SUPPLY-EXPLANATION-2026",
        }}
        workItems={businessWorkFixtures}
      />,
    );

    const task = screen.getByRole("region", { name: "当前供需复核任务" });
    expect(screen.getByRole("combobox", { name: "账户核定记录" })).toHaveValue(
      "approval-2",
    );
    expect(screen.getByRole("button", { name: "编制供需报告" })).toBeDisabled();
    expect(
      screen.queryByRole("table", { name: "区域粮食供需平衡表数据" }),
    ).not.toBeInTheDocument();
    expect(
      within(task).getByRole("button", { name: "退回修改" }),
    ).toBeDisabled();
    await user.click(within(task).getByRole("button", { name: "审核通过" }));

    expect(onWorkItemChange).toHaveBeenCalledTimes(1);
    const updatedWorkItem = onWorkItemChange.mock.calls.at(0)?.[0];
    if (!updatedWorkItem) throw new Error("供需审核结果未写回");
    expect(updatedWorkItem).toMatchObject({
      workId: "WORK-SUPPLY-EXPLANATION-2026",
      reviewStatus: "approved",
      qualityStatus: "warning",
    });
    expect(
      updatedWorkItem.qualityGovernance.approvedExplanationVersionIds,
    ).toEqual(["EXPLANATION-SUPPLY-1"]);
    expect(
      updatedWorkItem.reviewHistory.some(
        (event) => event.action === "approved" && event.reviewer === "王洋",
      ),
    ).toBe(true);
  });

  it("returns the requested supply explanation with a required auditable reason", async () => {
    const user = userEvent.setup();
    const onWorkItemChange =
      vi.fn<NonNullable<SupplyDemandWorkspaceProps["onWorkItemChange"]>>();
    const scope: OperationalScope = {
      ...fixtureOperationalIdentity,
      authorization: {
        ...fixtureOperationalIdentity.authorization,
        permissionKeys: [
          ...fixtureOperationalIdentity.authorization.permissionKeys,
          "business-work:review",
          "business-work:quality-review",
        ],
      },
      coordinates: { regionId: "authorized-all" },
      savedView: null,
    };

    render(
      <FormalSupplyDemandWorkspace
        onComposeReport={vi.fn()}
        onScopeChange={vi.fn()}
        onWorkItemChange={onWorkItemChange}
        scope={scope}
        section="calculation"
        selection={{
          type: "work-item",
          id: "WORK-SUPPLY-EXPLANATION-2026",
        }}
        workItems={businessWorkFixtures}
      />,
    );

    const task = screen.getByRole("region", { name: "当前供需复核任务" });
    await user.type(
      within(task).getByRole("textbox", { name: "供需说明退回原因" }),
      "调查库存差额依据不完整，请补充核对记录。",
    );
    await user.click(within(task).getByRole("button", { name: "退回修改" }));

    const updatedWorkItem = onWorkItemChange.mock.calls.at(0)?.[0];
    if (!updatedWorkItem) throw new Error("供需退回结果未写回");
    expect(updatedWorkItem).toMatchObject({
      documentStatus: "returned",
      reviewStatus: "returned",
      qualityStatus: "warning",
    });
    expect(
      updatedWorkItem.reviewHistory.some(
        (event) =>
          event.action === "returned" &&
          event.reviewer === "王洋" &&
          event.reason === "调查库存差额依据不完整，请补充核对记录。",
      ),
    ).toBe(true);
  });

  it("keeps supply review actions unavailable to anyone except the assigned reviewer", () => {
    const onWorkItemChange = vi.fn();
    const scope: OperationalScope = {
      ...fixtureOperationalIdentity,
      identity: {
        userId: "other-user",
        postId: "regional-data-admin",
        displayName: "其他人员",
      },
      authorization: {
        ...fixtureOperationalIdentity.authorization,
        permissionKeys: [
          ...fixtureOperationalIdentity.authorization.permissionKeys,
          "business-work:review",
          "business-work:quality-review",
        ],
      },
      coordinates: { regionId: "authorized-all" },
      savedView: null,
    };

    render(
      <FormalSupplyDemandWorkspace
        onComposeReport={vi.fn()}
        onScopeChange={vi.fn()}
        onWorkItemChange={onWorkItemChange}
        scope={scope}
        section="calculation"
        selection={{
          type: "work-item",
          id: "WORK-SUPPLY-EXPLANATION-2026",
        }}
        workItems={businessWorkFixtures}
      />,
    );

    const task = screen.getByRole("region", { name: "当前供需复核任务" });
    expect(
      within(task).getByRole("button", { name: "审核通过" }),
    ).toBeDisabled();
    expect(
      within(task).getByRole("button", { name: "退回修改" }),
    ).toBeDisabled();
    expect(task).toHaveTextContent("当前人员不是该任务的指派审核人，只能查看");
    expect(onWorkItemChange).not.toHaveBeenCalled();
  });

  it("contains wide supply results and gives horizontal scrolling to tables only", () => {
    const css = readFileSync("src/business/unified-workspaces.css", "utf8");
    expect(css).toMatch(
      /\.supply-workspace\s*\{[^}]*min-width:\s*0[^}]*overflow-x:\s*clip/s,
    );
    expect(css).toMatch(/\.supply-primary-result\s*\{[^}]*min-width:\s*0/s);
    expect(css).toMatch(
      /\.supply-statement-scroll\s*\{[^}]*overflow-x:\s*auto/s,
    );
  });
});
