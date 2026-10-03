export const MAX_SCENE_BYTES = 65536;
export const MAX_ANNOTATIONS = 50;
const fail = () => {
  throw new TypeError("场景无效：请检查版本、字段、坐标及数量限制。");
};
const keys = (value, allowed) => {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    fail();
  if (
    Object.keys(value).length !== allowed.length ||
    allowed.some((key) => !Object.hasOwn(value, key)) ||
    Object.keys(value).some((key) => !allowed.includes(key))
  )
    fail();
};
const number = (value, min, max) => {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    fail();
  return value;
};
export function validatePoint(value, labeled = false) {
  keys(value, labeled ? ["lon", "lat", "label"] : ["lon", "lat"]);
  const point = {
    lon: number(value.lon, -180, 180),
    lat: number(value.lat, -90, 90),
  };
  if (labeled) {
    if (
      typeof value.label !== "string" ||
      !value.label.trim() ||
      [...value.label].length > 80 ||
      /[<>]/u.test(value.label) ||
      [...value.label].some(
        (character) =>
          character.codePointAt(0) < 32 || character.codePointAt(0) === 127,
      )
    )
      fail();
    point.label = value.label;
  }
  return point;
}
export function validateGeometry(value) {
  if (
    !Array.isArray(value.annotations) ||
    value.annotations.length > MAX_ANNOTATIONS ||
    !Array.isArray(value.measurement) ||
    value.measurement.length > 2
  )
    fail();
  return {
    annotations: value.annotations.map((point) => validatePoint(point, true)),
    measurement: value.measurement.map((point) => validatePoint(point)),
  };
}
export function validateScene(value) {
  keys(value, [
    "version",
    "camera",
    "map",
    "style",
    "annotations",
    "measurement",
  ]);
  if (value.version !== 1) fail();
  keys(value.camera, ["lon", "lat", "height", "heading", "pitch", "roll"]);
  const camera = {
    lon: number(value.camera.lon, -180, 180),
    lat: number(value.camera.lat, -90, 90),
    height: number(value.camera.height, 0, 100000000),
    heading: number(value.camera.heading, -2 * Math.PI, 2 * Math.PI),
    pitch: number(value.camera.pitch, -Math.PI / 2, Math.PI / 2),
    roll: number(value.camera.roll, -2 * Math.PI, 2 * Math.PI),
  };
  if (!["earth", "natural", "osm"].includes(value.map)) fail();
  keys(value.style, [
    "name",
    "sharpen",
    "sharpenIntensity",
    "bloom",
    "bloomIntensity",
  ]);
  const style = value.style;
  if (
    ![
      "normal",
      "noir",
      "surveillance",
      "thermal",
      "retro",
      "anime",
      "snow",
    ].includes(style.name) ||
    typeof style.sharpen !== "boolean" ||
    typeof style.bloom !== "boolean"
  )
    fail();
  return {
    version: 1,
    camera,
    map: value.map,
    style: {
      name: style.name,
      sharpen: style.sharpen,
      sharpenIntensity: number(style.sharpenIntensity, 0, 1),
      bloom: style.bloom,
      bloomIntensity: number(style.bloomIntensity, 0, 200),
    },
    ...validateGeometry(value),
  };
}
export function parseScene(text) {
  if (
    typeof text !== "string" ||
    text.length > MAX_SCENE_BYTES ||
    new TextEncoder().encode(text).byteLength > MAX_SCENE_BYTES
  )
    throw new TypeError("场景文本超过 64 KiB 限制。");
  return validateScene(
    JSON.parse(text, (key, value) => {
      if (["__proto__", "prototype", "constructor"].includes(key)) fail();
      return value;
    }),
  );
}
/** Build from explicit public scene fields only; caller objects may contain other state. */
export function exportScene(value) {
  const scene = validateScene({
    version: 1,
    camera: value.camera,
    map: value.map,
    style: value.style,
    annotations: value.annotations,
    measurement: value.measurement,
  });
  const text = JSON.stringify(scene, null, 2);
  parseScene(text);
  return text;
}
