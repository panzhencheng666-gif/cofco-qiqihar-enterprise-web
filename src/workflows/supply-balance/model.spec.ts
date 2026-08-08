import { describe, expect, it } from "vitest";
import {
  buildBalanceSummary,
  formalScaledValue,
  productAccountCatalog,
  validateProductAccountCatalog,
  validateProductAccount,
  type AdditiveSupplyBalanceRow,
  type BalanceInput,
  type MetricReleaseVersionId,
  type ProductAccount,
} from "./model";

describe("supply balance account model", () => {
  it("calculates the governed inventory reconciliation from one supply and demand authority", () => {
    const summary = buildBalanceSummary(productAccountCatalog.corn);

    expect(summary).toEqual({
      totalSupply: "763.1",
      totalDemand: "659.2",
      preAdjustmentClosing: "103.9",
      approvedAdjustment: "0.0",
      adoptedClosing: "103.9",
      surveyClosing: "103.9",
      reconciliationDifference: "0.0",
      unit: "万吨",
    });
  });

  it.each(["corn", "soybean", "paddy", "rice"] as const)(
    "keeps account roles unique and formulas balanced for %s",
    (accountKey) => {
      expect(validateProductAccount(productAccountCatalog[accountKey])).toEqual(
        [],
      );
    },
  );

  it("keeps soybean crushing and protein processing mutually exclusive", () => {
    const soybean = productAccountCatalog.soybean;
    const crushing = soybean.rows.find(
      (row) => row.role === "soybean-crushing-use",
    );
    const protein = soybean.rows.find(
      (row) => row.role === "soybean-protein-use",
    );

    expect(crushing?.countingRule).toContain("不得计入蛋白加工用量");
    expect(protein?.countingRule).toContain("不含已经计入压榨");
  });

  it("keeps policy purchase and release outside the regional physical totals", () => {
    const soybean = productAccountCatalog.soybean;
    const policyRelease = soybean.rows.find(
      (row) => row.role === "soybean-reserve-release",
    );
    const policyPurchase = soybean.rows.find(
      (row) => row.role === "soybean-reserve-purchase",
    );

    expect(policyRelease?.section).toBe("政策账户备查");
    expect(policyRelease?.accountingSide).toBeUndefined();
    expect(policyPurchase?.section).toBe("政策账户备查");
    expect(policyPurchase?.accountingSide).toBeUndefined();
    expect(
      formalScaledValue(
        soybean.rows.find((row) => row.role === "total-supply")!.input,
      ),
    ).toBe(1940);
    expect(
      formalScaledValue(
        soybean.rows.find((row) => row.role === "total-demand")!.input,
      ),
    ).toBe(1640);
  });

  it("only maps published metric versions into additive account roles", () => {
    for (const account of Object.values(productAccountCatalog)) {
      expect(account.metricReleaseVersions.length).toBeGreaterThan(0);
      expect(account.metricReleaseVersionIds.length).toBeGreaterThan(0);
      expect(account.formulaVersionId).toEqual(expect.any(String));
      expect(account.calculationRunId).toEqual(expect.any(String));
      expect(account.resultVersionId).toEqual(expect.any(String));
      expect(account.inputSetValidationId).toEqual(expect.any(String));

      const additiveRows = account.rows.filter(
        (row): row is AdditiveSupplyBalanceRow =>
          row.accountingSide !== undefined,
      );
      for (const row of additiveRows) {
        expect(row.metricValueId).toMatch(/^metric-value:/);
        expect(row.metricReleaseVersionId).toMatch(/^metric-release:/);
        expect(account.metricReleaseVersionIds).toContain(
          row.metricReleaseVersionId,
        );
        expect(row.accountRoleMappingId).toMatch(/^account-role-mapping:/);
        expect(row.source).toContain("预置演示指标版本");
      }
    }
  });

  it("rejects an additive row outside the fixed metric release input set", () => {
    const detachedCorn: ProductAccount = {
      ...productAccountCatalog.corn,
      rows: productAccountCatalog.corn.rows.map((candidate) =>
        candidate.role === "corn-production" && candidate.accountingSide
          ? {
              ...candidate,
              metricReleaseVersionId:
                "metric-release:detached" as MetricReleaseVersionId,
            }
          : candidate,
      ),
    };

    expect(validateProductAccount(detachedCorn)).toContain(
      "corn-production 未包含在固定指标输入版本集合中",
    );
  });

  it("keeps paddy and rice in separate product accounts", () => {
    expect(productAccountCatalog.paddy.accountName).toBe("稻谷产品账户");
    expect(productAccountCatalog.rice.accountName).toBe("大米产品账户");
    expect(productAccountCatalog.paddy.accountKey).not.toBe(
      productAccountCatalog.rice.accountKey,
    );
  });

  it("distinguishes a true zero from missing and quality-blocked inputs", () => {
    const trueZero: BalanceInput = { state: "真实为零", scaledValue: 0 };
    const missing: BalanceInput = { state: "缺失" };
    const blocked: BalanceInput = { state: "质量阻断" };

    expect(formalScaledValue(trueZero)).toBe(0);
    expect(formalScaledValue(missing)).toBeUndefined();
    expect(formalScaledValue(blocked)).toBeUndefined();
    expect("scaledValue" in missing).toBe(false);
    expect("scaledValue" in blocked).toBe(false);
  });

  it.each(["缺失", "质量阻断"] as const)(
    "prevents a %s additive input from producing a publishable calculation",
    (state) => {
      const account: ProductAccount = {
        ...productAccountCatalog.corn,
        rows: productAccountCatalog.corn.rows.map((candidate) =>
          candidate.role === "corn-production"
            ? { ...candidate, input: { state } }
            : candidate,
        ),
      };

      expect(validateProductAccount(account)).toContain(
        `corn-production 输入状态为${state}，不可发布计算`,
      );
      expect(() => buildBalanceSummary(account)).toThrow(
        "账户输入未通过可发布校验",
      );
    },
  );

  it("binds paddy input and rice output to one validated conversion run", () => {
    const paddyInput = productAccountCatalog.paddy.rows.find(
      (row) => row.role === "paddy-food-use",
    );
    const riceOutput = productAccountCatalog.rice.rows.find(
      (row) => row.role === "rice-production",
    );

    expect(paddyInput?.processingRunId).toBe(riceOutput?.processingRunId);
    expect(paddyInput?.conversionRuleVersionId).toBe(
      riceOutput?.conversionRuleVersionId,
    );
    expect(paddyInput?.processingRunId).toEqual(expect.any(String));
    expect(validateProductAccountCatalog(productAccountCatalog)).toEqual([]);
  });

  it("rejects a rice output detached from the paddy conversion rule", () => {
    const detachedRice: ProductAccount = {
      ...productAccountCatalog.rice,
      rows: productAccountCatalog.rice.rows.map((candidate) =>
        candidate.role === "rice-production"
          ? {
              ...candidate,
              conversionRuleVersionId: "conversion-rule:paddy-to-rice-v0",
            }
          : candidate,
      ),
    };

    expect(
      validateProductAccountCatalog({
        ...productAccountCatalog,
        rice: detachedRice,
      }),
    ).toContain("稻谷投料与大米产出未使用同一转换规则版本");
  });
});
