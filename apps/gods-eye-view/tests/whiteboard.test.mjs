import test from "node:test";
import assert from "node:assert/strict";
const shapes = await import("../src/whiteboard-state.js").catch(() => ({}));
import { JSDOM } from "jsdom";
import {
  Cartesian3,
  Ellipsoid,
  Event as CesiumEvent,
  ScreenSpaceEventHandler,
  CameraEventAggregator,
  CameraEventType,
} from "@cesium/engine";
import { createWhiteboardRenderer } from "../src/whiteboard-renderer.js";
import { installWhiteboardControls } from "../src/whiteboard-controls.js";
import { installPointerNavigationCancellation } from "../src/pointer-navigation.js";
import { exportScene, parseScene } from "../src/scene-state.js";
const sample = (shape = "area") => ({
  shape,
  vertices:
    shape === "pin"
      ? [{ lon: 0, lat: 0 }]
      : shape === "line"
        ? [
            { lon: 0, lat: 0 },
            { lon: 0.01, lat: 0 },
          ]
        : [
            { lon: 0, lat: 0 },
            { lon: 0.01, lat: 0 },
            { lon: 0.01, lat: 0.01 },
          ],
  label: "手动示意",
  color: "primary",
});
test("manual shape validation copies bounded actual upstream geometry and refuses URL/identity fields", () => {
  assert.equal(
    typeof shapes.validateWhiteboard,
    "function",
    "bounded original manual shape contract must exist",
  );
  const input = [sample(), sample("line"), sample("pin")],
    copy = shapes.validateWhiteboard(input);
  assert.deepEqual(copy, input);
  input[0].vertices[0].lon = 10;
  assert.equal(copy[0].vertices[0].lon, 0);
  for (const bad of [
    { ...sample(), url: "https://example.invalid/" },
    { ...sample(), shape: "route" },
    { ...sample(), color: "url(x)" },
    { ...sample(), label: "<script>" },
    { ...sample(), label: "x".repeat(81) },
    {
      ...sample(),
      vertices: [
        { lon: Infinity, lat: 0 },
        { lon: 1, lat: 0 },
        { lon: 0, lat: 1 },
      ],
    },
  ])
    assert.throws(() => shapes.validateWhiteboard([bad]));
});
function rendererProbe({ projectPoint = () => ({ x: 10, y: 20 }) } = {}) {
  const dom = new JSDOM("<body><svg></svg></body>", {
      pretendToBeVisual: true,
    }),
    svg = dom.window.document.querySelector("svg");
  const postRender = new CesiumEvent(),
    signal = new AbortController();
  let visible = true,
    renders = 0,
    fatal = 0,
    fail = false;
  const viewer = {
    isDestroyed: () => false,
    camera: {
      positionWC: new Cartesian3(6379000, 0, 0),
      directionWC: new Cartesian3(-1, 0, 0),
    },
    scene: {
      postRender,
      canvas: { clientWidth: 800, clientHeight: 600 },
      requestRender() {
        if (fail) throw new Error("render fail");
        renders++;
      },
    },
  };
  const renderer = createWhiteboardRenderer({
    viewer,
    svg,
    signal: signal.signal,
    canRender: () => visible,
    projectPoint,
    onFatalError: () => fatal++,
  });
  return {
    dom,
    svg,
    viewer,
    postRender,
    signal,
    renderer,
    get renders() {
      return renders;
    },
    get fatal() {
      return fatal;
    },
    hide() {
      visible = false;
      renderer.visibility();
    },
    show() {
      visible = true;
      renderer.visibility();
    },
    fail() {
      fail = true;
    },
  };
}
test("renderer is idle when empty, rejects unbounded previews, and releases its sole listener on clear/hide/abort", () => {
  const p = rendererProbe();
  assert.equal(p.postRender.numberOfListeners, 0);
  assert.equal(p.renders, 0);
  assert.throws(() =>
    p.renderer.preview({
      ...sample("line"),
      vertices: [
        { lon: 0, lat: 0 },
        { lon: 3, lat: 0 },
      ],
    }),
  );
  assert.throws(() => p.renderer.preview({ ...sample("pin"), label: "<img>" }));
  p.renderer.replace([sample()]);
  assert.equal(p.postRender.numberOfListeners, 1);
  assert.equal(p.svg.querySelectorAll("polygon").length, 1);
  const renders = p.renders;
  p.postRender.raiseEvent();
  assert.equal(
    p.renders,
    renders,
    "paint listener never requests its own frame",
  );
  p.hide();
  assert.equal(p.postRender.numberOfListeners, 0);
  assert.equal(p.svg.childNodes.length, 0);
  p.show();
  assert.equal(p.postRender.numberOfListeners, 1);
  p.renderer.replace([]);
  assert.equal(p.postRender.numberOfListeners, 0);
  p.renderer.replace([sample("pin")]);
  p.signal.abort();
  assert.equal(p.postRender.numberOfListeners, 0);
  assert.equal(p.svg.childNodes.length, 0);
  assert.deepEqual(p.renderer.snapshot(), []);
  p.dom.window.close();
});
test("renderer rolls back failed replacement and never fills an area or bridges a line across hidden points", () => {
  let count = 0,
    occluded = false;
  const projectPoint = () => {
    const x = count++;
    return occluded && x % 3 === 2 ? null : { x, y: 20 };
  };
  const p = rendererProbe({ projectPoint });
  p.renderer.replace([sample("pin")]);
  const before = p.svg.innerHTML;
  p.fail();
  assert.throws(() => p.renderer.replace([sample("line")]));
  assert.equal(p.svg.innerHTML, before);
  assert.deepEqual(p.renderer.snapshot(), [sample("pin")]);
  assert.equal(p.postRender.numberOfListeners, 1);
  p.renderer.destroy();
  p.dom.window.close();
  const q = rendererProbe({ projectPoint });
  occluded = true;
  count = 0;
  q.renderer.replace([sample(), sample("line")]);
  assert.equal(q.svg.querySelectorAll("polygon").length, 0);
  assert.ok(q.svg.querySelectorAll("polyline").length > 0);
  for (const line of q.svg.querySelectorAll("polyline"))
    assert.ok(line.getAttribute("points").split(" ").length <= 2);
  q.renderer.destroy();
  q.dom.window.close();
});
const baseScene = () => ({
  camera: { lon: 0, lat: 0, height: 1000, heading: 0, pitch: -1, roll: 0 },
  map: "earth",
  style: {
    name: "normal",
    sharpen: false,
    sharpenIntensity: 0.2,
    bloom: false,
    bloomIntensity: 1,
  },
  annotations: [],
  measurement: [],
});
test("scene v1 stays compatible and v2 copies only admitted whiteboard fields within 64KiB", () => {
  const base = baseScene(),
    v1 = exportScene(base);
  assert.equal(JSON.parse(v1).version, 1);
  assert.ok(!v1.includes("drawings"));
  assert.equal(exportScene({ ...base, drawings: [] }), v1);
  const text = exportScene({
    ...base,
    drawings: [sample("pin")],
    token: "SECRET",
    feed: ["not admitted"],
  });
  const parsed = parseScene(text);
  assert.equal(parsed.version, 2);
  assert.deepEqual(parsed.drawings, [sample("pin")]);
  assert.ok(!text.includes("SECRET"));
  assert.ok(!text.includes("feed"));
  assert.throws(() => parseScene(JSON.stringify({ ...parsed, url: "bad" })));
  assert.throws(() => parseScene(JSON.stringify({ ...parsed, version: 3 })));
  assert.throws(() =>
    parseScene(
      JSON.stringify({
        ...parsed,
        drawings: [{ ...sample(), source: "network" }],
      }),
    ),
  );
});
function controlProbe({ decorateHandler = (h) => h, ...options } = {}) {
  const p = rendererProbe(),
    document = p.dom.window.document,
    handlers = [];
  const nodes = Object.fromEntries(
    [
      "panel",
      "shape",
      "label",
      "color",
      "lat",
      "lon",
      "begin",
      "add",
      "undo",
      "finish",
      "cancel",
      "clear",
      "status",
      "list",
    ].map((key) => {
      const tag =
        key === "panel"
          ? "details"
          : key === "list"
            ? "ol"
            : key === "status"
              ? "p"
              : ["shape", "color", "lat", "lon", "label"].includes(key)
                ? "input"
                : "button";
      const node = document.createElement(tag);
      document.body.append(node);
      return [key, node];
    }),
  );
  nodes.overlay = p.svg;
  nodes.panel.open = true;
  nodes.shape.value = "area";
  nodes.color.value = "primary";
  nodes.label.value = "手动示意";
  // Close the unused probe owner; the production controller owns the renderer.
  p.renderer.destroy();
  let changed = 0,
    leased = 0,
    fatal = 0;
  p.viewer.scene.globe = { ellipsoid: Ellipsoid.WGS84 };
  const board = installWhiteboardControls({
    viewer: p.viewer,
    nodes,
    signal: p.signal.signal,
    beforePick() {
      leased++;
    },
    onChange() {
      changed++;
    },
    onFatalError() {
      fatal++;
    },
    createRenderer: (settings) =>
      createWhiteboardRenderer({
        ...settings,
        projectPoint: () => ({ x: 10, y: 20 }),
      }),
    createHandler() {
      const h = decorateHandler({
        setInputAction(fn) {
          this.click = fn;
        },
        destroy() {
          this.dead = true;
        },
      });
      handlers.push(h);
      return h;
    },
    ...options,
  });
  return {
    ...p,
    nodes,
    handlers,
    board,
    get changed() {
      return changed;
    },
    get leased() {
      return leased;
    },
    get fatals() {
      return fatal;
    },
    point(lon, lat) {
      nodes.lon.value = String(lon);
      nodes.lat.value = String(lat);
      nodes.add.click();
    },
  };
}
test("real DOM manual area/line/pin workflows share one picker and support undo/delete/clear without HTML labels", () => {
  const p = controlProbe();
  assert.equal(p.postRender.numberOfListeners, 0);
  for (const type of ["area", "line", "pin"]) {
    p.nodes.shape.value = type;
    p.nodes.begin.click();
    assert.equal(p.leased, ["area", "line", "pin"].indexOf(type) + 1);
    assert.equal(p.handlers.filter((h) => !h.dead).length, 1);
    p.point(0, 0);
    assert.equal(p.nodes.finish.disabled, type !== "pin");
    if (type !== "pin") {
      p.point(0.01, 0);
      p.nodes.undo.click();
      assert.equal(p.nodes.finish.disabled, true);
      p.point(0.01, 0);
    }
    if (type === "area") p.point(0.01, 0.01);
    p.nodes.finish.click();
    assert.equal(p.handlers.filter((h) => !h.dead).length, 0);
  }
  assert.deepEqual(
    p.board.snapshot().map((s) => s.shape),
    ["area", "line", "pin"],
  );
  assert.equal(p.nodes.list.children.length, 3);
  assert.match(p.nodes.list.textContent, /估算/);
  assert.equal(p.postRender.numberOfListeners, 1);
  p.nodes.list.querySelector("button").click();
  assert.equal(p.board.snapshot().length, 2);
  p.nodes.clear.click();
  assert.equal(p.board.snapshot().length, 0);
  assert.equal(p.svg.childNodes.length, 0);
  assert.equal(p.postRender.numberOfListeners, 0);
  p.nodes.label.value = "<script>";
  p.nodes.begin.click();
  assert.equal(p.handlers.filter((h) => !h.dead).length, 0);
  assert.match(p.nodes.status.textContent, /纯文本/);
  p.board.destroy();
  p.dom.window.close();
});
test("canvas pick uses actual WGS84 coordinates; old handlers are inert after panel/hide/cancel/abort", () => {
  const p = controlProbe();
  p.nodes.shape.value = "pin";
  p.viewer.camera.pickEllipsoid = () => Cartesian3.fromDegrees(123.9, 47.35, 0);
  p.nodes.begin.click();
  const first = p.handlers.at(-1);
  first.click({ position: { x: 1, y: 2 } });
  p.nodes.finish.click();
  assert.ok(Math.abs(p.board.snapshot()[0].vertices[0].lon - 123.9) < 1e-8);
  assert.ok(Math.abs(p.board.snapshot()[0].vertices[0].lat - 47.35) < 1e-8);
  p.nodes.begin.click();
  const second = p.handlers.at(-1);
  p.nodes.panel.open = false;
  p.nodes.panel.dispatchEvent(new p.dom.window.Event("toggle"));
  second.click({ position: {} });
  assert.equal(p.nodes.add.disabled, true);
  assert.equal(p.board.snapshot().length, 1);
  assert.equal(second.dead, true);
  p.nodes.panel.open = true;
  p.nodes.begin.click();
  const third = p.handlers.at(-1);
  p.board.setVisible(false);
  assert.equal(third.dead, true);
  assert.equal(p.postRender.numberOfListeners, 0);
  p.board.setVisible(true);
  assert.equal(p.postRender.numberOfListeners, 1);
  p.nodes.begin.click();
  const fourth = p.handlers.at(-1);
  p.signal.abort();
  fourth.click({ position: {} });
  assert.equal(fourth.dead, true);
  assert.equal(p.postRender.numberOfListeners, 0);
  assert.deepEqual(p.board.snapshot(), []);
  p.dom.window.close();
});
test("manual input refuses extent, duplicates, self crossing and quantity overflow before finished state mutation", () => {
  const p = controlProbe();
  p.nodes.shape.value = "line";
  p.nodes.begin.click();
  p.point(0, 0);
  p.point(0, 0);
  assert.match(p.nodes.status.textContent, /1\/64/);
  p.point(3, 0);
  assert.match(p.nodes.status.textContent, /200 km/);
  assert.equal(p.nodes.finish.disabled, true);
  p.point(0.01, 0);
  p.nodes.finish.click();
  assert.equal(p.board.snapshot().length, 1);
  p.nodes.shape.value = "area";
  p.nodes.begin.click();
  p.point(0, 0);
  p.point(0.01, 0.01);
  p.point(0, 0.01);
  p.point(0.01, 0);
  assert.match(p.nodes.status.textContent, /无效/);
  p.nodes.cancel.click();
  assert.equal(p.board.snapshot().length, 1);
  p.board.replace(Array.from({ length: 16 }, () => sample("pin")));
  p.nodes.begin.click();
  assert.match(p.nodes.status.textContent, /最多 16/);
  assert.equal(p.handlers.filter((h) => !h.dead).length, 0);
  p.board.destroy();
  p.dom.window.close();
});
test("handler acquisition and cleanup faults do not leave a second picker or silently continue", () => {
  const p = controlProbe({
    decorateHandler(h) {
      h.setInputAction = () => {
        throw new Error("handler fail");
      };
      return h;
    },
  });
  p.nodes.begin.click();
  assert.equal(p.handlers.at(-1).dead, true);
  assert.equal(p.nodes.add.disabled, true);
  assert.equal(p.postRender.numberOfListeners, 0);
  p.board.destroy();
  p.dom.window.close();
  const q = controlProbe({
    decorateHandler(h) {
      h.destroy = () => {
        h.dead = true;
        throw new Error("cleanup fail");
      };
      return h;
    },
  });
  q.nodes.begin.click();
  q.nodes.cancel.click();
  assert.equal(q.fatals, 1);
  assert.equal(q.handlers.at(-1).dead, true);
  assert.equal(q.postRender.numberOfListeners, 0);
  assert.deepEqual(q.board.snapshot(), []);
  q.dom.window.close();
});
test("upstream degeneracy, dateline estimates and local totals are honored before rendering", () => {
  assert.equal(typeof shapes.validateWhiteboard, "function");
  assert.throws(() =>
    shapes.validateWhiteboard([
      {
        ...sample(),
        vertices: [
          { lon: 0, lat: 0 },
          { lon: 0.01, lat: 0 },
          { lon: 0.02, lat: 0 },
        ],
      },
    ]),
  );
  assert.throws(() =>
    shapes.validateWhiteboard([
      {
        ...sample(),
        vertices: [
          { lon: 0, lat: 0 },
          { lon: 0.01, lat: 0.01 },
          { lon: 0, lat: 0.01 },
          { lon: 0.01, lat: 0 },
        ],
      },
    ]),
  );
  assert.throws(() =>
    shapes.validateWhiteboard(Array.from({ length: 17 }, () => sample("pin"))),
  );
  assert.throws(() =>
    shapes.validateWhiteboard([
      {
        ...sample("line"),
        vertices: [
          { lon: 0, lat: 0 },
          { lon: 180, lat: 0 },
        ],
      },
    ]),
  );
  const dateline = {
    ...sample(),
    vertices: [
      { lon: 179.999, lat: 0 },
      { lon: -179.999, lat: 0 },
      { lon: -179.999, lat: 0.001 },
    ],
  };
  assert.equal(shapes.validateWhiteboard([dateline]).length, 1);
  assert.ok(shapes.describeWhiteboard(dateline).includes("估算"));
});

