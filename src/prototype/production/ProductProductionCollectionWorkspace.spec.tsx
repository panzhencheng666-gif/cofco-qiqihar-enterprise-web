import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RealtimeBusinessRepository } from "@/platform/api/realtimeBusinessRepository";

import type { OperationalScope } from "../core/operationalScope";
import { prototypeOperationalIdentity } from "../formalEnterpriseData";
import { ProductProductionCollectionWorkspace } from "./ProductProductionCollectionWorkspace";

afterEach(cleanup);

const scope: OperationalScope = {
  ...prototypeOperationalIdentity,
  coordinates: { regionId: "authorized-all" },
  authorization: {
    ...prototypeOperationalIdentity.authorization,
    authorizedBusinessClassificationIds: ["production.planting-production"],
    authorizedProductIds: ["corn"],
    authorizedCultivarIds: [],
  },
  savedView: null,
};

describe("product production collection workspace", () => {
  it("shows persisted records and performs a real CSV/XLSX import", async () => {
    const user = userEvent.setup();
    const listProduction = vi.fn().mockResolvedValue({
      items: [
        {
          id: "PROD-DB-001",
          values: {
            PROD_SURVEY_DATE: "2026-08-08",
            PROD_SUBJECT_NAME: "克山县第一调查点",
            PROD_OBJECT_TYPE: "农户",
            PROD_REGION: "克山县",
            PROD_AREA_MU: "320 亩",
            PROD_YIELD_PER_MU: "510 公斤/亩",
            PROD_ESTIMATED_OUTPUT: "163200 公斤",
            PROD_REPORTER_NAME: "张三",
            PROD_REPORTER_PHONE: "13800000000",
            PROD_SAMPLE_CONTACT: "13900000000",
            PROD_SAMPLE_LATITUDE: "47.3543",
            PROD_SAMPLE_LONGITUDE: "123.9182",
            PROD_STATUS: "APPROVED",
          },
          allowedActions: [],
          version: 1,
        },
      ],
      pageNumber: 0,
      pageSize: 100,
      totalElements: 1,
      totalPages: 1,
    });
    const importProductionCsv = vi.fn().mockResolvedValue({
      id: "IMPORT-001",
      domainCode: "PRODUCTION",
      statusCode: "COMPLETED",
      importedRows: 1,
      failedRows: 0,
    });
    const downloadProductionXlsxTemplate = vi
      .fn()
      .mockResolvedValue(new Blob(["xlsx"]));
    const onCreateRecord = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:template"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      () => undefined,
    );
    const repository = {
      listProduction,
      importProductionCsv,
      downloadProductionXlsxTemplate,
    } as unknown as RealtimeBusinessRepository;

    render(
      <ProductProductionCollectionWorkspace
        onCreateRecord={onCreateRecord}
        onScopeChange={vi.fn()}
        onSelectionChange={vi.fn()}
        queryAllowed
        realtimeRepository={repository}
        scope={scope}
        section="corn-collection"
      />,
    );

    expect(await screen.findByText("克山县第一调查点")).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "填报人" })).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "填报对象联系方式" }),
    ).toBeVisible();
    expect(screen.getByText("张三")).toBeVisible();
    expect(screen.getByText("47.3543")).toBeVisible();
    expect(
      screen.queryByText("产情监测 · PROD-CORN-001"),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "查询" }));
    await waitFor(() => expect(listProduction).toHaveBeenCalledTimes(2));

    await user.selectOptions(screen.getByLabelText("对象类型"), "farmer");
    await user.click(screen.getByRole("button", { name: "下载 XLSX 模板" }));
    await waitFor(() =>
      expect(downloadProductionXlsxTemplate).toHaveBeenCalledWith(
        "CORN",
        "FARMER",
      ),
    );

    const file = new File(["header\nvalue"], "production.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    await user.upload(screen.getByLabelText("批量导入产情记录"), file);

    await waitFor(() =>
      expect(importProductionCsv).toHaveBeenCalledWith(file, "CORN", "FARMER"),
    );
    expect(
      await screen.findByText("导入完成：成功 1 条，失败 0 条。"),
    ).toBeVisible();
    await waitFor(() => expect(listProduction).toHaveBeenCalledTimes(3));
    await user.click(screen.getByRole("button", { name: "新建调查记录" }));
    expect(onCreateRecord).toHaveBeenCalledWith("CORN");
  });
});
