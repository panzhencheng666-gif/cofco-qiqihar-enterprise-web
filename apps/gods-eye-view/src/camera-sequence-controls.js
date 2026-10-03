import { createCameraSequence } from "./camera-sequence.js";

/** Accessible DOM ownership, including capture-phase cancellation ahead of Cesium input. */
export function installCameraSequenceControls({
  viewer,
  nodes,
  signal,
  motionOwner,
  beforeMotion = () => {},
  document = nodes.panel.ownerDocument,
  motion = document.defaultView?.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ),
  schedule,
}) {
  const removers = [];
  let sequence,
    disposed = false;
  const alive = () => !disposed && !signal?.aborted && !viewer.isDestroyed?.();
  const listen = (node, type, callback, options) => {
    node.addEventListener(type, callback, options);
    removers.push(() => node.removeEventListener(type, callback, options));
  };
  const update = (state) => {
    if (!alive()) return;
    const previous = nodes.shots.value;
    nodes.shots.replaceChildren();
    state.shots.forEach((shot, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `${index + 1}. ${shot.label} · ${shot.durationSec} 秒 · ${shot.easing === "linear" ? "线性" : "平滑"}`;
      nodes.shots.append(option);
    });
    nodes.shots.value = state.selected >= 0 ? String(state.selected) : previous;
    nodes.capture.disabled = state.shots.length >= 12;
    nodes.play.disabled =
      !state.shots.length ||
      state.status === "playing" ||
      (motion?.matches && !nodes.allow.checked);
    nodes.stop.disabled = state.status !== "playing";
    nodes.seek.disabled = !state.shots.length;
    nodes.seek.max = String(state.total);
    nodes.seek.value = String(state.time);
    nodes.progress.textContent = `${state.time.toFixed(1)} / ${state.total.toFixed(1)} 秒 · ${state.shots.length}/12 镜头`;
    nodes.status.textContent = state.message;
    for (const key of ["select", "remove", "up", "down"])
      nodes[key].disabled = state.selected < 0;
    nodes.up.disabled ||= state.selected === 0;
    nodes.down.disabled ||= state.selected === state.shots.length - 1;
    nodes.motion.textContent = motion?.matches
      ? "系统偏好减少动态：默认手动定位；勾选后才允许动画。"
      : "仅点击开始时播放；可随时停止或手动定位。";
  };
  const canRender = () =>
    nodes.panel.open && !nodes.panel.closest("[hidden]") && !document.hidden;
  const cancel = (reason = "手动操作已取消镜头播放。") =>
    sequence?.stop(reason);
  const action = (fn) => () => {
    if (!alive()) return;
    try {
      fn();
    } catch (error) {
      nodes.status.textContent = error.message;
    }
  };
  const destroy = () => {
    if (disposed) return;
    disposed = true;
    signal?.removeEventListener("abort", destroy);
    for (const remove of removers.splice(0).reverse()) remove();
    sequence?.destroy();
    nodes.shots.replaceChildren();
  };
  try {
    sequence = createCameraSequence({
      viewer,
      signal,
      motionOwner,
      schedule,
      onChange: update,
      canRender,
      canAnimate: () =>
        canRender() && !(motion?.matches && !nodes.allow.checked),
    });
    nodes.allow.checked = false;
    update(sequence.state());
    listen(
      nodes.capture,
      "click",
      action(() =>
        sequence.capture(
          nodes.label.value,
          Number(nodes.duration.value || NaN),
          nodes.easing.value,
        ),
      ),
    );
    listen(
      nodes.play,
      "click",
      action(() => {
        if (
          !nodes.panel.open ||
          nodes.panel.closest("[hidden]") ||
          document.hidden ||
          (motion?.matches && !nodes.allow.checked)
        )
          return;
        beforeMotion();
        sequence.start();
      }),
    );
    listen(
      nodes.stop,
      "click",
      action(() => cancel("已手动停止。")),
    );
    listen(
      nodes.seek,
      "input",
      action(() => {
        beforeMotion();
        sequence.seek(Number(nodes.seek.value));
      }),
    );
    for (const [key, fn] of Object.entries({
      select: (index) => {
        beforeMotion();
        return sequence.select(index);
      },
      remove: (index) => sequence.remove(index),
      up: (index) => sequence.reorder(index, -1),
      down: (index) => sequence.reorder(index, 1),
    }))
      listen(
        nodes[key],
        "click",
        action(() => fn(Number(nodes.shots.value))),
      );
    listen(
      nodes.shots,
      "change",
      action(() => {
        // Selection itself is an explicit manual camera command.
        beforeMotion();
        sequence.select(Number(nodes.shots.value));
      }),
    );
    listen(
      nodes.allow,
      "change",
      action(() => {
        cancel("动画偏好已更改，播放已停止。");
        update(sequence.state());
      }),
    );
    listen(nodes.panel, "toggle", () => {
      if (!nodes.panel.open) cancel("镜头面板已关闭，播放已停止。");
    });
    listen(document, "visibilitychange", () => {
      if (document.hidden) cancel("页面已隐藏，播放已停止。");
    });
    if (document.defaultView)
      listen(document.defaultView, "pagehide", () =>
        cancel("页面已离开，播放已停止。"),
      );
    if (motion)
      listen(motion, "change", () => {
        nodes.allow.checked = false;
        cancel("系统动态偏好已更改，播放已停止。");
        update(sequence.state());
      });
    for (const type of ["pointerdown", "mousedown", "wheel", "touchstart"])
      listen(viewer.container || viewer.canvas, type, () => cancel(), {
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
          cancel();
      },
      true,
    );
    signal?.addEventListener("abort", destroy, { once: true });
    if (signal?.aborted) destroy();
    return { cancel, destroy };
  } catch (error) {
    destroy();
    throw error;
  }
}
