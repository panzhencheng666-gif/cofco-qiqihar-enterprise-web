export type RuntimeDataMode = "api" | "fixtures";

export function resolveRuntimeDataMode({
  environmentMode,
  requestedMode,
}: {
  environmentMode: string;
  requestedMode?: unknown;
}): RuntimeDataMode {
  if (
    requestedMode === "fixtures" &&
    (environmentMode === "development" || environmentMode === "test")
  ) {
    return "fixtures";
  }
  return "api";
}
