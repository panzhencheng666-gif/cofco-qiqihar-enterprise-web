import {
  Cartesian3,
  Cartographic,
  Color,
  Ellipsoid,
  EllipsoidGeodesic,
  LabelCollection,
  PointPrimitiveCollection,
  PolylineCollection,
  Material,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Math as CesiumMath,
} from "@cesium/engine";
import { validateGeometry, validatePoint } from "./scene-state.js";

/** WGS84 ellipsoid only, sampled into at most 65 surface positions. */
export function measureSurface(start, end) {
  const a = validatePoint(start),
    b = validatePoint(end);
  const first = Cartographic.fromDegrees(a.lon, a.lat),
    last = Cartographic.fromDegrees(b.lon, b.lat);
  // Cesium's Vincenty solver has no robust near-antipodal solution. Reject it
  // before its unbounded iteration; do not present a spherical fallback as WGS84.
  const u = Cartesian3.normalize(
    Ellipsoid.WGS84.cartographicToCartesian(first),
    new Cartesian3(),
  );
  const v = Cartesian3.normalize(
    Ellipsoid.WGS84.cartographicToCartesian(last),
    new Cartesian3(),
  );
  if (Cartesian3.angleBetween(u, v) > CesiumMath.toRadians(179))
    throw new TypeError("两点接近地球对跖点，无法可靠估算；请选择更近的两点。");
  const geodesic = new EllipsoidGeodesic(first, last, Ellipsoid.WGS84);
  const distance = geodesic.surfaceDistance;
  if (!Number.isFinite(distance) || distance < 0)
    throw new TypeError("无法计算椭球距离。");
  // Raise the display line just enough to keep sampled chords above the flat
  // ellipsoid. Distance itself is always computed on the ellipsoid surface.
  // Use a conservative bound below WGS84's minimum curvature radius.
  const displayHeight = 2 + (distance / 64) ** 2 / (8 * 6330000);
  const positions =
    distance === 0
      ? [Cartesian3.fromDegrees(a.lon, a.lat)]
      : Array.from({ length: 65 }, (_, i) => {
          const point = geodesic.interpolateUsingFraction(i / 64);
          point.height = displayHeight;
          return Ellipsoid.WGS84.cartographicToCartesian(point);
        });
  return { distance, positions };
}

