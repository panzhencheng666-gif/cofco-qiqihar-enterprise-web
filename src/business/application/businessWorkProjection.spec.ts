import { describe, expect, it } from "vitest";

import { fixtureOperationalIdentity } from "../formalEnterpriseData";
import { businessWorkFixtures } from "../data/businessWorkFixtures";
import { projectDomainTasks, projectMyWork } from "./businessWorkProjection";

const scope = {
  ...fixtureOperationalIdentity,
  coordinates: { regionId: "authorized-all" },
  savedView: null,
};

describe("business work fixture lifecycle invariants", () => {
  it("backs every in-progress obligation with a started audit event", () => {
    const activeWork = businessWorkFixtures.filter(
      ({ obligationStatus }) => obligationStatus === "in-progress",
    );

    expect(activeWork.length).toBeGreaterThan(0);
    for (const item of activeWork) {
      expect(
        item.obligationHistory.some(({ action }) => action === "started"),
      ).toBe(true);
    }
  });

  it("places every review conclusion after a claim for the same submission", () => {
    for (const item of businessWorkFixtures) {
      for (const [index, conclusion] of item.reviewHistory.entries()) {
        if (conclusion.action === "claimed") continue;
        const claim = item.reviewHistory
          .slice(0, index)
          .findLast(
            (event) =>
              event.action === "claimed" &&
              event.submissionVersionId === conclusion.submissionVersionId,
          );
        expect(claim).toBeDefined();
        expect(Date.parse(conclusion.at)).toBeGreaterThan(
          Date.parse(claim?.at ?? ""),
        );
      }
    }
  });

  it("backs each warning or blocking state with the current rule result", () => {
    const governedWork = businessWorkFixtures.filter(
      ({ qualityStatus }) =>
        qualityStatus === "warning" || qualityStatus === "blocking",
    );

    expect(governedWork.length).toBeGreaterThan(0);
    for (const item of governedWork) {
      const latestRules = item.qualityHistory
        .filter(({ action }) => action === "rules-executed")
        .at(-1);
      expect(latestRules).toBeDefined();
      expect(latestRules?.result).toBe(item.qualityStatus);
    }
  });

  it("backs every on-time obligation with an ordered start and completion audit chain", () => {
    const completedWork = businessWorkFixtures.filter(
      ({ obligationStatus }) => obligationStatus === "on-time",
    );

    expect(completedWork.length).toBeGreaterThan(0);
    for (const item of completedWork) {
      const completedIndex = item.obligationHistory.findIndex(
        ({ action }) => action === "completed",
      );
      const startedIndex = item.obligationHistory
        .slice(0, completedIndex)
        .findLastIndex(({ action }) => action === "started");
      expect(startedIndex).toBeGreaterThanOrEqual(0);
      expect(completedIndex).toBeGreaterThan(startedIndex);
      expect(
        Date.parse(item.obligationHistory[completedIndex]?.at ?? ""),
      ).toBeGreaterThan(
        Date.parse(item.obligationHistory[startedIndex]?.at ?? ""),
      );
    }
  });

  it("backs every reviewing status with a claim for the latest submission", () => {
    const reviewingWork = businessWorkFixtures.filter(
      ({ reviewStatus }) => reviewStatus === "reviewing",
    );

    expect(reviewingWork.length).toBeGreaterThan(0);
    for (const item of reviewingWork) {
      const latestSubmission = item.submissionHistory.at(-1);
      expect(latestSubmission).toBeDefined();
      expect(
        item.reviewHistory.some(
          (event) =>
            event.action === "claimed" &&
            event.submissionVersionId === latestSubmission?.submissionVersionId,
        ),
      ).toBe(true);
    }
  });

  it("places each pending quality explanation after submission and a warning or blocking rule result", () => {
    const explanationWork = businessWorkFixtures.filter(
      ({ qualityStatus }) => qualityStatus === "awaiting-explanation",
    );

    expect(explanationWork.length).toBeGreaterThan(0);
    for (const item of explanationWork) {
      const latestSubmission = item.submissionHistory.at(-1);
      const explanations = item.qualityHistory
        .map((event, index) => ({ event, index }))
        .filter(({ event }) => event.action === "explanation-submitted");
      expect(latestSubmission).toBeDefined();
      expect(explanations.length).toBeGreaterThan(0);
      for (const explanation of explanations) {
        const precedingRule = item.qualityHistory
          .slice(0, explanation.index)
          .filter(({ action }) => action === "rules-executed")
          .at(-1);
        expect(precedingRule).toBeDefined();
        expect(["warning", "blocking"]).toContain(precedingRule?.result);
        expect(Date.parse(precedingRule?.at ?? "")).toBeGreaterThanOrEqual(
          Date.parse(latestSubmission?.submittedAt ?? ""),
        );
        expect(Date.parse(explanation.event.at)).toBeGreaterThan(
          Date.parse(precedingRule?.at ?? ""),
        );
      }
    }
  });

  it("places every pending release request after approval of the latest submission", () => {
    const pendingReleaseWork = businessWorkFixtures.filter(
      ({ releaseStatus }) => releaseStatus === "pending",
    );

    expect(pendingReleaseWork.length).toBeGreaterThan(0);
    for (const item of pendingReleaseWork) {
      const latestSubmission = item.submissionHistory.at(-1);
      const approval = item.reviewHistory.findLast(
        (event) =>
          event.action === "approved" &&
          event.submissionVersionId === latestSubmission?.submissionVersionId,
      );
      const request = item.releaseHistory.findLast(
        ({ action }) => action === "requested",
      );
      expect(item.reviewStatus).toBe("approved");
      expect(approval).toBeDefined();
      expect(request).toBeDefined();
      expect(Date.parse(request?.at ?? "")).toBeGreaterThan(
        Date.parse(approval?.at ?? ""),
      );
    }
  });
});

