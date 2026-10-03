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
  const { installLocalSceneControls } = await load("local-scene-controls");
  const { createLocalGeometry } = await load("local-geometry");
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
      this.checked = false;
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
    "local-lat",
    "local-lon",
    "local-label",
    "local-kind",
    "local-add",
    "local-pick",
    "local-cancel",
    "local-clear",
    "local-status",
    "local-list",
    "scene-input",
    "scene-file",
    "scene-import",
    "scene-export",
    "scene-output",
    "scene-select",
  ];
  const nodes = Object.fromEntries(ids.map((id) => [id, new FakeNode()]));
  const dynamic = [],
    errors = new Set(),
    localHandlers = [],
    localCollections = [];
  let resolveFetch,
    requestSignal,
    disposed = false,
    renderRequests = 0;
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
      positionCartographic: { height: 1000, longitude: 0, latitude: 0 },
      pitch: -1.5,
      roll: 0,
      heading: 0,
      positionWC: { x: 6379000, y: 12, z: 34 },
      directionWC: { x: -1, y: 0, z: 0 },
      upWC: { x: 0, y: 0, z: 1 },
    },
    canvas: {},
    imageryLayers: { add() {}, remove() {} },
    scene: {
      postProcessStages: post.viewer.scene.postProcessStages,
      requestRender() {
        renderRequests++;
      },
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
    installLocalSceneControls(options) {
      for (const node of Object.values(options.nodes))
        node.ownerDocument = { createElement: (tag) => new FakeNode(tag) };
      return installLocalSceneControls({
        ...options,
        capture: () => JSON.parse(JSON.stringify(options.capture())),
        createGeometry: (settings) =>
          createLocalGeometry({
            ...settings,
            createCollection: () => {
              const collection = {
                add() {},
                removeAll() {},
                destroy() {
                  this.dead = true;
                },
              };
              localCollections.push(collection);
              return collection;
            },
            createHandler: () => {
              const handler = {
                setInputAction() {},
                destroy() {
                  this.dead = true;
                },
              };
              localHandlers.push(handler);
              return handler;
            },
          }),
      });
    },
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
    assert.equal(typeof nodes["local-add"].listeners.click, "function");
    assert.equal(typeof nodes["scene-import"].listeners.click, "function");
    assert.equal(typeof nodes.overhead.listeners.click, "function");
    const validScene = {
      version: 1,
      camera: {
        lon: 123,
        lat: 47,
        height: 200000,
        heading: 0,
        pitch: -1.5,
        roll: 0,
      },
      map: "earth",
      style: {
        name: "normal",
        sharpen: false,
        sharpenIntensity: 0.49,
        bloom: false,
        bloomIntensity: 0,
      },
      annotations: [],
      measurement: [],
    };
    const previousRenders = renderRequests;
    nodes["scene-input"].value = JSON.stringify({ ...validScene, url: "bad" });
    nodes["scene-import"].listeners.click();
    assert.equal(renderRequests, previousRenders);
    nodes["scene-input"].value = JSON.stringify(validScene);
    nodes["scene-import"].listeners.click();
    assert.equal(renderRequests, previousRenders + 1);
    assert.equal(nodes["map-style"].value, "earth");
    nodes["scene-export"].listeners.click();
    assert.equal(JSON.parse(nodes["scene-output"].value).version, 1);
    nodes["save-view"].listeners.click();
    assert.equal(nodes["restore-view"].disabled, false);
    nodes.sharpen.checked = true;
    nodes.sharpen.listeners.change();
    nodes.bloom.checked = true;
    nodes.bloom.listeners.change();
    assert.equal(post.stages.length, 1);
    nodes["local-label"].value = "Selected point";
    nodes["local-kind"].value = "annotation";
    nodes["local-pick"].listeners.click();
    assert.equal(localHandlers.length, 1);
    assert.equal(localHandlers[0].dead, undefined);
    const pending = nodes.refresh.listeners.click();
    triggerFailure();
    assert.equal(localHandlers[0].dead, true);
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
  assert.equal(localCollections.length, 3);
  assert.ok(localCollections.every((collection) => collection.dead));
  assert.equal(nodes["scene-input"].value, "");
  assert.equal(nodes["scene-output"].value, "");
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

import { Cartographic, Ellipsoid } from "@cesium/engine";
const codec = await import("../src/scene-state.js").catch(() => ({}));
const geometry = await import("../src/local-geometry.js").catch(() => ({}));
const scene = () => ({
  version: 1,
  camera: {
    lon: 123,
    lat: 47,
    height: 200000,
    heading: 0,
    pitch: -1.5,
    roll: 0,
  },
  map: "earth",
  style: {
    name: "normal",
    sharpen: false,
    sharpenIntensity: 0.49,
    bloom: false,
    bloomIntensity: 0,
  },
  annotations: [{ lon: 123, lat: 47, label: "Local point" }],
  measurement: [
    { lon: 0, lat: 0 },
    { lon: 1, lat: 0 },
  ],
});
const required = (module, name) => {
  assert.equal(typeof module[name], "function", `${name} must be implemented`);
  return module[name];
};

test("scene round trip is a copied whitelist with bounded finite geometry", () => {
  const encode = required(codec, "exportScene"),
    decode = required(codec, "parseScene");
  const source = {
    ...scene(),
    session: { secret: "sentinel" },
    events: ["USGS"],
    url: "https://example.test",
  };
  const exported = encode(source);
  assert.ok(!/sentinel|session|events|url|USGS/.test(exported));
  assert.deepEqual(decode(exported), scene());
  const copy = decode(exported);
  copy.annotations[0].label = "changed";
  assert.equal(source.annotations[0].label, "Local point");
});

test("scene rejects malformed oversized unknown prototype and partial state", () => {
  const parse = required(codec, "parseScene");
  const base = scene();
  for (const text of [
    "{",
    " ".repeat(65537),
    '"' + "界".repeat(22000) + '"',
    JSON.stringify({ ...base, version: 2 }),
    JSON.stringify({ ...base, url: "https://example.test" }),
    JSON.stringify({ ...base, camera: { ...base.camera, height: null } }),
    JSON.stringify({ ...base, style: { ...base.style, constructor: "x" } }),
    JSON.stringify({
      ...base,
      annotations: [{ lon: 1, lat: 2, label: "x", html: "x" }],
    }),
    JSON.stringify({
      ...base,
      annotations: Array(51).fill(base.annotations[0]),
    }),
    JSON.stringify({ ...base, measurement: Array(3).fill({ lon: 0, lat: 0 }) }),
    JSON.stringify({
      ...base,
      annotations: [{ lon: 181, lat: 0, label: "x" }],
    }),
    JSON.stringify({
      ...base,
      annotations: [{ lon: 0, lat: 0, label: "x".repeat(81) }],
    }),
    JSON.stringify({
      ...base,
      annotations: [{ lon: 0, lat: 0, label: "<b>unsafe</b>" }],
    }),
    '{"__proto__":{},' + JSON.stringify(base).slice(1),
  ]) {
    assert.throws(() => parse(text));
    assert.deepEqual(base, scene());
  }
});

test("WGS84 ellipsoid estimate matches equatorial one degree and zero distance", () => {
  const measure = required(geometry, "measureSurface");
  assert.ok(
    Math.abs(
      measure({ lon: 0, lat: 0 }, { lon: 1, lat: 0 }).distance - 111319.490793,
    ) < 0.01,
  );
  assert.equal(
    measure({ lon: 123, lat: 47 }, { lon: 123, lat: 47 }).distance,
    0,
  );
  assert.ok(
    Math.abs(
      measure({ lon: 179.5, lat: 0 }, { lon: -179.5, lat: 0 }).distance -
        111319.490793,
    ) < 0.01,
  );
  for (const point of [
    { lon: Infinity, lat: 0 },
    { lon: 0, lat: NaN },
    { lon: 0, lat: 91 },
    { lon: "0", lat: 0 },
  ])
    assert.throws(() => measure(point, { lon: 1, lat: 0 }));
});

function probe() {
  const collections = [],
    handlers = [];
  let renders = 0,
    destroyed = false;
  const viewer = {
    isDestroyed: () => destroyed,
    canvas: {},
    camera: {
      pickEllipsoid: () =>
        Ellipsoid.WGS84.cartographicToCartesian(
          Cartographic.fromDegrees(10, 20),
        ),
    },
    scene: {
      requestRender() {
        renders++;
      },
      primitives: {
        add(v) {
          collections.push(v);
          return v;
        },
        remove(v) {
          const index = collections.indexOf(v);
          if (index < 0) return false;
          collections.splice(index, 1);
          v.destroy();
          return true;
        },
      },
    },
  };
  const createCollection = () => ({
    values: [],
    add(value) {
      this.values.push(value);
      return value;
    },
    removeAll() {
      this.values = [];
    },
    destroy() {
      this.dead = true;
    },
  });
  const createHandler = () => {
    const handler = {
      setInputAction(fn) {
        this.click = fn;
      },
      destroy() {
        this.dead = true;
      },
    };
    handlers.push(handler);
    return handler;
  };
  return {
    viewer,
    collections,
    handlers,
    createCollection,
    createHandler,
    createLineMaterial: () => ({}),
    renders: () => renders,
    stop: () => {
      destroyed = true;
    },
  };
}

test("manual geometry owns bounded positions one render and handler cleanup", () => {
  const create = required(geometry, "createLocalGeometry");
  const p = probe(),
    controller = new AbortController();
  const local = create({ ...p, signal: controller.signal });
  assert.equal(p.handlers.length, 0);
  const annotations = Array.from({ length: 50 }, (_, i) => ({
    lon: i,
    lat: 20,
    label: `Point ${i}`,
  }));
  local.replace({ annotations, measurement: scene().measurement });
  assert.equal(p.renders(), 1);
  assert.ok(
    p.collections
      .flatMap((c) => c.values)
      .reduce((n, v) => n + (v.positions?.length || 1), 0) <= 200,
  );
  assert.throws(() => local.addAnnotation({ lon: 0, lat: 0, label: "51" }));
  assert.equal(p.renders(), 1);
  local.beginPick("annotation", "Selected");
  assert.equal(p.handlers.length, 1);
  local.cancelPick();
  assert.equal(p.handlers[0].dead, true);
  local.clear();
  local.beginPick("annotation", "Chosen");
  p.handlers[1].click({ position: {} });
  assert.equal(local.snapshot().annotations[0].label, "Chosen");
  assert.equal(p.renders(), 3);
  assert.equal(p.handlers[1].dead, true);
  local.beginPick("measurement");
  controller.abort();
  assert.equal(p.handlers[2].dead, true);
  assert.equal(p.collections.length, 0);
  local.destroy();
  assert.throws(() => local.clear());
});

test("invalid replacements preserve geometry through repeated scene and clear cycles", () => {
  const create = required(geometry, "createLocalGeometry"),
    parse = required(codec, "parseScene");
  const p = probe(),
    local = create(p);
  for (let i = 0; i < 10; i++) {
    const valid = parse(JSON.stringify(scene()));
    local.replace(valid);
    const before = local.snapshot(),
      renders = p.renders();
    assert.throws(() =>
      local.replace({
        annotations: [...valid.annotations, { lon: NaN, lat: 2, label: "bad" }],
        measurement: [],
      }),
    );
    assert.deepEqual(local.snapshot(), before);
    assert.equal(p.renders(), renders);
    assert.throws(() =>
      parse(
        JSON.stringify({ ...scene(), camera: { ...scene().camera, lat: 91 } }),
      ),
    );
    assert.deepEqual(local.snapshot(), before);
    local.clear();
    assert.deepEqual(local.snapshot(), { annotations: [], measurement: [] });
  }
  local.destroy();
  assert.equal(p.collections.length, 0);
});

const controlsModule = await import("../src/local-scene-controls.js").catch(
  () => ({}),
);
async function controlsProbe() {
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM("<body></body>"),
    doc = dom.window.document;
  const nodes = Object.fromEntries(
    [
      "lat",
      "lon",
      "label",
      "kind",
      "add",
      "pick",
      "cancel",
      "clear",
      "status",
      "list",
      "input",
      "file",
      "import",
      "export",
      "output",
      "select",
    ].map((key) => {
      const node = doc.createElement(
        key === "list"
          ? "ol"
          : key === "input" || key === "output"
            ? "textarea"
            : ["lat", "lon", "label", "kind", "file"].includes(key)
              ? "input"
              : "button",
      );
      doc.body.append(node);
      return [key, node];
    }),
  );
  nodes.lat.value = "47";
  nodes.lon.value = "123";
  nodes.label.value = "My point";
  nodes.kind.value = "annotation";
  const p = probe(),
    signal = new AbortController();
  let applied = 0;
  const install = required(controlsModule, "installLocalSceneControls");
  const release = install({
    viewer: p.viewer,
    signal: signal.signal,
    nodes,
    capture: () => scene(),
    apply(value, local) {
      applied++;
      local.replace(value);
    },
    createGeometry: (options) =>
      geometry.createLocalGeometry({ ...p, ...options }),
  });
  return { ...p, dom, nodes, signal, release, applied: () => applied };
}
test("scene controls preserve state on invalid import and refuse oversized files before read", async () => {
  const p = await controlsProbe();
  p.nodes.add.click();
  assert.equal(p.nodes.list.children.length, 1);
  p.nodes.input.value = JSON.stringify({ ...scene(), url: "bad" });
  p.nodes.import.click();
  assert.equal(p.applied(), 0);
  assert.equal(p.nodes.list.children.length, 1);
  let reads = 0;
  Object.defineProperty(p.nodes.file, "files", {
    configurable: true,
    value: [
      {
        size: 65537,
        text() {
          reads++;
        },
      },
    ],
  });
  p.nodes.file.dispatchEvent(new p.dom.window.Event("change"));
  await Promise.resolve();
  assert.equal(reads, 0);
  assert.equal(p.applied(), 0);
  p.nodes.input.value = JSON.stringify(scene());
  p.nodes.import.click();
  assert.equal(p.applied(), 1);
  p.nodes.export.click();
  assert.equal(
    JSON.parse(p.nodes.output.value).annotations[0].label,
    "Local point",
  );
  p.nodes.clear.click();
  assert.equal(p.nodes.list.children.length, 0);
  assert.equal(p.nodes.output.value, "");
  p.signal.abort();
  assert.equal(p.collections.length, 0);
  p.nodes.add.click();
  assert.equal(p.nodes.list.children.length, 0);
  p.release();
});
test("pending file import cannot revive a cleared or destroyed scene", async () => {
  const p = await controlsProbe();
  let resolve;
  Object.defineProperty(p.nodes.file, "files", {
    value: [
      {
        size: 100,
        text: () =>
          new Promise((r) => {
            resolve = r;
          }),
      },
    ],
  });
  p.nodes.file.dispatchEvent(new p.dom.window.Event("change"));
  p.nodes.clear.click();
  resolve(JSON.stringify(scene()));
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(p.applied(), 0);
  p.nodes.file.dispatchEvent(new p.dom.window.Event("change"));
  p.signal.abort();
  resolve(JSON.stringify(scene()));
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(p.applied(), 0);
});
test("render batching makes multiple effect edits request only one frame", async () => {
  const { createStaticVisualEffects } =
    await import("../src/static-effects.js");
  let renders = 0;
  const effects = createStaticVisualEffects({
    viewer: {
      isDestroyed: () => false,
      scene: {
        requestRender() {
          renders++;
        },
      },
    },
  });
  assert.equal(
    typeof effects.batch,
    "function",
    "scene application needs an effect render batch",
  );
  effects.batch(() => {
    effects.setStyle("normal");
    effects.setSharpenEnabled(false);
    effects.setBloomEnabled(false);
  });
  assert.equal(renders, 1);
  effects.destroy();
});

test("geometry acquisition failure releases attached and unattached collections", () => {
  for (const failing of [1, 2, 3]) {
    const p = probe(),
      acquired = [];
    let adds = 0;
    p.viewer.scene.primitives.add = (collection) => {
      if (++adds === failing) throw new Error("insert failed");
      p.collections.push(collection);
      return collection;
    };
    assert.throws(
      () =>
        geometry.createLocalGeometry({
          ...p,
          createCollection: () => {
            const c = p.createCollection();
            acquired.push(c);
            return c;
          },
        }),
      /insert failed/,
    );
    assert.equal(p.collections.length, 0);
    assert.ok(acquired.every((c) => c.dead));
  }
});
test("geometry rejects near-antipodal measurement before changing valid positions", () => {
  const p = probe(),
    local = geometry.createLocalGeometry(p);
  local.replace(scene());
  const before = local.snapshot(),
    renders = p.renders();
  assert.throws(
    () =>
      local.replace({
        annotations: [],
        measurement: [
          { lon: 0, lat: 0 },
          { lon: 180, lat: 0 },
        ],
      }),
    /对跖/,
  );
  assert.deepEqual(local.snapshot(), before);
  assert.equal(p.renders(), renders);
  local.destroy();
});

test("scene size limit counts UTF-8 bytes before JSON or field validation", () => {
  const multibyte = JSON.stringify({
    ...scene(),
    annotations: [{ lon: 0, lat: 0, label: "界".repeat(22000) }],
  });
  assert.ok(multibyte.length < 65536);
  assert.throws(() => codec.parseScene(multibyte), /64 KiB/);
  assert.deepEqual(
    codec.parseScene(JSON.stringify(scene()).padEnd(65536, " ")),
    scene(),
  );
  assert.throws(
    () => codec.parseScene(JSON.stringify(scene()).padEnd(65537, " ")),
    /64 KiB/,
  );
});

test("cancelled globe selection callbacks cannot mutate local state", () => {
  const p = probe(),
    local = geometry.createLocalGeometry(p);
  local.beginPick("annotation", "Stale");
  const stale = p.handlers[0].click;
  local.cancelPick();
  stale({ position: {} });
  assert.deepEqual(local.snapshot(), { annotations: [], measurement: [] });
  assert.equal(p.renders(), 0);
  local.destroy();
});
test("choosing an import file cancels globe placement and later manual edits invalidate its result", async () => {
  const p = await controlsProbe();
  let resolve;
  p.nodes.pick.click();
  const stale = p.handlers[0].click;
  Object.defineProperty(p.nodes.file, "files", {
    value: [
      {
        size: 100,
        text: () =>
          new Promise((r) => {
            resolve = r;
          }),
      },
    ],
  });
  p.nodes.file.dispatchEvent(new p.dom.window.Event("change"));
  assert.equal(p.handlers[0].dead, true);
  stale({ position: {} });
  assert.equal(p.nodes.list.children.length, 0);
  p.nodes.add.click();
  assert.equal(p.nodes.list.children.length, 1);
  resolve(JSON.stringify({ ...scene(), annotations: [] }));
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(p.applied(), 0);
  assert.equal(p.nodes.list.children.length, 1);
  p.release();
});

test("sampled measurement chords remain above the WGS84 ellipsoid", async () => {
  const { Cartesian3 } = await import("@cesium/engine");
  for (const latitude of [80, 89]) {
    const { positions } = geometry.measureSurface(
      { lon: 0, lat: -latitude },
      { lon: 0, lat: latitude },
    );
    for (let index = 1; index < positions.length; index++) {
      const midpoint = Cartesian3.midpoint(
        positions[index - 1],
        positions[index],
        new Cartesian3(),
      );
      assert.ok(
        Cartographic.fromCartesian(midpoint, Ellipsoid.WGS84).height >= 0,
      );
    }
  }
});

import "./ion-regressions.mjs";