test("actual handler acquired during abort or newer begin is retired without publishing stale controls", () => {
  let p, actual;
  const oldDocument = globalThis.document;
  try {
    p = controlProbe({
      createHandler() {
        globalThis.document = p.dom.window.document;
        const canvas = p.dom.window.document.createElement("canvas");
        actual = new ScreenSpaceEventHandler(canvas);
        p.signal.abort();
        return actual;
      },
    });
    p.nodes.begin.click();
    try {
      assert.equal(actual.isDestroyed(), true);
      assert.equal(p.nodes.add.disabled, true);
    } finally {
      if (!actual.isDestroyed()) actual.destroy();
      p.dom.window.close();
    }
    let first = true,
      outer;
    const q = controlProbe({
      decorateHandler(h) {
        if (first) {
          first = false;
          outer = h;
          q.nodes.begin.dispatchEvent(new q.dom.window.Event("click"));
        }
        return h;
      },
    });
    q.nodes.begin.click();
    assert.equal(outer.dead, true);
    assert.equal(q.handlers.filter((h) => !h.dead).length, 1);
    q.nodes.cancel.click();
    assert.equal(q.handlers.filter((h) => !h.dead).length, 0);
    q.board.destroy();
    q.dom.window.close();
  } finally {
    globalThis.document = oldDocument;
  }
});
test("actual postRender acquisition cannot retain a listener or republish disposed SVG after abort", () => {
  const p = rendererProbe(),
    add = p.postRender.addEventListener.bind(p.postRender);
  p.postRender.addEventListener = (fn) => {
    const remove = add(fn);
    p.signal.abort();
    return remove;
  };
  assert.throws(() => p.renderer.replace([sample("pin")]));
  assert.equal(p.postRender.numberOfListeners, 0);
  assert.equal(p.svg.childNodes.length, 0);
  assert.deepEqual(p.renderer.snapshot(), []);
  p.renderer.destroy();
  p.dom.window.close();
});
test("reentrant newer renderer replacement and visibility win registration over an older commit", () => {
  for (const action of ["replace", "hide"]) {
    const p = rendererProbe(),
      add = p.postRender.addEventListener.bind(p.postRender);
    let first = true;
    p.postRender.addEventListener = (fn) => {
      const remove = add(fn);
      if (first) {
        first = false;
        if (action === "replace")
          p.renderer.replace([{ ...sample("pin"), label: "newer" }]);
        else p.hide();
      }
      return remove;
    };
    assert.throws(() => p.renderer.replace([sample()]));
    assert.equal(p.postRender.numberOfListeners, action === "replace" ? 1 : 0);
    if (action === "replace")
      assert.equal(p.renderer.snapshot()[0].label, "newer");
    else assert.equal(p.svg.childNodes.length, 0);
    p.renderer.destroy();
    p.dom.window.close();
  }
});

