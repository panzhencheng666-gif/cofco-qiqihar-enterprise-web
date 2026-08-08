export type ResponsibilityBusinessDomain =
  | "production-monitoring"
  | "market-monitoring"
  | "supply-situation"
  | "report-center";

export interface ResponsibilityCoordinate {
  id: string;
  organizationId: string;
  businessDomain: ResponsibilityBusinessDomain;
  reportingItemCode: string;
  regionVersionId: string;
  regionId: string;
  objectScopeId: string;
  productCode?: string;
}

export interface EffectiveAppointment {
  id: string;
  positionId: string;
  actorId: string;
  actorDisplayName: string;
  validFrom: string;
  validToExclusive: string;
}

export interface ResponsibilityAssignment {
  id: string;
  coordinateId: string;
  appointmentId: string;
  validFrom: string;
  validToExclusive: string;
}

export type ResponsibilityResolution =
  | {
      status: "resolved";
      coordinate: ResponsibilityCoordinate;
      at: string;
      assignment: ResponsibilityAssignment;
      appointment: EffectiveAppointment;
    }
  | {
      status: "gap";
      coordinateId: string;
      at: string;
    }
  | {
      status: "conflict";
      coordinateId: string;
      at: string;
      assignmentIds: readonly string[];
    };

export interface ObligationOwnerSnapshot {
  obligationId: string;
  coordinateId: string;
  deadlineAt: string;
  responsibilityAssignmentId: string;
  appointmentId: string;
  deadlineOwnerActorId: string;
  deadlineOwnerDisplayName: string;
  capturedAt: string;
  supplementaryActorId?: string;
  supplementaryActorDisplayName?: string;
}

function isEffectiveAt(
  record: { validFrom: string; validToExclusive: string },
  at: string,
) {
  const instant = Date.parse(at);
  const validFrom = Date.parse(record.validFrom);
  const validToExclusive = Date.parse(record.validToExclusive);
  return validFrom <= instant && instant < validToExclusive;
}

export function resolveResponsibilityOwner({
  coordinate,
  at,
  assignments,
  appointments,
}: {
  coordinate: ResponsibilityCoordinate;
  at: string;
  assignments: readonly ResponsibilityAssignment[];
  appointments: readonly EffectiveAppointment[];
}): ResponsibilityResolution {
  const appointmentById = new Map(
    appointments.map((appointment) => [appointment.id, appointment]),
  );
  const candidates = assignments.flatMap((assignment) => {
    if (
      assignment.coordinateId !== coordinate.id ||
      !isEffectiveAt(assignment, at)
    ) {
      return [];
    }
    const appointment = appointmentById.get(assignment.appointmentId);
    if (!appointment || !isEffectiveAt(appointment, at)) return [];
    return [{ assignment, appointment }];
  });

  if (candidates.length === 0) {
    return { status: "gap", coordinateId: coordinate.id, at };
  }
  if (candidates.length > 1) {
    return {
      status: "conflict",
      coordinateId: coordinate.id,
      at,
      assignmentIds: candidates.map(({ assignment }) => assignment.id),
    };
  }

  const candidate = candidates[0];
  return {
    status: "resolved",
    coordinate,
    at,
    assignment: candidate.assignment,
    appointment: candidate.appointment,
  };
}

export function createObligationOwnerSnapshot({
  obligationId,
  deadlineAt,
  resolvedOwner,
  capturedAt,
  supplementaryActorId,
  supplementaryActorDisplayName,
}: {
  obligationId: string;
  deadlineAt: string;
  resolvedOwner: Extract<ResponsibilityResolution, { status: "resolved" }>;
  capturedAt: string;
  supplementaryActorId?: string;
  supplementaryActorDisplayName?: string;
}): ObligationOwnerSnapshot {
  return {
    obligationId,
    coordinateId: resolvedOwner.coordinate.id,
    deadlineAt,
    responsibilityAssignmentId: resolvedOwner.assignment.id,
    appointmentId: resolvedOwner.appointment.id,
    deadlineOwnerActorId: resolvedOwner.appointment.actorId,
    deadlineOwnerDisplayName: resolvedOwner.appointment.actorDisplayName,
    capturedAt,
    supplementaryActorId,
    supplementaryActorDisplayName,
  };
}
