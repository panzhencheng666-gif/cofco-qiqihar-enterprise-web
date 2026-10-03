import test from "node:test";
import assert from "node:assert/strict";
const load = (name) => import(`../src/${name}.js`).catch(() => ({}));
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