test("real native DOM navigation keeps clicks, cancels drag/wheel/key/pinch, and removes listeners on abort", () => {
  const p = controlProbe(),
    canvas = p.dom.window.document.createElement("canvas");
  p.viewer.canvas = canvas;
  p.dom.window.document.body.append(canvas);
  let cancels = 0;
  const release = installPointerNavigationCancellation({
    viewer: p.viewer,
    signal: p.signal.signal,
    cancel() {
      cancels++;
      p.board.cancel();
    },
  });
  const mouse = (type, extra = {}) =>
    canvas.dispatchEvent(
      new p.dom.window.MouseEvent(type, {
        bubbles: true,
        button: 0,
        clientX: 0,
        clientY: 0,
        ...extra,
      }),
    );
  p.nodes.begin.click();
  mouse("pointerdown");
  mouse("pointerup");
  assert.equal(cancels, 0);
  assert.equal(p.nodes.add.disabled, false);
  for (const action of [
    () =>
      canvas.dispatchEvent(
        new p.dom.window.WheelEvent("wheel", { ctrlKey: true }),
      ),
    () =>
      canvas.dispatchEvent(
        new p.dom.window.KeyboardEvent("keydown", { key: "ArrowLeft" }),
      ),
    () => mouse("mousedown", { button: 2 }),
    () => {
      mouse("pointerdown");
      mouse("pointermove", { clientX: 5 });
    },
    () => {
      const event = new p.dom.window.Event("touchstart");
      Object.defineProperty(event, "touches", {
        value: [
          { clientX: 0, clientY: 0 },
          { clientX: 1, clientY: 0 },
        ],
      });
      canvas.dispatchEvent(event);
    },
  ]) {
    p.nodes.begin.click();
    action();
    assert.equal(p.handlers.at(-1).dead, true);
    assert.equal(p.nodes.add.disabled, true);
  }
  const before = cancels;
  p.signal.abort();
  canvas.dispatchEvent(new p.dom.window.WheelEvent("wheel"));
  assert.equal(cancels, before);
  release();
  p.dom.window.close();
});

