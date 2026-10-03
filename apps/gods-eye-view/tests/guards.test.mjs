import test from "node:test";
import assert from "node:assert/strict";
const load = (name) => import(`../src/${name}.js`).catch(() => ({}));
async function terminalGlobeProbe(failDuringStartup, preAborted = false) {
  const { readFile } = await import("node:fs/promises");
  const vm = await import("node:vm");
  const { createApplication } =
    await import("../vendor/src/app/application.js");
  const { installRenderFailureHandler } = await load("render-errors");
  const { installDisplayControls, updateVisualEffectStatus } =
    await load("display-controls");
  const { createStaticVisualEffects } = await loadStaticEffects();
  const post = postProcessProbe();
  const source = (
    await readFile(new URL("../src/globe.js", import.meta.url), "utf8")
  )
    .replace(/import\s+[\s\S]*?\sfrom\s+["'][^"']+["'];\n/g, "")
    .replace("export async function startGlobe", "async function startGlobe");
  class FakeNode {
    constructor(tag = "button") {
      this.tag = tag;
      this.disabled = false;
      this.listeners = {};
      this.children = [];
      this.dataset = {};
      this.value = "";
    }
    setAttribute() {}
    focus() {}
    addEventListener(type, fn) {
      this.listeners[type] = fn;
    }
    removeEventListener(type) {
      delete this.listeners[type];
    }
    replaceChildren() {
      this.children = [];
    }
    append(...nodes) {
      this.children.push(...nodes);
    }
  }
  const ids = [
    "globe",
    "credits",
    "globe-status",
    "map-state",
    "query",
    "search-button",
    "search-status",
    "home",
    "map-style",
    "visual-style",
    "effect-status",
    "zoom-in",
    "zoom-out",
    "north",
    "coordinates",
    "events",
    "clear",
    "refresh",
    "feed-status",
    "overhead",
    "oblique",
    "save-view",
    "restore-view",
    "camera-status",
    "clean-view",
    "sharpen",
    "sharpen-intensity",
    "bloom",
    "bloom-intensity",
  ];
  const nodes = Object.fromEntries(ids.map((id) => [id, new FakeNode()]));
  const dynamic = [],
    errors = new Set();
  let resolveFetch,
    requestSignal,
    disposed = false;
  const viewer = {
    isDestroyed: () => disposed,
    useDefaultRenderLoop: true,
    destroy() {
      disposed = true;
    },
    camera: {
      cancelFlight() {},
      flyTo() {},
      zoomIn() {},
      zoomOut() {},
      setView() {},
      positionCartographic: { height: 1000 },
      heading: 0,
      positionWC: { x: 6379000, y: 12, z: 34 },
      directionWC: { x: -1, y: 0, z: 0 },
      upWC: { x: 0, y: 0, z: 1 },
    },
    canvas: {},
    imageryLayers: { add() {}, remove() {} },
    scene: {
      postProcessStages: post.viewer.scene.postProcessStages,
      requestRender() {},
      renderError: {
        addEventListener(fn) {
          errors.add(fn);
          return () => errors.delete(fn);
        },
      },
      primitives: {
        add(v) {
          return v;
        },
        remove() {},
      },
    },
  };
  const triggerFailure = () => {
    for (const fn of [...errors]) fn(viewer.scene, new Error("GPU failure"));
  };
  const Provider = class {
    constructor() {
      this.errorEvent = {
        addEventListener() {
          return () => {};
        },
      };
    }
  };
  const context = vm.createContext({
    AbortController,
    AbortSignal,
    createApplication,
    installRenderFailureHandler(options) {
      const release = installRenderFailureHandler(options);
      if (failDuringStartup) queueMicrotask(triggerFailure);
      return release;
    },
    document: {
      getElementById: (id) => nodes[id],
      querySelectorAll: (selector) =>
        selector === "[data-city]" ? [] : [...Object.values(nodes), ...dynamic],
      createElement(tag) {
        const n = new FakeNode(tag);
        dynamic.push(n);
        return n;
      },
    },
    createApplicationViewer: () => viewer,
    installDisplayControls,
    updateVisualEffectStatus,
    createStaticVisualEffects: (options) =>
      createStaticVisualEffects({ ...options, createStage: post.createStage }),
    installSearchControls: () => () => {},
    installTrackpadPinchZoom: () => () => {},
    fetchEarthquakes: ({ signal }) => {
      requestSignal = signal;
      return new Promise((resolve) => {
        resolveFetch = resolve;
      });
    },
    NATURAL_EARTH_OPTIONS: {},
    parseCoordinateQuery: () => null,
    Cartesian3: { fromDegrees: () => ({}) },
    Color: { fromCssColorString: () => ({}) },
    CesiumMath: { toDegrees: (v) => v },
    OpenStreetMapImageryProvider: Provider,
    UrlTemplateImageryProvider: Provider,
    GeographicTilingScheme: class {},
    ImageryLayer: class {},
    PointPrimitiveCollection: class {
      add() {}
      removeAll() {}
    },
    ScreenSpaceEventHandler: class {
      setInputAction() {}
      destroy() {}
    },
    ScreenSpaceEventType: { MOUSE_MOVE: 1 },
    Cartographic: { fromCartesian: (x) => x },
  });
  vm.runInContext(source, context);
  const external = new AbortController();
  if (preAborted) {
    external.abort();
    await assert.rejects(context.startGlobe(external.signal), {
      name: "AbortError",
    });
    const { getEventListeners } = await import("node:events");
    assert.equal(getEventListeners(external.signal, "abort").length, 0);
    assert.equal(disposed, false);
    assert.equal(errors.size, 0);
    return;
  }
  await context.startGlobe(external.signal);
  if (!failDuringStartup) {
    assert.equal(typeof nodes.overhead.listeners.click, "function");
    nodes["save-view"].listeners.click();
    assert.equal(nodes["restore-view"].disabled, false);
    nodes.sharpen.checked = true;
    nodes.sharpen.listeners.change();
    nodes.bloom.checked = true;
    nodes.bloom.listeners.change();
    assert.equal(post.stages.length, 1);
    const pending = nodes.refresh.listeners.click();
    triggerFailure();
    assert.equal(requestSignal.aborted, true);
    resolveFetch({
      rows: [{ lat: 47, lon: 123, mag: 3, time: 1, place: "probe" }],
      fetchedAt: "2026-10-03T00:00:00Z",
    });
    await pending;
  }
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(viewer.useDefaultRenderLoop, false);
  assert.equal(nodes.refresh.disabled, true);
  assert.equal(nodes.clear.disabled, true);
  assert.equal(
    dynamic.some((n) => n.tag === "button"),
    false,
  );
  assert.equal(disposed, true);
  assert.equal(errors.size, 0);
  assert.equal(post.stages.length, 0);
  assert.deepEqual(post.bloom, post.original);
  assert.ok(
    Object.values(nodes).every(
      (node) => Object.keys(node.listeners).length === 0,
    ),
  );
  assert.match(nodes["globe-status"].textContent, /暂停地球观察/);
}
test("GPU failure aborts pending data without re-enabling controls or creating targets", () =>
  terminalGlobeProbe(false));
