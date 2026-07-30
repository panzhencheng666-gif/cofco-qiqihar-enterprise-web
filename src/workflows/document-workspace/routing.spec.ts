import { canonicalDocumentPath } from "./routing";
import { describe, expect, it } from "vitest";

describe("canonicalDocumentPath", () => {
  it("creates the only object/document route used by tasks and reviews", () => {
    expect(
      canonicalDocumentPath("site-qqhr-001", "doc-market-20260730-001"),
    ).toBe("/objects/site-qqhr-001/documents/doc-market-20260730-001");
  });
});
