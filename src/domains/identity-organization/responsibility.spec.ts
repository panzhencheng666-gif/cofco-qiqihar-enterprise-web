import { describe, expect, it } from "vitest";
import {
  createObligationOwnerSnapshot,
  resolveResponsibilityOwner,
  type EffectiveAppointment,
  type ResponsibilityAssignment,
  type ResponsibilityCoordinate,
} from "./responsibility";

const coordinate: ResponsibilityCoordinate = {
  id: "responsibility-coordinate:qqhr-corn-production",
  organizationId: "northeast-regional-operation-center",
  businessDomain: "production-monitoring",
  reportingItemCode: "corn-production-season",
  regionVersionId: "region-version:2026-v6",
  regionId: "region:qqhr",
  objectScopeId: "monitoring-plan:qqhr-corn-2026",
  productCode: "corn",
};

const appointments: readonly EffectiveAppointment[] = [
  {
    id: "appointment:reporter-a",
    positionId: "position:qqhr-corn-reporter",
    actorId: "actor:reporter-a",
    actorDisplayName: "张敏",
    validFrom: "2026-01-01T00:00:00+08:00",
    validToExclusive: "2026-08-01T00:00:00+08:00",
  },
  {
    id: "appointment:reporter-b",
    positionId: "position:qqhr-corn-reporter",
    actorId: "actor:reporter-b",
    actorDisplayName: "李静",
    validFrom: "2026-08-01T00:00:00+08:00",
    validToExclusive: "2027-01-01T00:00:00+08:00",
  },
];

const assignments: readonly ResponsibilityAssignment[] = [
  {
    id: "assignment:qqhr-corn-a",
    coordinateId: coordinate.id,
    appointmentId: appointments[0].id,
    validFrom: "2026-01-01T00:00:00+08:00",
    validToExclusive: "2026-08-01T00:00:00+08:00",
  },
  {
    id: "assignment:qqhr-corn-b",
    coordinateId: coordinate.id,
    appointmentId: appointments[1].id,
    validFrom: "2026-08-01T00:00:00+08:00",
    validToExclusive: "2027-01-01T00:00:00+08:00",
  },
];

describe("responsibility ownership", () => {
  it("resolves exactly one effective owner at a reporting deadline", () => {
    expect(
      resolveResponsibilityOwner({
        coordinate,
        at: "2026-07-31T16:00:00+08:00",
        assignments,
        appointments,
      }),
    ).toMatchObject({
      status: "resolved",
      assignment: { id: "assignment:qqhr-corn-a" },
      appointment: {
        id: "appointment:reporter-a",
        actorId: "actor:reporter-a",
      },
    });
  });

  it("uses half-open periods so a responsibility transfer has no overlap", () => {
    const result = resolveResponsibilityOwner({
      coordinate,
      at: "2026-08-01T00:00:00+08:00",
      assignments,
      appointments,
    });

    expect(result).toMatchObject({
      status: "resolved",
      assignment: { id: "assignment:qqhr-corn-b" },
      appointment: { id: "appointment:reporter-b" },
    });
  });

  it("fails closed when the responsibility coordinate has no owner", () => {
    expect(
      resolveResponsibilityOwner({
        coordinate,
        at: "2027-02-01T00:00:00+08:00",
        assignments,
        appointments,
      }),
    ).toEqual({
      status: "gap",
      coordinateId: coordinate.id,
      at: "2027-02-01T00:00:00+08:00",
    });
  });

  it("fails closed when overlapping assignments create multiple owners", () => {
    const conflictingAssignment: ResponsibilityAssignment = {
      id: "assignment:qqhr-corn-conflict",
      coordinateId: coordinate.id,
      appointmentId: appointments[1].id,
      validFrom: "2026-07-01T00:00:00+08:00",
      validToExclusive: "2026-09-01T00:00:00+08:00",
    };

    const result = resolveResponsibilityOwner({
      coordinate,
      at: "2026-07-31T16:00:00+08:00",
      assignments: [...assignments, conflictingAssignment],
      appointments: [
        ...appointments,
        {
          ...appointments[1],
          validFrom: "2026-07-01T00:00:00+08:00",
        },
      ],
    });

    expect(result).toMatchObject({
      status: "conflict",
      coordinateId: coordinate.id,
    });
    if (result.status === "conflict") {
      expect(result.assignmentIds).toEqual([
        "assignment:qqhr-corn-a",
        "assignment:qqhr-corn-conflict",
      ]);
    }
  });

  it("freezes the deadline owner without overwriting a later supplementary reporter", () => {
    const result = resolveResponsibilityOwner({
      coordinate,
      at: "2026-07-31T16:00:00+08:00",
      assignments,
      appointments,
    });
    if (result.status !== "resolved") throw new Error("责任人必须唯一");

    expect(
      createObligationOwnerSnapshot({
        obligationId: "obligation:qqhr-corn-2026-07-31",
        deadlineAt: "2026-07-31T16:00:00+08:00",
        resolvedOwner: result,
        capturedAt: "2026-07-31T16:00:01+08:00",
        supplementaryActorId: "actor:reporter-b",
        supplementaryActorDisplayName: "李静",
      }),
    ).toMatchObject({
      deadlineOwnerActorId: "actor:reporter-a",
      deadlineOwnerDisplayName: "张敏",
      supplementaryActorId: "actor:reporter-b",
      supplementaryActorDisplayName: "李静",
    });
  });
});
