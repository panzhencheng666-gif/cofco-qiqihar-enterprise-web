import { describe, expect, it } from "vitest";
import {
  validateSubmissionFields,
  submissionFailure,
} from "./realtimeSubmissionValidation";
import { RealtimeApiError } from "@/platform/api/realtimeApiClient";

describe("submission field validation", () => {
  it("marks invalid date and excess decimal places while accepting zero", () => {
    expect(
      validateSubmissionFields(
        [
          { code: "date", label: "日期", type: "date" },
          {
            code: "amount",
            label: "数量",
            type: "decimal",
            precision: 6,
            scale: 2,
          },
          { code: "zero", label: "库存", type: "decimal", required: true },
        ],
        { date: "2026-02-30", amount: "12.345", zero: "0" },
        () => [],
      ),
    ).toEqual({
      date: "日期须为有效日期，例如 2026-09-15。",
      amount: "数量最多保留 2 位小数，例如 1.22。",
    });
  });
  it("does not blame a field for an unlocated server error or network uncertainty", () => {
    const fields = [
      { code: "regionCode", label: "地区", type: "region" as const },
    ];
    expect(
      submissionFailure(
        new RealtimeApiError({
          status: 400,
          code: "INVALID_REQUEST",
          message: "Request data is invalid",
        }),
        fields,
      ).fields,
    ).toEqual({});
    expect(
      submissionFailure(
        new RealtimeApiError({
          status: 408,
          code: "API_TIMEOUT",
          message: "超时",
        }),
        fields,
      ).message,
    ).toContain("先核对列表");
  });
});
