import { createCameraCommands } from "./camera-controls.js";

/** Describe the selected static style and independently enabled enhancements. */
export function updateVisualEffectStatus(nodes) {
  nodes.effectStatus.textContent =
    nodes.style.value === "normal" &&
    !nodes.sharpen.checked &&
    !nodes.bloom.checked
      ? "原始画面，无模拟滤镜。"
      : "静态模拟视觉处理 · 非真实传感器数据";
}

/** Own display listeners and restore panel visibility on every teardown path. */
export function installDisplayControls({
  viewer,
  effects,
  nodes,
  overlays,
  signal,
  beforeCamera = () => {},
  onCleanChange = () => {},
}) {
  const camera = createCameraCommands({ viewer, signal, beforeCamera });
  const removers = [];
  const visibility = overlays.map((node) => [node, node.hidden]);
  let clean = false;
  let disposed = false;
  const updateClean = () => {
    for (const [node, hidden] of visibility) node.hidden = clean || hidden;
    nodes.clean.setAttribute("aria-pressed", String(clean));
    nodes.clean.textContent = clean ? "恢复界面" : "纯净视图";
    onCleanChange(!clean);
  };
  const release = () => {
    if (disposed) return;
    disposed = true;
    signal?.removeEventListener("abort", release);
    for (const remove of removers.reverse()) remove();
    camera.destroy();
    clean = false;
    updateClean();
  };
  const listen = (node, event, action) => {
    const handler = () => {
      if (!disposed && !signal?.aborted && !viewer.isDestroyed?.()) action();
    };
    node.addEventListener(event, handler);
    removers.push(() => node.removeEventListener(event, handler));
  };
  const effect = (action) => {
    try {
      action();
      updateVisualEffectStatus(nodes);
    } catch {
      effects.clear();
      nodes.sharpen.checked = false;
      nodes.bloom.checked = false;
      nodes.style.value = "normal";
      nodes.effectStatus.textContent =
        "此浏览器暂时无法使用该视觉处理，已恢复原始画面。";
    }
  };
  try {
    nodes.restore.disabled = true;
    updateClean();
    listen(nodes.overhead, "click", camera.overhead);
    listen(nodes.oblique, "click", camera.oblique);
    listen(nodes.save, "click", () => {
      const saved = camera.save();
      if (saved) nodes.restore.disabled = false;
      nodes.cameraStatus.textContent = saved
        ? "已保存当前视角，仅在本次观察中保留。"
        : "当前相机位置不可保存，请调整视角后重试。";
    });
    listen(nodes.restore, "click", () => {
      nodes.cameraStatus.textContent = camera.restore()
        ? "已恢复保存的视角。"
        : "尚无可恢复的视角。";
    });
    listen(nodes.clean, "click", () => {
      beforeCamera();
      clean = !clean;
      updateClean();
      nodes.clean.focus();
    });
    listen(nodes.sharpen, "change", () =>
      effect(() => effects.setSharpenEnabled(nodes.sharpen.checked)),
    );
    listen(nodes.bloom, "change", () =>
      effect(() => effects.setBloomEnabled(nodes.bloom.checked)),
    );
    listen(nodes.sharpenIntensity, "input", () =>
      effect(() => {
        nodes.sharpenIntensity.value = String(
          effects.setSharpenIntensity(Number(nodes.sharpenIntensity.value)),
        );
      }),
    );
    listen(nodes.bloomIntensity, "input", () =>
      effect(() => {
        nodes.bloomIntensity.value = String(
          effects.setBloomIntensity(Number(nodes.bloomIntensity.value)),
        );
      }),
    );
    signal?.addEventListener("abort", release, { once: true });
    if (signal?.aborted) release();
    return release;
  } catch (error) {
    release();
    throw error;
  }
}
