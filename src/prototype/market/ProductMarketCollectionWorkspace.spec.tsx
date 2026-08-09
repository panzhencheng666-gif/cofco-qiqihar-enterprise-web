import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RealtimeBusinessRepository } from "@/platform/api/realtimeBusinessRepository";

import type { OperationalScope } from "../core/operationalScope";
import { prototypeOperationalIdentity } from "../formalEnterpriseData";
import { ProductMarketCollectionWorkspace } from "./ProductMarketCollectionWorkspace";

afterEach(cleanup);

const scope: OperationalScope = {
  ...prototypeOperationalIdentity,
  coordinates: { regionId: "authorized-all" },
  authorization: {
    ...prototypeOperationalIdentity.authorization,
    authorizedBusinessClassificationIds: ["market.quote-trade"],
    authorizedProductIds: ["corn"],
    authorizedCultivarIds: [],
  },
  savedView: null,
};

describe("product market collection workspace", () => {
  it("downloads and imports the backend-owned market XLSX template from the list", async () => {
    const user = userEvent.setup();
    const listMarket = vi.fn().mockResolvedValue({
      items: [],
      pageNumber: 0,
      pageSize: 100,
      totalElements: 0,
      totalPages: 0,
    });
    const loadMarketDefinition = vi.fn().mockResolvedValue({
      productCode: "CORN",
      objectTypeCode: "TRADER",
      coreFields: [],
      groups: [],
    });
    const importMarketWorkbook = vi.fn().mockResolvedValue({
      id: "IMPORT-MARKET-001",
      domainCode: "MARKET",
      statusCode: "COMPLETED",
      importedRows: 2,
      failedRows: 0,
    });
    const downloadMarketXlsxTemplate = vi
      .fn()
      .mockResolvedValue(new Blob(["xlsx"]));
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:market-template"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      () => undefined,
    );
    const repository = {
      listMarket,
      loadMarketDefinition,
      importMarketWorkbook,
      downloadMarketXlsxTemplate,
    } as unknown as RealtimeBusinessRepository;

    render(
      <ProductMarketCollectionWorkspace
        onScopeChange={vi.fn()}
        onSelectionChange={vi.fn()}
        queryAllowed
        realtimeRepository={repository}
        scope={scope}
        section="corn-collection"
      />,
    );

    expect(
      await screen.findByRole("button", { name: "下载 XLSX 模板" }),
    ).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "查询" }));
    await waitFor(() => expect(listMarket).toHaveBeenCalledTimes(2));
    await user.click(screen.getByRole("button", { name: "下载 XLSX 模板" }));
    await waitFor(() =>
      expect(downloadMarketXlsxTemplate).toHaveBeenCalledWith("CORN", "TRADER"),
    );

    const file = new File(["market"], "market.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    await user.upload(screen.getByLabelText("批量导入市场采集记录"), file);

    await waitFor(() =>
      expect(importMarketWorkbook).toHaveBeenCalledWith(file),
    );
    expect(
      await screen.findByText("导入完成：成功 2 条，失败 0 条。"),
    ).toBeVisible();
    await waitFor(() => expect(listMarket).toHaveBeenCalledTimes(3));
  });
});
