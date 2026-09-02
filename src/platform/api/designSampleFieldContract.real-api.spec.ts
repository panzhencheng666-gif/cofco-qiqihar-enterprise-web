import { describe, expect, it } from "vitest";

import { createRealtimeApiClient } from "./realtimeApiClient";
import { loadDesignSampleFieldDefinition } from "./designSampleFieldContract";

const acceptanceBaseUrl = process.env["DESIGN_SAMPLE_METADATA_ACCEPTANCE_URL"];

describe.runIf(acceptanceBaseUrl !== undefined)(
  "design sample metadata real API acceptance",
  () => {
    it("parses the backend-owned contract through the raw response adapter", async () => {
      const definition = await loadDesignSampleFieldDefinition(
        createRealtimeApiClient({ baseUrl: acceptanceBaseUrl }),
        {
          domainCode: "MARKET",
          productCode: "CORN",
          objectTypeCode: "TRADER",
        },
      );

      expect(definition.contractVersion).toBe("design-sample-fields-v2");
      expect(definition.supportedContexts).toHaveLength(28);
      expect(definition.observationFields.map(({ code }) => code)).toEqual(
        expect.arrayContaining([
          "MKT_PURCHASE_BASE_PRICE",
          "MKT_SALE_BASE_PRICE",
        ]),
      );
    });
  },
);
