export const WORKBENCH_URL = "/workbench/";

/** Only return to our business application, never arbitrary redirect targets. */
export function safeWorkbenchReturn(
  value: string | null,
  origin: string,
): string {
  if (!value) return WORKBENCH_URL;
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin || url.pathname !== WORKBENCH_URL)
      return WORKBENCH_URL;
    return url.pathname + url.search + url.hash;
  } catch {
    return WORKBENCH_URL;
  }
}

export function workbenchReturn(
  location: Pick<Location, "pathname" | "search" | "hash" | "origin">,
): string {
  if (location.pathname === "/" || location.pathname === WORKBENCH_URL) {
    return WORKBENCH_URL + location.search + location.hash;
  }
  return safeWorkbenchReturn(
    new URLSearchParams(location.search).get("returnTo"),
    location.origin,
  );
}

export function identityNavigationUrl(
  href: string,
  location: Pick<Location, "pathname" | "search" | "hash" | "origin">,
): string {
  const url = new URL(href, location.origin);
  url.searchParams.set("returnTo", workbenchReturn(location));
  return url.pathname + url.search + url.hash;
}
