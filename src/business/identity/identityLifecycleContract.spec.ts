import { describe, expect, it } from "vitest";
import { identityLifecycleContract } from "./identityLifecycleContract";

describe("identity lifecycle cross-repository contract", () => {
  it("freezes version, statuses, errors, idempotency and audit vocabulary", () => {
    expect(identityLifecycleContract).toEqual({
      version: "2026-08-30",
      idempotencyHeader: "Idempotency-Key",
      invitationStatuses: ["PENDING", "ACTIVATED", "REVOKED", "EXPIRED"],
      deliveryResults: ["QUEUED", "DELIVERED", "FAILED"],
      errorCodes: [
        "IDENTITY_INVITATION_INVALID",
        "IDENTITY_INVITATION_NOT_FOUND",
        "IDENTITY_INVITATION_STATE_CONFLICT",
        "IDENTITY_INVITATION_IDEMPOTENCY_CONFLICT",
        "INVALID_IDEMPOTENCY_KEY",
        "INVALID_INVITATION_DELIVERY_ADDRESS",
        "IDENTITY_SUBJECT_NOT_FOUND",
      ],
      auditEvents: [
        "SECURITY_USER_INVITED",
        "SECURITY_USER_ACTIVATED",
        "SECURITY_INVITATION_REVOKED",
        "SECURITY_USER_REINVITED",
      ],
    });
  });
});
