import { describe, expect, it } from "vitest";

import {
  businessComparisonReason,
  businessDataBatchLabel,
  chineseDateTime,
  chinesePeriodRange,
} from "./businessDisplayPolicy";

describe("business display policy", () => {
  it.each([
    ["区划边界版本不一致", "各年度统计范围发生变化，暂不可直接比较"],
    ["指标定义缺少到当前版本的批准桥接", "各年度统计口径尚未完成可比性确认"],
    [
      "单位定义版本不一致且缺少批准转换证据",
      "各年度计量单位口径尚未完成换算确认",
    ],
    ["同期间键不一致", "比较期间不一致"],
    ["业务域坐标不一致", "指标所属业务范围不一致"],
    ["数据层不一致", "各年度数据状态不一致"],
  ])("maps %s to a business-readable reason", (source, expected) => {
    expect(businessComparisonReason(source)).toBe(expected);
  });

  it("preserves a safe business reason and blocks an unknown technical code", () => {
    expect(businessComparisonReason("本年度未组织采集")).toBe(
      "本年度未组织采集",
    );
    expect(businessComparisonReason("BUILD_INTERNAL_42")).toBe(
      "比较数据暂不可用，请联系数据管理员核对统计口径",
    );
  });

  it("never returns a raw data batch code", () => {
    expect(businessDataBatchLabel("METRIC-2026-W31-V3", true)).toBe(
      "已核定数据（当前采用）",
    );
    expect(
      businessDataBatchLabel("2026年第31周已核定数据（当前采用）", true),
    ).toBe("2026年第31周已核定数据（当前采用）");
  });

  it("formats machine dates as Chinese business dates without raw fallback", () => {
    expect(chineseDateTime("2026-07-31T17:00:00+08:00")).toBe(
      "2026年7月31日 17:00",
    );
    expect(chineseDateTime("BUILD_INTERNAL_42")).toBe("时间待维护");
  });

  it("formats a stored responsibility period as a Chinese business range", () => {
    expect(chinesePeriodRange("2026-01-01 至 2026-12-31")).toBe(
      "2026年1月1日至2026年12月31日",
    );
    expect(chinesePeriodRange("2026 年度")).toBe("2026 年度");
    expect(chinesePeriodRange("BUILD_INTERNAL_42")).toBe("有效期待维护");
  });
});