test("a first manual line/area vertex is visible in its draft before enough points exist to finish", () => {
  const p = rendererProbe();
  for (const shape of ["line", "area"]) {
    p.renderer.preview({ ...sample(shape), vertices: [{ lon: 0, lat: 0 }] });
    assert.equal(
      p.svg.querySelectorAll("circle").length,
      1,
      "user must be able to see the first placed vertex",
    );
    p.renderer.preview();
    assert.equal(p.svg.childNodes.length, 0);
    assert.equal(p.postRender.numberOfListeners, 0);
  }
  p.renderer.destroy();
  p.dom.window.close();
});

test("actual Cesium mouse fallback across canvas/document navigation cancels only canvas-initiated picking", () => {
  const oldDocument = globalThis.document,
    p = controlProbe(),
    document = p.dom.window.document,
    canvas = document.createElement("canvas"),
    outside = document.createElement("div");
  document.body.append(canvas, outside);
  p.viewer.canvas = canvas;
  globalThis.document = document;
  let aggregator,
    release,
    cancels = 0;
  const emit = (target, type, x) =>
    target.dispatchEvent(
      new p.dom.window.MouseEvent(type, {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: x,
        clientY: 0,
      }),
    );
  try {
    aggregator = new CameraEventAggregator(canvas);
    release = installPointerNavigationCancellation({
      viewer: p.viewer,
      signal: p.signal.signal,
      cancel() {
        cancels++;
        p.board.cancel();
      },
    });
    p.nodes.begin.click();
    const picker = p.handlers.at(-1);
    emit(canvas, "mousedown", 0);
    emit(canvas, "mouseleave", 1);
    emit(outside, "mousemove", 10);
    assert.equal(aggregator.isMoving(CameraEventType.LEFT_DRAG), true);
    assert.equal(
      aggregator.getMovement(CameraEventType.LEFT_DRAG).endPosition.x,
      10,
    );
    assert.equal(cancels, 1);
    assert.equal(picker.dead, true);
    emit(outside, "mouseup", 10);
    assert.equal(aggregator.isButtonDown(CameraEventType.LEFT_DRAG), false);
    p.nodes.begin.click();
    emit(outside, "mousemove", 100);
    assert.equal(
      cancels,
      1,
      "unrelated document motion cannot cancel a fresh picker",
    );
    assert.equal(p.nodes.add.disabled, false);
    p.signal.abort();
    emit(canvas, "mousedown", 0);
    emit(outside, "mousemove", 20);
    assert.equal(cancels, 1);
  } finally {
    release?.();
    aggregator?.destroy();
    p.board.destroy();
    globalThis.document = oldDocument;
    p.dom.window.close();
  }
});
