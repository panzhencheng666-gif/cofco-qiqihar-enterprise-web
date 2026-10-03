/** Cancel manual pickers before native navigation, while preserving ordinary
 * left clicks. Only canvas-started drags are tracked on the document, matching
 * Cesium's mouse fallback. Records are bounded to two contacts, no clock. */
export function installPointerNavigationCancellation({
  viewer,
  signal,
  cancel,
}) {
  const target = viewer.canvas || viewer.scene.canvas,
    dragSurface = target.ownerDocument || target,
    removers = [],
    points = new Map();
  let mouse,
    touch,
    disposed = false;
  const alive = () => !disposed && !signal?.aborted && !viewer.isDestroyed?.();
  const reset = () => {
    points.clear();
    mouse = touch = undefined;
  };
  const navigate = () => {
    if (!alive()) return;
    reset();
    cancel();
  };
  const position = (event) =>
    Number.isFinite(event.clientX) && Number.isFinite(event.clientY)
      ? { x: event.clientX, y: event.clientY }
      : undefined;
  const moved = (start, event) => {
    const next = position(event);
    return start && next && Math.hypot(next.x - start.x, next.y - start.y) > 4;
  };
  const listen = (event, fn, surface = target) => {
    const handler = (value) => {
      if (alive()) fn(value);
    };
    const options = { capture: true, passive: true };
    surface.addEventListener(event, handler, options);
    removers.push(() => surface.removeEventListener(event, handler, options));
  };
  function destroy() {
    if (disposed) return;
    disposed = true;
    reset();
    signal?.removeEventListener("abort", destroy);
    for (const remove of removers.splice(0).reverse()) remove();
  }
  try {
    listen("wheel", navigate);
    listen("keydown", (event) => {
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
        navigate();
    });
    listen("pointerdown", (event) => {
      if (
        event.button > 0 ||
        (points.size >= 1 && !points.has(event.pointerId))
      ) {
        navigate();
        return;
      }
      const point = position(event);
      if (point) points.set(event.pointerId, point);
      mouse = touch = undefined;
    });
    listen(
      "pointermove",
      (event) => {
        if (moved(points.get(event.pointerId), event)) navigate();
      },
      dragSurface,
    );
    for (const event of ["pointerup", "pointercancel"])
      listen(event, (value) => points.delete(value.pointerId), dragSurface);
    listen("mousedown", (event) => {
      if (event.button > 0) navigate();
      else if (!points.size) mouse = position(event);
    });
    listen(
      "mousemove",
      (event) => {
        if (!points.size && moved(mouse, event)) navigate();
      },
      dragSurface,
    );
    listen(
      "mouseup",
      () => {
        mouse = undefined;
      },
      dragSurface,
    );
    listen("touchstart", (event) => {
      if (event.touches.length > 1) navigate();
      else if (!points.size) touch = position(event.touches[0] || {});
    });
    listen(
      "touchmove",
      (event) => {
        if (
          ((touch || points.size) && event.touches.length > 1) ||
          (!points.size && moved(touch, event.touches[0] || {}))
        )
          navigate();
      },
      dragSurface,
    );
    for (const event of ["touchend", "touchcancel"])
      listen(event, reset, dragSurface);
    listen(
      "visibilitychange",
      () => {
        if (dragSurface.hidden) reset();
      },
      dragSurface,
    );
    if (dragSurface.defaultView)
      listen("pagehide", reset, dragSurface.defaultView);
    signal?.addEventListener("abort", destroy, { once: true });
    if (signal?.aborted) destroy();
    return destroy;
  } catch (error) {
    destroy();
    throw error;
  }
}
