const attemptKey = "cofco:automatic-login-attempt";
export function clearAutomaticLoginAttempt() {
  try { sessionStorage.removeItem(attemptKey); } catch { /* Storage may be disabled. */ }
}
export function redirectToEnterpriseLogin(
  url: string,
  navigate: (url: string) => void = (target) => window.location.replace(target),
): boolean {
  try {
    const previous = Number(sessionStorage.getItem(attemptKey));
    if (previous && Date.now() - previous < 60_000) return false;
    sessionStorage.setItem(attemptKey, String(Date.now()));
  } catch { return false; }
  navigate(url);
  return true;
}