test("GPU failure during startup preserves terminal status and returns without a bootstrap error", () =>
  terminalGlobeProbe(true));
const session = {
  subjectId: "s",
  displayName: "人",
  workUnitCode: "a",
  workUnitName: "单位",
  accountStatus: "ACTIVE",
  employmentStatus: "ACTIVE",
  roleCodes: [],
  positions: [],
  permissions: [],
  regionCodes: [],
};
test("unauthenticated and malformed sessions cannot mount a heavy frame", async () => {
  const { createHostController } = await load("host-controller");
  assert.equal(typeof createHostController, "function");
  for (const payload of [
    null,
    {},
    { ...session, subjectId: "" },
    { ...session, accountStatus: "DISABLED" },
  ]) {
    let mounts = 0;
    const host = createHostController({
      checkSession: async () => payload,
      mount: () => {
        mounts++;
        return { remove() {} };
      },
    });
    await host.open();
    assert.equal(mounts, 0);
    assert.equal(host.state, "denied");
  }
});
test("hide during session request prevents a late frame and requires explicit resume", async () => {
  const { createHostController } = await load("host-controller");
  assert.equal(typeof createHostController, "function");
  let finish;
  let mounts = 0;
  const host = createHostController({
    checkSession: () => new Promise((r) => (finish = r)),
    mount: () => {
      mounts++;
      return { remove() {} };
    },
  });
  const opening = host.open();
  host.suspend();
  finish(session);
  await opening;
  assert.equal(mounts, 0);
  assert.equal(host.state, "paused");
});
test("hide removes a running frame synchronously and resume revalidates the session", async () => {
  const { createHostController } = await load("host-controller");
  assert.equal(typeof createHostController, "function");
  let removed = 0,
    checks = 0;
  const host = createHostController({
    checkSession: async () => {
      checks++;
      return session;
    },
    mount: () => ({
      remove() {
        removed++;
      },
    }),
  });
  await host.open();
  host.suspend();
  assert.equal(removed, 1);
  assert.equal(host.state, "paused");
  await host.open();
  assert.equal(checks, 2);
});
test("source rejects malformed, oversize and redirected responses", async () => {
  const { fetchEarthquakes } = await load("earthquakes");
  assert.equal(typeof fetchEarthquakes, "function");
  for (const response of [
    new Response("{}"),
    new Response("x".repeat(2097153)),
    new Response("{}", { headers: { "content-length": "2097153" } }),
  ]) {
    await assert.rejects(fetchEarthquakes({ fetchImpl: async () => response }));
  }
  await assert.rejects(
    fetchEarthquakes({
      fetchImpl: async () => ({ ok: true, redirected: true, body: null }),
    }),
    /redirect/i,
  );
});
test("source timeout aborts outstanding fetch and credentials never go externally", async () => {
  const { fetchEarthquakes } = await load("earthquakes");
  assert.equal(typeof fetchEarthquakes, "function");
  let aborted = false;
  await assert.rejects(
    fetchEarthquakes({
      timeoutMs: 10,
      fetchImpl: (url, options) => {
        assert.equal(
          url,
          "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson",
        );
        assert.equal(options.credentials, "omit");
        assert.equal(options.redirect, "error");
        return new Promise((_, reject) =>
          options.signal.addEventListener("abort", () => {
            aborted = true;
            reject(options.signal.reason);
          }),
        );
      },
    }),
  );
  assert.equal(aborted, true);
});
test("source preserves exact event times and filters to M2.5+", async () => {
  const { fetchEarthquakes } = await load("earthquakes");
  assert.equal(typeof fetchEarthquakes, "function");
  const feature = (mag) => ({
    id: String(mag),
    geometry: { type: "Point", coordinates: [120, 30, 5] },
    properties: { mag, time: 1760000000123, place: "<img>" },
  });
  const result = await fetchEarthquakes({
    fetchImpl: async () =>
      new Response(JSON.stringify({ features: [feature(2), feature(3)] })),
  });
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].time, 1760000000123);
  assert.equal(result.rows[0].place, "<img>");
  assert.ok(result.fetchedAt);
});
test("destroy during upstream setup cancels later phases and releases acquired resources", async () => {
  const { createApplication } =
    await import("../vendor/src/app/application.js").catch(() => ({}));
  assert.equal(typeof createApplication, "function");
  let finish;
  let released = 0,
    controls = 0;
  const app = createApplication({
    createScene: async ({ defer }) => {
      defer(() => released++);
      await new Promise((r) => (finish = r));
      return {};
    },
    createControls: () => controls++,
    createData: () => {},
    createTools: () => {},
  });
  const start = app.start();
  await new Promise((r) => setImmediate(r));
  const stop = app.destroy();
  finish();
  await assert.rejects(start);
  await stop;
  assert.equal(released, 1);
  assert.equal(controls, 0);
  assert.equal(app.getState().status, "destroyed");
});
test("source timeout also cancels a stalled response body", async () => {
  const { fetchEarthquakes } = await load("earthquakes");
  let cancelled = false;
  const body = new ReadableStream({
    pull() {
      return new Promise(() => {});
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    fetchEarthquakes({
      timeoutMs: 10,
      fetchImpl: async () => new Response(body),
    }),
  );
  assert.equal(cancelled, true);
});
test("session probe unwraps the root API data envelope using only the session endpoint", async () => {
  const { checkSession } = await load("host-controller");
  const original = globalThis.fetch;
  let options;
  globalThis.fetch = async (url, opts) => {
    assert.equal(url, "/api/v1/session/me");
    options = opts;
    return new Response(JSON.stringify({ data: session }), {
      headers: { "content-type": "application/json" },
    });
  };
  try {
    assert.deepEqual(await checkSession(new AbortController().signal), session);
    assert.equal(options.credentials, "same-origin");
    assert.equal(options.headers.Accept, "application/json");
  } finally {
    globalThis.fetch = original;
  }
});
test("an already aborted source cannot issue an external request", async () => {
  const { fetchEarthquakes } = await load("earthquakes");
  let calls = 0;
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(
    fetchEarthquakes({
      signal: abort.signal,
      fetchImpl: async () => {
        calls++;
        return new Response("{}");
      },
    }),
  );
  assert.equal(calls, 0);
});
test("bad point geometry, duplicate events and absent event times are rejected atomically", async () => {
  const { fetchEarthquakes } = await load("earthquakes");
  const f = {
    id: "x",
    geometry: { type: "Point", coordinates: [120, 30, 2] },
    properties: { mag: 3, time: 1760000000000 },
  };
  for (const features of [
    [{ ...f, geometry: { type: "Point", coordinates: [181, 30] } }],
    [f, f],
    [{ ...f, properties: { mag: 3 } }],
  ]) {
    await assert.rejects(
      fetchEarthquakes({
        fetchImpl: async () => new Response(JSON.stringify({ features })),
      }),
    );
  }
});
test("visible pause action removes the iframe and offers explicit resume", async () => {
  const previous = {
    document: globalThis.document,
    window: globalThis.window,
    fetch: globalThis.fetch,
  };
  class Element extends EventTarget {
    hidden = false;
    disabled = false;
    textContent = "";
    children = [];
    setAttribute() {}
    append(node) {
      this.children.push(node);
      node.remove = () => {
        this.children = this.children.filter((n) => n !== node);
      };
    }
  }
  const nodes = new Map(
    ["open", "pause", "status", "login", "frame-mount"].map((id) => [
      "#" + id,
      new Element(),
    ]),
  );
  const documentLike = new EventTarget();
  documentLike.hidden = false;
  documentLike.querySelector = (id) => nodes.get(id);
  documentLike.createElement = () => new Element();
  documentLike.body = { classList: { toggle() {} } };
  globalThis.document = documentLike;
  globalThis.window = new EventTarget();
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ data: session }), {
      headers: { "content-type": "application/json" },
    });
  try {
    await import("../src/host.js?pause-test");
    nodes.get("#open").dispatchEvent(new Event("click"));
    await new Promise((r) => setImmediate(r));
    assert.equal(nodes.get("#frame-mount").children.length, 1);
    assert.equal(nodes.get("#pause").hidden, false);
    nodes.get("#pause").dispatchEvent(new Event("click"));
    assert.equal(nodes.get("#frame-mount").children.length, 0);
    assert.equal(nodes.get("#open").textContent, "恢复地球观察");
    assert.equal(nodes.get("#pause").hidden, true);
  } finally {
    Object.assign(globalThis, previous);
  }
});
test("a terminated or failed build subprocess never reports success", async () => {
  const { commandExitCode } = await load("command-status");
  assert.equal(typeof commandExitCode, "function");
  assert.equal(commandExitCode({ status: null, signal: "SIGTERM" }), 1);
  assert.equal(
    commandExitCode({ status: null, error: new Error("spawn failed") }),
    1,
  );
  assert.equal(
    commandExitCode({ status: 0, error: new Error("spawn failed") }),
    1,
  );
  assert.equal(commandExitCode({ status: 2 }), 2);
  assert.equal(commandExitCode({ status: 0, signal: null }), 0);
});
test("disabled model compression does not initialize WebAssembly and fails closed if requested", async () => {
  const previous = globalThis.WebAssembly;
  let instantiations = 0;
  globalThis.WebAssembly = {
    instantiate() {
      instantiations++;
      throw new Error("CSP forbids compilation");
    },
  };
  try {
    const { MeshoptDecoder } = await load("disabled-meshopt");
    assert.ok(MeshoptDecoder, "Optional decoder gate must exist");
    assert.equal(instantiations, 0);
    assert.equal(MeshoptDecoder.supported, false);
    await assert.rejects(MeshoptDecoder.ready, /not available/);
    for (const method of [
      "decodeGltfBuffer",
      "decodeVertexBuffer",
      "decodeIndexBuffer",
      "decodeIndexSequence",
    ])
      assert.throws(() => MeshoptDecoder[method](), /not available/);
  } finally {
    globalThis.WebAssembly = previous;
  }
});
test("coordinate navigation works through a direct button or Enter without form permissions", async () => {
  const { installSearchControls } = await load("search-controls");
  assert.equal(typeof installSearchControls, "function");
  const input = new EventTarget();
  input.value = "47.35, 123.92";
  const button = new EventTarget();
  const queries = [];
  const release = installSearchControls({
    input,
    button,
    onQuery: (query) => queries.push(query),
  });
  button.dispatchEvent(new Event("click"));
  const enter = new Event("keydown", { cancelable: true });
  enter.key = "Enter";
  input.dispatchEvent(enter);
  assert.deepEqual(queries, ["47.35, 123.92", "47.35, 123.92"]);
  assert.equal(enter.defaultPrevented, true);
  const composing = new Event("keydown", { cancelable: true });
  composing.key = "Enter";
  composing.isComposing = true;
  input.dispatchEvent(composing);
  assert.equal(queries.length, 2);
  assert.equal(composing.defaultPrevented, false);
  release();
  button.dispatchEvent(new Event("click"));
  assert.equal(queries.length, 2);
});
test("local Natural Earth overview uses only bundled low-resolution geographic tiles", async () => {
  const { NATURAL_EARTH_OPTIONS } = await load("basemaps");
  assert.ok(NATURAL_EARTH_OPTIONS, "Local map options must exist");
  assert.equal(NATURAL_EARTH_OPTIONS.maximumLevel, 2);
  assert.ok(
    NATURAL_EARTH_OPTIONS.url.startsWith(
      "./cesium/Assets/Textures/NaturalEarthII/",
    ),
  );
  assert.ok(NATURAL_EARTH_OPTIONS.url.includes("{reverseY}"));
  assert.ok(!NATURAL_EARTH_OPTIONS.url.includes("https:"));
  const { readFile } = await import("node:fs/promises");
  for (const x of [0, 1])
    assert.ok(
      (
        await readFile(
          new URL(
            `../node_modules/cesium/Build/Cesium/Assets/Textures/NaturalEarthII/0/${x}/0.jpg`,
            import.meta.url,
          ),
        )
      ).length > 0,
    );
});
test("upstream static styles are opt-in, schedule no frames, and release every stage on clear or destroy", async () => {
  const { createStaticVisualEffects } = await loadStaticEffects();
  let scheduled = 0,
    renders = 0;
  const previous = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => {
    scheduled++;
    return 1;
  };
  const stages = [];
  const collection = {
    add(stage) {
      stages.push(stage);
    },
    remove(stage) {
      const i = stages.indexOf(stage);
      if (i !== -1) stages.splice(i, 1);
    },
  };
  try {
    const owner = createStaticVisualEffects({
      viewer: {
        scene: {
          postProcessStages: collection,
          requestRender() {
            renders++;
          },
        },
      },
    });
    assert.equal(stages.length, 0);
    owner.setStyle("surveillance");
    assert.equal(stages.filter((s) => s.enabled).length, 1);
    assert.equal(stages.find((s) => s.enabled).uniforms.time, 0);
    owner.setStyle("thermal");
    assert.equal(stages.filter((s) => s.enabled).length, 1);
    assert.equal(scheduled, 0);
    assert.ok(renders > 0);
    owner.clear();
    assert.equal(stages.length, 0);
    owner.setStyle("noir");
    assert.equal(stages.filter((s) => s.enabled).length, 1);
    owner.destroy();
    assert.equal(stages.length, 0);
    assert.equal(owner.setStyle("noir"), false);
    assert.equal(scheduled, 0);
  } finally {
    globalThis.requestAnimationFrame = previous;
  }
});

