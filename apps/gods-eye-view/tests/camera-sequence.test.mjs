import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFile } from "node:fs/promises";
import {
  Camera,
  GeographicProjection,
  SceneMode,
  Math as CesiumMath,
  Matrix4,
} from "@cesium/engine";
import { sampleCameraMove } from "../vendor/src/director/camera.js";
import {
  applyCameraPose,
  captureCameraPose,
  createCameraSequence,
  FRAME_MS,
} from "../src/camera-sequence.js";
import { installCameraSequenceControls } from "../src/camera-sequence-controls.js";
import { createCameraCommands } from "../src/camera-controls.js";

function fixture(options = {}) {
  const controller = new AbortController();
  let now = 0,
    serial = 0,
    renders = 0;
  const queue = new Map(),
    cancelled = [];
  const schedule = {
    now: () => now,
    request(fn) {
      const id = ++serial;
      queue.set(id, fn);
      return id;
    },
    cancel(id) {
      cancelled.push(queue.get(id));
      queue.delete(id);
    },
  };
  const scene = {
    mode: SceneMode.SCENE3D,
    mapProjection: new GeographicProjection(),
    drawingBufferWidth: 800,
    drawingBufferHeight: 600,
    requestRender() {
      ++renders;
      options.render?.();
    },
  };
  const camera = new Camera(scene);
  const viewer = { camera, scene, isDestroyed: () => false };
  applyCameraPose(viewer, {
    lon: 179,
    lat: 20,
    alt: 1000,
    heading: 350,
    pitch: -45,
    roll: 0,
  });
  const states = [];
  const sequence = createCameraSequence({
    viewer,
    signal: controller.signal,
    schedule,
    onChange: (state) => states.push(state),
  });
  function add(label = "第一镜头", duration = 0.2, easing = "linear") {
    sequence.capture(label, duration, easing);
  }
  function second() {
    applyCameraPose(viewer, {
      lon: -179,
      lat: 30,
      alt: 2000,
      heading: 10,
      pitch: -30,
      roll: 0,
    });
    add("第二镜头");
  }
  return {
    viewer,
    sequence,
    schedule,
    controller,
    queue,
    cancelled,
    states,
    add,
    second,
    get renders() {
      return renders;
    },
    advance(ms = FRAME_MS + 0.001) {
      now += ms;
      const entry = queue.entries().next().value;
      if (entry) {
        queue.delete(entry[0]);
        entry[1]();
      }
    },
  };
}

test("exact upstream interpolation preserves endpoints and shortest dateline/heading/roll arcs", () => {
  const from = {
    lon: 179,
    lat: 10,
    alt: 100,
    heading: 350,
    pitch: -80,
    roll: 350,
  };
  const to = {
    lon: -179,
    lat: 20,
    alt: 300,
    heading: 10,
    pitch: -20,
    roll: 10,
  };
  const move = { from, to, easing: "linear" };
  assert.deepEqual(sampleCameraMove(move, 0), from);
  assert.deepEqual(sampleCameraMove(move, 1), to);
  const middle = sampleCameraMove(move, 0.5);
  assert.equal(middle.lon, -180);
  assert.equal(middle.heading, 360);
  assert.equal(middle.roll, 360);
  assert.equal(middle.alt, 200);
  assert.equal(
    sampleCameraMove({ ...move, easing: "cubic" }, 0.25).lat,
    10.625,
  );
  assert.equal(sampleCameraMove(move, 0.25).lat, 12.5);
});

test("installed Cesium Camera applies world pose, radians and releases any target transform", () => {
  const f = fixture();
  const pose = captureCameraPose(f.viewer.camera);
  for (const [field, expected] of Object.entries({
    lon: 179,
    lat: 20,
    alt: 1000,
    heading: 350,
    pitch: -45,
    roll: 0,
  }))
    assert.ok(
      Math.abs(
        field === "roll"
          ? ((pose[field] - expected + 180) % 360) - 180
          : pose[field] - expected,
      ) < 1e-6,
      `${field}: ${pose[field]}`,
    );
  assert.ok(Matrix4.equals(f.viewer.camera.transform, Matrix4.IDENTITY));
  assert.equal(f.viewer.useDefaultRenderLoop, undefined);
  assert.equal(f.viewer.scene.maximumRenderTimeChange, undefined);
});

