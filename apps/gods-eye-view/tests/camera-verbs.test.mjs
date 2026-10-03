import test from "node:test";
import assert from "node:assert/strict";
import {
  Camera,
  Cartesian3,
  GeographicProjection,
  HeadingPitchRange,
  Matrix4,
  Math as CesiumMath,
  SceneMode,
} from "@cesium/engine";
import {
  applyCameraPose,
  createCameraSequence,
} from "../src/camera-sequence.js";
import { createCameraMotionOwner } from "../src/camera-motion-owner.js";
const module = await import("../src/camera-verbs.js").catch(() => ({}));
function fixture(options = {}) {
  let now = 0,
    serial = 0,
    renders = 0,
    visible = true;
  const queue = new Map(),
    cancelled = [],
    controller = new AbortController();
  const scene = {
    mode: SceneMode.SCENE3D,
    mapProjection: new GeographicProjection(),
    drawingBufferWidth: 800,
    drawingBufferHeight: 600,
    requestRender: () => ++renders,
  };
  const camera = new Camera(scene),
    viewer = { camera, scene, isDestroyed: () => false };
  scene.canvas = { clientWidth: 800, clientHeight: 600 };
  applyCameraPose(viewer, {
    lon: 123,
    lat: 47,
    alt: 10000,
    heading: 30,
    pitch: -45,
    roll: 0,
  });
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
  const motionOwner = createCameraMotionOwner({
    signal: controller.signal,
    schedule,
  });
  assert.equal(
    typeof module.createCameraVerbs,
    "function",
    "bounded four-verb controller must exist",
  );
  const verbs = module.createCameraVerbs({
    viewer,
    signal: controller.signal,
    motionOwner,
    canRender: () => visible,
    ...options,
  });
  return {
    viewer,
    verbs,
    motionOwner,
    controller,
    queue,
    cancelled,
    schedule,
    get renders() {
      return renders;
    },
    hide() {
      visible = false;
    },
    advance(ms = 34) {
      now += ms;
      const entry = queue.entries().next().value;
      if (entry) {
        queue.delete(entry[0]);
        entry[1]();
      }
    },
    run(ms = 1000) {
      for (let t = 0; t < ms; t += 34) this.advance();
    },
  };
}
function near(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);
}
const start = (
  f,
  motion,
  direction,
  mode = "once",
  speed = "normal",
  instant = false,
) => f.verbs.start({ motion, direction, mode, speed, instant });
test("actual Cesium once pan/tilt/rotate use upstream signs, totals and finite identity pose", () => {
  for (const [motion, direction, method, total] of [
    ["pan", "left", "moveLeft", 2500],
    ["pan", "right", "moveRight", 2500],
    ["pan", "up", "moveUp", 2500],
    ["pan", "down", "moveDown", 2500],
    ["tilt", "up", "lookUp", CesiumMath.toRadians(15)],
    ["tilt", "down", "lookDown", CesiumMath.toRadians(15)],
    ["rotate", "left", "lookLeft", CesiumMath.toRadians(15)],
    ["rotate", "right", "lookRight", CesiumMath.toRadians(15)],
  ]) {
    const f = fixture(),
      expected = Camera.clone(f.viewer.camera);
    expected[method](total);
    assert.equal(start(f, motion, direction, "once", "normal", true), true);
    assert.equal(f.queue.size, 0);
    near(
      Cartesian3.distance(f.viewer.camera.positionWC, expected.positionWC),
      0,
      1e-5,
    );
    near(
      Cartesian3.distance(f.viewer.camera.directionWC, expected.directionWC),
      0,
    );
    assert.ok(Matrix4.equals(f.viewer.camera.transform, Matrix4.IDENTITY));
    assert.equal(f.verbs.state().status, "complete");
    f.motionOwner.destroy();
  }
});
test("once orbit preserves ENU range/pitch, applies exact final heading then releases fixed-world frame", () => {
  const f = fixture();
  const target = Cartesian3.fromDegrees(123, 47, 0);
  f.viewer.camera.lookAt(
    target,
    new HeadingPitchRange(
      CesiumMath.toRadians(30),
      CesiumMath.toRadians(-35),
      10000,
    ),
  );
  f.viewer.camera.lookAtTransform(Matrix4.IDENTITY);
  f.viewer.camera.pickEllipsoid = () => target;
  const expected = Camera.clone(f.viewer.camera);
  expected.lookAt(
    target,
    new HeadingPitchRange(
      CesiumMath.toRadians(60),
      CesiumMath.toRadians(-35),
      10000,
    ),
  );
  expected.lookAtTransform(Matrix4.IDENTITY);
  assert.equal(start(f, "orbit", "right"), true);
  assert.equal(f.queue.size, 1);
  const late = [...f.queue.values()][0];
  f.run();
  assert.equal(f.verbs.state().status, "complete");
  near(
    Cartesian3.distance(f.viewer.camera.positionWC, expected.positionWC),
    0,
    1e-4,
  );
  assert.equal(f.queue.size, 0);
  assert.ok(Matrix4.equals(f.viewer.camera.transform, Matrix4.IDENTITY));
  const before = f.renders;
  late();
  assert.equal(f.renders, before);
});
test("continuous rate is <=30fps, dt capped and hard30s cutoff cancels late ticks", () => {
  const f = fixture(),
    expected = Camera.clone(f.viewer.camera);
  assert.equal(start(f, "rotate", "right", "continuous", "normal"), true);
  const before = f.renders;
  f.advance(10);
  assert.equal(f.renders, before);
  f.advance(24);
  expected.lookRight(CesiumMath.toRadians(10) * 0.034);
  near(
    Cartesian3.distance(f.viewer.camera.directionWC, expected.directionWC),
    0,
  );
  f.advance(1000);
  expected.lookRight(CesiumMath.toRadians(10) * 0.25);
  near(
    Cartesian3.distance(f.viewer.camera.directionWC, expected.directionWC),
    0,
  );
  f.advance(30000);
  assert.equal(f.queue.size, 0);
  assert.equal(f.verbs.state().status, "complete");
  assert.match(f.verbs.state().message, /30/);
});
test("invalid/no-hit/out-of-bounds verbs refuse before mutation or stealing a sequence owner", () => {
  const f = fixture(),
    sequence = createCameraSequence({
      viewer: f.viewer,
      signal: f.controller.signal,
      motionOwner: f.motionOwner,
    });
  sequence.capture("first", 1, "linear");
  sequence.capture("second", 1, "linear");
  sequence.start();
  const before = Cartesian3.clone(f.viewer.camera.positionWC),
    renders = f.renders;
  f.viewer.camera.pickEllipsoid = () => undefined;
  for (const args of [
    { motion: "orbit", direction: "right" },
    { motion: "tilt", direction: "left" },
    { motion: "rotate", direction: "up" },
    { motion: "route", direction: "right" },
    { motion: "pan", direction: "left", speed: "turbo" },
  ]) {
    assert.equal(
      f.verbs.start({ mode: "once", speed: "normal", ...args }),
      false,
    );
    assert.equal(sequence.state().status, "playing");
    assert.equal(f.queue.size, 1);
  }
  assert.equal(f.renders, renders);
  near(Cartesian3.distance(f.viewer.camera.positionWC, before), 0);
  sequence.destroy();
  f.motionOwner.destroy();
});
test("sequence and verb takeover/seek are exclusive and stopped callbacks never mutate", () => {
  const f = fixture(),
    sequence = createCameraSequence({
      viewer: f.viewer,
      signal: f.controller.signal,
      motionOwner: f.motionOwner,
    });
  sequence.capture("first", 1, "linear");
  sequence.capture("second", 1, "linear");
  sequence.start();
  const sequenceLate = [...f.queue.values()][0];
  assert.equal(start(f, "pan", "left", "continuous"), true);
  assert.equal(sequence.state().status, "stopped");
  assert.equal(f.queue.size, 1);
  const verbLate = [...f.queue.values()][0],
    before = f.renders;
  sequenceLate();
  assert.equal(f.renders, before);
  sequence.seek(0.5);
  assert.equal(f.verbs.state().status, "stopped");
  assert.equal(f.queue.size, 0);
  verbLate();
  assert.equal(f.queue.size, 0);
  start(f, "rotate", "right", "continuous");
  sequence.start();
  assert.equal(f.verbs.state().status, "stopped");
  assert.equal(f.queue.size, 1);
  sequence.destroy();
  f.motionOwner.destroy();
});
test("hidden/stop/abort during actual camera apply suppresses follow-up render and completion", () => {
  for (const action of ["hide", "stop", "abort"]) {
    const f = fixture();
    start(f, "pan", "left", "continuous");
    const original = f.viewer.camera.setView.bind(f.viewer.camera);
    f.viewer.camera.setView = (args) => {
      original(args);
      if (action === "hide") f.hide();
      if (action === "stop") f.verbs.stop();
      if (action === "abort") f.controller.abort();
    };
    const before = f.renders;
    f.advance();
    assert.equal(f.renders, before);
    assert.equal(f.queue.size, 0);
    assert.notEqual(f.verbs.state().status, "playing");
    assert.ok(Matrix4.equals(f.viewer.camera.transform, Matrix4.IDENTITY));
  }
});