async function loadStaticEffects() {
  const { build } = await import("esbuild");
  const { fileURLToPath } = await import("node:url");
  const { existsSync } = await import("node:fs");
  const entry = fileURLToPath(
    new URL("../src/static-effects.js", import.meta.url),
  );
  assert.ok(existsSync(entry), "Static effect owner must exist");
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    plugins: [
      {
        name: "test-stage",
        setup(b) {
          b.onResolve({ filter: /^cesium$/ }, () => ({
            path: "stage",
            namespace: "test",
          }));
          b.onLoad({ filter: /.*/, namespace: "test" }, () => ({
            contents:
              "export class PostProcessStage {constructor(options){Object.assign(this,options)}}",
          }));
        },
      },
    ],
  });
  return import(
    "data:text/javascript;base64," +
      Buffer.from(result.outputFiles[0].text).toString("base64")
  );
}
test("Nth style construction or collection insertion failure releases every acquired stage", async () => {
  const { createStaticVisualEffects } = await loadStaticEffects();
  for (const phase of ["construct", "add"]) {
    const stages = [],
      created = [];
    let attempts = 0;
    const collection = {
      add(stage) {
        if (phase === "add" && created.length === 3)
          throw new Error("add failed");
        stages.push(stage);
      },
      remove(stage) {
        const index = stages.indexOf(stage);
        if (index === -1) return false;
        stages.splice(index, 1);
        stage.destroy();
        return true;
      },
    };
    const createStage = (options) => {
      if (++attempts === 3 && phase === "construct")
        throw new Error("construct failed");
      let dead = false;
      const stage = {
        ...options,
        isDestroyed: () => dead,
        destroy() {
          assert.equal(dead, false, "stage cannot be destroyed twice");
          dead = true;
        },
      };
      created.push(stage);
      return stage;
    };
    const owner = createStaticVisualEffects({
      viewer: { scene: { postProcessStages: collection, requestRender() {} } },
      createStage,
    });
    assert.throws(() => owner.setStyle("noir"), /failed/);
    assert.equal(stages.length, 0);
    assert.ok(created.every((s) => s.isDestroyed()));
    owner.destroy();
    assert.equal(stages.length, 0);
  }
});
test("render failure is visibly terminal, clears effects once, and never restarts the loop", async () => {
  const { installRenderFailureHandler } = await load("render-errors");
  assert.equal(typeof installRenderFailureHandler, "function");
  const listeners = new Set();
  let cleared = 0,
    stopped = 0;
  const abort = new AbortController();
  const viewer = {
    useDefaultRenderLoop: true,
    isDestroyed: () => false,
    scene: {
      renderError: {
        addEventListener(fn) {
          listeners.add(fn);
          return () => listeners.delete(fn);
        },
      },
    },
  };
  const release = installRenderFailureHandler({
    viewer,
    signal: abort.signal,
    effects: {
      clear() {
        cleared++;
        throw new Error("cleanup error");
      },
    },
    onStopped() {
      stopped++;
    },
  });
  const error = [...listeners][0];
  assert.doesNotThrow(error);
  assert.equal(viewer.useDefaultRenderLoop, false);
  assert.equal(cleared, 1);
  assert.equal(stopped, 1);
  error();
  assert.equal(cleared, 1);
  release();
  assert.equal(listeners.size, 0);
});
test("a disposed widget cannot be resumed by a late style action", async () => {
  const { createStaticVisualEffects } = await loadStaticEffects();
  let draws = 0;
  const owner = createStaticVisualEffects({
    viewer: {
      isDestroyed: () => true,
      scene: {
        requestRender() {
          draws++;
          throw new Error("disposed widget");
        },
      },
    },
  });
  assert.equal(owner.setStyle("noir"), false);
  assert.doesNotThrow(() => owner.clear());
  assert.doesNotThrow(() => owner.destroy());
  assert.equal(draws, 0);
});

