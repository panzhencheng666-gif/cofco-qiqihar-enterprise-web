import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Ellipsoid,
  EllipsoidGeodesic,
  EllipsoidalOccluder,
  SceneTransforms,
} from "@cesium/engine";
import {
  validateWhiteboard,
  validateWhiteboardDraft,
  MAX_DRAW_TOTAL,
  MAX_DRAWINGS,
} from "./whiteboard-state.js";
import { ringCentroid } from "../vendor/src/annotations/drawMode.js";
const PALETTE = {
  primary: "#72e1bd",
  amber: "#ffbd59",
  cyan: "#66dfff",
  green: "#8df296",
  red: "#ff8282",
};
/** Narrow static derivative of upstream screenAnnotationRenderer.js. No terrain,
 * tracking, animation, styles injected into global DOM, or autonomous frames. */
export function createWhiteboardRenderer({
  viewer,
  svg,
  signal,
  canRender = () => true,
  onFatalError = () => {},
  projectPoint,
}) {
  const scene = viewer.scene,
    document = svg.ownerDocument;
  const scratch = new Cartesian2(),
    direction = new Cartesian3();
  const occluder = new EllipsoidalOccluder(
    Ellipsoid.WGS84,
    viewer.camera.positionWC,
  );
  let state = [],
    compiled = [],
    draft = [],
    removeRender,
    disposed = false;
  let generation = 0,
    leaseGeneration = 0;
  const alive = () => !disposed && !signal?.aborted && !viewer.isDestroyed?.();
  const node = (tag, attributes = {}) => {
    const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [name, value] of Object.entries(attributes))
      element.setAttribute(name, String(value));
    return element;
  };
  const project =
    projectPoint ||
    ((world) => {
      Cartesian3.subtract(world, viewer.camera.positionWC, direction);
      if (
        Cartesian3.dot(direction, viewer.camera.directionWC) <= 0 ||
        !occluder.isPointVisible(world)
      )
        return null;
      const p = SceneTransforms.worldToWindowCoordinates(scene, world, scratch);
      const w = scene.canvas.clientWidth || scene.canvas.width,
        h = scene.canvas.clientHeight || scene.canvas.height;
      return p &&
        Number.isFinite(p.x) &&
        Number.isFinite(p.y) &&
        p.x >= -w &&
        p.x <= 2 * w &&
        p.y >= -h &&
        p.y <= 2 * h
        ? { x: p.x, y: p.y }
        : null;
    });
  const world = (point) => Cartesian3.fromDegrees(point.lon, point.lat, 0);
  // At most four samples per admitted edge: <=1024 world points for 256 vertices.
  const compile = (shape) => {
    const path = [];
    const vertexWorld = shape.vertices.map(world);
    const count = shape.vertices.length;
    for (let i = 0; i < count; i++) {
      path.push(vertexWorld[i]);
      if (shape.shape === "pin" || (i === count - 1 && shape.shape !== "area"))
        continue;
      const a = shape.vertices[i],
        b = shape.vertices[(i + 1) % count];
      const geodesic = new EllipsoidGeodesic(
        Cartographic.fromDegrees(a.lon, a.lat),
        Cartographic.fromDegrees(b.lon, b.lat),
      );
      for (let k = 1; k < 4; k++)
        path.push(
          Ellipsoid.WGS84.cartographicToCartesian(
            geodesic.interpolateUsingFraction(k / 4),
          ),
        );
    }
    const center = ringCentroid(shape.vertices);
    return {
      ...shape,
      path,
      vertexWorld,
      anchor: center ? world(center) : undefined,
    };
  };
  const build = (items) => {
    if (!alive() || !canRender()) return [];
    occluder.cameraPosition = viewer.camera.positionWC;
    const rows = [];
    for (const shape of items) {
      const points = shape.path.map(project),
        color = PALETTE[shape.color],
        group = node("g");
      if (shape.shape === "pin") {
        if (!points[0]) continue;
        group.append(
          node("circle", {
            cx: points[0].x,
            cy: points[0].y,
            r: 5,
            fill: color,
            stroke: "#071219",
            "stroke-width": 2,
          }),
        );
      } else if (
        shape.shape === "area" &&
        points.length >= 3 &&
        points.every(Boolean)
      ) {
        group.append(
          node("polygon", {
            points: points.map((p) => `${p.x},${p.y}`).join(" "),
            fill: color,
            "fill-opacity": 0.12,
            stroke: color,
            "stroke-width": 2,
          }),
        );
      } else if (shape.shape !== "area" || shape.preview) {
        let part = [];
        const flush = () => {
          if (part.length > 1)
            group.append(
              node("polyline", {
                points: part.map((p) => `${p.x},${p.y}`).join(" "),
                fill: "none",
                stroke: color,
                "stroke-width": 2,
              }),
            );
          part = [];
        };
        for (const p of points) {
          if (p) part.push(p);
          else flush();
        }
        flush();
      } else continue; // Never bridge a hidden section or fill through the horizon.
      if (shape.preview && shape.shape !== "pin")
        for (const world of shape.vertexWorld) {
          const p = project(world);
          if (p)
            group.append(
              node("circle", {
                cx: p.x,
                cy: p.y,
                r: 3,
                fill: color,
                stroke: "#071219",
                "stroke-width": 1,
              }),
            );
        }
      const anchor = shape.anchor && project(shape.anchor);
      if (anchor && shape.label) {
        const text = node("text", {
          x: anchor.x + 8,
          y: anchor.y - 8,
          fill: color,
          "font-size": 12,
          stroke: "#071219",
          "stroke-width": 3,
          "paint-order": "stroke",
        });
        text.textContent = shape.label;
        group.append(text);
      }
      rows.push(group);
    }
    return rows;
  };
  const repaint = () => {
    if (!alive()) return;
    const ticket = generation;
    try {
      const rows = build([...compiled, ...draft]);
      if (alive() && ticket === generation) svg.replaceChildren(...rows);
    } catch (error) {
      try {
        destroy();
      } finally {
        onFatalError(error);
      }
    }
  };
  const subscribe = (hasContent, ticket = generation) => {
    if (hasContent && canRender() && !removeRender) {
      const stamp = ++leaseGeneration,
        callback = () => repaint();
      let candidate;
      try {
        candidate = scene.postRender.addEventListener(callback);
      } catch (error) {
        scene.postRender.removeEventListener(callback);
        throw error;
      }
      if (
        !alive() ||
        !canRender() ||
        ticket !== generation ||
        stamp !== leaseGeneration
      ) {
        candidate();
        return;
      }
      removeRender = candidate;
    } else if ((!hasContent || !canRender()) && removeRender) {
      ++leaseGeneration;
      const remove = removeRender;
      removeRender = undefined;
      remove();
    }
  };
  const commit = (
    nextState,
    nextCompiled,
    nextDraft,
    { render = true } = {},
  ) => {
    if (!alive()) throw new Error("手动画板已关闭。");
    const ticket = ++generation;
    const current = () => alive() && ticket === generation;
    const requireCurrent = () => {
      if (!current()) throw new Error("手动画板操作已取消或被替换。");
    };
    const previous = [...svg.childNodes],
      had = !!removeRender;
    try {
      const rows = build([...nextCompiled, ...nextDraft]);
      requireCurrent();
      subscribe(!!(nextCompiled.length + nextDraft.length), ticket);
      requireCurrent();
      svg.replaceChildren(...rows);
      requireCurrent();
      if (render) scene.requestRender();
      requireCurrent();
      state = nextState;
      compiled = nextCompiled;
      draft = nextDraft;
    } catch (error) {
      if (current())
        try {
          svg.replaceChildren(...previous);
          subscribe(had);
        } catch (failure) {
          try {
            destroy();
          } finally {
            onFatalError(failure);
          }
        }
      throw error;
    }
  };
  function destroy() {
    if (disposed) return;
    disposed = true;
    ++generation;
    ++leaseGeneration;
    signal?.removeEventListener("abort", destroy);
    const remove = removeRender;
    removeRender = undefined;
    try {
      remove?.();
    } finally {
      state = [];
      compiled = [];
      draft = [];
      svg.replaceChildren();
    }
  }
  signal?.addEventListener("abort", destroy, { once: true });
  if (signal?.aborted) destroy();
  return {
    snapshot: () =>
      state.map((shape) => ({
        ...shape,
        vertices: shape.vertices.map((p) => ({ ...p })),
      })),
    prepare: validateWhiteboard,
    replace(value, options) {
      const next = validateWhiteboard(value);
      commit(next, next.map(compile), [], options);
    },
    preview(session, options) {
      const next = session ? validateWhiteboardDraft(session) : undefined;
      if (next?.vertices.length && state.length >= MAX_DRAWINGS)
        throw new TypeError("最多 16 个手绘图形，请先删除一个。");
      if (
        next &&
        state.reduce((sum, shape) => sum + shape.vertices.length, 0) +
          next.vertices.length >
          MAX_DRAW_TOTAL
      )
        throw new TypeError("已达到手绘顶点上限。");
      commit(
        state,
        compiled,
        next?.vertices.length
          ? [compile({ ...next, preview: true, label: "" })]
          : [],
        options,
      );
    },
    visibility() {
      if (!alive()) return;
      ++generation;
      subscribe(!!(compiled.length + draft.length));
      repaint();
    },
    destroy,
  };
}
