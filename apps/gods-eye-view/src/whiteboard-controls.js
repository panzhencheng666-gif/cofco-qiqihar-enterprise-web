import {
  Cartographic,
  Math as CesiumMath,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
} from "@cesium/engine";
import {
  createDrawSession,
  addVertex,
  removeLastVertex,
  finishReason,
  greatCircleM,
} from "../vendor/src/annotations/drawMode.js";
import { createWhiteboardRenderer } from "./whiteboard-renderer.js";
import {
  describeWhiteboard,
  MAX_DRAWINGS,
  MAX_DRAW_TOTAL,
  MAX_DRAW_VERTICES,
  validateWhiteboardDraft,
} from "./whiteboard-state.js";
/** Explicit manual input derivative of drawTool.js; no geocoding or voice engine. */
export function installWhiteboardControls({
  viewer,
  nodes,
  signal,
  beforePick = () => {},
  onChange = () => {},
  onFatalError = () => {},
  createRenderer = createWhiteboardRenderer,
  createHandler = () => new ScreenSpaceEventHandler(viewer.scene.canvas),
}) {
  const document = nodes.panel.ownerDocument,
    removers = [],
    rows = [];
  let renderer,
    session,
    handler,
    disposed = false,
    clean = false;
  let inputGeneration = 0,
    beginSerial = 0;
  const retiredHandlers = new WeakSet();
  const alive = () => !disposed && !signal?.aborted && !viewer.isDestroyed?.();
  const visible = () => !document.hidden && !clean;
  const interactive = () =>
    visible() && nodes.panel.open && !nodes.panel.closest("[hidden]");
  const error = (value) => {
    if (alive()) nodes.status.textContent = value.message || "手动画图未完成。";
  };
  const listen = (target, event, action) => {
    const fn = () => {
      if (alive())
        try {
          action();
        } catch (value) {
          error(value);
        }
    };
    target.addEventListener(event, fn);
    removers.push(() => target.removeEventListener(event, fn));
  };
  const hints = () => {
    const count = session?.vertices.length || 0;
    nodes.finish.disabled = !session || finishReason(session) !== "ok";
    nodes.undo.disabled = !count;
    nodes.cancel.disabled = !session;
    nodes.add.disabled = !session;
    nodes.status.textContent = session
      ? `正在手绘${{ area: "区域", line: "线条", pin: "标记" }[session.shape]}：${count}/${MAX_DRAW_VERTICES} 顶点；点击地球或输入坐标，完成后保存。`
      : `${renderer.snapshot().length}/${MAX_DRAWINGS} 个手动图形，仅本次观察保留。`;
  };
  const clearRows = () => {
    for (const remove of rows.splice(0)) remove();
    nodes.list.replaceChildren();
  };
  const changed = () => {
    if (!alive()) return;
    clearRows();
    renderer.snapshot().forEach((shape, index) => {
      const row = document.createElement("li"),
        text = document.createElement("span"),
        remove = document.createElement("button");
      text.textContent = `${shape.label || "未命名图形"} · ${describeWhiteboard(shape)}`;
      remove.type = "button";
      remove.textContent = "删除";
      remove.setAttribute(
        "aria-label",
        `删除手绘：${shape.label || "未命名图形"}`,
      );
      const click = () => {
        if (!alive()) return;
        try {
          cancel();
          const next = renderer.snapshot();
          next.splice(index, 1);
          renderer.replace(next);
          changed();
        } catch (value) {
          error(value);
        }
      };
      remove.addEventListener("click", click);
      rows.push(() => remove.removeEventListener("click", click));
      row.append(text, remove);
      nodes.list.append(row);
    });
    hints();
    onChange();
  };
  const dropHandler = () => {
    const previous = handler;
    handler = undefined;
    retireHandler(previous);
  };
  const retireHandler = (previous) => {
    if (!previous || retiredHandlers.has(previous)) return;
    retiredHandlers.add(previous);
    try {
      if (!previous.isDestroyed?.()) previous.destroy();
    } catch (value) {
      destroy();
      onFatalError(value);
      throw value;
    }
  };
  function cancel() {
    ++inputGeneration;
    const active = !!session;
    session = undefined;
    try {
      dropHandler();
    } finally {
      if (alive() && active) {
        renderer.preview(undefined, { render: false });
        hints();
        onChange();
      }
    }
  }
  const append = (point) => {
    if (!session || !interactive()) return;
    const total = renderer
      .snapshot()
      .reduce((sum, shape) => sum + shape.vertices.length, 0);
    if (
      !Number.isFinite(point.lat) ||
      !Number.isFinite(point.lon) ||
      Math.abs(point.lat) > 90 ||
      Math.abs(point.lon) > 180
    )
      throw new TypeError("请输入有效纬度与经度。");
    if (session.vertices.some((p) => greatCircleM(p, point) > 200000))
      throw new TypeError("单个图形范围不能超过 200 km。");
    if (
      session.shape !== "pin" &&
      (session.vertices.length >= MAX_DRAW_VERTICES ||
        total + session.vertices.length >= MAX_DRAW_TOTAL)
    )
      throw new TypeError("已达到手绘顶点上限。");
    if (session.shape === "pin" && total >= MAX_DRAW_TOTAL)
      throw new TypeError("已达到手绘顶点上限。");
    const next = {
      ...session,
      vertices: session.vertices.map((p) => ({ ...p })),
    };
    const result = addVertex(next, point);
    if (!result.added) {
      if (result.reason === "duplicate") return;
      throw new TypeError("此顶点不能添加。");
    }
    next.vertices = next.vertices.map(({ lon, lat }) => ({ lon, lat }));
    renderer.preview(next);
    session = next;
    hints();
    onChange();
  };
  function destroy() {
    if (disposed) return;
    disposed = true;
    ++inputGeneration;
    ++beginSerial;
    session = undefined;
    signal?.removeEventListener("abort", destroy);
    for (const remove of removers.splice(0).reverse()) remove();
    clearRows();
    for (const key of ["add", "undo", "finish", "cancel"])
      nodes[key].disabled = true;
    try {
      dropHandler();
    } finally {
      renderer?.destroy();
    }
  }
  try {
    renderer = createRenderer({
      viewer,
      svg: nodes.overlay,
      signal,
      canRender: visible,
      onFatalError,
    });
    listen(nodes.begin, "click", () => {
      if (!interactive()) return;
      const attempt = ++beginSerial;
      cancel();
      beforePick();
      if (!alive() || !interactive() || attempt !== beginSerial) return;
      if (renderer.snapshot().length >= MAX_DRAWINGS)
        throw new TypeError("最多 16 个手绘图形，请先删除一个。");
      if (
        !["area", "line", "pin"].includes(nodes.shape.value) ||
        !["primary", "amber", "cyan", "green", "red"].includes(
          nodes.color.value,
        )
      )
        throw new TypeError("形状或颜色无效。");
      // Validate all fields before acquiring input; an empty label is allowed.
      const next = validateWhiteboardDraft({
        ...createDrawSession(nodes.shape.value),
        color: nodes.color.value,
        label: nodes.label.value,
      });
      const ticket = ++inputGeneration;
      const selected = createHandler();
      if (
        !alive() ||
        !interactive() ||
        ticket !== inputGeneration ||
        attempt !== beginSerial
      ) {
        retireHandler(selected);
        return;
      }
      handler = selected;
      session = next;
      try {
        selected.setInputAction((event) => {
          if (
            !alive() ||
            ticket !== inputGeneration ||
            handler !== selected ||
            !session
          )
            return;
          try {
            if (!interactive()) {
              cancel();
              return;
            }
            const world = viewer.camera.pickEllipsoid(
              event.position,
              viewer.scene.globe.ellipsoid,
            );
            if (!world) {
              nodes.status.textContent = "请点击地球表面。";
              return;
            }
            const p = Cartographic.fromCartesian(
              world,
              viewer.scene.globe.ellipsoid,
            );
            if (p)
              append({
                lon: CesiumMath.toDegrees(p.longitude),
                lat: CesiumMath.toDegrees(p.latitude),
              });
          } catch (value) {
            error(value);
          }
        }, ScreenSpaceEventType.LEFT_CLICK);
      } catch (value) {
        if (handler === selected) cancel();
        else retireHandler(selected);
        throw value;
      }
      if (
        !alive() ||
        !interactive() ||
        ticket !== inputGeneration ||
        handler !== selected
      ) {
        if (handler === selected) cancel();
        else retireHandler(selected);
        return;
      }
      hints();
      onChange();
    });
    listen(nodes.add, "click", () => {
      if (!nodes.lat.value.trim() || !nodes.lon.value.trim())
        throw new TypeError("请输入纬度与经度。");
      append({ lat: Number(nodes.lat.value), lon: Number(nodes.lon.value) });
    });
    listen(nodes.undo, "click", () => {
      if (!session) return;
      const next = {
        ...session,
        vertices: session.vertices.map((p) => ({ ...p })),
      };
      removeLastVertex(next);
      renderer.preview(next);
      session = next;
      hints();
      onChange();
    });
    listen(nodes.finish, "click", () => {
      if (!session || !interactive()) return;
      const next = [
        ...renderer.snapshot(),
        {
          shape: session.shape,
          vertices: session.vertices,
          label: session.label,
          color: session.color,
        },
      ];
      renderer.replace(next);
      session = undefined;
      dropHandler();
      changed();
    });
    listen(nodes.cancel, "click", cancel);
    listen(nodes.clear, "click", () => {
      cancel();
      renderer.replace([]);
      changed();
    });
    for (const key of ["shape", "label", "color"])
      listen(nodes[key], "change", cancel);
    listen(nodes.panel, "toggle", () => {
      if (!nodes.panel.open) cancel();
    });
    listen(document, "visibilitychange", () => {
      if (document.hidden) cancel();
      renderer.visibility();
    });
    if (document.defaultView) listen(document.defaultView, "pagehide", cancel);
    signal?.addEventListener("abort", destroy, { once: true });
    changed();
    if (signal?.aborted) destroy();
    return {
      snapshot: renderer.snapshot,
      prepare: renderer.prepare,
      replace(value, options) {
        cancel();
        renderer.replace(value, options);
        changed();
      },
      cancel,
      destroy,
      setVisible(value) {
        clean = !value;
        if (clean) cancel();
        renderer.visibility();
      },
    };
  } catch (value) {
    destroy();
    throw value;
  }
}
