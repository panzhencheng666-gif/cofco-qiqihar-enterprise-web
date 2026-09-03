import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { RealtimeApiError, type RealtimeApiClient } from "./realtimeApiClient";
import { validSnapshot } from "./observableAnalysisContract.fixture";
import {
  createRealtimeBusinessRepository,
  parseProductionDefinition,
  productionDefinitionCacheKey,
  type EligibleFormalSample,
  type RealtimeBusinessRepository,
} from "./realtimeBusinessRepository";
import {
  PRODUCTION_SURVEY_CONTRACT_DIGEST,
  PRODUCTION_SURVEY_CONTRACT_VERSION,
} from "./productionSurveyContract";

function client(
  products: readonly { code: string; name: string }[] = [
    { code: "CORN", name: "玉米" },
  ],
) {
  const get = vi.fn((path: string) => {
    if (path.endsWith("/session/me"))
      return Promise.resolve({
        subjectId: "wang-yang",
        displayName: "王洋",
        workUnitCode: "QIQIHAR_BUSINESS",
        permissions: ["BUSINESS_CREATE"],
        regionCodes: ["230200"],
      });
    if (path.endsWith("/products")) return Promise.resolve(products);
    if (path.endsWith("/business-periods")) return Promise.resolve([]);
    if (path.endsWith("/supply-survey-periods"))
      return Promise.resolve([
        {
          code: "2026",
          name: "2026年度",
          surveyYear: 2026,
          surveyQuarter: null,
          precision: "YEAR",
          marketingYearCode: "2026/27",
          marketingYearName: "2026/27营销年度",
        },
      ]);
    if (path.endsWith("/regions"))
      return Promise.resolve([
        {
          code: "230200",
          name: "齐齐哈尔市",
          parentCode: null,
          level: "PREFECTURE",
        },
      ]);
    if (path.endsWith("/overview/options"))
      return Promise.resolve({ years: [2024] });
    if (path.endsWith("/work-items"))
      return Promise.resolve({
        items: [],
        pageNumber: 0,
        pageSize: 20,
        totalElements: 0,
        totalPages: 0,
      });
    if (path.endsWith("/identity/employees/assignment-options"))
      return Promise.resolve({
        workUnits: [],
        roles: [],
        positions: [],
        regionCodes: [],
      });
    if (path.endsWith("/identity/invitations/activation-bootstrap"))
      return Promise.resolve({
        contractVersion: "2026-08-30",
        csrfReady: true,
      });
    if (path.endsWith("/identity/employees/employee-88/invitation"))
      return Promise.resolve({
        contractVersion: "2026-08-30",
        subjectId: "employee-88",
        invitationId: "invitation-88",
        invitationStatus: "PENDING",
        deliveryStatus: "QUEUED",
      });
    if (path.endsWith("/identity/employees")) return Promise.resolve([]);
    if (path.endsWith("/identity/access-reviews")) return Promise.resolve([]);
    if (path.endsWith("/market-objects")) return Promise.resolve([]);
    if (path.endsWith("/audit-events"))
      return Promise.resolve({
        items: [],
        pageNumber: 0,
        pageSize: 50,
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
  const put = vi.fn(() => Promise.resolve({ id: "1", version: 1 }));
  const remove = vi.fn(() => Promise.resolve());
  const download = vi.fn(() => Promise.resolve(new Blob(["report"])));
  const upload = vi.fn(
    (path: string, body: FormData, headers?: Record<string, string>) => {
      void path;
      void body;
      void headers;
      return Promise.resolve<unknown>({
        id: "photo-1",
        state: "STAGED",
        originalFilename: "field.png",
      });
    },
  );
  const api = {
    get,
    post,
    put,
    delete: remove,
    upload,
    download,
  } as unknown as RealtimeApiClient;
  return { api, delete: remove, download, get, post, put, upload };
}

describe("realtime business repository", () => {
  it("adapts the formal sample point list, detail, and versioned deletion contract", async () => {
    const { api, delete: remove, get } = client();
    get.mockResolvedValueOnce({
      items: [
        {
          id: "formal-point-1",
          canonicalName: "龙沙区正式样本",
          regionCode: "230202",
          version: 4,
        },
      ],
      pageNumber: 0,
      pageSize: 20,
      totalElements: 1,
      totalPages: 1,
    } as never);
    get.mockResolvedValueOnce({
      id: "formal-point-1",
      canonicalName: "龙沙区正式样本",
      regionCode: "230202",
      version: 4,
    } as never);
    const repository = createRealtimeBusinessRepository(api);

    await repository.listFormalSamplePoints!({
      regionCode: "230202",
      keyword: "龙沙",
      page: 0,
      pageSize: 20,
    });
    await repository.getFormalSamplePoint!("formal/point-1");
    await repository.deleteFormalSamplePoint!("formal/point-1", 4);

    expect(get).toHaveBeenCalledWith("/api/v1/formal-sample-points", {
      regionCode: "230202",
      keyword: "龙沙",
      page: 0,
      pageSize: 20,
    });
    expect(get).toHaveBeenCalledWith(
      "/api/v1/formal-sample-points/formal%2Fpoint-1",
    );
    expect(remove).toHaveBeenCalledWith(
      "/api/v1/formal-sample-points/formal%2Fpoint-1",
      { expectedVersion: 4 },
    );
  });

  it("uses the same stable fields for formal sample creation and versioned update", async () => {
    const { api, post, put } = client();
    const repository = createRealtimeBusinessRepository(api);
    const fields = {
      canonicalName: "龙沙区农户样本",
      regionCode: "230202",
      address: "龙沙区新立街 1 号",
      longitude: 123.94,
      latitude: 47.31,
      objectTypeCode: "FARMER",
      maintainerSubjectId: "employee-88",
    };

    await repository.createFormalSamplePoint!(fields);
    await repository.updateFormalSamplePoint!("formal/point-1", fields, 4);

    expect(post).toHaveBeenCalledWith("/api/v1/formal-sample-points", fields);
    expect(put).toHaveBeenCalledWith(
      "/api/v1/formal-sample-points/formal%2Fpoint-1",
      { ...fields, expectedVersion: 4 },
    );

    await repository.assignFormalSampleMaintainer!("formal/point-1", {
      maintainerSubjectId: "employee-99",
      maintainerChangeReason: "责任岗位调整",
      expectedVersion: 5,
    });
    expect(put).toHaveBeenLastCalledWith(
      "/api/v1/formal-sample-points/formal%2Fpoint-1/maintainer",
      {
        maintainerSubjectId: "employee-99",
        maintainerChangeReason: "责任岗位调整",
        expectedVersion: 5,
      },
    );
  });

  it("adapts the year-independent design sample point CRUD contract", async () => {
    const { api, delete: remove, get, post, put } = client();
    get.mockResolvedValueOnce({
      items: [{ id: "point-1", name: "兴农示范点", version: 2 }],
      pageNumber: 1,
      pageSize: 20,
      totalElements: 21,
      totalPages: 2,
    } as never);
    get.mockResolvedValueOnce({
      id: "point-1",
      name: "兴农示范点",
      version: 2,
    } as never);
    const repository = createRealtimeBusinessRepository(api);
    const mutation = {
      contractVersion: "design-sample-fields-v2",
      contractDigest: `sha256:${"a".repeat(64)}`,
      context: {
        domainCode: "REFERENCE",
        productCode: "GENERAL",
        objectTypeCode: "REFERENCE_POINT",
      },
      values: {
        DSP_NAME: "兴农示范点",
        DSP_REGION_CODE: "230202",
        DSP_ADDRESS: "龙沙区兴农路1号",
        DSP_LONGITUDE: "123.95",
        DSP_LATITUDE: "47.35",
      },
    } as const;

    await repository.listDesignSamplePoints!({
      domainCode: "PRODUCTION",
      productCode: "CORN",
      objectTypeCode: "FARMER",
      regionCode: "230202",
      keyword: "兴农",
      page: 1,
      pageSize: 20,
    });
    await repository.getDesignSamplePoint!("point/1");
    await repository.createDesignSamplePoint!(mutation, "create-key-1");
    await repository.updateDesignSamplePoint!("point/1", mutation, 2);
    await repository.deleteDesignSamplePoint!("point/1", 3);

    expect(get).toHaveBeenCalledWith("/api/v1/design-sample-points", {
      domainCode: "PRODUCTION",
      productCode: "CORN",
      objectTypeCode: "FARMER",
      regionCode: "230202",
      keyword: "兴农",
      page: 1,
      pageSize: 20,
    });
    expect(get).toHaveBeenCalledWith("/api/v1/design-sample-points/point%2F1");
    expect(post).toHaveBeenCalledWith(
      "/api/v1/design-sample-points",
      mutation,
      { headers: { "Idempotency-Key": "create-key-1" } },
    );
    expect(put).toHaveBeenCalledWith("/api/v1/design-sample-points/point%2F1", {
      ...mutation,
      expectedVersion: 2,
    });
    expect(remove).toHaveBeenCalledWith(
      "/api/v1/design-sample-points/point%2F1",
      { expectedVersion: 3 },
    );
  });

  it("connects atomic design and formal sample workbook imports", async () => {
    const { api, download, upload } = client();
    upload.mockResolvedValue({
      id: "import-1",
      statusCode: "COMPLETED",
      importedRows: 2,
      failedRows: 0,
      completedAt: "2026-09-02T08:00:00Z",
    });
    const repository = createRealtimeBusinessRepository(api);
    const file = new File(["workbook"], "样本点.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    await repository.downloadDesignSamplePointTemplate!("MARKET");
    await repository.importDesignSamplePoints!(
      file,
      "MARKET",
      "design-import-key",
    );
    await repository.downloadDesignSamplePointImportErrors!("import/1");
    await repository.downloadFormalSamplePointTemplate!();
    await repository.importFormalSamplePoints!(file, "formal-import-key");
    await repository.downloadFormalSamplePointImportErrors!("import/2");

    expect(download.mock.calls).toEqual([
      ["/api/v1/design-sample-points/import-template?domain=MARKET"],
      ["/api/v1/design-sample-points/imports/import%2F1/errors"],
      ["/api/v1/formal-sample-points/import-template"],
      ["/api/v1/formal-sample-points/imports/import%2F2/errors"],
    ]);
    expect(upload).toHaveBeenNthCalledWith(
      1,
      "/api/v1/design-sample-points/imports?domain=MARKET",
      expect.any(FormData),
      { "Idempotency-Key": "design-import-key" },
    );
    expect(upload).toHaveBeenNthCalledWith(
      2,
      "/api/v1/formal-sample-points/imports",
      expect.any(FormData),
      { "Idempotency-Key": "formal-import-key" },
    );
    expect(upload.mock.calls[0]?.[1].get("file")).toMatchObject({
      name: "样本点.xlsx",
      size: file.size,
    });
    expect(upload.mock.calls[1]?.[1].get("file")).toMatchObject({
      name: "样本点.xlsx",
      size: file.size,
    });
  });

  it("keeps formal-sample filters, locked object identity, and idempotent save aligned", async () => {
    expectTypeOf<EligibleFormalSample>()
      .toHaveProperty("objectTypeCode")
      .toEqualTypeOf<string | null>();
    expectTypeOf<EligibleFormalSample>()
      .toHaveProperty("objectTypeName")
      .toEqualTypeOf<string | null>();

    const { api, get, post } = client();
    get.mockResolvedValueOnce([
      {
        samplePointId: "sample-1",
        sampleName: "中粮生化能源（龙江）有限公司",
        objectTypeCode: "DEEP_PROCESSOR",
        objectTypeName: "深加工企业",
        domain: "MARKET",
        productCode: "CORN",
        regionCode: "230221",
        regionName: "龙江县",
        latitude: "47.5100000",
        longitude: "123.3800000",
        effectiveFrom: "2026-01-01",
        effectiveTo: null,
        latestObservationId: "record-1",
        latestObservedAt: "2026-08-25T10:58:50Z",
        latestValues: { MKT_OBJECT_TYPE: "DEEP_PROCESSOR" },
      },
    ] as never);
    get.mockResolvedValueOnce({
      items: [{ observationId: "observation-1", latest: true }],
      totalElements: 2,
      pageNumber: 0,
      pageSize: 20,
    } as never);
    post.mockResolvedValueOnce({ observationId: "observation-1" } as never);
    const repository = createRealtimeBusinessRepository(api);

    const samples = await repository.listEligibleFormalSamples!({
      domain: "MARKET",
      productCode: "CORN",
      regionCode: "230221",
      objectTypeCode: "DEEP_PROCESSOR",
      keyword: "中粮生化",
      year: 2026,
      observedAt: "2026-08-29T02:51:00Z",
    });
    const history = await repository.listFormalSampleObservationHistory!({
      domain: "MARKET",
      samplePointId: "sample-1",
      productCode: "CORN",
      year: 2026,
      pageNumber: 0,
      pageSize: 20,
    });
    await repository.saveFormalSampleObservation!(
      {
        domain: "MARKET",
        samplePointId: samples[0].samplePointId,
        productCode: "CORN",
        observedAt: "2026-08-29T02:51:00Z",
        payload: { productCode: "CORN", coreValues: {}, facts: {} },
      },
      "formal-observation-key-1",
    );

    expect(samples[0]).toMatchObject({
      objectTypeCode: "DEEP_PROCESSOR",
      objectTypeName: "深加工企业",
    });
    expect(history).toMatchObject({
      totalElements: 2,
      items: [{ latest: true }],
    });
    expect(get).toHaveBeenCalledWith(
      "/api/v1/formal-sample-observations/eligible-samples",
      {
        domain: "MARKET",
        productCode: "CORN",
        regionCode: "230221",
        objectTypeCode: "DEEP_PROCESSOR",
        keyword: "中粮生化",
        year: 2026,
        observedAt: "2026-08-29T02:51:00Z",
      },
    );
    expect(post).toHaveBeenCalledWith(
      "/api/v1/formal-sample-observations/observations",
      expect.objectContaining({ samplePointId: "sample-1" }),
      { headers: { "Idempotency-Key": "formal-observation-key-1" } },
    );
    expect(get).toHaveBeenCalledWith(
      "/api/v1/formal-sample-observations/observations",
      {
        domain: "MARKET",
        samplePointId: "sample-1",
        productCode: "CORN",
        year: 2026,
        pageNumber: 0,
        pageSize: 20,
      },
    );
  });

  it("uses server identity governance contracts and preserves the upload idempotency key", async () => {
    const { api, get, post, upload, download } = client();
    get.mockResolvedValueOnce([] as never);
    post.mockResolvedValueOnce({ draftId: "draft-1" } as never);
    upload.mockResolvedValueOnce({ jobId: "merge-job-1" });
    const repository = createRealtimeBusinessRepository(api);
    const workbook = new File(["xlsx"], "身份治理.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    await repository.listSampleIdentityReviews!();
    await repository.decideSampleIdentityReview!(
      "draft/1",
      "LINK_EXISTING",
      "point-1",
      2,
      "核验一致",
    );
    await repository.downloadSampleIdentityMergeWorkbook!();
    await repository.uploadSampleIdentityMergeWorkbook!(
      workbook,
      "identity-job-key-1",
    );

    expect(get).toHaveBeenCalledWith("/api/v1/sample-point-identities/reviews");
    expect(post).toHaveBeenCalledWith(
      "/api/v1/sample-point-identities/reviews/draft%2F1/decisions",
      {
        decision: "LINK_EXISTING",
        targetSamplePointId: "point-1",
        expectedVersion: 2,
        reason: "核验一致",
      },
    );
    expect(download).toHaveBeenCalledWith(
      "/api/v1/sample-point-identities/merge-export",
    );
    expect(upload).toHaveBeenCalledWith(
      "/api/v1/sample-point-identities/merge-jobs",
      expect.any(FormData),
      { "Idempotency-Key": "identity-job-key-1" },
    );
  });

  it("sends the caller idempotency key when retrying failed coordinate rows", async () => {
    const { api, post } = client();
    post.mockResolvedValueOnce({ jobId: "job-2" } as never);
    const repository = createRealtimeBusinessRepository(api);

    await repository.retrySamplePointCoordinateCorrectionJob!(
      "job/1",
      "retry-key-1",
    );

    expect(post).toHaveBeenCalledWith(
      "/api/v1/sample-point-coordinate-corrections/jobs/job%2F1/retry",
      undefined,
      {
        headers: { "Idempotency-Key": "retry-key-1" },
        timeoutMs: 300_000,
      },
    );
  });

  it("loads one strictly parsed observable snapshot with only allowed query parameters", async () => {
    const { api, get } = client();
    get.mockResolvedValueOnce(validSnapshot() as never);
    const repository = createRealtimeBusinessRepository(api);

    const snapshot = await repository.loadObservableAnalysisSnapshot({
      productCode: "CORN",
      regionCode: "230200",
      surveyYear: 2026,
      surveyMonth: 8,
      cultivarCode: "CORN-DENT",
      subjectTypeCode: "FARMER",
    });
    expect(snapshot.analysisVersion).toMatch(/^sha256:/u);
    expect(snapshot.qualityState).toBe("AVAILABLE");
    expect(get).toHaveBeenCalledWith("/api/v1/observable-analysis/snapshots", {
      productCode: "CORN",
      regionCode: "230200",
      surveyYear: 2026,
      surveyMonth: 8,
      cultivarCode: "CORN-DENT",
      subjectTypeCode: "FARMER",
    });
  });

  it("coalesces identical in-flight observable snapshots without caching completed data", async () => {
    const { api, get } = client();
    let release: () => void = () => undefined;
    const pending = new Promise<ReturnType<typeof validSnapshot>>((resolve) => {
      release = () => resolve(validSnapshot());
    });
    get.mockReturnValueOnce(pending as never);
    const repository = createRealtimeBusinessRepository(api);
    const query = {
      productCode: "CORN",
      regionCode: "230200",
      surveyYear: 2026,
    };

    const first = repository.loadObservableAnalysisSnapshot(query);
    const duplicate = repository.loadObservableAnalysisSnapshot(query);
    expect(get).toHaveBeenCalledTimes(1);
    release();
    await expect(Promise.all([first, duplicate])).resolves.toHaveLength(2);

    get.mockResolvedValueOnce(validSnapshot() as never);
    await repository.loadObservableAnalysisSnapshot(query);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("uses the governed annual sample-network lifecycle contracts", async () => {
    const { api, get, post, put } = client();
    const repository = createRealtimeBusinessRepository(api);
    get.mockResolvedValue({ networkYear: 2027, memberships: [] } as never);
    post.mockResolvedValue({ networkYear: 2027, memberships: [] } as never);
    put.mockResolvedValue({ networkYear: 2027, memberships: [] } as never);

    await repository.getSampleNetwork!(2027);
    await repository.getSampleNetworkComparison!(2027, "230200", "CORN");
    await repository.generateSampleNetworkCandidates!(2027, 2026);
    await repository.updateSampleNetworkMember!(2027, "point/1", {
      designVillageRegionCode: "230202997001",
      relationType: "EXPLICIT_REPRESENTATION",
      evidenceReference: "2027年实地核验记录",
      statusCode: "ACTIVE",
      sourceCode: "CARRIED_FORWARD",
      reason: "继续纳入2027年度",
      version: 0,
    });
    await repository.submitSampleNetwork!(2027, 3);
    await repository.reviewSampleNetwork!(2027, 4, "APPROVE", "独立复核通过");

    expect(get).toHaveBeenNthCalledWith(1, "/api/v1/sample-networks/2027");
    expect(get).toHaveBeenNthCalledWith(
      2,
      "/api/v1/sample-networks/2027/comparison",
      { productCode: "CORN", regionCode: "230200" },
    );
    expect(post).toHaveBeenCalledWith("/api/v1/sample-networks/2027", {
      carriedFromYear: 2026,
    });
    expect(put).toHaveBeenCalledWith(
      "/api/v1/sample-networks/2027/members/point%2F1",
      {
        designVillageRegionCode: "230202997001",
        relationType: "EXPLICIT_REPRESENTATION",
        evidenceReference: "2027年实地核验记录",
        statusCode: "ACTIVE",
        sourceCode: "CARRIED_FORWARD",
        reason: "继续纳入2027年度",
        version: 0,
      },
    );
    expect(post).toHaveBeenCalledWith("/api/v1/sample-networks/2027/submit", {
      version: 3,
    });
    expect(post).toHaveBeenCalledWith("/api/v1/sample-networks/2027/review", {
      version: 4,
      decision: "APPROVE",
      reason: "独立复核通过",
    });
  });

  it("keeps transport errors distinct from snapshot contract failures", async () => {
    const { api, get } = client();
    const repository = createRealtimeBusinessRepository(api);
    get.mockRejectedValueOnce(
      new RealtimeApiError({
        code: "ACCESS_REGION_DENIED",
        message: "无权访问该地区",
        status: 403,
      }),
    );

    await expect(
      repository.loadObservableAnalysisSnapshot({
        productCode: "CORN",
        regionCode: "150700",
        surveyYear: 2026,
      }),
    ).rejects.toMatchObject({ code: "ACCESS_REGION_DENIED", status: 403 });

    get.mockResolvedValueOnce({
      ...validSnapshot(),
      recordId: "private",
    } as never);
    await expect(
      repository.loadObservableAnalysisSnapshot({
        productCode: "CORN",
        regionCode: "230200",
        surveyYear: 2026,
      }),
    ).rejects.toMatchObject({ code: "CONTRACT_MISMATCH", status: 200 });
  });

  it("sends the expected production contract version and digest to the backend", async () => {
    const { api, get } = client();
    get.mockResolvedValueOnce(
      productionDefinition("RICE", "VILLAGE_COMMITTEE", [
        "MILLING_YIELD",
      ]) as never,
    );
    const repository = createRealtimeBusinessRepository(api);

    await repository.loadProductionDefinition("RICE", "VILLAGE_COMMITTEE");

    expect(get).toHaveBeenCalledWith("/api/v1/production-record-definitions", {
      productCode: "RICE",
      objectTypeCode: "VILLAGE_COMMITTEE",
      contractVersion: PRODUCTION_SURVEY_CONTRACT_VERSION,
      contractDigest: PRODUCTION_SURVEY_CONTRACT_DIGEST,
    });
  });

  it("accepts only the authoritative production survey contract version and boundaries", () => {
    const definition = productionDefinition();

    expect(parseProductionDefinition(definition)).toEqual(definition);
    expect(() =>
      parseProductionDefinition({
        ...definition,
        contractVersion: "production-survey-fields-obsolete",
      }),
    ).toThrowError(
      expect.objectContaining<Partial<RealtimeApiError>>({
        code: "CONTRACT_MISMATCH",
      }),
    );
    expect(() =>
      parseProductionDefinition({
        ...definition,
        fields: [
          ...definition.fields,
          field("PROD_SAMPLE_SUBJECT_CODE", {
            groupCode: "SUBJECT",
            groupLabel: "系统治理",
            groupOrder: 20,
            controlType: "READONLY_SUBJECT",
            readOnly: true,
            importable: false,
          }),
        ],
      }),
    ).toThrowError(
      expect.objectContaining<Partial<RealtimeApiError>>({
        code: "CONTRACT_MISMATCH",
      }),
    );
    expect(() =>
      parseProductionDefinition({
        ...definition,
        fields: definition.fields.filter(
          ({ code }) => code !== "PROD_SURVEYOR_PHONE",
        ),
      }),
    ).toThrowError(
      expect.objectContaining<Partial<RealtimeApiError>>({
        code: "CONTRACT_MISMATCH",
        details: expect.objectContaining({
          reason: "INVALID_PRODUCTION_FIELD_BOUNDARY",
        }),
      }),
    );
  });

  it("binds the parsed public contract to its digest and rejects unapproved fields", () => {
    const definition = {
      ...productionDefinition(),
      contractDigest: PRODUCTION_SURVEY_CONTRACT_DIGEST,
    };

    expect(parseProductionDefinition(definition)).toMatchObject({
      contractVersion: PRODUCTION_SURVEY_CONTRACT_VERSION,
      contractDigest: definition.contractDigest,
    });
    expect(() =>
      parseProductionDefinition({
        ...definition,
        contractDigest:
          "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      }),
    ).toThrowError(
      expect.objectContaining<Partial<RealtimeApiError>>({
        code: "CONTRACT_MISMATCH",
        details: expect.objectContaining({
          reason: "CONTRACT_DIGEST_MISMATCH",
        }),
      }),
    );
    expect(() =>
      parseProductionDefinition({
        ...definition,
        fields: [
          ...definition.fields,
          field("PROD_UNAPPROVED_PUBLIC_FIELD", {
            groupCode: "DETAIL",
            groupLabel: "业务信息",
            groupOrder: 40,
            sortOrder: 999,
          }),
        ],
      }),
    ).toThrowError(
      expect.objectContaining<Partial<RealtimeApiError>>({
        code: "CONTRACT_MISMATCH",
        details: expect.objectContaining({
          reason: "INVALID_PRODUCTION_FIELD_BOUNDARY",
          unapprovedPublicCodes: ["PROD_UNAPPROVED_PUBLIC_FIELD"],
        }),
      }),
    );
  });

  it("runtime-validates production definitions loaded from the API", async () => {
    const { api, get } = client();
    get.mockResolvedValueOnce(productionDefinition() as never);
    const repository = createRealtimeBusinessRepository(api);

    const definition = await repository.loadProductionDefinition(
      "CORN",
      "FARMER",
    );

    expect(definition.contractVersion).toBe(PRODUCTION_SURVEY_CONTRACT_VERSION);
    expect(definition.fields.map(({ code }) => code)).not.toContain(
      "PROD_SAMPLE_SUBJECT_CODE",
    );
    expect(definition.fields).toContainEqual(
      expect.objectContaining({ code: "PROD_SAMPLE_NAME" }),
    );
  });

  it("enumerates the authoritative enabled production product set", async () => {
    const products = [
      { code: "CORN", name: "玉米" },
      { code: "SOYBEAN", name: "大豆" },
      { code: "RICE", name: "稻谷" },
    ] as const;
    const { api, get } = client(products);
    const repository = createRealtimeBusinessRepository(api);

    if (!repository.listProducts) {
      throw new Error("Production product enumeration is required");
    }
    const enabled = await repository.listProducts("PRODUCTION", "MONITORING");

    expect(new Set(enabled.map(({ code }) => code))).toEqual(
      new Set(products.map(({ code }) => code)),
    );
    expect(get).toHaveBeenCalledWith("/api/v1/master-data/products", {
      domain: "PRODUCTION",
      pageKind: "MONITORING",
    });
  });

  it.each([
    ["CORN", "MOISTURE"],
    ["SOYBEAN", "PROTEIN"],
    ["RICE", "MILLING_YIELD"],
  ] as const)(
    "keeps the %s product and its quality projection bound to the request",
    async (productCode, qualityCode) => {
      const { api, get } = client();
      get.mockResolvedValueOnce(
        productionDefinition(productCode, "FARMER", [qualityCode]) as never,
      );
      const repository = createRealtimeBusinessRepository(api);

      const definition = await repository.loadProductionDefinition(
        productCode,
        "FARMER",
      );

      expect(definition.productCode).toBe(productCode);
      expect(definition.objectTypeCode).toBe("FARMER");
      expect(
        definition.groups.flatMap(({ fields }) =>
          fields.map(({ code }) => code),
        ),
      ).toContain(qualityCode);
    },
  );

  it("rejects a response product or object mismatch even with the same digest", async () => {
    const { api, get } = client();
    get.mockResolvedValueOnce(
      productionDefinition("SOYBEAN", "VILLAGE_COMMITTEE", [
        "PROTEIN",
      ]) as never,
    );
    const repository = createRealtimeBusinessRepository(api);

    await expect(
      repository.loadProductionDefinition("CORN", "FARMER"),
    ).rejects.toMatchObject({
      code: "CONTRACT_MISMATCH",
      details: {
        reason: "PRODUCTION_CONTEXT_MISMATCH",
        expectedProductCode: "CORN",
        actualProductCode: "SOYBEAN",
        expectedObjectTypeCode: "FARMER",
        actualObjectTypeCode: "VILLAGE_COMMITTEE",
      },
    });
  });

  it("uses a product/object/digest-specific production definition cache key", () => {
    const corn = productionDefinitionCacheKey(
      "CORN",
      "FARMER",
      "sha256:44997993c550cd093d2012bb0eb0520b5f693da046cca2573d4fbe6b93f62e32",
    );
    const soybean = productionDefinitionCacheKey(
      "SOYBEAN",
      "FARMER",
      "sha256:44997993c550cd093d2012bb0eb0520b5f693da046cca2573d4fbe6b93f62e32",
    );

    expect(corn).toContain("CORN");
    expect(corn).toContain("FARMER");
    expect(corn).toContain(
      "sha256:44997993c550cd093d2012bb0eb0520b5f693da046cca2573d4fbe6b93f62e32",
    );
    expect(soybean).not.toBe(corn);
  });

  it("does not reuse a cached definition across product codes", async () => {
    const { api, get } = client();
    get.mockResolvedValueOnce(
      productionDefinition("CORN", "FARMER", ["MOISTURE"]) as never,
    );
    get.mockResolvedValueOnce(
      productionDefinition("SOYBEAN", "FARMER", ["PROTEIN"]) as never,
    );
    const repository = createRealtimeBusinessRepository(api);

    const corn = await repository.loadProductionDefinition("CORN", "FARMER");
    const cornAgain = await repository.loadProductionDefinition(
      "CORN",
      "FARMER",
    );
    const soybean = await repository.loadProductionDefinition(
      "SOYBEAN",
      "FARMER",
    );

    expect(cornAgain).toBe(corn);
    expect(soybean.productCode).toBe("SOYBEAN");
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("coalesces concurrent formal definition reads per domain and context", async () => {
    const { api, get } = client();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    get.mockImplementation(async (path: string) => {
      await gate;
      if (path.endsWith("/production-record-definitions")) {
        return productionDefinition() as never;
      }
      if (path.endsWith("/market-record-definitions")) {
        return {
          productCode: "CORN",
          objectTypeCode: "TRADER",
          coreFields: [],
          groups: [],
        } as never;
      }
      if (path.endsWith("/logistics-record-definitions")) {
        return {
          productCode: "CORN",
          fields: [],
          actions: [],
        } as never;
      }
      throw new Error(`unexpected GET ${path}`);
    });
    const repository = createRealtimeBusinessRepository(api);

    const reads = [
      repository.loadProductionDefinition("CORN", "FARMER"),
      repository.loadProductionDefinition("CORN", "FARMER"),
      repository.loadMarketDefinition("CORN", "TRADER"),
      repository.loadMarketDefinition("CORN", "TRADER"),
      repository.loadLogisticsDefinition("CORN"),
      repository.loadLogisticsDefinition("CORN"),
    ];

    await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(3));
    release();
    await expect(Promise.all(reads)).resolves.toHaveLength(6);
  });

  it("does not cache a failed formal definition read", async () => {
    const { api, get } = client();
    get.mockRejectedValueOnce(new Error("temporary unavailable"));
    get.mockResolvedValueOnce({
      productCode: "CORN",
      objectTypeCode: "TRADER",
      coreFields: [],
      groups: [],
    } as never);
    const repository = createRealtimeBusinessRepository(api);

    await expect(
      repository.loadMarketDefinition("CORN", "TRADER"),
    ).rejects.toThrow("temporary unavailable");
    await expect(
      repository.loadMarketDefinition("CORN", "TRADER"),
    ).resolves.toMatchObject({ productCode: "CORN" });
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("publishes an approved business record as a governed supply source", async () => {
    const { api, post } = client();
    const repository = createRealtimeBusinessRepository(api);
    const input = {
      sourceDomain: "PRODUCTION" as const,
      sourceRecordId: "production-1",
      sourceVersion: 2,
      productCode: "CORN",
      regionCode: "230200",
      periodCode: "2026-Q3",
      roleCode: "LOCAL_PRODUCTION" as const,
      sourceFieldCode: "PROD_ESTIMATED_OUTPUT" as const,
      qualityState: "PASSED" as const,
    };

    await repository.releaseSupplySource(input);

    expect(post).toHaveBeenCalledWith("/api/v1/supply-sources/releases", input);
  });

  it("reads and exports governed employee obligation reports", async () => {
    const { api, download, get, post } = client();
    get.mockResolvedValueOnce({
      weekStart: "2026-08-03",
      weekEnd: "2026-08-09",
      scopeLabel: "王洋",
      summary: { total: 1, overdueOutstanding: 1 },
      rows: [],
    } as never);
    post.mockResolvedValueOnce({
      id: "report/1",
      filename: "填报履职周报.xlsx",
    } as never);
    const repository = createRealtimeBusinessRepository(api);
    const input = { weekStart: "2026-08-03", subjectId: "wang-yang" };

    await repository.loadWorkObligationWeeklyReport(input);
    const exported = await repository.createWorkObligationReportExport(input);
    await repository.downloadWorkObligationReport(exported.id);

    expect(get).toHaveBeenCalledWith(
      "/api/v1/work-obligation-reports/weekly",
      input,
    );
    expect(post).toHaveBeenCalledWith(
      "/api/v1/work-obligation-reports/weekly/exports",
      input,
    );
    expect(download).toHaveBeenCalledWith(
      "/api/v1/work-obligation-reports/exports/report%2F1/content",
    );
  });

  it("reads the database-owned annual comparison indicator catalogue", async () => {
    const { api, get } = client();
    get.mockResolvedValueOnce([
      {
        code: "PRODUCTION_PROD_OPENING_INVENTORY",
        name: "产情核定期初库存",
        unitCode: "吨",
        sourceDomain: "PRODUCTION",
        aggregationCode: "SUM",
      },
    ] as never);
    const repository = createRealtimeBusinessRepository(api);

    await expect(
      repository.listAnnualComparisonDefinitions("PRODUCTION", "SOYBEAN"),
    ).resolves.toEqual([
      expect.objectContaining({
        code: "PRODUCTION_PROD_OPENING_INVENTORY",
      }),
    ]);
    expect(get).toHaveBeenCalledWith(
      "/api/v1/overview/annual-comparison-definitions",
      { sourceDomain: "PRODUCTION", productCode: "SOYBEAN" },
    );
  });

  it("reads durable notifications, marks them read and streams business changes", async () => {
    const { api, get, post } = client();
    get.mockImplementationOnce(
      () =>
        Promise.resolve({
          items: [
            {
              id: "event-1",
              sequence: 12,
              aggregateType: "PRODUCTION_RECORD",
              aggregateId: "production-1",
              actionCode: "PRODUCTION_RECORD_CREATED",
              productCode: "CORN",
              regionCodes: ["230200"],
              occurredAt: "2026-08-09T10:00:00Z",
              read: false,
            },
          ],
          unreadCount: 1,
        }) as never,
    );
    post.mockImplementationOnce(
      () => Promise.resolve({ id: "event-1", read: true }) as never,
    );
    const listeners = new Map<string, (event: MessageEvent<string>) => void>();
    const source = {
      addEventListener: vi.fn(
        (name: string, listener: EventListenerOrEventListenerObject) => {
          listeners.set(
            name,
            listener as unknown as (event: MessageEvent<string>) => void,
          );
        },
      ),
      close: vi.fn(),
    };
    const repository = createRealtimeBusinessRepository(api, {
      eventSourceFactory: (url) => {
        expect(url).toBe("/api/v1/business-events/stream?after=12");
        return source;
      },
    });

    await expect(repository.listNotifications()).resolves.toMatchObject({
      unreadCount: 1,
      items: [{ aggregateId: "production-1", read: false }],
    });
    await repository.markNotificationRead("event/1");
    const onChange = vi.fn();
    const unsubscribe = repository.subscribeBusinessEvents(12, onChange);
    listeners.get("business-change")?.(
      new MessageEvent("business-change", {
        data: JSON.stringify({
          id: "event-2",
          sequence: 13,
          aggregateType: "MARKET_RECORD",
          aggregateId: "market-1",
          actionCode: "MARKET_RECORD_CREATED",
          productCode: "SOYBEAN",
          regionCodes: ["230200"],
          occurredAt: "2026-08-09T10:01:00Z",
          read: false,
        }),
      }),
    );
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: "event-2", productCode: "SOYBEAN" }),
    );
    expect(get).toHaveBeenCalledWith("/api/v1/notifications");
    expect(post).toHaveBeenCalledWith("/api/v1/notifications/event%2F1/read");
    unsubscribe();
    expect(source.close).toHaveBeenCalledTimes(1);
  });

  it("accepts standards-compatible SSE events across browser realms", () => {
    const listeners = new Map<string, (event: MessageEvent<string>) => void>();
    const source = {
      addEventListener: vi.fn(
        (name: string, listener: EventListenerOrEventListenerObject) => {
          listeners.set(
            name,
            listener as unknown as (event: MessageEvent<string>) => void,
          );
        },
      ),
      close: vi.fn(),
    };
    const repository = createRealtimeBusinessRepository(
      { get: vi.fn(), post: vi.fn() } as never,
      { eventSourceFactory: () => source },
    );
    const onChange = vi.fn();
    repository.subscribeBusinessEvents(0, onChange);

    listeners.get("business-change")?.({
      data: JSON.stringify({
        id: "event-cross-realm",
        sequence: 1,
        aggregateType: "MARKET_RECORD",
        aggregateId: "market-1",
        actionCode: "MARKET_RECORD_RETURNED",
        productCode: "SOYBEAN",
        regionCodes: ["230208101001"],
        occurredAt: "2026-08-09T13:30:00Z",
        read: false,
      }),
    } as MessageEvent<string>);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ actionCode: "MARKET_RECORD_RETURNED" }),
    );
  });

  it("loads all master-data collections from the API", async () => {
    const { api, get } = client();
    const result = await createRealtimeBusinessRepository(api).loadMasterData();
    expect(result.products).toEqual([{ code: "CORN", name: "玉米" }]);
    expect(result.periods).toEqual([]);
    expect(result.regions[0]?.code).toBe("230200");
    expect(result.approvedSurveyYears).toEqual([2024]);
    expect(get).toHaveBeenCalledTimes(4);
  });

  it("loads governed supply survey years and nullable quarters", async () => {
    const { api, get } = client();
    const periods =
      await createRealtimeBusinessRepository(api).loadSupplySurveyPeriods();

    expect(periods).toEqual([
      expect.objectContaining({
        code: "2026",
        surveyQuarter: null,
        precision: "YEAR",
      }),
    ]);
    expect(get).toHaveBeenCalledWith(
      "/api/v1/master-data/supply-survey-periods",
    );
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

  it("connects employee assignments and access reviews to governance APIs", async () => {
    const { api, get, post, put } = client();
    const repository = createRealtimeBusinessRepository(api);

    await repository.listEmployees();
    await repository.loadAssignmentOptions("QIQIHAR_BUSINESS");
    await repository.inviteEmployee({
      idempotencyKey: "identity-invite-employee-88",
      subjectId: "employee-88",
      displayName: "张敏",
      deliveryAddress: "employee-88@example.test",
      workUnitCode: "QIQIHAR_BUSINESS",
      positionCodes: ["REGIONAL_REPORTER"],
      roleCodes: ["BUSINESS_OPERATOR"],
      regionCodes: ["230202"],
    });
    await repository.loadEmployeeInvitation("employee-88");
    await repository.revokeInvitation("invitation-88");
    await repository.reissueInvitation({
      idempotencyKey: "identity-reinvite-employee-88",
      subjectId: "employee-88",
      deliveryAddress: "employee-88-new@example.test",
    });
    await repository.updateEmployee("employee-88", {
      version: 2,
      displayName: "张敏",
      workUnitCode: "QIQIHAR_BUSINESS",
      accountStatus: "ACTIVE",
      employmentStatus: "ACTIVE",
      positionCodes: ["REGIONAL_REPORTER"],
      roleCodes: ["BUSINESS_OPERATOR"],
      regionCodes: ["230202"],
    });
    await repository.listAccessReviews("QIQIHAR_BUSINESS");
    await repository.createAccessReview({
      name: "三季度权限复核",
      workUnitCode: "QIQIHAR_BUSINESS",
      dueAt: "2026-09-30T16:00:00Z",
    });
    await repository.decideAccessReview("review-1", [
      {
        subjectId: "employee-88",
        grantType: "REGION",
        grantKey: "230202",
        decisionCode: "RETAIN",
        reason: "责任区域继续有效",
      },
    ]);

    expect(get).toHaveBeenCalledWith("/api/v1/identity/employees");
    expect(get).toHaveBeenCalledWith(
      "/api/v1/identity/employees/assignment-options",
      { workUnitCode: "QIQIHAR_BUSINESS" },
    );
    expect(get).toHaveBeenCalledWith("/api/v1/identity/access-reviews", {
      workUnitCode: "QIQIHAR_BUSINESS",
    });
    expect(post).toHaveBeenCalledWith(
      "/api/v1/identity/employees",
      expect.objectContaining({
        subjectId: "employee-88",
        deliveryAddress: "employee-88@example.test",
      }),
      { headers: { "Idempotency-Key": "identity-invite-employee-88" } },
    );
    expect(put).toHaveBeenCalledWith(
      "/api/v1/identity/employees/employee-88",
      expect.objectContaining({ version: 2 }),
    );
    expect(get).toHaveBeenCalledWith(
      "/api/v1/identity/employees/employee-88/invitation",
    );
    expect(post).toHaveBeenCalledWith(
      "/api/v1/identity/invitations/invitation-88/revoke",
    );
    expect(post).toHaveBeenCalledWith(
      "/api/v1/identity/employees/employee-88/invitations",
      { deliveryAddress: "employee-88-new@example.test" },
      { headers: { "Idempotency-Key": "identity-reinvite-employee-88" } },
    );
    expect(post).toHaveBeenCalledWith(
      "/api/v1/identity/access-reviews",
      expect.objectContaining({ name: "三季度权限复核" }),
    );
    expect(post).toHaveBeenCalledWith(
      "/api/v1/identity/access-reviews/review-1/decisions",
      {
        decisions: [
          {
            subjectId: "employee-88",
            grantType: "REGION",
            grantKey: "230202",
            decisionCode: "RETAIN",
            reason: "责任区域继续有效",
          },
        ],
      },
    );
  });

  it("uses the non-secret CSRF bootstrap before posting an invitation activation token", async () => {
    const { api, get, post } = client();
    const repository = createRealtimeBusinessRepository(api);

    await repository.bootstrapInvitationActivation();
    await repository.activateInvitation("secret-invitation-token-0002");

    expect(get).toHaveBeenCalledWith(
      "/api/v1/identity/invitations/activation-bootstrap",
    );
    expect(post).toHaveBeenCalledWith("/api/v1/identity/invitations/activate", {
      token: "secret-invitation-token-0002",
    });
  });

  it("queries immutable business audit events through the governed API", async () => {
    const { api, get } = client();
    const repository = createRealtimeBusinessRepository(api);

    await repository.listAuditEvents({
      workUnitCode: "QIQIHAR_BUSINESS",
      aggregateType: "SECURITY_USER",
      actorSubjectId: "identity-admin",
      occurredFrom: "2026-08-01T00:00:00.000Z",
      occurredTo: "2026-08-10T23:59:59.999Z",
      page: 1,
      pageSize: 25,
    });

    expect(get).toHaveBeenCalledWith("/api/v1/audit-events", {
      workUnitCode: "QIQIHAR_BUSINESS",
      aggregateType: "SECURITY_USER",
      actorSubjectId: "identity-admin",
      occurredFrom: "2026-08-01T00:00:00.000Z",
      occurredTo: "2026-08-10T23:59:59.999Z",
      page: 1,
      pageSize: 25,
    });
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

  it("sends one governed batch approval request for the selected work-item scope", async () => {
    const { api, post } = client();
    const repository = createRealtimeBusinessRepository(api);

    await repository.batchApproveWorkItems?.({
      domain: "PRODUCTION",
      regionId: "230225",
      productCode: "CORN",
    });

    expect(post).toHaveBeenCalledWith(
      "/api/v1/work-items/batch-approve",
      {
        domain: "PRODUCTION",
        regionId: "230225",
        productCode: "CORN",
      },
      { timeoutMs: 300_000 },
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

  it("uses atomic create and resubmit endpoints for formal production and market entry", async () => {
    const { api, post, put } = client();
    const repository = createRealtimeBusinessRepository(api) as unknown as {
      createAndSubmitProduction(input: unknown): Promise<unknown>;
      updateAndSubmitProduction(id: string, input: unknown): Promise<unknown>;
      createAndSubmitMarket(input: unknown): Promise<unknown>;
      updateAndSubmitMarket(id: string, input: unknown): Promise<unknown>;
    };
    const production = { productCode: "CORN" };
    const market = { productCode: "SOYBEAN" };

    await repository.createAndSubmitProduction(production);
    await repository.updateAndSubmitProduction("production/1", production);
    await repository.createAndSubmitMarket(market);
    await repository.updateAndSubmitMarket("market/1", market);

    expect(post).toHaveBeenNthCalledWith(
      1,
      "/api/v1/production-records/submit",
      production,
    );
    expect(put).toHaveBeenNthCalledWith(
      1,
      "/api/v1/production-records/production%2F1/submit",
      production,
    );
    expect(post).toHaveBeenNthCalledWith(
      2,
      "/api/v1/market-records/submit",
      market,
    );
    expect(put).toHaveBeenNthCalledWith(
      2,
      "/api/v1/market-records/market%2F1/submit",
      market,
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

  it("persists governed market object dossiers through the dedicated API", async () => {
    const { api, get, post, put } = client();
    const repository = createRealtimeBusinessRepository(
      api,
    ) as RealtimeBusinessRepository & {
      listMarketObjects(): Promise<readonly unknown[]>;
      createMarketObject(input: unknown): Promise<unknown>;
      updateMarketObject(id: string, input: unknown): Promise<unknown>;
    };
    const input = {
      objectName: "讷河阶段四米业",
      objectTypeId: "grain-processing-enterprise",
      regionCode: "230281",
      productIds: ["paddy"],
      cultivarIds: [],
      sourceChannelId: "enterprise-report",
      responsiblePerson: "王洋",
      effectiveFrom: "2026-08-01",
      effectiveTo: null,
      validityStatus: "active",
      roles: [],
    };

    expect(typeof repository.listMarketObjects).toBe("function");
    expect(typeof repository.createMarketObject).toBe("function");
    expect(typeof repository.updateMarketObject).toBe("function");
    await repository.listMarketObjects();
    await repository.createMarketObject(input);
    await repository.updateMarketObject("object/1", { ...input, version: 2 });

    expect(get).toHaveBeenCalledWith("/api/v1/market-objects");
    expect(post).toHaveBeenCalledWith("/api/v1/market-objects", input);
    expect(put).toHaveBeenCalledWith("/api/v1/market-objects/object%2F1", {
      ...input,
      version: 2,
    });
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

  it("binds each product workbook to the menu product and includes optional photos", async () => {
    const { api, upload } = client();
    const repository = createRealtimeBusinessRepository(api);
    const workbook = new File(["xlsx"], "业务批量导入.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const photo = new File(["photo"], "样本点一.jpg", { type: "image/jpeg" });
    await repository.importProductionCsv(workbook, "CORN", "FARMER", [photo]);
    await repository.importMarketWorkbook?.(workbook, "SOYBEAN", "TRADER");
    await repository.importLogisticsWorkbook?.(workbook, "RICE");

    const expectedPaths = [
      "/api/v1/imports/production?productCode=CORN",
      "/api/v1/imports/market?productCode=SOYBEAN&objectTypeCode=TRADER",
      "/api/v1/imports/logistics?productCode=RICE",
    ];
    expectedPaths.forEach((path, index) => {
      const call = upload.mock.calls[index];
      expect(call?.[0]).toBe(path);
      expect(call?.[1]).toBeInstanceOf(FormData);
      expect(call?.[2]?.["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/u);
    });
    const productionForm = upload.mock.calls[0]?.[1];
    if (!(productionForm instanceof FormData))
      throw new Error("expected multipart form");
    expect(productionForm.getAll("photos")).toHaveLength(1);
    expect((productionForm.get("photos") as File).name).toBe("样本点一.jpg");
  });

  it("downloads the unified market template without a selected object type", async () => {
    const { api, download } = client();
    const repository = createRealtimeBusinessRepository(api);

    await repository.downloadMarketXlsxTemplate?.("CORN");

    expect(download).toHaveBeenCalledWith("/api/v1/imports/market/template", {
      format: "xlsx",
      productCode: "CORN",
    });
  });

  it("uses only the dedicated returned-correction workbook endpoints", async () => {
    const { api, download, get, upload } = client();
    get.mockResolvedValueOnce({
      id: "correction/job-1",
      domainCode: "MARKET",
      statusCode: "PROCESSING",
      importedRows: 0,
      failedRows: 0,
    } as never);
    const repository = createRealtimeBusinessRepository(api);
    const workbook = new File(["xlsx"], "玉米市场退回记录修正表.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    await repository.downloadMarketReturnedCorrectionWorkbook?.("CORN");
    await repository.importMarketReturnedCorrectionWorkbook?.(workbook, "CORN");
    await repository.getMarketReturnedCorrectionJob?.("correction/job-1");
    await repository.downloadMarketReturnedCorrectionErrors?.(
      "correction/job-1",
    );

    expect(download).toHaveBeenNthCalledWith(
      1,
      "/api/v1/imports/market/returned-corrections/template",
      { productCode: "CORN" },
    );
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0]?.[0]).toBe(
      "/api/v1/imports/market/returned-corrections?productCode=CORN",
    );
    expect(upload.mock.calls[0]?.[1]).toBeInstanceOf(FormData);
    expect(upload.mock.calls[0]?.[2]?.["Idempotency-Key"]).toMatch(
      /^[0-9a-f-]{36}$/u,
    );
    const form = upload.mock.calls[0]?.[1];
    if (!(form instanceof FormData)) throw new Error("expected multipart form");
    expect(Array.from(form.keys())).toEqual(["file"]);
    expect((form.get("file") as File).name).toBe("玉米市场退回记录修正表.xlsx");
    expect(get).toHaveBeenCalledWith(
      "/api/v1/imports/market/returned-corrections/correction%2Fjob-1",
    );
    expect(download).toHaveBeenNthCalledWith(
      2,
      "/api/v1/imports/market/returned-corrections/correction%2Fjob-1/errors",
    );
    expect(upload.mock.calls[0]?.[0]).not.toBe("/api/v1/imports/market");
  });

  it("routes production and logistics corrections to their dedicated original-record endpoints", async () => {
    const { api, download, get, upload } = client();
    get.mockResolvedValue({
      id: "correction/job-1",
      domainCode: "PRODUCTION",
      statusCode: "PROCESSING",
      importedRows: 0,
      failedRows: 0,
    } as never);
    const repository = createRealtimeBusinessRepository(api);
    const workbook = new File(["xlsx"], "退回记录修正表.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    for (const domain of ["production", "logistics"] as const) {
      await repository.downloadReturnedCorrectionWorkbook?.(domain, "CORN");
      await repository.importReturnedCorrectionWorkbook?.(
        domain,
        workbook,
        "CORN",
      );
      await repository.getReturnedCorrectionJob?.(domain, "correction/job-1");
      await repository.downloadReturnedCorrectionErrors?.(
        domain,
        "correction/job-1",
      );
    }

    for (const [index, domain] of ["production", "logistics"].entries()) {
      expect(download).toHaveBeenNthCalledWith(
        index * 2 + 1,
        `/api/v1/imports/${domain}/returned-corrections/template`,
        { productCode: "CORN" },
      );
      const uploadCall = upload.mock.calls[index];
      expect(uploadCall?.[0]).toBe(
        `/api/v1/imports/${domain}/returned-corrections?productCode=CORN`,
      );
      expect(uploadCall?.[1]).toBeInstanceOf(FormData);
      expect(uploadCall?.[2]?.["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/u);
      expect(get).toHaveBeenNthCalledWith(
        index + 1,
        `/api/v1/imports/${domain}/returned-corrections/correction%2Fjob-1`,
      );
      expect(download).toHaveBeenNthCalledWith(
        index * 2 + 2,
        `/api/v1/imports/${domain}/returned-corrections/correction%2Fjob-1/errors`,
      );
    }
  });

  it("lists imported rows and submits one draft to formal review", async () => {
    const { api, get, post } = client();
    get.mockResolvedValueOnce([] as never);
    post.mockResolvedValueOnce({
      id: "draft/1",
      stateCode: "PROMOTED",
    } as never);
    const repository = createRealtimeBusinessRepository(api);

    await repository.listImportDrafts?.("job/1");
    await repository.submitImportDraft?.("draft/1");

    expect(get).toHaveBeenCalledWith("/api/v1/import-drafts", {
      importJobId: "job/1",
    });
    expect(post).toHaveBeenCalledWith("/api/v1/import-drafts/draft%2F1/submit");
  });

  it("restores pending product drafts and submits one import job as a batch", async () => {
    const { api, get, post } = client();
    get.mockResolvedValueOnce([] as never);
    post.mockResolvedValueOnce({
      importJobId: "job/1",
      submittedRows: 2,
      remainingDraftRows: 0,
    } as never);
    const repository = createRealtimeBusinessRepository(api);

    await repository.listPendingImportDrafts?.("PRODUCTION", "CORN");
    await repository.submitImportDraftJob?.("job/1");

    expect(get).toHaveBeenCalledWith("/api/v1/import-drafts", {
      domainCode: "PRODUCTION",
      productCode: "CORN",
      stateCode: "DRAFT",
    });
    expect(post).toHaveBeenCalledWith(
      "/api/v1/import-drafts/jobs/job%2F1/submit",
    );
  });

  it("reads, retries and downloads the durable result of every background import", async () => {
    const { api, download, get, post } = client();
    get.mockResolvedValueOnce({
      id: "import-1",
      domainCode: "MARKET",
      statusCode: "PROCESSING",
      importedRows: 0,
      failedRows: 0,
    } as never);
    post.mockResolvedValueOnce({
      id: "import-2",
      domainCode: "MARKET",
      statusCode: "QUEUED",
      importedRows: 0,
      failedRows: 0,
    } as never);
    const repository = createRealtimeBusinessRepository(api);

    await repository.getImportJob!("market", "import/1");
    await repository.retryImportJob!("market", "import/1");
    await repository.downloadImportErrors!("market", "import/1");

    expect(get).toHaveBeenCalledWith("/api/v1/imports/market/import%2F1");
    expect(post).toHaveBeenCalledWith(
      "/api/v1/imports/market/import%2F1/retries",
    );
    expect(download).toHaveBeenCalledWith(
      "/api/v1/imports/market/import%2F1/errors",
    );
  });

  it("lists the current account and unit import history for one business domain", async () => {
    const { api, get } = client();
    get.mockResolvedValueOnce({
      items: [],
      pageNumber: 1,
      pageSize: 10,
      totalElements: 0,
      totalPages: 0,
    });
    const repository = createRealtimeBusinessRepository(api);

    await repository.listImportJobs!("market", 1, 10);

    expect(get).toHaveBeenCalledWith("/api/v1/imports/market", {
      pageNumber: 1,
      pageSize: 10,
    });
  });

  it("reads an import photo manifest and supplements one file at a time against the original job", async () => {
    const { api, get, upload } = client();
    get.mockResolvedValueOnce({
      totalFileCount: 2,
      eligibleFileCount: 1,
      deferredFileCount: 1,
      totalTargetAttachments: 2,
      attachedTargetAttachments: 0,
      files: [],
    } as never);
    const repository = createRealtimeBusinessRepository(api);
    const photo = new File(["photo"], "现场照片.png", { type: "image/png" });

    await repository.getProductionImportPhotoManifest!("import/1");
    await repository.supplementProductionImportPhoto!("import/1", photo);

    expect(get).toHaveBeenCalledWith(
      "/api/v1/imports/production/import%2F1/photo-manifest",
    );
    const [path, body] = upload.mock.calls.at(-1) ?? [];
    expect(path).toBe("/api/v1/imports/production/import%2F1/photos");
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get("file")).toBeInstanceOf(File);
    expect((body as FormData).get("file")).toHaveProperty(
      "name",
      "现场照片.png",
    );
  });

  it("creates a scoped report preview before exporting and publishing its immutable result", async () => {
    const { api, download, get, post } = client();
    get.mockImplementationOnce(
      () => Promise.resolve({ definitions: [], formats: [] }) as never,
    );
    post
      .mockImplementationOnce(
        () =>
          Promise.resolve({
            id: "preview-1",
            title: "齐齐哈尔市综合经营日报",
          }) as never,
      )
      .mockImplementationOnce(
        () =>
          Promise.resolve({ id: "export-1", previewId: "preview-1" }) as never,
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          id: "publication-1",
          previewId: "preview-1",
          exportTaskId: "export-1",
          version: 1,
        }),
      );
    const repository = createRealtimeBusinessRepository(api);

    await repository.loadReportParameterOptions();
    const preview = await repository.createReportPreview({
      definitionCode: "COMPREHENSIVE_DAILY",
      regionLevel: "PREFECTURE",
      regionCode: "230200",
      periodCode: "2026-W32",
    });
    await repository.createReportExport(preview.id, "CSV");
    await repository.downloadReportExport("export-1");
    await repository.createReportPublication(preview.id, "export-1", 0);

    expect(get).toHaveBeenCalledWith("/api/v1/reports/parameter-options");
    expect(post).toHaveBeenNthCalledWith(1, "/api/v1/reports/previews", {
      definitionCode: "COMPREHENSIVE_DAILY",
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
    expect(post).toHaveBeenNthCalledWith(
      3,
      "/api/v1/reports/previews/preview-1/publications",
      { exportTaskId: "export-1", expectedVersion: 0 },
    );
  });
});

function field(
  code: string,
  overrides: Partial<{
    label: string;
    groupCode: string;
    groupLabel: string;
    groupOrder: number;
    sortOrder: number;
    valueType: string;
    controlType: string;
    unit: string | null;
    required: boolean;
    options: readonly string[];
    readOnly: boolean;
    calculated: boolean;
    importable: boolean;
    displayed: boolean;
    description: string | null;
    precision: number;
    scale: number;
  }> = {},
) {
  return {
    code,
    label: code,
    groupCode: "CONTEXT",
    groupLabel: "基础信息",
    groupOrder: 10,
    sortOrder: 10,
    valueType: "TEXT",
    controlType: "TEXT",
    unit: null,
    required: false,
    options: [],
    readOnly: false,
    calculated: false,
    importable: true,
    displayed: true,
    description: null,
    precision: 0,
    scale: 0,
    ...overrides,
  };
}

function productionDefinition(
  productCode: "CORN" | "SOYBEAN" | "RICE" = "CORN",
  objectTypeCode: "FARMER" | "VILLAGE_COMMITTEE" = "FARMER",
  qualityCodes: readonly string[] = [],
) {
  return {
    productCode,
    objectTypeCode,
    contractVersion: PRODUCTION_SURVEY_CONTRACT_VERSION,
    contractDigest: PRODUCTION_SURVEY_CONTRACT_DIGEST,
    fields: [
      field("objectTypeCode", { controlType: "SELECT", required: true }),
      field("regionCode", { controlType: "REGION", required: true }),
      field("surveyYear", {
        label: "数据年份",
        controlType: "SELECT",
        required: true,
      }),
      field("surveyMonth", {
        label: "数据月份",
        controlType: "SELECT",
      }),
      field("PROD_SAMPLE_NAME", {
        label: "样本点名称",
        groupCode: "SUBJECT",
        groupLabel: "填报与定位",
        groupOrder: 20,
      }),
      field("PROD_REPORTER_NAME", {
        label: "填报人",
        groupCode: "SUBJECT",
        groupLabel: "填报与定位",
        groupOrder: 20,
        sortOrder: 20,
        controlType: "READONLY_TEXT",
        required: true,
        readOnly: true,
        importable: false,
      }),
      ...["PROD_SURVEYOR_NAME", "PROD_SURVEYOR_PHONE"].map((code, index) =>
        field(code, {
          groupCode: "SUBJECT",
          groupLabel: "填报与定位",
          groupOrder: 20,
          sortOrder: 30 + index * 10,
          required: false,
        }),
      ),
      field("PROD_SAMPLE_CONTACT", {
        groupCode: "SUBJECT",
        groupLabel: "填报与定位",
        groupOrder: 20,
        sortOrder: 50,
        required: true,
      }),
      ...["PROD_SAMPLE_LATITUDE", "PROD_SAMPLE_LONGITUDE"].map((code, index) =>
        field(code, {
          groupCode: "SUBJECT",
          groupLabel: "填报与定位",
          groupOrder: 20,
          sortOrder: 60 + index * 10,
          valueType: "DECIMAL",
          controlType: "DECIMAL",
          required: true,
        }),
      ),
      field("cultivatedAreaMu", {
        groupCode: "OUTPUT",
        groupLabel: "产量信息",
        groupOrder: 30,
        valueType: "DECIMAL",
        controlType: "DECIMAL",
        required: true,
      }),
      field("yieldPerMuKilograms", {
        groupCode: "OUTPUT",
        groupLabel: "产量信息",
        groupOrder: 30,
        sortOrder: 20,
        valueType: "DECIMAL",
        controlType: "DECIMAL",
        required: true,
      }),
      field("estimatedOutputKilograms", {
        groupCode: "OUTPUT",
        groupLabel: "产量信息",
        groupOrder: 30,
        sortOrder: 30,
        valueType: "DECIMAL",
        controlType: "READONLY_DECIMAL",
        readOnly: true,
        calculated: true,
        importable: false,
      }),
      field("yearOnYear", {
        groupCode: "OUTPUT",
        groupLabel: "产量信息",
        groupOrder: 30,
        sortOrder: 40,
        controlType: "READONLY_TEXT",
        readOnly: true,
        calculated: true,
        importable: false,
      }),
      ...qualityCodes.map((code, index) =>
        field(code, {
          label: code,
          groupCode: "QUALITY",
          groupLabel: "质量指标",
          groupOrder: 100,
          sortOrder: index + 1,
          valueType: "DECIMAL",
          controlType: "DECIMAL",
          unit: "%",
        }),
      ),
    ],
    groups: qualityCodes.length
      ? [
          {
            category: "QUALITY",
            label: "质量指标",
            sortOrder: 100,
            fields: qualityCodes.map((code, index) => ({
              code,
              label: code,
              valueType: "DECIMAL",
              unit: "%",
              description: null,
              precision: 18,
              scale: 1,
              sortOrder: index + 1,
            })),
          },
        ]
      : [],
  };
}