test("memory poses are bounded, copied, named and reordered; total is <=360 seconds", () => {
  const f = fixture();
  assert.equal(f.sequence.start(), false);
  assert.equal(f.sequence.seek(0), false);
  assert.equal(f.queue.size, 0);
  for (const duration of [NaN, Infinity, 0, 0.199, 30.01, "3"])
    assert.throws(() => f.add("镜头", duration));
  for (const label of ["", "<script>", "\n", "x".repeat(81)])
    assert.throws(() => f.add(label));
  assert.throws(() => f.add("镜头", 3, "other"));
  for (let i = 0; i < 12; i++) f.add(`镜头${i}`, 30);
  assert.equal(f.sequence.state().total, 360);
  assert.throws(() => f.add());
  const leaked = f.sequence.state();
  leaked.shots[0].pose.lon = 0;
  assert.notEqual(f.sequence.state().shots[0].pose.lon, 0);
  assert.equal(f.sequence.reorder(0, -1), false);
  assert.equal(f.sequence.reorder(11, 1), false);
  f.sequence.reorder(0, 1);
  assert.equal(f.sequence.state().shots[1].label, "镜头0");
  f.sequence.remove(1);
  assert.equal(f.sequence.state().shots.length, 11);
  assert.equal(f.queue.size, 0);
});

test("invalid ellipsoidal heights, coordinates and radian angles never enter sequence", () => {
  for (const [field, value] of [
    ["heading", NaN],
    ["pitch", 2],
    ["roll", 7],
  ]) {
    assert.throws(() =>
      captureCameraPose({
        positionCartographic: { longitude: 0, latitude: 0, height: 1000 },
        heading: 0,
        pitch: -1,
        roll: 0,
        [field]: value,
      }),
    );
  }
  for (const position of [
    { longitude: 4, latitude: 0, height: 1 },
    { longitude: 0, latitude: 2, height: 1 },
    { longitude: 0, latitude: 0, height: -1 },
    { longitude: 0, latitude: 0, height: 1e8 + 1 },
  ])
    assert.throws(() =>
      captureCameraPose({
        positionCartographic: position,
        heading: 0,
        pitch: -1,
        roll: 0,
      }),
    );
});

test("single-shot start is instant; seeking is one frame without scheduled owner", () => {
  const f = fixture();
  f.add();
  const before = f.renders;
  f.sequence.start();
  assert.equal(f.renders, before + 1);
  assert.equal(f.sequence.state().status, "complete");
  assert.equal(f.queue.size, 0);
  f.sequence.seek(0.1);
  assert.equal(f.renders, before + 2);
  assert.equal(f.queue.size, 0);
  assert.throws(() => f.sequence.seek(Infinity));
});

test("explicit playback owns one <=30fps schedule, completes, and late callback cannot revive", () => {
  const f = fixture();
  f.add();
  f.second();
  f.sequence.start();
  assert.equal(f.queue.size, 1);
  assert.equal(f.sequence.start(), false);
  const before = f.renders;
  f.advance(10);
  assert.equal(f.renders, before);
  assert.equal(f.queue.size, 1);
  f.advance(24);
  assert.equal(f.renders, before + 1);
  const late = [...f.queue.values()][0];
  f.advance(500);
  assert.equal(f.sequence.state().status, "complete");
  assert.equal(f.queue.size, 0);
  const completed = f.renders;
  late();
  assert.equal(f.renders, completed);
  assert.equal(f.sequence.state().time, 0.4);
  assert.ok(
    Math.abs(
      CesiumMath.toDegrees(f.viewer.camera.positionCartographic.longitude) +
        179,
    ) < 1e-6,
  );
});

test("stop, seek, edits, abort and destroy synchronously cancel and invalidate owned callbacks", () => {
  for (const action of [
    (f) => f.sequence.stop(),
    (f) => f.sequence.seek(0.3),
    (f) => f.sequence.remove(1),
    (f) => f.controller.abort(),
    (f) => f.sequence.destroy(),
  ]) {
    const f = fixture();
    f.add();
    f.second();
    f.sequence.start();
    const late = [...f.queue.values()][0];
    action(f);
    const after = f.renders;
    assert.equal(f.queue.size, 0);
    late();
    assert.equal(f.renders, after);
    assert.notEqual(f.sequence.state().status, "playing");
    f.sequence.destroy();
    f.sequence.destroy();
  }
});

