export const invitationActivationStorageKey =
  "cofco.identity.invitation.activation-token";

function readStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(invitationActivationStorageKey);
  } catch {
    return null;
  }
}

export function captureInvitationActivationToken(): string | null {
  if (typeof window === "undefined") return null;
  const fragment = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const parameters = new URLSearchParams(fragment);
  if (!parameters.has("activate")) return readStoredToken();

  const token = parameters.get("activate")?.trim() ?? "";
  parameters.delete("activate");
  const remainingFragment = parameters.toString();
  window.history.replaceState(
    window.history.state,
    "",
    `${window.location.pathname}${window.location.search}${
      remainingFragment ? `#${remainingFragment}` : ""
    }`,
  );

  try {
    if (token) {
      window.sessionStorage.setItem(invitationActivationStorageKey, token);
    } else {
      window.sessionStorage.removeItem(invitationActivationStorageKey);
    }
  } catch {
    return token || null;
  }
  return token || null;
}

export function clearInvitationActivationToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(invitationActivationStorageKey);
  } catch {
    // A blocked session store is already non-persistent; there is nothing else to clear.
  }
}
