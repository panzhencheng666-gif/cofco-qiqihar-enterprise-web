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
  const owned = [];
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
  const destroy = () => {
    if (disposed) return;
    disposed = true;
    cancelPick();
    signal?.removeEventListener("abort", destroy);
    for (const collection of owned.splice(0).reverse()) {
      try {
        const removed =
          !viewer.isDestroyed?.() && viewer.scene.primitives.remove(collection);
        if (!removed && !collection.isDestroyed?.()) collection.destroy();
      } catch {
        if (!collection.isDestroyed?.()) {
          try {
            collection.destroy();
          } catch {
            /* Continue releasing other resources. */
          }
        }
      }
    }
    state = { annotations: [], measurement: [] };
  };
  try {
    requireAlive();
    for (const kind of ["points", "labels", "lines"]) {
      const collection = createCollection(kind);
      owned.push(collection);
      viewer.scene.primitives.add(collection);
    }
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
    const [points, labels, lines] = owned;
    for (const collection of owned) collection.removeAll();
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
    if (estimate && estimate.distance > 0)
      lines.add({
        positions: estimate.positions,
        width: 2,
        material: createLineMaterial(),
      });
    state = next;
    if (render) viewer.scene.requestRender();
    onChange(snapshot(), estimate?.distance);
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
