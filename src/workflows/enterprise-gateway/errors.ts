import type { HttpError } from "@refinedev/core";

export type EnterpriseResource = "object" | "document";

export interface EnterpriseQueryError extends Error, HttpError {
  code: "NOT_FOUND" | "QUERY_FAILED";
  resource?: EnterpriseResource;
  resourceId?: string;
}

export function enterpriseNotFoundError(
  resource: EnterpriseResource,
  resourceId: string,
): EnterpriseQueryError {
  const message = `${resource === "object" ? "监测对象" : "业务单据"}不存在`;
  return Object.assign(new Error(message), {
    name: "EnterpriseQueryError",
    code: "NOT_FOUND",
    statusCode: 404,
    resource,
    resourceId,
  } as const);
}

export function isEnterpriseNotFoundError(
  error: unknown,
): error is EnterpriseQueryError {
  if (!error || typeof error !== "object") return false;
  const candidate = error as Partial<EnterpriseQueryError>;
  return candidate.code === "NOT_FOUND" && candidate.statusCode === 404;
}