test("camera commands cancel flights, validate and copy a single world pose", async () => {
  const { createCameraCommands } = await load("camera-controls");
  assert.equal(typeof createCameraCommands, "function");
  let renders = 0,
    cancellations = 0;
  const views = [];
  const camera = {
    heading: 0.7,
    positionWC: { x: 6379000, y: 12, z: 34 },
    directionWC: { x: -1, y: 0, z: 0 },
    upWC: { x: 0, y: 0, z: 1 },
    cancelFlight() {
      cancellations++;
    },
    setView(view) {
      views.push(view);
    },
    lookAt(target, offset) {
      views.push({ destination: target, orientation: offset });
    },
    lookAtTransform() {},
  };
  const abort = new AbortController();
  const commands = createCameraCommands({
    viewer: {
      camera,
      scene: {
        requestRender() {
          renders++;
        },
      },
    },
    signal: abort.signal,
  });
  assert.equal(commands.restore(), false);
  assert.equal(commands.save(), true);
  camera.positionWC.x = 8000000;
  assert.equal(commands.restore(), true);
  assert.equal(views[0].destination.x, 6379000);
  views[0].destination.x = 1;
  commands.restore();
  assert.equal(views[1].destination.x, 6379000);
  for (const bad of [NaN, Infinity]) {
    camera.positionWC.x = bad;
    assert.equal(commands.save(), false);
  }
  camera.positionWC.x = 6379000;
  camera.upWC = { ...camera.directionWC };
  assert.equal(commands.save(), false);
  commands.restore();
  assert.equal(views.at(-1).destination.x, 6379000);
  commands.overhead();
  assert.deepEqual(views.at(-1).orientation, {
    heading: 0.7,
    pitch: -Math.PI / 2,
    roll: 0,
  });
  commands.oblique();
  assert.equal(views.at(-1).orientation.pitch, -Math.PI / 4);
  assert.equal(renders, 5);
  assert.equal(cancellations, 5);
  abort.abort();
  assert.equal(commands.save(), false);
  assert.equal(commands.restore(), false);
  assert.equal(commands.overhead(), false);
  commands.destroy();
  assert.equal(commands.oblique(), false);
});