test("ENU orbit frame and instant endpoint remain finite across dateline, poles and globe scale", async () => {
  const { readEllipsoidTargetFrame } =
    await import("../src/camera-target-frame.js");
  for (const [lon, lat, range, pitch, heading] of [
    [179.999, 30, 1e4, -35, 30],
    [-179.99, -30, 1e4, -45, 240],
    [0, 89.99, 1e4, -35, 130],
    [0, -89.99, 1e4, -35, 300],
    [108, 24, 28e6, -60, 30],
  ]) {
    const f = fixture(),
      target = Cartesian3.fromDegrees(lon, lat, 0);
    f.viewer.camera.lookAt(
      target,
      new HeadingPitchRange(
        CesiumMath.toRadians(heading),
        CesiumMath.toRadians(pitch),
        range,
      ),
    );
    f.viewer.camera.lookAtTransform(Matrix4.IDENTITY);
    const frame = readEllipsoidTargetFrame(f.viewer.camera, target);
    near(frame.range, range, 1e-5);
    near(CesiumMath.toDegrees(frame.pitch), pitch);
    near(CesiumMath.toDegrees(frame.heading), heading);
    f.viewer.camera.pickEllipsoid = () => target;
    const expected = Camera.clone(f.viewer.camera);
    expected.lookAt(
      target,
      new HeadingPitchRange(
        CesiumMath.toRadians(heading - 30),
        CesiumMath.toRadians(pitch),
        range,
      ),
    );
    expected.lookAtTransform(Matrix4.IDENTITY);
    assert.equal(start(f, "orbit", "left", "once", "normal", true), true);
    near(
      Cartesian3.distance(f.viewer.camera.positionWC, expected.positionWC),
      0,
      1e-4,
    );
    assert.ok(Matrix4.equals(f.viewer.camera.transform, Matrix4.IDENTITY));
    f.motionOwner.destroy();
  }
});
test("scratch preflight rejects height and pitch limits before any live camera mutation", () => {
  for (const setup of [
    (f) => {
      applyCameraPose(f.viewer, {
        lon: 0,
        lat: 0,
        alt: 99999999,
        heading: 0,
        pitch: -45,
        roll: 0,
      });
      return ["pan", "up"];
    },
    (f) => {
      applyCameraPose(f.viewer, {
        lon: 0,
        lat: 0,
        alt: 1000,
        heading: 0,
        pitch: -85,
        roll: 0,
      });
      return ["tilt", "down"];
    },
    (f) => {
      f.viewer.camera.pickEllipsoid = () => new Cartesian3(NaN, 0, 0);
      return ["orbit", "right"];
    },
    (f) => {
      f.viewer.camera.pickEllipsoid = () => Cartesian3.ZERO;
      return ["orbit", "right"];
    },
  ]) {
    const f = fixture(),
      [motion, direction] = setup(f),
      before = Cartesian3.clone(f.viewer.camera.positionWC),
      renders = f.renders;
    assert.equal(start(f, motion, direction, "once", "normal", true), false);
    near(Cartesian3.distance(f.viewer.camera.positionWC, before), 0);
    assert.equal(f.renders, renders);
    assert.equal(f.queue.size, 0);
  }
});
test("camera/render/scheduler/clock faults release authority without claiming motion success", () => {
  for (const fail of [
    (f) => {
      f.viewer.camera.setView = () => {
        throw new Error("camera fault");
      };
    },
    (f) => {
      f.viewer.scene.requestRender = () => {
        throw new Error("render fault");
      };
    },
    (f) => {
      f.schedule.request = () => {
        throw new Error("schedule fault");
      };
    },
    (f) => {
      f.schedule.now = () => NaN;
    },
  ]) {
    const f = fixture();
    fail(f);
    start(f, "rotate", "right", "continuous");
    f.advance();
    assert.notEqual(f.verbs.state().status, "playing");
    assert.equal(f.queue.size, 0);
    assert.notEqual(f.verbs.state().status, "complete");
    f.verbs.destroy();
    f.verbs.destroy();
    f.motionOwner.destroy();
  }
});

