import type { AccessControlProvider } from "@refinedev/core";

const allowedActions = new Set([
  "overview:list",
  "tasks:list",
  "objects:show",
  "documents:show",
  "reviews:list",
  "documents:review",
]);

export const accessControlProvider: AccessControlProvider = {
  async can({ resource, action }) {
    return {
      can: allowedActions.has(`${resource}:${action}`),
      reason: "本地兼容阶段只开放读取与复核投影",
    };
  },
};