function displayNodes() {
  class Node extends EventTarget {
    disabled = false;
    hidden = false;
    checked = false;
    value = "0";
    textContent = "";
    attributes = {};
    focused = 0;
    setAttribute(name, value) {
      this.attributes[name] = value;
    }
    focus() {
      this.focused++;
    }
  }
  return Object.fromEntries(
    [
      "overhead",
      "oblique",
      "save",
      "restore",
      "cameraStatus",
      "clean",
      "sharpen",
      "sharpenIntensity",
      "bloom",
      "bloomIntensity",
      "effectStatus",
      "style",
    ].map((name) => [name, new Node()]),
  );
}

test("clean view retains a focused restore control and abort restores visibility and listeners", async () => {
  const { installDisplayControls } = await load("display-controls");
  assert.equal(typeof installDisplayControls, "function");
  const nodes = displayNodes();
  const overlays = [{ hidden: false }, { hidden: true }];
  const abort = new AbortController();
  let views = 0;
  const release = installDisplayControls({
    viewer: {
      camera: {
        heading: 0,
        cancelFlight() {},
        setView() {
          views++;
        },
      },
      scene: { requestRender() {} },
    },
    effects: {},
    nodes,
    overlays,
    signal: abort.signal,
  });
  nodes.clean.dispatchEvent(new Event("click"));
  assert.deepEqual(
    overlays.map((n) => n.hidden),
    [true, true],
  );
  assert.equal(nodes.clean.hidden, false);
  assert.equal(nodes.clean.attributes["aria-pressed"], "true");
  assert.match(nodes.clean.textContent, /恢复/);
  assert.equal(nodes.clean.focused, 1);
  nodes.clean.dispatchEvent(new Event("click"));
  assert.deepEqual(
    overlays.map((n) => n.hidden),
    [false, true],
  );
  nodes.clean.dispatchEvent(new Event("click"));
  abort.abort();
  assert.deepEqual(
    overlays.map((n) => n.hidden),
    [false, true],
  );
  nodes.overhead.dispatchEvent(new Event("click"));
  nodes.clean.dispatchEvent(new Event("click"));
  assert.equal(views, 0);
  assert.equal(nodes.clean.attributes["aria-pressed"], "false");
  release();
});

