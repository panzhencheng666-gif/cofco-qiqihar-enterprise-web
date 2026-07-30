import type { MonitoringObject } from "@/domains/monitoring-object/model";
import { enterpriseNotFoundError } from "@/workflows/enterprise-gateway/errors";
import type { BusinessDocument } from "./model";
import { fixedDecimal } from "./model";
import { resolveDocumentViewState } from "./view-state";
import { describe, expect, it } from "vitest";

const object: MonitoringObject = {
  id: "object-a",
  name: "对象 A",
  kind: "operating-site",
  regionPath: ["黑龙江省", "齐齐哈尔市"],
  capabilities: ["贸易"],
  status: "active",
};

const document: BusinessDocument = {
  id: "document-a",
  objectId: object.id,
  domain: "market-monitoring",
  commodity: "玉米",
  reportingPeriod: "2026-07-30",
  formVersion: "MARKET-CORN-1.0",
  revision: 1,
  state: "PRIMARY_REVIEW",
  quality: { blocking: 0, warning: 0, passed: 1 },
  sections: [
    {
      id: "purchase",
      title: "收购",
      fields: [
        {
          code: "price",
          label: "价格",
          value: { status: "reported", amount: fixedDecimal("2168") },
          quality: "passed",
        },
      ],
    },
  ],
};

const base = {
  requestedObjectId: object.id,
  object,
  document,
  objectLoading: false,
  documentLoading: false,
  accessLoading: false,
  objectError: null,
  documentError: null,
  accessError: null,
};

describe("resolveDocumentViewState", () => {
  it("does not call service failures coordinate mismatches", () => {
    expect(
      resolveDocumentViewState({
        ...base,
        document: undefined,
        documentError: new Error("服务离线"),
      }),
    ).toEqual({ kind: "query-error" });
  });

  it("distinguishes object and document not-found results", () => {
    expect(
      resolveDocumentViewState({
        ...base,
        object: undefined,
        objectError: enterpriseNotFoundError("object", object.id),
      }),
    ).toEqual({ kind: "not-found", target: "object" });
    expect(
      resolveDocumentViewState({
        ...base,
        document: undefined,
        documentError: enterpriseNotFoundError("document", document.id),
      }),
    ).toEqual({ kind: "not-found", target: "document" });
  });

  it("reports a mismatch only after both resources load", () => {
    expect(
      resolveDocumentViewState({
        ...base,
        requestedObjectId: "object-b",
      }),
    ).toEqual({ kind: "mismatch" });
    expect(resolveDocumentViewState(base)).toMatchObject({ kind: "ready" });
  });
});
