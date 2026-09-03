import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  CurrentSession,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";
import { CurrentSamplePointLedger } from "./CurrentSamplePointLedger";

const formalLedger = vi.hoisted(() => vi.fn());

vi.mock("../formal-sample/FormalSamplePointLedger", () => ({
  FormalSamplePointLedger: (props: {
    domain: string;
    productCode: string;
    permissions: readonly string[];
    onSelectionChange?: (value: { type: string; id: string }) => void;
  }) => {
    formalLedger(props);
    return (
      <section aria-label="复用正式样本台账">
        {props.domain}:{props.productCode}:{props.permissions.join(",")}
        <button
          type="button"
          onClick={() =>
            props.onSelectionChange?.({
              type: "formal-sample-create",
              id: "new",
            })
          }
        >
          新增样本
        </button>
      </section>
    );
  },
}));

afterEach(() => {
  cleanup();
  formalLedger.mockClear();
});

const session = {
  subjectId: "current-sample-tester",
  displayName: "当前样本测试员",
  workUnitCode: "230200",
  workUnitName: "齐齐哈尔市",
  accountStatus: "ACTIVE",
  employmentStatus: "ACTIVE",
  roleCodes: ["BUSINESS_MANAGER"],
  positions: [],
  permissions: ["FORMAL_SAMPLE_MANAGE", "FORMAL_SAMPLE_DELETE"],
  regionCodes: ["230200"],
} satisfies CurrentSession;

describe("CurrentSamplePointLedger", () => {
  it("delegates the current-sample surface to the mature formal ledger", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    const repository = {
      loadMasterData: vi.fn().mockResolvedValue({
        products: [
          { code: "CORN", name: "玉米" },
          { code: "RICE", name: "水稻" },
        ],
      }),
    } as unknown as RealtimeBusinessRepository;

    render(
      <CurrentSamplePointLedger
        repository={repository}
        session={session}
        onSelectionChange={onSelectionChange}
      />,
    );

    expect(screen.getByLabelText("复用正式样本台账")).toHaveTextContent(
      "PRODUCTION:CORN:FORMAL_SAMPLE_MANAGE,FORMAL_SAMPLE_DELETE",
    );
    await user.selectOptions(
      screen.getByLabelText("现有样本业务类别"),
      "MARKET",
    );
    expect(screen.getByLabelText("复用正式样本台账")).toHaveTextContent(
      "MARKET:CORN",
    );
    await user.selectOptions(screen.getByLabelText("现有样本产品"), "RICE");
    expect(screen.getByLabelText("复用正式样本台账")).toHaveTextContent(
      "MARKET:RICE",
    );
    await user.click(screen.getByRole("button", { name: "新增样本" }));
    expect(onSelectionChange).toHaveBeenLastCalledWith({
      type: "formal-sample-create",
      id: "new",
    });
  });
});