test("display effect errors clear owned resources and reset visible controls", async () => {
  const { installDisplayControls } = await load("display-controls");
  assert.equal(typeof installDisplayControls, "function");
  const nodes = displayNodes();
  let clears = 0;
  const release = installDisplayControls({
    viewer: {},
    overlays: [],
    nodes,
    effects: {
      setSharpenEnabled() {
        throw new Error("GPU unavailable");
      },
      clear() {
        clears++;
      },
    },
  });
  nodes.sharpen.checked = true;
  nodes.bloom.checked = true;
  nodes.style.value = "noir";
  nodes.sharpen.dispatchEvent(new Event("change"));
  assert.equal(clears, 1);
  assert.equal(nodes.sharpen.checked, false);
  assert.equal(nodes.bloom.checked, false);
  assert.equal(nodes.style.value, "normal");
  assert.match(nodes.effectStatus.textContent, /恢复/);
  release();
});

function postProcessProbe() {
  const stages = [],
    created = [];
  const bloom = {
    enabled: true,
    uniforms: {
      glowOnly: true,
      contrast: 7,
      brightness: 8,
      delta: 9,
      sigma: 10,
      stepSize: 11,
      untouched: 12,
    },
  };
  const original = structuredClone(bloom);
  let renders = 0;
  const viewer = {
    scene: {
      requestRender() {
        renders++;
      },
      postProcessStages: {
        bloom,
        add(stage) {
          stages.push(stage);
        },
        remove(stage) {
          const i = stages.indexOf(stage);
          if (i === -1) return false;
          stages.splice(i, 1);
          stage.destroy();
          return true;
        },
      },
    },
  };
  const createStage = (options) => {
    let dead = false;
    const stage = {
      ...options,
      isDestroyed: () => dead,
      destroy() {
        assert.equal(dead, false);
        dead = true;
      },
    };
    created.push(stage);
    return stage;
  };
  return {
    viewer,
    bloom,
    original,
    stages,
    created,
    createStage,
    renders: () => renders,
  };
}

