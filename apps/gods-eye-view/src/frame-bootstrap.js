import { checkSession, isAuthenticatedSession } from "./host-controller.js";
const lifecycle = new AbortController();
const close = () => lifecycle.abort();
document.addEventListener("visibilitychange", () => {
  if (document.hidden) close();
});
window.addEventListener("pagehide", close);
try {
  if (document.hidden) close();
  lifecycle.signal.throwIfAborted();
  const session = await checkSession(lifecycle.signal);
  lifecycle.signal.throwIfAborted();
  if (!isAuthenticatedSession(session))
    throw new Error("请登录后从应用中心打开地球观察。");
  const { startGlobe } = await import("./globe.js");
  lifecycle.signal.throwIfAborted();
  await startGlobe(lifecycle.signal);
} catch (error) {
  document.querySelector("#globe-status").textContent = lifecycle.signal.aborted
    ? "已暂停，请从入口恢复地球观察。"
    : `无法打开地球：${error.message}`;
}
