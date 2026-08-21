import { describe, expect, it } from "vitest";

import { formatRealFillingTime } from "./explicitRecordTime";

describe("explicit record time", () => {
  it("renders technical ISO timestamps as Chinese business time", () => {
    expect(
      formatRealFillingTime(
        {
          PROD_FILLING_AT: "2026-08-17T14:31:31.027897Z",
          PROD_FILLING_TIME_BASIS: "SUBMITTED_AT",
        },
        "PROD",
      ),
    ).toBe("2026年08月17日 22:31:31（提交）");
  });
});