test("render/camera/scheduler faults stay error and cancel playback", () => {
  for (const fail of [
    (f) => {
      f.viewer.camera.setView = () => {
        throw new Error("camera fault");
      };
    },
    (f) => {
      f.viewer.scene.requestRender = () => {
        throw new Error("renderer fault");
      };
    },
    (f) => {
      f.schedule.request = () => {
        throw new Error("scheduler fault");
      };
    },
    (f) => {
      f.schedule.now = () => NaN;
    },
  ]) {
    const f = fixture();
    f.add();
    f.second();
    fail(f);
    assert.equal(f.sequence.start(), false);
    assert.equal(f.sequence.state().status, "error");
    assert.equal(f.queue.size, 0);
  }
});

test("cancellation inside pose application cannot report complete or seek success", () => {
  const f = fixture();
  f.add();
  f.second();
  f.sequence.start();
  f.viewer.scene.requestRender = () => f.sequence.stop("cancelled in renderer");
  f.advance(500);
  assert.equal(f.sequence.state().status, "stopped");
  assert.equal(f.queue.size, 0);
  f.viewer.scene.requestRender = () => f.controller.abort();
  assert.equal(f.sequence.seek(0.3), false);
  assert.equal(f.sequence.state().status, "disposed");
});

async function panelFixture(reduced = false) {
  const html = await readFile(
    new URL("../public/frame.html", import.meta.url),
    "utf8",
  );
  const dom = new JSDOM(html, { pretendToBeVisual: true }),
    document = dom.window.document;
  const f = fixture();
  f.viewer.canvas = document.createElement("canvas");
  f.viewer.container = document.getElementById("globe");
  f.viewer.container.append(f.viewer.canvas);
  const nodes = Object.fromEntries(
    [
      "panel",
      "label",
      "duration",
      "easing",
      "capture",
      "shots",
      "select",
      "remove",
      "up",
      "down",
      "play",
      "stop",
      "seek",
      "progress",
      "status",
      "allow",
      "motion",
    ].map((key) => [key, document.getElementById("sequence-" + key)]),
  );
  const motion = new dom.window.EventTarget();
  motion.matches = reduced;
  const owner = installCameraSequenceControls({
    viewer: f.viewer,
    nodes,
    signal: f.controller.signal,
    schedule: f.schedule,
    document,
    motion,
  });
  nodes.panel.open = true;
  nodes.capture.click();
  applyCameraPose(f.viewer, {
    lon: -179,
    lat: 30,
    alt: 2000,
    heading: 10,
    pitch: -30,
    roll: 0,
  });
  nodes.capture.click();
  const cleanup = () => {
    owner.destroy();
    dom.window.close();
  };
  return { ...f, f, dom, nodes, document, motion, owner, cleanup };
}

test("real DOM bindings capture/reorder/remove/select/seek and keyboard/native controls", async () => {
  const p = await panelFixture();
  assert.equal(p.nodes.shots.options.length, 2);
  assert.equal(p.f.queue.size, 0);
  p.nodes.up.click();
  assert.match(p.nodes.shots.options[0].textContent, /^1\./);
  p.nodes.select.click();
  assert.equal(p.f.queue.size, 0);
  p.nodes.play.click();
  assert.equal(p.f.queue.size, 1);
  p.nodes.seek.value = "1";
  p.nodes.seek.dispatchEvent(new p.dom.window.Event("input"));
  assert.equal(p.f.queue.size, 0);
  p.nodes.remove.click();
  assert.equal(p.nodes.shots.options.length, 1);
  p.cleanup();
  assert.equal(p.nodes.shots.options.length, 0);
});

