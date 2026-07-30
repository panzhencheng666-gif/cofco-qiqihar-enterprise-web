import { canonicalDocumentPath } from "./routing";
import { describe, expect, it } from "vitest";

describe("canonicalDocumentPath", () => {
  it("creates the only object/document route used by tasks and reviews", () => {
    expect(
      canonicalDocumentPath("site-qqhr-001", "doc-market-20260730-001"),
    ).toBe("/objects/site-qqhr-001/documents/doc-market-20260730-001");
  });

  it("encodes slash and space characters inside route identifiers", () => {
    expect(canonicalDocumentPath("site/齐齐哈尔 001", "doc/market 001")).toBe(
      "/objects/site%2F%E9%BD%90%E9%BD%90%E5%93%88%E5%B0%94%20001/documents/doc%2Fmarket%20001",
    );
  });
});
