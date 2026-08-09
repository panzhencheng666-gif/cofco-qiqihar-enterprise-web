import { describe, expect, it, vi } from "vitest";
import type { RealtimeApiClient } from "./realtimeApiClient";
import { createRealtimeBusinessRepository } from "./realtimeBusinessRepository";

function client() {
  const get = vi.fn((path: string) => {
    if (path.endsWith("/session/me"))
      return Promise.resolve({
        subjectId: "wang-yang",
        displayName: "王洋",
        workUnitCode: "QIQIHAR_BUSINESS",
        permissions: ["BUSINESS_CREATE"],
        regionCodes: ["230200"],
      });
    if (path.endsWith("/products"))
      return Promise.resolve([{ code: "CORN", name: "玉米" }]);
    if (path.endsWith("/business-periods")) return Promise.resolve([]);
    if (path.endsWith("/regions"))
      return Promise.resolve([
        {
          code: "230200",
          name: "齐齐哈尔市",
          parentCode: null,
          level: "PREFECTURE",
        },
      ]);
    if (path.endsWith("/work-items"))
      return Promise.resolve({
        items: [],
        pageNumber: 0,
        pageSize: 20,
        totalElements: 0,
        totalPages: 0,
      });
    if (
      path.includes("/production-records") ||
      path.includes("/market-records")
    ) {
      return Promise.resolve(
        path.endsWith("records")
          ? {
              items: [],
              pageNumber: 0,
              pageSize: 20,
              totalElements: 0,
              totalPages: 0,
            }
          : { id: "1", version: 0 },
      );
    }
    throw new Error(`unexpected GET ${path}`);
  });
  const post = vi.fn(() => Promise.resolve({ id: "1", version: 0 }));
  const download = vi.fn(() => Promise.resolve(new Blob(["report"])));
  const upload = vi.fn((path: string, body: FormData) => {
    void path;
    void body;
    return Promise.resolve({
      id: "photo-1",
      state: "STAGED",
      originalFilename: "field.png",
    });
  });
  const api = {
    get,
    post,
    put: vi.fn(() => Promise.resolve({ id: "1", version: 1 })),
    upload,
    download,
  } as unknown as RealtimeApiClient;
  return { api, download, get, post, upload };
}