/** Own only this child's manually authored points, labels, line and pick handler. */
export function createLocalGeometry({
  viewer,
  signal,
  onChange = () => {},
  onError = () => {},
  onFatalError = () => {},
  createCollection = (kind) =>
    kind === "points"
      ? new PointPrimitiveCollection()
      : kind === "labels"
        ? new LabelCollection()
        : new PolylineCollection(),
  createLineMaterial = () =>
    Material.fromType("Color", { color: Color.YELLOW }),
  createHandler = (canvas) => new ScreenSpaceEventHandler(canvas),
}) {
  let disposed = false,
    handler,
    state = { annotations: [], measurement: [] };
  const owned = new Set();
  let active = [];
  const alive = () => !disposed && !signal?.aborted && !viewer.isDestroyed?.();
  const requireAlive = () => {
    if (!alive()) throw new Error("本次观察已结束。");
  };
  const cancelPick = () => {
    if (handler) {
      handler.destroy();
      handler = undefined;
    }
  };
  const release = (collections) => {
    const failures = [];
    for (const collection of [...collections].reverse()) {
      try {
        const removed =
          !viewer.isDestroyed?.() && viewer.scene.primitives.remove(collection);
        if (!removed && !collection.isDestroyed?.()) collection.destroy();
        owned.delete(collection);
      } catch (error) {
        failures.push(error);
        // Keep ownership if detach/destruction failed; terminal viewer teardown
        // is the final owner. Continue releasing every other candidate resource.
        if (!collection.isDestroyed?.()) {
          try {
            collection.destroy();
          } catch (failure) {
            failures.push(failure);
          }
        }
      }
    }
    if (failures.length)
      throw new AggregateError(failures, "本地几何资源释放失败。");
  };
  const destroy = () => {
    if (disposed) return;
    disposed = true;
    signal?.removeEventListener("abort", destroy);
    try {
      cancelPick();
    } finally {
      state = { annotations: [], measurement: [] };
      active = [];
      release(owned);
    }
  };
  const fatal = (error) => {
    try {
      if (!signal?.aborted && !viewer.isDestroyed?.()) onFatalError(error);
    } finally {
      destroy();
    }
  };
  const acquire = () => {
    const candidate = [];
    try {
      for (const kind of ["points", "labels", "lines"]) {
        const collection = createCollection(kind);
        owned.add(collection);
        candidate.push(collection);
        collection.show = false;
      }
      return candidate;
    } catch (error) {
      try {
        release(candidate);
      } catch (cleanupError) {
        fatal(cleanupError);
      }
      throw error;
    }
  };
  try {
    requireAlive();
    active = acquire();
    for (const collection of active) {
      requireAlive();
      viewer.scene.primitives.add(collection);
    }
    requireAlive();
    for (const collection of active) collection.show = true;
  } catch (error) {
    destroy();
    throw error;
  }
  const snapshot = () => ({
    annotations: state.annotations.map((point) => ({ ...point })),
    measurement: state.measurement.map((point) => ({ ...point })),
  });
  const prepare = (value) => {
    const next = validateGeometry(value);
    return {
      next,
      estimate:
        next.measurement.length === 2
          ? measureSurface(...next.measurement)
          : undefined,
    };
  };
  const replace = (value, { render = true } = {}) => {
    requireAlive();
    const { next, estimate } = prepare(value);
    cancelPick();
    // Populate detached, hidden resources. A failed Nth insertion cannot touch
    // the currently rendered scene, including its labels and measured line.
    const candidate = acquire();
    const [points, labels, lines] = candidate;
    let pendingMaterial;
    try {
      for (const point of next.annotations) {
        const position = Cartesian3.fromDegrees(point.lon, point.lat);
        points.add({ position, color: Color.CYAN, pixelSize: 8 });
        labels.add({
          position,
          text: point.label,
          font: "12px sans-serif",
          fillColor: Color.CYAN,
          showBackground: true,
          pixelOffset: { x: 0, y: -18 },
        });
      }
      for (const point of next.measurement)
        points.add({
          position: Cartesian3.fromDegrees(point.lon, point.lat),
          color: Color.YELLOW,
          pixelSize: 9,
        });
      if (estimate && estimate.distance > 0) {
        pendingMaterial = createLineMaterial();
        lines.add({
          positions: estimate.positions,
          width: 2,
          material: pendingMaterial,
        });
        pendingMaterial = undefined; // PolylineCollection owns it after add.
      }
      for (const collection of candidate) {
        requireAlive();
        viewer.scene.primitives.add(collection);
      }
      requireAlive();
    } catch (error) {
      try {
        try {
          release(candidate);
        } finally {
          // add() may throw before taking ownership or after attaching a line.
          // Release the collection first, then any still-unowned material.
          if (pendingMaterial && !pendingMaterial.isDestroyed?.())
            pendingMaterial.destroy?.();
        }
      } catch (cleanupError) {
        fatal(cleanupError);
      }
      throw error;
    }
    const previous = active;
    // All acquisition has succeeded. No render is requested during this swap;
    // there are never two visible sets or more than 167 visible positions.
    for (const collection of previous) collection.show = false;
    for (const collection of candidate) collection.show = true;
    active = candidate;
    try {
      release(previous);
    } catch (error) {
      fatal(error);
      throw error;
    }
    // Cesium primitiveRemoved listeners may abort synchronously during release.
    requireAlive();
    state = next;
    try {
      if (render) viewer.scene.requestRender();
      requireAlive();
      onChange(snapshot(), estimate?.distance);
    } catch (error) {
      fatal(error);
      throw error;
    }
    return estimate?.distance;
  };
  const addAnnotation = (point) =>
    replace({
      ...snapshot(),
      annotations: [...state.annotations, validatePoint(point, true)],
    });
  const addMeasurement = (point) =>
    replace({
      ...snapshot(),
      measurement:
        state.measurement.length === 2
          ? [validatePoint(point)]
          : [...state.measurement, validatePoint(point)],
    });
  const beginPick = (kind, label) => {
    requireAlive();
    if (!["annotation", "measurement"].includes(kind))
      throw new TypeError("未知选择模式。");
    if (kind === "annotation") validatePoint({ lon: 0, lat: 0, label }, true);
    cancelPick();
    handler = createHandler(viewer.canvas);
    const selectedHandler = handler;
    try {
      handler.setInputAction((movement) => {
        if (!alive() || handler !== selectedHandler) return;
        const hit = viewer.camera.pickEllipsoid(
          movement.position,
          Ellipsoid.WGS84,
        );
        if (!hit) return;
        try {
          const point = Cartographic.fromCartesian(hit, Ellipsoid.WGS84);
          const value = {
            lon: CesiumMath.toDegrees(point.longitude),
            lat: CesiumMath.toDegrees(point.latitude),
          };
          if (kind === "annotation") addAnnotation({ ...value, label });
          else addMeasurement(value);
        } catch (error) {
          cancelPick();
          onError(error);
        }
      }, ScreenSpaceEventType.LEFT_CLICK);
    } catch (error) {
      cancelPick();
      throw error;
    }
  };
  signal?.addEventListener("abort", destroy, { once: true });
  return {
    snapshot,
    prepare,
    replace,
    addAnnotation,
    addMeasurement,
    beginPick,
    cancelPick,
    clear: () => replace({ annotations: [], measurement: [] }),
    destroy,
  };
}
