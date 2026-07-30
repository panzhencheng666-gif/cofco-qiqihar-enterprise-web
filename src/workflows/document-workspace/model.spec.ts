import { fieldValueDisplay, fixedDecimal, type DocumentField } from "./model";
import { describe, expect, it } from "vitest";

describe("document field value contract", () => {
  it("accepts only canonical decimal strings", () => {
    expect(fixedDecimal("2168.00")).toBe("2168.00");
    expect(fixedDecimal("-0.25")).toBe("-0.25");

    for (const invalid of [2168, null, "1e3", " 1", "01", "NaN"]) {
      expect(() => fixedDecimal(invalid)).toThrow("规范十进制定点字符串");
    }
  });

  it("keeps value provenance separate from quality state", () => {
    const field: DocumentField = {
      code: "yield",
      label: "单产",
      value: {
        status: "estimated",
        amount: fixedDecimal("785.50"),
        method: "样本加权估算",
      },
      quality: "warning",
      unit: "斤/亩",
    };

    expect(field.value.status).toBe("estimated");
    expect(field.quality).toBe("warning");
    expect(fieldValueDisplay(field.value)).toEqual({
      text: "785.50",
      statusLabel: "估算值",
      hasAmount: true,
    });
  });

  it.each([
    ["reported", "已填报", true],
    ["not-reported", "未填报", false],
    ["not-applicable", "不适用", false],
    ["unavailable", "暂不可得", false],
    ["collection-failed", "采集失败", false],
    ["estimated", "估算值", true],
    ["imputed", "插补值", true],
    ["approved-adjustment", "审核调整", true],
  ] as const)(
    "distinguishes %s from every other value state",
    (status, label, hasAmount) => {
      const values = {
        reported: { status: "reported", amount: fixedDecimal("1") },
        "not-reported": { status: "not-reported" },
        "not-applicable": {
          status: "not-applicable",
          reason: "当前表单不适用",
        },
        unavailable: { status: "unavailable", reason: "来源尚未发布" },
        "collection-failed": {
          status: "collection-failed",
          reason: "采集设备离线",
        },
        estimated: {
          status: "estimated",
          amount: fixedDecimal("2"),
          method: "样本估算",
        },
        imputed: {
          status: "imputed",
          amount: fixedDecimal("3"),
          method: "经批准的插补规则",
        },
        "approved-adjustment": {
          status: "approved-adjustment",
          amount: fixedDecimal("4"),
          reason: "审核更正",
        },
      } as const;

      expect(fieldValueDisplay(values[status])).toMatchObject({
        statusLabel: label,
        hasAmount,
      });
    },
  );
});