describe("realtime business repository", () => {
  it("loads all master-data collections from the API", async () => {
    const { api, get } = client();
    const result = await createRealtimeBusinessRepository(api).loadMasterData();
    expect(result.products).toEqual([{ code: "CORN", name: "玉米" }]);
    expect(result.periods).toEqual([]);
    expect(result.regions[0]?.code).toBe("230200");
    expect(get).toHaveBeenCalledTimes(3);
  });

  it("reads the authenticated employee profile from the server", async () => {
    const { api, get } = client();

    await expect(
      createRealtimeBusinessRepository(api).loadCurrentSession(),
    ).resolves.toMatchObject({
      subjectId: "wang-yang",
      displayName: "王洋",
      workUnitCode: "QIQIHAR_BUSINESS",
    });
    expect(get).toHaveBeenCalledWith("/api/v1/session/me");
  });

  it("always sends the pending scope and supports real filters", async () => {
    const { api, get } = client();
    await createRealtimeBusinessRepository(api).listWorkItems({
      productCode: "CORN",
      domain: "PRODUCTION",
    });
    expect(get).toHaveBeenCalledWith(
      "/api/v1/work-items",
      expect.objectContaining({
        scope: "PENDING",
        productCode: "CORN",
        domain: "PRODUCTION",
      }),
    );
  });

  it("uses optimistic-lock versions for workflow transitions", async () => {
    const { api, post } = client();
    const repository = createRealtimeBusinessRepository(api);
    await repository.transitionProduction("production/1", "submit", 4);
    await repository.transitionMarket("market/1", "return", 6, "缺少依据");
    expect(post).toHaveBeenNthCalledWith(
      1,
      "/api/v1/production-records/production%2F1/submit",
      { version: 4 },
    );
    expect(post).toHaveBeenNthCalledWith(
      2,
      "/api/v1/market-records/market%2F1/return",
      { version: 6, reason: "缺少依据" },
    );
  });

  it("lists and reads persisted production and market records", async () => {
    const { api, get } = client();
    const repository = createRealtimeBusinessRepository(api);

    await repository.listProduction({
      productCode: "CORN",
      page: 1,
      pageSize: 50,
    });
    await repository.getProduction("production/1");
    await repository.listMarket({
      productCode: "SOYBEAN",
      page: 2,
      pageSize: 20,
    });
    await repository.getMarket("market/1");

    expect(get).toHaveBeenNthCalledWith(1, "/api/v1/production-records", {
      productCode: "CORN",
      pageKind: "MONITORING",
      pageNumber: 1,
      pageSize: 50,
    });
    expect(get).toHaveBeenNthCalledWith(
      2,
      "/api/v1/production-records/production%2F1",
    );
    expect(get).toHaveBeenNthCalledWith(3, "/api/v1/market-records", {
      productCode: "SOYBEAN",
      pageKind: "MONITORING",
      pageNumber: 2,
      pageSize: 20,
    });
    expect(get).toHaveBeenNthCalledWith(4, "/api/v1/market-records/market%2F1");
  });

  it("uploads evidence photos with captured coordinates and watermark metadata", async () => {
    const { api, upload } = client();
    const file = new File(["field"], "field.png", { type: "image/png" });

    await createRealtimeBusinessRepository(api).uploadEvidencePhoto({
      file,
      capturedAt: "2026-08-08T10:00:00+08:00",
      latitude: "47.3543",
      longitude: "123.9182",
      watermarkText: "齐齐哈尔市 产情调查 张三",
    });

    expect(upload).toHaveBeenCalledTimes(1);
    const [path, body] = upload.mock.calls[0] ?? [];
    expect(path).toBe("/api/v1/evidence-photos");
    if (!(body instanceof FormData)) throw new Error("expected multipart form");
    const form = body;
    expect(form.get("file")).toBeInstanceOf(File);
    expect((form.get("file") as File).name).toBe("field.png");
    expect(form.get("capturedAt")).toBe("2026-08-08T10:00:00+08:00");
    expect(form.get("latitude")).toBe("47.3543");
    expect(form.get("longitude")).toBe("123.9182");
    expect(form.get("watermarkText")).toBe("齐齐哈尔市 产情调查 张三");
  });

  it("creates a scoped report preview before exporting its immutable result", async () => {
    const { api, download, get, post } = client();
    get.mockImplementationOnce(
      () => Promise.resolve({ definitions: [], formats: [] }) as never,
    );
    post
      .mockImplementationOnce(
        () =>
          Promise.resolve({
            id: "preview-1",
            title: "齐齐哈尔市玉米产情日报",
          }) as never,
      )
      .mockImplementationOnce(
        () =>
          Promise.resolve({ id: "export-1", previewId: "preview-1" }) as never,
      );
    const repository = createRealtimeBusinessRepository(api);

    await repository.loadReportParameterOptions();
    const preview = await repository.createReportPreview({
      definitionCode: "PRODUCTION_DAILY",
      productCode: "CORN",
      cultivarCode: "XIAN_YU_335",
      regionLevel: "PREFECTURE",
      regionCode: "230200",
      periodCode: "2026-W32",
    });
    await repository.createReportExport(preview.id, "CSV");
    await repository.downloadReportExport("export-1");

    expect(get).toHaveBeenCalledWith("/api/v1/reports/parameter-options");
    expect(post).toHaveBeenNthCalledWith(1, "/api/v1/reports/previews", {
      definitionCode: "PRODUCTION_DAILY",
      productCode: "CORN",
      cultivarCode: "XIAN_YU_335",
      regionLevel: "PREFECTURE",
      regionCode: "230200",
      periodCode: "2026-W32",
    });
    expect(post).toHaveBeenNthCalledWith(
      2,
      "/api/v1/reports/previews/preview-1/exports",
      { formatCode: "CSV" },
    );
    expect(download).toHaveBeenCalledWith(
      "/api/v1/reports/exports/export-1/content",
    );
  });
});
