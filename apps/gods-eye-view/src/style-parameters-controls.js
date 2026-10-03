import { createStyleParameters } from "../vendor/src/ui/styleParameters.js";

/** Original native rows with bounded current-style access and revocable lifetime. */
export function installStyleParameterControls({
  viewer,
  effects,
  nodes,
  signal,
  onChange = () => {},
  onError = () => {},
}) {
  const documentRef = nodes.container.ownerDocument;
  const rows = createStyleParameters({
    container: nodes.container,
    documentRef,
  });
  let generation = 0,
    disposed = false,
    visible = true;
  const alive = () =>
    !disposed &&
    visible &&
    !nodes.panel.closest?.("[hidden]") &&
    !signal?.aborted &&
    !viewer.isDestroyed?.() &&
    !documentRef.hidden;
  const status = () => {
    nodes.status.textContent =
      nodes.style.value === "normal"
        ? "选择模拟视觉风格后可调整参数。"
        : "静态模拟画面；参数仅本次有效，不写入场景 JSON。" +
          (nodes.style.value === "snow" ? "风速需动画，静态版不可用。" : "");
  };
  const clear = () => {
    generation++;
    rows.clear();
    nodes.reset.disabled = true;
  };
  const fail = (error) => {
    clear();
    if (!alive()) return;
    onError(error);
    if (alive()) nodes.status.textContent = "视觉参数不可用，已恢复原始画面。";
  };
  function refresh() {
    clear();
    if (!alive()) return;
    status();
    if (!nodes.panel.open || nodes.style.value === "normal") return;
    const ticket = generation;
    try {
      const snapshot = effects.getStyleParameters();
      if (snapshot.style !== nodes.style.value) return;
      const metadata = effects.getStyleParameterMetadata();
      let wrote = false;
      rows.render({
        uniforms: metadata,
        readValue: (name) => snapshot.values[name],
        writeValue(name, value) {
          wrote = false;
          if (
            !alive() ||
            ticket !== generation ||
            !nodes.panel.open ||
            !metadata[name]?.editable
          )
            return;
          try {
            wrote = effects.setStyleParameter(name, value);
          } catch (error) {
            fail(error);
          }
        },
        onChange() {
          if (alive() && ticket === generation && wrote) onChange();
        },
      });
      const sliders = [
        ...nodes.container.querySelectorAll("input[type=range]"),
      ];
      for (const [i, meta] of Object.values(metadata).entries()) {
        sliders[i].disabled = !meta.editable;
        if (!meta.editable)
          sliders[i].title = "风速需要动画，当前静态模式不可用";
      }
      nodes.reset.disabled = !sliders.some((s) => !s.disabled);
    } catch (error) {
      fail(error);
    }
  }
  function reset() {
    if (!alive() || !nodes.panel.open) return;
    try {
      effects.setStyle(nodes.style.value);
      refresh();
      if (alive()) onChange();
    } catch (error) {
      fail(error);
    }
  }
  function hidden() {
    if (documentRef.hidden) clear();
  }
  function destroy() {
    if (disposed) return;
    clear();
    disposed = true;
    rows.destroy();
    signal?.removeEventListener("abort", destroy);
    nodes.panel.removeEventListener("toggle", refresh);
    nodes.reset.removeEventListener("click", reset);
    documentRef.removeEventListener("visibilitychange", hidden);
  }
  try {
    nodes.panel.addEventListener("toggle", refresh);
    nodes.reset.addEventListener("click", reset);
    documentRef.addEventListener("visibilitychange", hidden);
    signal?.addEventListener("abort", destroy, { once: true });
    refresh();
    if (signal?.aborted) destroy();
    return {
      refresh,
      setVisible(value) {
        if (disposed) return;
        visible = !!value;
        if (visible) refresh();
        else clear();
      },
      destroy,
    };
  } catch (error) {
    destroy();
    throw error;
  }
}
