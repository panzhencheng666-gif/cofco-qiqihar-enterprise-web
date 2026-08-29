import type { OperationalScopeIdentity } from "./core/operationalScope";
import type { FormalShellIdentity } from "./formalEnterpriseData";

export const apiPendingShellIdentity: FormalShellIdentity = {
  platformName: "齐齐哈尔粮食商情企业平台",
  workUnit: {
    organizationLabel: "当前组织",
    currentUnitLabel: "当前工作单位",
    units: [],
  },
  account: {
    displayName: "已认证用户",
    menuItems: [],
    roleLabel: "当前角色",
    responsibilityLabel: "按当前账号权限展示",
  },
};

export const apiPendingOperationalIdentity: OperationalScopeIdentity = {
  workUnit: {
    organizationId: "current-organization",
    unitId: "authorization-pending",
    label: "当前工作单位",
  },
  identity: {
    userId: "authenticated-user",
    postId: "authorization-pending",
    displayName: "已认证用户",
  },
  authorization: {
    serverAuthoritative: true,
    authorizedRegionIds: ["authorized-all"],
    authorizedBusinessClassificationIds: [],
    authorizedProductIds: [],
    authorizedCultivarIds: [],
    authorizedReleaseVersionIds: [],
    permissionKeys: [],
  },
};
