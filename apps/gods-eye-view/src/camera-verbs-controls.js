import { createCameraVerbs } from "./camera-verbs.js";
/** Explicit native controls and bounded DOM ownership; no autonomous motion. */
export function installCameraVerbsControls({
  viewer,
  nodes,
  signal,
  motionOwner,
  beforeMotion = () => {},
  document = nodes.panel.ownerDocument,
  motion = document.defaultView?.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ),
}) {
  const removers = [];
  let verbs,
    disposed = false;
  const alive = () => !disposed && !signal?.aborted && !viewer.isDestroyed?.();
  const visible = () =>
    nodes.panel.open && !nodes.panel.closest("[hidden]") && !document.hidden;
  const listen = (target, type, fn, options) => {
    target.addEventListener(type, fn, options);
    removers.push(() => target.removeEventListener(type, fn, options));
  };
  const animate = () => !(motion?.matches && !nodes.allow.checked);
  const update = (state) => {
    if (!alive()) return;
    nodes.stop.disabled = state.status !== "playing";
    nodes.continuous.disabled = !animate();
    nodes.status.textContent = `${state.message} · ${state.seconds.toFixed(1)} 秒`;
    nodes.preference.textContent = motion?.matches
      ? "系统偏好减少动态：单次直接定位；连续运动需明确勾选。"
      : "单次 0.9 秒；连续每次最多 30 秒。操作或隐藏页面会停止。";
  };
  const directions = () => {
    const previous = nodes.direction.value;
    nodes.direction.replaceChildren();
    const values =
      {
        orbit: ["left", "right"],
        pan: ["left", "right", "up", "down"],
        tilt: ["up", "down"],
        rotate: ["left", "right"],
      }[nodes.motion.value] || [];
    for (const value of values) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = {
        left: "向左",
        right: "向右",
        up: "向上",
        down: "向下",
      }[value];
      nodes.direction.append(option);
    }
    if (values.includes(previous)) nodes.direction.value = previous;
  };
  const start = (mode) => {
    if (!alive() || !visible() || (mode === "continuous" && !animate())) return;
    beforeMotion();
    verbs.start({
      motion: nodes.motion.value,
      direction: nodes.direction.value,
      speed: nodes.speed.value,
      mode,
      instant: mode === "once" && !animate(),
    });
  };
  const cancelAll = () => motionOwner.cancel();
  const destroy = () => {
    if (disposed) return;
    disposed = true;
    signal?.removeEventListener("abort", destroy);
    for (const remove of removers.splice(0).reverse()) remove();
    verbs?.destroy();
  };
  try {
    verbs = createCameraVerbs({
      viewer,
      signal,
      motionOwner,
      canRender: visible,
      onChange: update,
    });
    nodes.allow.checked = false;
    directions();
    update(verbs.state());
    listen(nodes.once, "click", () => start("once"));
    listen(nodes.continuous, "click", () => start("continuous"));
    listen(nodes.stop, "click", () => verbs.stop("已手动停止相机运动。"));
    for (const key of ["motion", "direction", "speed", "allow"])
      listen(nodes[key], "change", () => {
        verbs.stop("参数已更改，运动已停止。");
        if (key === "motion") directions();
        update(verbs.state());
      });
    listen(nodes.panel, "toggle", () => {
      if (!nodes.panel.open) verbs.stop("相机面板已关闭，运动已停止。");
    });
    listen(document, "visibilitychange", () => {
      if (document.hidden) cancelAll();
    });
    if (document.defaultView)
      listen(document.defaultView, "pagehide", cancelAll);
    if (motion)
      listen(motion, "change", () => {
        nodes.allow.checked = false;
        verbs.stop("系统动态偏好已更改，运动已停止。");
        update(verbs.state());
      });
    for (const type of ["pointerdown", "mousedown", "wheel", "touchstart"])
      listen(viewer.container || viewer.canvas, type, cancelAll, {
        capture: true,
        passive: true,
      });
    listen(
      viewer.container || viewer.canvas,
      "keydown",
      (event) => {
        if (
          [
            "ArrowUp",
            "ArrowDown",
            "ArrowLeft",
            "ArrowRight",
            "PageUp",
            "PageDown",
            "+",
            "-",
            "Escape",
          ].includes(event.key)
        )
          cancelAll();
      },
      true,
    );
    signal?.addEventListener("abort", destroy, { once: true });
    if (signal?.aborted) destroy();
    return { destroy, stop: verbs.stop };
  } catch (error) {
    destroy();
    throw error;
  }
}