test("sharpen and bloom clamp finite controls and restore borrowed bloom on repeated disable", async () => {
  const { createStaticVisualEffects } = await loadStaticEffects();
  const p = postProcessProbe();
  const owner = createStaticVisualEffects(p);
  assert.equal(typeof owner.setSharpenEnabled, "function");
  assert.equal(owner.setSharpenIntensity(2), 1);
  assert.equal(owner.setBloomIntensity(300), 200);
  assert.equal(p.stages.length, 0);
  assert.equal(p.renders(), 0);
  owner.setStyle("noir");
  const styleCount = p.stages.length;
  for (let i = 0; i < 3; i++) {
    owner.setSharpenEnabled(true);
    owner.setBloomEnabled(true);
    assert.equal(p.stages.length, styleCount + 1);
    assert.equal(
      p.stages.find((s) => s.name.endsWith("sharpen")).uniforms.amount,
      2.1,
    );
    assert.equal(p.bloom.enabled, true);
    assert.equal(owner.setSharpenIntensity(NaN), 0.49);
    assert.equal(owner.setBloomIntensity(Infinity), 0);
    assert.equal(p.bloom.enabled, false);
    assert.equal(owner.setSharpenIntensity(-2), 0);
    assert.equal(owner.setBloomIntensity(-2), 0);
    owner.setSharpenIntensity(1);
    owner.setBloomIntensity(200);
    owner.setStyle("normal");
    assert.equal(
      p.stages.find((s) => s.name.endsWith("sharpen")).enabled,
      true,
    );
    owner.setSharpenEnabled(false);
    owner.setBloomEnabled(false);
    assert.deepEqual(p.bloom, p.original);
    assert.equal(p.stages.length, 0);
    owner.setStyle("noir");
  }
  owner.setBloomEnabled(true);
  owner.destroy();
  assert.deepEqual(p.bloom, p.original);
  assert.equal(p.stages.length, 0);
  assert.ok(p.created.every((s) => s.isDestroyed()));
  assert.equal(owner.setBloomEnabled(true), false);
  assert.equal(owner.setSharpenIntensity(1), false);
});

test("post-process initialization failures roll back borrowed bloom and partial stages", async () => {
  const { createStaticVisualEffects } = await loadStaticEffects();
  for (const phase of ["construct", "add"]) {
    const p = postProcessProbe();
    const owner = createStaticVisualEffects({
      ...p,
      createStage(options) {
        if (phase === "construct") throw new Error("construct failed");
        return p.createStage(options);
      },
    });
    if (phase === "add")
      p.viewer.scene.postProcessStages.add = () => {
        throw new Error("add failed");
      };
    assert.equal(typeof owner.setBloomEnabled, "function");
    assert.throws(() => owner.setBloomEnabled(true), /failed/);
    assert.deepEqual(p.bloom, p.original);
    assert.equal(p.stages.length, 0);
    assert.ok(p.created.every((s) => s.isDestroyed()));
    owner.clear();
    owner.destroy();
  }
});