async function domFixture(reduced = false) {
  const { JSDOM } = await import("jsdom");
  const { readFile } = await import("node:fs/promises");
  const { installCameraVerbsControls } =
    await import("../src/camera-verbs-controls.js");
  const html = await readFile(
    new URL("../public/frame.html", import.meta.url),
    "utf8",
  );
  const dom = new JSDOM(html, { pretendToBeVisual: true }),
    document = dom.window.document,
    f = fixture();
  f.verbs.destroy();
  f.viewer.container = document.getElementById("globe");
  f.viewer.canvas = document.createElement("canvas");
  f.viewer.container.append(f.viewer.canvas);
  const nodes = Object.fromEntries(
    [
      "panel",
      "motion",
      "direction",
      "speed",
      "once",
      "continuous",
      "stop",
      "status",
      "allow",
      "preference",
    ].map((key) => [key, document.getElementById("verb-" + key)]),
  );
  const motion = new dom.window.EventTarget();
  motion.matches = reduced;
  const ui = installCameraVerbsControls({
    viewer: f.viewer,
    nodes,
    signal: f.controller.signal,
    motionOwner: f.motionOwner,
    document,
    motion,
  });
  nodes.motion.value = "pan";
  nodes.motion.dispatchEvent(new dom.window.Event("change"));
  return {
    ...f,
    f,
    dom,
    document,
    nodes,
    motion,
    ui,
    close() {
      ui.destroy();
      f.motionOwner.destroy();
      dom.window.close();
    },
  };
}
test("actual native DOM requires open panel; reduced motion gives instant Once and explicit Continuous opt-in", async () => {
  const p = await domFixture(true);
  assert.equal(p.f.queue.size, 0);
  p.nodes.once.click();
  assert.equal(p.f.queue.size, 0);
  p.nodes.panel.open = true;
  assert.equal(p.nodes.allow.checked, false);
  assert.equal(p.nodes.continuous.disabled, true);
  p.nodes.once.click();
  assert.equal(p.f.queue.size, 0);
  assert.match(p.nodes.status.textContent, /减少动态/);
  p.nodes.continuous.click();
  assert.equal(p.f.queue.size, 0);
  p.nodes.allow.checked = true;
  p.nodes.allow.dispatchEvent(new p.dom.window.Event("change"));
  p.nodes.continuous.click();
  assert.equal(p.f.queue.size, 1);
  p.motion.dispatchEvent(new p.dom.window.Event("change"));
  assert.equal(p.f.queue.size, 0);
  assert.equal(p.nodes.allow.checked, false);
  p.nodes.motion.value = "tilt";
  p.nodes.motion.dispatchEvent(new p.dom.window.Event("change"));
  assert.deepEqual(
    [...p.nodes.direction.options].map((o) => o.value),
    ["up", "down"],
  );
  p.close();
});
test("DOM close/hidden/ancestor/exit/canvas/motion changes/abort dispose or cancel before stale callbacks", async () => {
  for (const action of [
    (p) => {
      p.nodes.panel.open = false;
    },
    (p) => {
      p.nodes.panel.parentElement.hidden = true;
    },
    (p) => {
      Object.defineProperty(p.document, "hidden", { value: true });
    },
    (p) => {
      p.dom.window.dispatchEvent(new p.dom.window.Event("pagehide"));
    },
    (p) => {
      p.viewer.canvas.dispatchEvent(
        new p.dom.window.Event("pointerdown", { bubbles: true }),
      );
    },
    (p) => {
      p.viewer.canvas.dispatchEvent(
        new p.dom.window.Event("mousedown", { bubbles: true }),
      );
    },
    (p) => {
      p.viewer.canvas.dispatchEvent(
        new p.dom.window.Event("wheel", { bubbles: true }),
      );
    },
    (p) => {
      p.viewer.canvas.dispatchEvent(
        new p.dom.window.Event("touchstart", { bubbles: true }),
      );
    },
    (p) => {
      p.viewer.canvas.dispatchEvent(
        new p.dom.window.KeyboardEvent("keydown", {
          key: "ArrowUp",
          bubbles: true,
        }),
      );
    },
    (p) => {
      p.nodes.speed.value = "slow";
      p.nodes.speed.dispatchEvent(new p.dom.window.Event("change"));
    },
    (p) => {
      p.controller.abort();
    },
    (p) => {
      p.ui.destroy();
    },
  ]) {
    const p = await domFixture();
    p.nodes.panel.open = true;
    p.nodes.continuous.click();
    assert.equal(p.f.queue.size, 1);
    const late = [...p.f.queue.values()][0],
      before = p.f.renders;
    action(p);
    p.f.advance();
    assert.equal(p.f.queue.size, 0);
    late();
    assert.equal(p.f.renders, before);
    p.close();
    p.nodes.continuous.click();
    assert.equal(p.f.queue.size, 0);
  }
});
test("canvas capture cancels both sequence and verbs before downstream installed camera input", async () => {
  const p = await domFixture();
  p.nodes.panel.open = true;
  p.nodes.continuous.click();
  let pendingAtCamera;
  p.viewer.canvas.addEventListener("wheel", () => {
    pendingAtCamera = p.f.queue.size;
  });
  p.viewer.canvas.dispatchEvent(
    new p.dom.window.Event("wheel", { bubbles: true }),
  );
  assert.equal(pendingAtCamera, 0);
  const sequence = createCameraSequence({
    viewer: p.viewer,
    signal: p.controller.signal,
    motionOwner: p.motionOwner,
  });
  sequence.capture("first", 1, "linear");
  sequence.capture("second", 1, "linear");
  sequence.start();
  assert.equal(p.f.queue.size, 1);
  p.viewer.canvas.dispatchEvent(
    new p.dom.window.Event("wheel", { bubbles: true }),
  );
  assert.equal(pendingAtCamera, 0);
  assert.equal(sequence.state().status, "stopped");
  sequence.destroy();
  p.close();
});