describe("business work projections", () => {
  it("uses logistics-specific fill and review actions for logistics work", () => {
    const marketSeed = businessWorkFixtures.find(
      ({ domain }) => domain === "market",
    );
    expect(marketSeed).toBeDefined();
    if (!marketSeed) return;
    const logisticsReview = {
      ...marketSeed,
      workId: "WORK-LOGISTICS-REVIEW",
      businessSubtypeId: "market.logistics" as const,
      documentStatus: "submitted" as const,
      reviewStatus: "pending" as const,
    };
    const [projected] = projectDomainTasks([logisticsReview], {
      domain: "market",
      scope: {
        ...scope,
        authorization: {
          ...scope.authorization,
          serverAuthoritative: true,
        },
      },
      queryAllowed: true,
      availablePeriodKeys: [logisticsReview.periodKey],
    });

    expect(projected?.actionLabel).toBe("审核物流单据");
  });

  it("matches governed user identity only at the current processing node", () => {
    const reviewerWork = projectMyWork(businessWorkFixtures, {
      userId: "zhao-chen",
      scope,
      queryAllowed: true,
      availablePeriodKeys: ["2026-W31", "2026"],
    });

    expect([...new Set(reviewerWork.map(({ item }) => item.domain))]).toEqual([
      "market",
    ]);
    expect(
      reviewerWork.find(
        ({ item }) => item.workId === "WORK-PRODUCTION-FILL-W31",
      ),
    ).toBeUndefined();
    expect(
      reviewerWork.every(
        ({ item }) =>
          item.responsibleUserId === "zhao-chen" ||
          item.reviewerUserId === "zhao-chen",
      ),
    ).toBe(true);
  });

  it("stops assigning an approved pending-release report to its former reviewer", () => {
    const reviewerWork = projectMyWork(businessWorkFixtures, {
      userId: "wang-yang",
      scope,
      queryAllowed: true,
      availablePeriodKeys: ["2026-W31", "2026"],
    });

    expect(
      reviewerWork.find(({ item }) => item.workId === "WORK-REPORT-REVIEW-W31"),
    ).toBeUndefined();
    expect(
      reviewerWork.find(
        ({ item }) => item.workId === "WORK-SUPPLY-EXPLANATION-2026",
      )?.savedViewGroup,
    ).toBe("待审核");
  });

  it("uses the same source object and stable work identity in My Work and production tasks", () => {
    const myWork = projectMyWork(businessWorkFixtures, {
      userId: "wang-yang",
      scope,
      queryAllowed: true,
      availablePeriodKeys: ["2026-W31", "2026"],
    });
    const production = projectDomainTasks(businessWorkFixtures, {
      domain: "production",
      scope,
      queryAllowed: true,
      availablePeriodKeys: ["2026-W31"],
    });
    const personalProduction = myWork.find(
      ({ item }) => item.domain === "production",
    );

    expect(personalProduction).toBeDefined();
    expect(personalProduction?.item).toBe(production[0]?.item);
    expect(personalProduction?.item.workId).toBe(production[0]?.item.workId);
    expect(personalProduction?.item.obligationHistory).toBe(
      production[0]?.item.obligationHistory,
    );
    expect(personalProduction?.item.submissionHistory).toBe(
      production[0]?.item.submissionHistory,
    );
    expect(personalProduction?.item.reviewHistory).toBe(
      production[0]?.item.reviewHistory,
    );
    expect(personalProduction?.item.qualityHistory).toBe(
      production[0]?.item.qualityHistory,
    );
    expect(personalProduction?.item.releaseHistory).toBe(
      production[0]?.item.releaseHistory,
    );
    expect(personalProduction?.destination).toEqual({
      route: { application: "production", section: "corn-collection" },
      selection: {
        type: "work-item",
        id: personalProduction?.item.workId,
      },
    });
  });

  it("includes responsible and reviewer work only while their node is active", () => {
    const projections = projectMyWork(businessWorkFixtures, {
      userId: "wang-yang",
      scope,
      queryAllowed: true,
      availablePeriodKeys: ["2026-W31", "2026"],
    });
    expect(new Set(projections.map(({ item }) => item.domain))).toEqual(
      new Set(["production", "market", "supply"]),
    );
    expect(
      projections.find(({ item }) => item.domain === "supply")?.actionLabel,
    ).toBe("复核供需说明");
    expect(
      projections.find(({ item }) => item.domain === "reporting"),
    ).toBeUndefined();
  });

  it("enforces authorization before returning assigned or reviewer My Work items", () => {
    expect(
      projectMyWork(businessWorkFixtures, {
        userId: "wang-yang",
        scope,
        queryAllowed: false,
        availablePeriodKeys: ["2026-W31", "2026"],
      }),
    ).toEqual([]);
    expect(
      projectMyWork(businessWorkFixtures, {
        userId: "wang-yang",
        scope: {
          ...scope,
          authorization: {
            ...scope.authorization,
            authorizedRegionIds: [],
          },
        },
        queryAllowed: true,
        availablePeriodKeys: ["2026-W31", "2026"],
      }),
    ).toEqual([]);
    expect(
      projectMyWork(businessWorkFixtures, {
        userId: "wang-yang",
        scope: {
          ...scope,
          authorization: {
            ...scope.authorization,
            authorizedBusinessClassificationIds: [],
          },
        },
        queryAllowed: true,
        availablePeriodKeys: ["2026-W31", "2026"],
      }),
    ).toEqual([]);
  });

  it("filters domain tasks through permission, classification, region, product, cultivar and period authorization", () => {
    expect(
      projectDomainTasks(businessWorkFixtures, {
        domain: "production",
        scope,
        queryAllowed: false,
        availablePeriodKeys: ["2026-W31"],
      }),
    ).toEqual([]);
    expect(
      projectDomainTasks(businessWorkFixtures, {
        domain: "production",
        scope: {
          ...scope,
          coordinates: { regionId: "qiqihar-nehe", periodKey: "2099-W99" },
        },
        queryAllowed: true,
        availablePeriodKeys: ["2026-W31"],
      }),
    ).toEqual([]);
    expect(
      projectDomainTasks(businessWorkFixtures, {
        domain: "production",
        scope: {
          ...scope,
          coordinates: {
            regionId: "qiqihar-nehe",
            productId: "corn",
            cultivarId: "jingke-968",
            periodKey: "2026-W31",
          },
        },
        queryAllowed: true,
        availablePeriodKeys: ["2026-W31"],
      }),
    ).toHaveLength(1);
  });

  it("returns an empty projection for an unavailable task selection without fallback", () => {
    expect(
      projectDomainTasks(businessWorkFixtures, {
        domain: "production",
        scope,
        queryAllowed: true,
        availablePeriodKeys: ["2026-W31"],
        workId: "WORK-UNAVAILABLE",
      }),
    ).toEqual([]);
  });
});
