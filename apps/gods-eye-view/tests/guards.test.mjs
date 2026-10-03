import test from "node:test";
import assert from "node:assert/strict";
const load = (name) => import(`../src/${name}.js`).catch(() => ({}));
async function terminalGlobeProbe(failDuringStartup) {
  const { readFile } = await import("node:fs/promises");
  const vm = await import("node:vm");
  const { createApplication } =
    await import("../vendor/src/app/application.js");
  const { installRenderFailureHandler } = await load("render-errors");
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
    },
    canvas: {},
    imageryLayers: { add() {}, remove() {} },
    scene: {
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
    createStaticVisualEffects: () => ({
      clear() {},
      destroy() {},
      setStyle() {},
    }),
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
  await context.startGlobe(new AbortController().signal);
  if (!failDuringStartup) {
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
