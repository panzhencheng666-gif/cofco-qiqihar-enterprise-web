import { describe, expect, it } from "vitest";
import {
  apiPendingOperationalIdentity,
  apiPendingShellIdentity,
} from "./runtimeIdentity";

describe("API runtime identity placeholder", () => {
  it("does not claim a named user or client-side elevated permissions", () => {
    expect(apiPendingShellIdentity.account).toEqual({
      displayName: "已认证用户",
      menuItems: [],
      responsibilityLabel: "以服务端授权为准",
      roleLabel: "权限待服务端确认",
    });
    expect(apiPendingOperationalIdentity.identity).toEqual({
      userId: "authenticated-user",
      postId: "authorization-pending",
      displayName: "已认证用户",
    });
    expect(apiPendingOperationalIdentity.authorization.permissionKeys).toEqual(
      [],
    );
    expect(JSON.stringify(apiPendingShellIdentity)).not.toContain("王洋");
    expect(JSON.stringify(apiPendingOperationalIdentity)).not.toContain("王洋");
  });
});
