import { afterEach, expect, it, vi } from "vitest";
import {
  redirectToEnterpriseLogin,
  clearAutomaticLoginAttempt,
} from "./automaticLogin";
afterEach(() => sessionStorage.clear());
it("redirects once and blocks repeated unauthenticated returns", () => {
  const navigate = vi.fn();
  expect(redirectToEnterpriseLogin("/api/v1/session/login", navigate)).toBe(
    true,
  );
  expect(navigate).toHaveBeenCalledWith("/api/v1/session/login");
  expect(redirectToEnterpriseLogin("/api/v1/session/login", navigate)).toBe(
    false,
  );
  expect(navigate).toHaveBeenCalledTimes(1);
  clearAutomaticLoginAttempt();
  expect(redirectToEnterpriseLogin("/api/v1/session/login", navigate)).toBe(
    true,
  );
});
it("fails closed if the redirect guard cannot be persisted", () => {
  const blocked = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new Error("unavailable");
    });
  const navigate = vi.fn();
  expect(redirectToEnterpriseLogin("/api/v1/session/login", navigate)).toBe(
    false,
  );
  expect(navigate).not.toHaveBeenCalled();
  blocked.mockRestore();
});
