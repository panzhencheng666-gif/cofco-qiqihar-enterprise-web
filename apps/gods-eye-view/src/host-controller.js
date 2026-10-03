const textFields = [
  "subjectId",
  "displayName",
  "workUnitCode",
  "workUnitName",
  "accountStatus",
  "employmentStatus",
];
export function isAuthenticatedSession(value) {
  if (
    !value ||
    typeof value !== "object" ||
    !textFields.every((k) => typeof value[k] === "string") ||
    !value.subjectId.trim() ||
    value.accountStatus !== "ACTIVE" ||
    value.employmentStatus !== "ACTIVE"
  )
    return false;
  if (
    !["roleCodes", "permissions", "regionCodes"].every(
      (k) =>
        Array.isArray(value[k]) && value[k].every((v) => typeof v === "string"),
    )
  )
    return false;
  return (
    Array.isArray(value.positions) &&
    value.positions.every(
      (p) =>
        p &&
        typeof p.code === "string" &&
        typeof p.name === "string" &&
        typeof p.primaryPosition === "boolean",
    ) &&
    ["rootAdministrator", "unassignedReporter"].every(
      (k) => value[k] === undefined || typeof value[k] === "boolean",
    )
  );
}
export function createHostController({
  checkSession,
  mount,
  onState = () => {},
}) {
  let state = "idle",
    frame,
    epoch = 0,
    request;
  const publish = (s) => {
    state = s;
    onState(s);
  };
  return {
    get state() {
      return state;
    },
    async open() {
      if (state === "running" || state === "checking") return;
      const ticket = ++epoch;
      request = new AbortController();
      publish("checking");
      try {
        const session = await checkSession(request.signal);
        if (ticket !== epoch) return;
        if (!isAuthenticatedSession(session)) {
          publish("denied");
          return;
        }
        frame = mount();
        publish("running");
      } catch {
        if (ticket === epoch) publish("unavailable");
      }
    },
    suspend() {
      ++epoch;
      request?.abort();
      frame?.remove();
      frame = undefined;
      publish("paused");
    },
  };
}
export async function checkSession(signal) {
  const deadline = AbortSignal.timeout(10000);
  const response = await fetch("/api/v1/session/me", {
    method: "GET",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.any([signal, deadline]),
  });
  if (!response.ok) return null;
  if (!response.headers.get("content-type")?.includes("application/json"))
    return null;
  const body = await response.text();
  if (body.length > 131072) return null;
  return JSON.parse(body)?.data ?? null;
}