test("actual USGS selection focus reclaims verb authority before installed camera mutation", async () => {
  const { installEarthquakeControls } =
    await import("../src/earthquake-controls.js");
  const p = await domFixture();
  p.nodes.panel.open = true;
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
  const collections = new Set();
  p.viewer.scene.primitives = {
    add(c) {
      collections.add(c);
      return c;
    },
    remove(c) {
      const existed = collections.delete(c);
      if (existed) c.destroy();
      return existed;
    },
  };
  const stamp = new Date().toISOString();
  const release = installEarthquakeControls({
    viewer: p.viewer,
    nodes,
    signal: p.controller.signal,
    beforeCamera: p.motionOwner.cancel,
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
  p.nodes.continuous.click();
  assert.equal(p.f.queue.size, 1);
  const original = p.viewer.camera.setView.bind(p.viewer.camera);
  p.viewer.camera.setView = (args) => {
    assert.equal(p.f.queue.size, 0);
    original(args);
  };
  nodes.focus.click();
  assert.equal(p.f.queue.size, 0);
  near(CesiumMath.toDegrees(p.viewer.camera.positionCartographic.longitude), 1);
  release();
  p.close();
});

test("an old frame never stops a new same-controller run accepted during setView or requestRender", () => {
  for (const site of ["setView", "requestRender"]) {
    const f = fixture();
    start(f, "pan", "left", "continuous");
    let once = false,
      accepted;
    const original =
      site === "setView"
        ? f.viewer.camera.setView.bind(f.viewer.camera)
        : f.viewer.scene.requestRender.bind(f.viewer.scene);
    const mutate = (...args) => {
      original(...args);
      if (!once) {
        once = true;
        accepted = start(f, "rotate", "right", "continuous");
      }
    };
    if (site === "setView") f.viewer.camera.setView = mutate;
    else f.viewer.scene.requestRender = mutate;
    f.advance();
    assert.equal(accepted, true);
    assert.equal(f.verbs.state().status, "playing");
    assert.equal(f.verbs.state().motion, "rotate");
    assert.equal(f.queue.size, 1);
    f.advance();
    assert.equal(f.verbs.state().status, "playing");
    assert.equal(f.queue.size, 1);
    f.motionOwner.destroy();
  }
});
test("hide/stop/abort/takeover during requestRender releases only the old current owner", () => {
  for (const action of ["hide", "stop", "abort", "takeover"]) {
    const f = fixture();
    start(f, "pan", "left", "continuous");
    let called = false;
    const third = f.motionOwner.register({ stop() {} });
    f.viewer.scene.requestRender = () => {
      if (called) return;
      called = true;
      if (action === "hide") f.hide();
      if (action === "stop") f.verbs.stop();
      if (action === "abort") f.controller.abort();
      if (action === "takeover") {
        assert.equal(third.claim(), true);
        third.schedule.request(() => {});
      }
    };
    f.advance();
    assert.notEqual(f.verbs.state().status, "playing");
    assert.equal(f.queue.size, action === "takeover" ? 1 : 0);
    if (action === "takeover") assert.equal(third.valid(), true);
    f.motionOwner.destroy();
  }
});
