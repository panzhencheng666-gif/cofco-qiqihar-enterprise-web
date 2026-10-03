import { createHostController, checkSession } from "./host-controller.js";
const open = document.querySelector("#open");
const status = document.querySelector("#status");
const pause = document.querySelector("#pause");
const labels = {
  idle: "点击打开后确认登录状态并加载地球。",
  checking: "正在确认登录状态…",
  running: "地球观察已打开。",
  paused: "已暂停地球观察并释放资源。点击恢复继续。",
  denied: "登录状态不可用，请先登录。",
  unavailable: "暂时无法确认登录状态，请稍后重试。",
};
const host = createHostController({
  checkSession,
  mount: () => {
    const iframe = document.createElement("iframe");
    iframe.title = "God’s Eye View 地球观察";
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.src = "./frame.html";
    document.querySelector("#frame-mount").append(iframe);
    return iframe;
  },
  onState: (state) => {
    document.body.classList.toggle("running", state === "running");
    open.disabled = state === "checking";
    pause.hidden = state !== "running";
    open.textContent =
      state === "paused"
        ? "恢复地球观察"
        : state === "unavailable"
          ? "重新确认并打开"
          : "打开地球观察";
    status.textContent = labels[state];
    document.querySelector("#login").hidden = state !== "denied";
  },
});
open.addEventListener("click", () => {
  if (!document.hidden) void host.open();
});
pause.addEventListener("click", () => host.suspend());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) host.suspend();
});
window.addEventListener("pagehide", () => host.suspend());