test("canvas capture listeners cancel before downstream navigation, including ctrl-wheel and touch", async () => {
  for (const type of [
    "pointerdown",
    "mousedown",
    "wheel",
    "touchstart",
    "keydown",
  ]) {
    const p = await panelFixture();
    p.nodes.play.click();
    assert.equal(p.f.queue.size, 1);
    let queueAtCamera;
    p.f.viewer.canvas.addEventListener(type, () => {
      queueAtCamera = p.f.queue.size;
    });
    const event =
      type === "keydown"
        ? new p.dom.window.KeyboardEvent(type, {
            key: "ArrowUp",
            bubbles: true,
          })
        : new p.dom.window.Event(type, { bubbles: true });
    p.f.viewer.canvas.dispatchEvent(event);
    assert.equal(queueAtCamera, 0, type);
    const late = p.f.cancelled.at(-1);
    const before = p.f.renders;
    late?.();
    assert.equal(p.f.renders, before);
    p.cleanup();
  }
});

test("reduced motion defaults to manual mode; opted animation and policy changes are explicit", async () => {
  const p = await panelFixture(true);
  assert.equal(p.nodes.allow.checked, false);
  const beforeSeek = p.f.renders;
  p.nodes.seek.value = "1";
  p.nodes.seek.dispatchEvent(new p.dom.window.Event("input"));
  assert.equal(p.f.renders, beforeSeek + 1);
  assert.equal(p.f.queue.size, 0);
  assert.equal(p.nodes.play.disabled, true);
  p.nodes.play.click();
  assert.equal(p.f.queue.size, 0);
  p.nodes.allow.checked = true;
  p.nodes.allow.dispatchEvent(new p.dom.window.Event("change"));
  p.nodes.play.click();
  assert.equal(p.f.queue.size, 1);
  p.motion.dispatchEvent(new p.dom.window.Event("change"));
  assert.equal(p.f.queue.size, 0);
  assert.equal(p.nodes.allow.checked, false);
  p.cleanup();
});

test("panel close, page hide, page exit, abort release scheduling and all bound listeners", async () => {
  for (const action of [
    (p) => {
      p.nodes.panel.open = false;
      p.nodes.panel.dispatchEvent(new p.dom.window.Event("toggle"));
    },
    (p) => {
      Object.defineProperty(p.document, "hidden", { value: true });
      p.document.dispatchEvent(new p.dom.window.Event("visibilitychange"));
    },
    (p) => p.dom.window.dispatchEvent(new p.dom.window.Event("pagehide")),
    (p) => p.f.controller.abort(),
  ]) {
    const p = await panelFixture();
    p.nodes.play.click();
    assert.equal(p.f.queue.size, 1);
    action(p);
    assert.equal(p.f.queue.size, 0);
    p.owner.destroy();
    const before = p.f.renders;
    p.nodes.capture.click();
    p.nodes.play.click();
    p.nodes.seek.dispatchEvent(new p.dom.window.Event("input"));
    p.motion.dispatchEvent(new p.dom.window.Event("change"));
    assert.equal(p.f.renders, before);
    assert.equal(p.f.queue.size, 0);
    p.cleanup();
  }
});

test("manual installed camera commands cancel before camera mutation", () => {
  for (const name of ["overhead", "oblique", "restore"]) {
    const f = fixture();
    f.add();
    f.second();
    const command = createCameraCommands({
      viewer: f.viewer,
      signal: f.controller.signal,
      beforeCamera: () => f.sequence.stop(),
    });
    command.save();
    f.sequence.start();
    const setView = f.viewer.camera.setView.bind(f.viewer.camera);
    f.viewer.camera.setView = (options) => {
      assert.equal(f.queue.size, 0);
      setView(options);
    };
    const lookAt = f.viewer.camera.lookAt.bind(f.viewer.camera);
    f.viewer.camera.lookAt = (...args) => {
      assert.equal(f.queue.size, 0);
      lookAt(...args);
    };
    command[name]();
    assert.equal(f.queue.size, 0);
    command.destroy();
  }
});

