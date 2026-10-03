import {
  finishReason,
  formatMeasure,
  greatCircleM,
  unwrapLongitudes,
} from "../vendor/src/annotations/drawMode.js";
export const MAX_DRAWINGS = 16,
  MAX_DRAW_VERTICES = 64,
  MAX_DRAW_TOTAL = 256;
const COLORS = ["primary", "amber", "cyan", "green", "red"];
const fail = () => {
  throw new TypeError("手动画图无效：请检查形状、坐标、文字和数量边界。");
};
const keys = (obj, list) => {
  if (
    !obj ||
    Object.getPrototypeOf(obj) !== Object.prototype ||
    Object.keys(obj).length !== list.length ||
    list.some((key) => !Object.hasOwn(obj, key))
  )
    fail();
};
const label = (text) => {
  if (
    typeof text !== "string" ||
    [...text].length > 80 ||
    /[<>]/u.test(text) ||
    [...text].some(
      (character) =>
        character.codePointAt(0) < 32 || character.codePointAt(0) === 127,
    )
  )
    throw new TypeError("标签须为 80 字以内的纯文本。");
  return text;
};
function crosses(a, b, c, d) {
  const side = (p, q, r) =>
    (q.lon - p.lon) * (r.lat - p.lat) - (q.lat - p.lat) * (r.lon - p.lon);
  const within = (p, q, r) =>
    r.lon >= Math.min(p.lon, q.lon) - 1e-12 &&
    r.lon <= Math.max(p.lon, q.lon) + 1e-12 &&
    r.lat >= Math.min(p.lat, q.lat) - 1e-12 &&
    r.lat <= Math.max(p.lat, q.lat) + 1e-12;
  const x = side(a, b, c),
    y = side(a, b, d),
    z = side(c, d, a),
    w = side(c, d, b);
  return (
    (x * y < 0 && z * w < 0) ||
    (Math.abs(x) < 1e-12 && within(a, b, c)) ||
    (Math.abs(y) < 1e-12 && within(a, b, d)) ||
    (Math.abs(z) < 1e-12 && within(c, d, a)) ||
    (Math.abs(w) < 1e-12 && within(c, d, b))
  );
}
function validate(value, draft = false) {
  if (!Array.isArray(value) || value.length > MAX_DRAWINGS) fail();
  let total = 0;
  return value.map((shape) => {
    keys(shape, ["shape", "vertices", "label", "color"]);
    if (
      !["area", "line", "pin"].includes(shape.shape) ||
      !COLORS.includes(shape.color) ||
      !Array.isArray(shape.vertices) ||
      shape.vertices.length > MAX_DRAW_VERTICES
    )
      fail();
    total += shape.vertices.length;
    if (total > MAX_DRAW_TOTAL) fail();
    const vertices = shape.vertices.map((point) => {
      keys(point, ["lon", "lat"]);
      if (
        !Number.isFinite(point.lon) ||
        !Number.isFinite(point.lat) ||
        Math.abs(point.lon) > 180 ||
        Math.abs(point.lat) > 90
      )
        fail();
      return { ...point };
    });
    if (
      shape.shape === "pin" &&
      (draft ? vertices.length > 1 : vertices.length !== 1)
    )
      fail();
    if (!draft && finishReason({ shape: shape.shape, vertices }) !== "ok")
      fail();
    // The upstream planar-area estimate is for whiteboard scale, not a continent.
    for (let i = 0; i < vertices.length; i++)
      for (let j = i + 1; j < vertices.length; j++)
        if (greatCircleM(vertices[i], vertices[j]) > 200000) fail();
    if (shape.shape === "area") {
      const ring = unwrapLongitudes(vertices),
        n = ring.length;
      for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++) {
          if (j === i + 1 || (i === 0 && j === n - 1)) continue;
          if (crosses(ring[i], ring[(i + 1) % n], ring[j], ring[(j + 1) % n]))
            fail();
        }
    }
    return {
      shape: shape.shape,
      vertices,
      label: label(shape.label),
      color: shape.color,
    };
  });
}
export const validateWhiteboard = (value) => validate(value);
export const validateWhiteboardDraft = (value) => validate([value], true)[0];
export function describeWhiteboard(shape) {
  return shape.shape === "pin"
    ? "手动标记 · WGS84 椭球位置"
    : `手动${shape.shape === "area" ? "区域" : "线条"} · 估算 ${formatMeasure(shape)} · 非实际边界或道路`;
}
