import { describe, expect, it } from "vitest";

import {
  absFixedDecimal,
  addFixedDecimal,
  cagrPercent,
  compareFixedDecimal,
  divideFixedDecimal,
  fixedDecimal,
  formatFixedDecimal,
  multiplyFixedDecimal,
  percentageChange,
  roundHalfUp,
  subtractFixedDecimal,
} from "./fixedDecimal";

describe("FixedDecimal", () => {
  it("keeps authoritative arithmetic beyond Number.MAX_SAFE_INTEGER exact", () => {
    expect(
      addFixedDecimal(fixedDecimal("9007199254740993.00"), fixedDecimal("0.01")),
    ).toBe("9007199254740993.01");
    expect(
      multiplyFixedDecimal(fixedDecimal("9007199254740993"), fixedDecimal("1.01")),
    ).toBe("9097271247288402.93");
  });

  it("canonicalizes only governed plain decimal input", () => {
    expect(fixedDecimal("00012.3400")).toBe("12.34");
    expect(fixedDecimal("-0.0")).toBe("0");
    for (const input of ["", " 1", "+1", ".5", "1.", "1e3", "NaN", "Infinity"]) {
      expect(() => fixedDecimal(input)).toThrow("十进制格式无效");
    }
  });

  it("rounds exact halves away from zero and formats after rounding", () => {
    expect(roundHalfUp(fixedDecimal("1.005"), 2)).toBe("1.01");
    expect(roundHalfUp(fixedDecimal("-1.005"), 2)).toBe("-1.01");
    expect(formatFixedDecimal(fixedDecimal("9.999"), 2)).toBe("10.00");
    expect(() => roundHalfUp(fixedDecimal("1"), -1)).toThrow("小数位数无效");
  });

  it("adds, subtracts, compares, takes absolute values, and divides exactly", () => {
    expect(subtractFixedDecimal(fixedDecimal("1"), fixedDecimal("1.25"))).toBe("-0.25");
    expect(compareFixedDecimal(fixedDecimal("1.20"), fixedDecimal("1.2"))).toBe(0);
    expect(absFixedDecimal(fixedDecimal("-2.50"))).toBe("2.5");
    expect(divideFixedDecimal(fixedDecimal("2"), fixedDecimal("3"), 3)).toBe("0.667");
    expect(divideFixedDecimal(fixedDecimal("-1"), fixedDecimal("8"), 2)).toBe("-0.13");
    expect(() => divideFixedDecimal(fixedDecimal("1"), fixedDecimal("0"), 2)).toThrow(
      "除数不能为零",
    );
  });

  it("calculates percentage change as one exact rational with one final rounding", () => {
    expect(percentageChange(fixedDecimal("1.005"), fixedDecimal("1"), 1)).toBe("0.5");
    expect(() => percentageChange(fixedDecimal("1"), fixedDecimal("0"), 1)).toThrow(
      "基期不能为零",
    );
  });

  it("certifies CAGR for non-perfect roots, decreases, carry, and huge endpoints", () => {
    expect(cagrPercent(fixedDecimal("2"), fixedDecimal("1"), 3, 6)).toBe("25.992105");
    expect(cagrPercent(fixedDecimal("1"), fixedDecimal("8"), 3, 2)).toBe("-50");
    expect(cagrPercent(fixedDecimal("4"), fixedDecimal("1"), 2, 0)).toBe("100");
    expect(
      cagrPercent(
        fixedDecimal("11988986215002844.68"),
        fixedDecimal("9007199254740993"),
        3,
        1,
      ),
    ).toBe("10");
  });

  it("certifies exact CAGR half-up boundaries and their immediate neighbors", () => {
    expect(cagrPercent(fixedDecimal("1.00005"), fixedDecimal("1"), 1, 2)).toBe("0.01");
    expect(cagrPercent(fixedDecimal("1.000049999"), fixedDecimal("1"), 1, 2)).toBe("0");
    expect(cagrPercent(fixedDecimal("1.000050001"), fixedDecimal("1"), 1, 2)).toBe("0.01");
    expect(cagrPercent(fixedDecimal("0.99995"), fixedDecimal("1"), 1, 2)).toBe("-0.01");
    expect(cagrPercent(fixedDecimal("1.000150007500125"), fixedDecimal("1"), 3, 2)).toBe("0.01");
    expect(cagrPercent(fixedDecimal("1.000150007500124"), fixedDecimal("1"), 3, 2)).toBe("0");
    expect(cagrPercent(fixedDecimal("1.000150007500126"), fixedDecimal("1"), 3, 2)).toBe("0.01");
    expect(cagrPercent(fixedDecimal("0.999850007499875"), fixedDecimal("1"), 3, 2)).toBe("-0.01");
    expect(cagrPercent(fixedDecimal("1.09995"), fixedDecimal("1"), 1, 2)).toBe("10");
  });

  it("validates positive CAGR endpoints and safe integer years", () => {
    expect(() => cagrPercent(fixedDecimal("0"), fixedDecimal("1"), 3, 1)).toThrow(
      "复合增长率端点必须为正数",
    );
    expect(() => cagrPercent(fixedDecimal("1"), fixedDecimal("1"), 0, 1)).toThrow(
      "年数无效",
    );
  });
});
