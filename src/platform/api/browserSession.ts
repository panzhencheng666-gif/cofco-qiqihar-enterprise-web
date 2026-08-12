export const enterpriseLoginPath = "/api/v1/session/login";
export const enterpriseLogoutPath = "/api/v1/session/logout";
export const enterpriseSessionPath = "/api/v1/session/me";

export function csrfTokenFromCookies(
  cookieHeader?: string,
): string | undefined {
  const source =
    cookieHeader ?? (typeof document === "undefined" ? "" : document.cookie);
  const encoded = source
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("XSRF-TOKEN="))
    ?.slice("XSRF-TOKEN=".length);
  if (!encoded) return undefined;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return undefined;
  }
}