test("selected USGS focus cancels actual camera sequence before camera mutation", async () => {
  const { installEarthquakeControls } =
    await import("../src/earthquake-controls.js");
  const p = await panelFixture();
  const ids = {
    refresh: "refresh",
    clear: "clear",
    list: "events",
    status: "feed-status",
    summary: "analyst-status",
    metadata: "event-metadata",
    focus: "event-focus",
    apply: "analyst-apply",
    magnitude: "analyst-magnitude",
    minDepth: "analyst-min-depth",
    maxDepth: "analyst-max-depth",
    place: "analyst-place",
    sort: "analyst-sort",
    scope: "analyst-scope",
    lat: "analyst-lat",
    lon: "analyst-lon",
    km: "analyst-km",
  };
  const nodes = Object.fromEntries(
    Object.entries(ids).map(([key, id]) => [
      key,
      p.document.getElementById(id),
    ]),
  );
  const collection = new Set();
  p.f.viewer.scene.primitives = {
    add(c) {
      collection.add(c);
    },
    remove(c) {
      const removed = collection.delete(c);
      if (removed) c.destroy();
      return removed;
    },
  };
  const stamp = new Date().toISOString();
  const release = installEarthquakeControls({
    viewer: p.f.viewer,
    nodes,
    signal: p.f.controller.signal,
    beforeCamera: p.owner.cancel,
    fetchSnapshot: async () => ({
      fetchedAt: stamp,
      sourceAt: stamp,
      totalMatched: 1,
      sourceFeatures: 1,
      rows: [
        {
          stableId: "event",
          usgsId: "event",
          mag: 3,
          depthKm: 10,
          lon: 1,
          lat: 2,
          time: Date.now(),
          place: "Test",
        },
      ],
    }),
    createCollection: () => ({
      add() {},
      destroy() {},
      isDestroyed: () => false,
    }),
    onFatalError: (error) => {
      throw error;
    },
  });
  nodes.refresh.click();
  await new Promise((resolve) => setImmediate(resolve));
  nodes.list.querySelector("button").click();
  assert.equal(nodes.focus.disabled, false);
  p.nodes.play.click();
  assert.equal(p.f.queue.size, 1);
  const original = p.f.viewer.camera.setView.bind(p.f.viewer.camera);
  p.f.viewer.camera.setView = (options) => {
    assert.equal(p.f.queue.size, 0);
    original(options);
  };
  nodes.focus.click();
  assert.equal(p.f.queue.size, 0);
  assert.ok(
    Math.abs(
      CesiumMath.toDegrees(p.f.viewer.camera.positionCartographic.longitude) -
        1,
    ) < 1e-6,
  );
  release();
  p.cleanup();
});

test("a due callback cannot render after panel/ancestor/page hides before DOM cancellation events", async () => {
  for (const hide of [
    (p) => {
      p.nodes.panel.open = false;
    },
    (p) => {
      p.nodes.panel.parentElement.hidden = true;
    },
    (p) => {
      Object.defineProperty(p.document, "hidden", { value: true });
    },
  ]) {
    const p = await panelFixture();
    p.nodes.play.click();
    assert.equal(p.f.queue.size, 1);
    const before = p.f.renders;
    hide(p); // Deliberately do not dispatch toggle/visibilitychange.
    p.f.advance(1000);
    assert.equal(p.f.renders, before);
    assert.equal(p.f.queue.size, 0);
    assert.match(p.nodes.status.textContent, /隐藏.*停止/);
    p.cleanup();
  }
});

test("abort inside installed camera mutation suppresses its follow-up render", () => {
  const f = fixture();
  f.add();
  f.second();
  const original = f.viewer.camera.setView.bind(f.viewer.camera);
  f.viewer.camera.setView = (options) => {
    original(options);
    f.controller.abort();
  };
  const before = f.renders;
  assert.equal(f.sequence.start(), false);
  assert.equal(f.renders, before);
  assert.equal(f.sequence.state().status, "disposed");
  assert.equal(f.queue.size, 0);
});

test("stop inside camera mutation invalidates the frame's follow-up render", () => {
  const f = fixture();
  f.add();
  f.second();
  f.sequence.start();
  const original = f.viewer.camera.setView.bind(f.viewer.camera);
  f.viewer.camera.setView = (options) => {
    original(options);
    f.sequence.stop("manual camera took ownership");
  };
  const before = f.renders;
  f.advance();
  assert.equal(f.renders, before);
  assert.equal(f.sequence.state().status, "stopped");
  assert.equal(f.queue.size, 0);
});