test("camera and bounded effects have labeled markup with an independent clean-view restore", async () => {
  const { readFile } = await import("node:fs/promises");
  const html = await readFile(
    new URL("../public/frame.html", import.meta.url),
    "utf8",
  );
  const css = await readFile(
    new URL("../public/frame.css", import.meta.url),
    "utf8",
  );
  for (const id of [
    "overhead",
    "oblique",
    "save-view",
    "restore-view",
    "clean-view",
    "sharpen",
    "bloom",
  ])
    assert.ok(html.includes(`id="${id}"`), id);
  assert.match(
    html,
    /<input[\s\S]*?id="sharpen-intensity"[\s\S]*?min="0"[\s\S]*?max="1"/,
  );
  assert.match(
    html,
    /<input[\s\S]*?id="bloom-intensity"[\s\S]*?min="0"[\s\S]*?max="200"/,
  );
  for (const id of ["sharpen-intensity", "bloom-intensity"])
    assert.ok(html.includes(`for="${id}"`));
  assert.match(
    html,
    /<\/aside>\s*<button[^>]*id="clean-view"[^>]*aria-pressed="false"/,
  );
  assert.match(css, /\[hidden\]\s*\{\s*display:\s*none/);
});

test("effect status reflects enabled controls when a style or inactive slider changes", async () => {
  const { installDisplayControls, updateVisualEffectStatus } =
    await load("display-controls");
  const nodes = displayNodes();
  nodes.style.value = "normal";
  const release = installDisplayControls({
    viewer: {},
    overlays: [],
    nodes,
    effects: { setSharpenIntensity: (x) => x, setSharpenEnabled() {} },
  });
  nodes.sharpenIntensity.dispatchEvent(new Event("input"));
  assert.match(nodes.effectStatus.textContent, /原始画面/);
  nodes.sharpen.checked = true;
  nodes.sharpen.dispatchEvent(new Event("change"));
  assert.match(nodes.effectStatus.textContent, /静态/);
  assert.equal(typeof updateVisualEffectStatus, "function");
  updateVisualEffectStatus(nodes);
  assert.doesNotMatch(nodes.effectStatus.textContent, /原始画面/);
  nodes.sharpen.checked = false;
  updateVisualEffectStatus(nodes);
  assert.match(nodes.effectStatus.textContent, /原始画面/);
  release();
});

test("pre-aborted startup releases the outer listener without acquiring a viewer", () =>
  terminalGlobeProbe(false, true));

test("saved world pose round-trips through the installed Cesium Camera without WebGL", async () => {
  const { Camera, GeographicProjection, Ellipsoid, Cartesian3, SceneMode } =
    await import("cesium");
  const { createCameraCommands } = await load("camera-controls");
  const camera = new Camera({
    drawingBufferWidth: 1000,
    drawingBufferHeight: 800,
    mapProjection: new GeographicProjection(Ellipsoid.WGS84),
    mode: SceneMode.SCENE3D,
  });
  camera.setView({
    destination: Cartesian3.fromDegrees(42, 24, 250000),
    orientation: { heading: 0.4, pitch: -0.7, roll: 0.2 },
  });
  const original = [camera.positionWC, camera.directionWC, camera.upWC].map(
    (v) => Cartesian3.clone(v),
  );
  let renders = 0;
  const commands = createCameraCommands({
    viewer: {
      camera,
      scene: {
        requestRender() {
          renders++;
        },
      },
    },
  });
  assert.equal(commands.save(), true);
  assert.equal(commands.overhead(), true);
  assert.ok(Math.abs(camera.pitch + Math.PI / 2) < 1e-12);
  assert.equal(commands.oblique(), true);
  assert.equal(commands.restore(), true);
  assert.ok(Cartesian3.distance(camera.positionWC, original[0]) < 1e-6);
  assert.ok(Cartesian3.distance(camera.directionWC, original[1]) < 1e-12);
  assert.ok(Cartesian3.distance(camera.upWC, original[2]) < 1e-12);
  assert.equal(renders, 3);
  commands.destroy();
});

test("oblique view keeps a center-ray ground hit from global and city altitudes", async () => {
  const {
    Camera,
    GeographicProjection,
    Ellipsoid,
    Cartesian3,
    SceneMode,
    Ray,
    IntersectionTests,
    Matrix4,
  } = await import("cesium");
  const { createCameraCommands } = await load("camera-controls");
  for (const [height, pitch] of [
    [28000000, -Math.PI / 2],
    [220000, -Math.PI / 2],
    [500, Math.PI / 4],
  ]) {
    const camera = new Camera({
      drawingBufferWidth: 1000,
      drawingBufferHeight: 800,
      mapProjection: new GeographicProjection(Ellipsoid.WGS84),
      mode: SceneMode.SCENE3D,
    });
    camera.setView({
      destination: Cartesian3.fromDegrees(108, 24, height),
      orientation: { heading: 0.4, pitch, roll: 0 },
    });
    const hitBefore = IntersectionTests.rayEllipsoid(
      new Ray(camera.positionWC, camera.directionWC),
      Ellipsoid.WGS84,
    );
    const target = hitBefore
      ? Ray.getPoint(
          new Ray(camera.positionWC, camera.directionWC),
          hitBefore.start,
        )
      : Ellipsoid.WGS84.scaleToGeodeticSurface(camera.positionWC);
    const commands = createCameraCommands({
      viewer: { camera, scene: { requestRender() {} } },
    });
    assert.equal(commands.oblique(), true);
    const hitAfter = IntersectionTests.rayEllipsoid(
      new Ray(camera.positionWC, camera.directionWC),
      Ellipsoid.WGS84,
    );
    assert.ok(hitAfter, `oblique must show ground at height ${height}`);
    const viewedTarget = Ray.getPoint(
      new Ray(camera.positionWC, camera.directionWC),
      hitAfter.start,
    );
    assert.ok(
      Cartesian3.distance(viewedTarget, target) < 1e-6,
      "current ground target is preserved",
    );
    const normal = Ellipsoid.WGS84.geodeticSurfaceNormal(target);
    assert.ok(
      Math.abs(Cartesian3.dot(camera.directionWC, normal) + Math.SQRT1_2) <
        1e-12,
      "45-degree oblique angle is relative to the target's tangent plane",
    );
    assert.ok(Cartesian3.distance(camera.positionWC, target) <= 2000000.000001);
    assert.ok(Cartesian3.distance(camera.positionWC, target) >= 999.999999);
    assert.ok(
      Matrix4.equals(camera.transform, Matrix4.IDENTITY),
      "normal globe navigation retains its world reference frame",
    );
    commands.destroy();
  }
});
