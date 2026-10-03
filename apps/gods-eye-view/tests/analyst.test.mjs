import test from "node:test";
import assert from "node:assert/strict";
const load = () => import("../src/earthquake-analyst.js").catch(() => ({}));
const stamp = "2026-10-03T00:00:00.000Z";
const rows = [
  {
    stableId: "a",
    mag: 3,
    depthKm: 12,
    lat: 0,
    lon: 0,
    time: 1,
    place: "<img> Alaska",
  },
  {
    stableId: "b",
    mag: 5,
    depthKm: null,
    lat: 1,
    lon: 1,
    time: 2,
    place: "Alaska",
  },
  {
    stableId: "c",
    mag: 4,
    depthKm: 70,
    lat: 50,
    lon: 50,
    time: 3,
    place: "Japan",
  },
];
const snapshot = () => ({
  rows: rows.map((r) => ({ ...r })),
  fetchedAt: stamp,
  sourceAt: stamp,
  totalMatched: 3,
  sourceFeatures: 3,
});
async function probe(
  fetchSnapshot = async () => snapshot(),
  stage = async () => ({ commit() {}, dispose() {} }),
) {
  const { createEarthquakeAnalyst } = await load();
  assert.equal(typeof createEarthquakeAnalyst, "function");
  let draws = 0;
  const states = [];
  const controller = createEarthquakeAnalyst({
    fetchSnapshot,
    stage,
    onState: (s) => states.push(s),
    requestRender: () => ++draws,
    now: () => Date.parse(stamp),
  });
  return {
    controller,
    states,
    get draws() {
      return draws;
    },
  };
}
test("actual upstream engine counts and ranks loaded magnitude, excludes unknown depths, and filters plain place", async () => {
  const p = await probe();
  await p.controller.refresh();
  assert.equal(p.controller.state().result.count, 3);
  assert.equal(p.controller.state().result.items[0].id, "b");
  await p.controller.query({ sort: "depth-asc" });
  assert.deepEqual(
    p.controller.state().result.items.map((r) => r.id),
    ["a", "c"],
  );
  await p.controller.query({ place: "alaska", minMagnitude: 4 });
  assert.equal(p.controller.state().result.count, 1);
  assert.equal(p.controller.state().result.items[0].id, "b");
  assert.equal(p.draws, 3);
});
test("filters admit only bounded controls and explicit radius, with no region lookup or additional source request", async () => {
  let fetches = 0;
  const p = await probe(async () => {
    fetches++;
    return snapshot();
  });
  await p.controller.refresh();
  await p.controller.query({ scope: "radius", lat: 0, lon: 0, km: 100 });
  assert.equal(p.controller.state().result.count, 1);
  assert.equal(fetches, 1);
  await assert.rejects(p.controller.query({ scope: "region", name: "Alaska" }));
  await assert.rejects(
    p.controller.query({
      minMagnitude: "",
      scope: "radius",
      lat: 90,
      lon: 180,
      km: 0,
    }),
  );
  await assert.rejects(p.controller.query({ layers: ["flights"] }));
});
test("refresh failure retains entire selected snapshot and stamps analyst stale provenance without fetch on query", async () => {
  let fail = false;
  const p = await probe(async () => {
    if (fail) throw new Error("offline");
    return snapshot();
  });
  await p.controller.refresh();
  p.controller.select("a");
  const original = p.controller.state().snapshot;
  fail = true;
  await p.controller.refresh();
  assert.equal(p.controller.state().snapshot, original);
  assert.equal(p.controller.state().selected.stableId, "a");
  await p.controller.query({});
  assert.equal(
    p.controller.state().result.coverage.feedProvenance.overall,
    "stale",
  );
  assert.equal(p.controller.state().selected.place, "<img> Alaska");
});
test("clear and abort prevent a late source or staged async query from reviving disposed targets", async () => {
  let resolve;
  const p = await probe(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const pending = p.controller.refresh();
  p.controller.clear();
  resolve(snapshot());
  await pending;
  assert.equal(p.controller.state().snapshot, null);
  assert.equal(p.controller.state().selected, null);
  let finish;
  let disposed = 0;
  const q = await probe(
    async () => snapshot(),
    () =>
      new Promise((r) => {
        finish = () =>
          r({
            commit() {
              assert.fail("late commit");
            },
            dispose() {
              disposed++;
            },
          });
      }),
  );
  const next = q.controller.refresh();
  await new Promise((r) => setImmediate(r));
  q.controller.destroy();
  finish();
  await next;
  assert.equal(disposed, 1);
  assert.equal(q.controller.state().snapshot, null);
});
test("Nth candidate acquisition failure preserves full snapshot and selection; commit failure is terminal disposal", async () => {
  let fail = false,
    commitFail = false,
    disposed = 0;
  const p = await probe(
    async () => snapshot(),
    async () => {
      if (fail) throw new Error("Nth insertion");
      return {
        commit() {
          if (commitFail) throw new Error("mount");
        },
        dispose() {
          disposed++;
        },
      };
    },
  );
  await p.controller.refresh();
  p.controller.select("b");
  const original = p.controller.state().snapshot;
  fail = true;
  await p.controller.refresh();
  assert.equal(p.controller.state().snapshot, original);
  assert.equal(p.controller.state().selected.stableId, "b");
  fail = false;
  commitFail = true;
  await p.controller.refresh();
  assert.equal(p.controller.state().snapshot, null);
  assert.equal(p.controller.state().stopped, true);
  assert.ok(disposed >= 2);
});
const feature = (id = "x", changes = {}) => ({
  id,
  geometry: { type: "Point", coordinates: [0, 0, null] },
  properties: { mag: 3, time: 1, place: "USGS test", ...changes },
});
async function fetchPayload(payload) {
  const { fetchEarthquakes } = await import("../src/earthquakes.js");
  return fetchEarthquakes({
    fetchImpl: async () => new Response(JSON.stringify(payload)),
  });
}
test("actual source validates the whole bounded payload, source UTC, duplicate identities and unknown depth", async () => {
  const result = await fetchPayload({
    metadata: { generated: 1 },
    features: [feature("a"), feature("b", { mag: 2 })],
  });
  assert.equal(result.sourceAt, "1970-01-01T00:00:00.001Z");
  assert.equal(result.sourceFeatures, 2);
  assert.equal(result.totalMatched, 1);
  assert.equal(result.rows[0].depthKm, null);
  await assert.rejects(
    fetchPayload({ features: [feature("a"), feature("a", { mag: 2 })] }),
  );
  await assert.rejects(
    fetchPayload({
      features: [feature("a"), feature("b", { time: null, mag: 2 })],
    }),
  );
  await assert.rejects(
    fetchPayload({ metadata: { generated: "invalid" }, features: [feature()] }),
  );
});
test("source point cap is honest and validates rejected tail instead of accepting first 500", async () => {
  const features = Array.from({ length: 501 }, (_, i) => feature(String(i)));
  const result = await fetchPayload({ features });
  assert.equal(result.rows.length, 500);
  assert.equal(result.totalMatched, 501);
  features[500].geometry.coordinates[0] = 200;
  await assert.rejects(fetchPayload({ features }));
});
async function displayProbe({
  failAt = 0,
  mountFail = false,
  removeFail = false,
} = {}) {
  const { JSDOM } = await import("../../../node_modules/jsdom/lib/api.js");
  const doc = new JSDOM('<ol id="events"></ol>').window.document;
  const mounted = new Set(),
    created = [];
  let additions = 0;
  const { createEarthquakeDisplay } =
    await import("../src/earthquake-display.js").catch(() => ({}));
  assert.equal(typeof createEarthquakeDisplay, "function");
  const display = createEarthquakeDisplay({
    list: doc.getElementById("events"),
    primitives: {
      add(c) {
        mounted.add(c);
        if (mountFail) throw new Error("mount");
      },
      remove(c) {
        if (removeFail) throw new Error("detach");
        mounted.delete(c);
        c.destroy();
        return true;
      },
    },
    createCollection() {
      const c = {
        values: [],
        add(r) {
          if (++additions === failAt) throw new Error("point insertion");
          this.values.push(r);
        },
        destroy() {
          this.dead = true;
        },
        isDestroyed() {
          return !!this.dead;
        },
      };
      created.push(c);
      return c;
    },
    pointOptions: (r) => ({ id: r.stableId }),
  });
  return { display, doc, mounted, created };
}
test("real detached display bounds list, uses plain text metadata rows and disposes candidates on Nth point failure", async () => {
  const p = await displayProbe();
  const staged = p.display.stage({
    snapshot: snapshot(),
    result: { items: rows.map((r) => ({ ...r, id: r.stableId })) },
  });
  staged.commit();
  assert.equal(p.mounted.size, 1);
  assert.equal(p.doc.querySelectorAll("button").length, 3);
  assert.equal(p.doc.querySelectorAll("img").length, 0);
  assert.match(p.doc.body.textContent, /<img> Alaska/);
  staged.dispose();
  assert.equal(p.mounted.size, 0);
  assert.equal(p.created[0].dead, true);
  assert.equal(p.doc.querySelectorAll("button").length, 0);
  const q = await displayProbe({ failAt: 2 });
  assert.throws(() =>
    q.display.stage({ snapshot: snapshot(), result: { items: [] } }),
  );
  assert.equal(q.mounted.size, 0);
  assert.equal(q.created[0].dead, true);
});
test("partial collection mount and failing detachment retain ownership until terminal disposal", async () => {
  const p = await displayProbe({ mountFail: true });
  const candidate = p.display.stage({
    snapshot: snapshot(),
    result: { items: [] },
  });
  assert.throws(() => candidate.commit());
  candidate.dispose();
  assert.equal(p.mounted.size, 0);
  assert.equal(p.created[0].dead, true);
  const q = await displayProbe({ removeFail: true });
  const staged = q.display.stage({
    snapshot: snapshot(),
    result: { items: [] },
  });
  staged.commit();
  assert.throws(() => staged.dispose());
  assert.equal(q.created[0].dead, true);
  assert.throws(() => q.display.destroy());
});
test("synchronous clear during mount cannot republish a snapshot or retain engine follow-up memory", async () => {
  let controller;
  let disposed = 0;
  const p = await probe(
    async () => snapshot(),
    async () => ({
      commit() {
        controller.clear();
      },
      dispose() {
        disposed++;
      },
    }),
  );
  controller = p.controller;
  await controller.refresh();
  assert.equal(controller.state().snapshot, null);
  assert.equal(controller.state().result, null);
  assert.equal(controller.state().selected, null);
  assert.equal(disposed, 1);
});
test("actual Cesium primitiveAdded abort stops candidate attachment and list publication", async () => {
  const { PrimitiveCollection } = await import("@cesium/engine");
  const { JSDOM } = await import("../../../node_modules/jsdom/lib/api.js");
  const { createEarthquakeDisplay } =
    await import("../src/earthquake-display.js");
  const primitives = new PrimitiveCollection();
  const signal = new AbortController();
  const list = new JSDOM("<ol></ol>").window.document.querySelector("ol");
  const display = createEarthquakeDisplay({
    list,
    primitives,
    createCollection: () => ({
      add() {},
      destroy() {
        this.dead = true;
      },
      isDestroyed() {
        return !!this.dead;
      },
    }),
    pointOptions: (r) => r,
  });
  signal.signal.addEventListener("abort", () => display.destroy());
  primitives.primitiveAdded.addEventListener(() => signal.abort());
  const candidate = display.stage({
    snapshot: snapshot(),
    result: { items: rows.map((r) => ({ ...r, id: r.stableId })) },
  });
  assert.throws(() => candidate.commit());
  assert.equal(primitives.length, 0);
  assert.equal(list.children.length, 0);
  primitives.destroy();
});
async function controlsProbe() {
  const { JSDOM } = await import("../../../node_modules/jsdom/lib/api.js");
  const { readFile } = await import("node:fs/promises");
  const { installEarthquakeControls } =
    await import("../src/earthquake-controls.js");
  const document = new JSDOM(
    await readFile(new URL("../public/frame.html", import.meta.url), "utf8"),
  ).window.document;
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
    Object.entries(ids).map(([k, id]) => [k, document.getElementById(id)]),
  );
  const mounted = new Set();
  let fetches = 0,
    frames = 0,
    focused = 0,
    fail = false,
    failAt = 0,
    pointAdds = 0;
  const created = [];
  const abort = new AbortController();
  const destroy = installEarthquakeControls({
    signal: abort.signal,
    nodes,
    viewer: {
      scene: {
        requestRender() {
          frames++;
        },
        primitives: {
          add(c) {
            mounted.add(c);
          },
          remove(c) {
            const had = mounted.delete(c);
            if (had) c.destroy();
            return had;
          },
        },
      },
      camera: {
        cancelFlight() {},
        setView() {
          focused++;
        },
      },
    },
    fetchSnapshot: async () => {
      fetches++;
      if (fail) throw new Error("offline");
      return snapshot();
    },
    createCollection: () => {
      const c = {
        add() {
          if (++pointAdds === failAt) throw new Error("Nth source point");
        },
        destroy() {
          this.dead = true;
        },
        isDestroyed() {
          return !!this.dead;
        },
      };
      created.push(c);
      return c;
    },
    onFatalError() {
      abort.abort();
    },
  });
  const click = async (node) => {
    node.dispatchEvent(
      new document.defaultView.Event("click", { bubbles: true }),
    );
    await new Promise((r) => setImmediate(r));
  };
  return {
    nodes,
    document,
    mounted,
    created,
    abort,
    destroy,
    click,
    get fetches() {
      return fetches;
    },
    get frames() {
      return frames;
    },
    get focused() {
      return focused;
    },
    fail() {
      fail = true;
    },
    failInsertion() {
      failAt = pointAdds + 2;
    },
  };
}
test("actual labeled controls select plain event metadata and focus only explicitly, then clear and remove listeners", async () => {
  const p = await controlsProbe();
  await p.click(p.nodes.refresh);
  assert.equal(p.fetches, 1);
  assert.equal(p.mounted.size, 1);
  assert.equal(p.frames, 1);
  const row = [...p.nodes.list.querySelectorAll("button")].find(
    (button) => button.dataset.earthquakeId === "a",
  );
  await p.click(row);
  assert.match(p.nodes.metadata.textContent, /<img> Alaska/);
  assert.match(p.nodes.metadata.textContent, /USGS ID a/);
  assert.equal(p.document.querySelectorAll("img").length, 0);
  assert.equal(p.focused, 0);
  await p.click(p.nodes.focus);
  assert.equal(p.focused, 1);
  assert.equal(p.frames, 2);
  p.nodes.sort.value = "depth-asc";
  await p.click(p.nodes.apply);
  assert.equal(p.fetches, 1);
  assert.match(p.nodes.summary.textContent, /匹配 2/);
  assert.match(p.nodes.summary.textContent, /排除未提供深度/);
  await p.click(p.nodes.clear);
  assert.equal(p.mounted.size, 0);
  assert.equal(p.nodes.list.children.length, 0);
  assert.equal(p.nodes.metadata.textContent, "尚未选择地震事件。");
  assert.equal(p.nodes.apply.disabled, true);
  p.destroy();
  await p.click(p.nodes.refresh);
  assert.equal(p.fetches, 1);
  assert.ok(p.created.every((c) => c.dead));
});
test("real source point acquisition fault keeps visible prior rows and selection stale, query summary uses applied scope", async () => {
  const p = await controlsProbe();
  await p.click(p.nodes.refresh);
  await p.click(p.nodes.list.querySelector("button"));
  const before = p.nodes.list.textContent;
  p.failInsertion();
  await p.click(p.nodes.refresh);
  assert.equal(p.nodes.list.textContent, before);
  assert.match(p.nodes.metadata.textContent, /USGS ID b/);
  assert.match(p.nodes.metadata.textContent, /STALE/);
  assert.equal(p.mounted.size, 1);
  assert.ok(p.created[1].dead);
  p.nodes.scope.value = "radius";
  p.nodes.lat.value = "200";
  await p.click(p.nodes.apply);
  assert.match(p.nodes.summary.textContent, /查询未更改/);
  p.fail();
  await p.click(p.nodes.refresh);
  assert.match(p.nodes.summary.textContent, /范围：全部已加载记录/);
  assert.equal(p.nodes.list.textContent, before);
  p.abort.abort();
  assert.equal(p.mounted.size, 0);
  assert.equal(p.nodes.list.children.length, 0);
});
test("actual upstream follow-up memory can be reset and disabled source provenance stays off", async () => {
  const { createAnalystEngine } =
    await import("../vendor/src/data/analystEngine.js");
  let enabled = true;
  const engine = createAnalystEngine({
    getRecords: () =>
      enabled
        ? rows.map((r) => ({ ...r, id: r.stableId, magnitude: r.mag }))
        : [],
    getLayerSnapshot: () => ({
      id: "earthquakes",
      enabled,
      feedState: enabled ? "nominal" : "off",
    }),
    getViewContext: () => ({ lat: 0, lon: 0 }),
    resolveRegionRing: () => assert.fail("region access"),
  });
  await engine.query({ layers: ["earthquakes"], scope: { kind: "anywhere" } });
  assert.equal(engine.hasMemory(), true);
  engine.reset();
  assert.equal(engine.hasMemory(), false);
  enabled = false;
  const result = await engine.query({
    layers: ["earthquakes"],
    scope: { kind: "anywhere" },
  });
  assert.equal(result.count, 0);
  assert.equal(result.coverage.feedProvenance.overall, "off");
});
test("latest manual refresh and latest asynchronous query generation win without stale target revival", async () => {
  const arrivals = [];
  const p = await probe(() => new Promise((resolve) => arrivals.push(resolve)));
  const first = p.controller.refresh(),
    second = p.controller.refresh();
  const replacement = snapshot();
  replacement.rows = [rows[2]];
  replacement.totalMatched = 1;
  arrivals[1](replacement);
  await second;
  arrivals[0](snapshot());
  await first;
  assert.equal(p.controller.state().snapshot, replacement);
  assert.equal(p.controller.state().result.count, 1);
  let hold = false;
  const stages = [];
  let oldDisposed = 0;
  const q = await probe(
    async () => snapshot(),
    async () =>
      hold
        ? new Promise((resolve) => stages.push(resolve))
        : { commit() {}, dispose() {} },
  );
  await q.controller.refresh();
  hold = true;
  const older = q.controller.query({ minMagnitude: 4 });
  await new Promise((r) => setImmediate(r));
  const newer = q.controller.query({ place: "Japan" });
  await new Promise((r) => setImmediate(r));
  stages[1]({ commit() {}, dispose() {} });
  await newer;
  stages[0]({
    commit() {
      assert.fail("old generation mounted");
    },
    dispose() {
      oldDisposed++;
    },
  });
  await older;
  assert.equal(q.controller.state().result.count, 1);
  assert.equal(q.controller.state().result.items[0].id, "c");
  assert.equal(oldDisposed, 1);
  q.controller.destroy();
});
test("source feature count, label and identity limits are enforced; empty successful snapshot remains valid", async () => {
  await assert.rejects(
    fetchPayload({ features: Array.from({ length: 10001 }, () => feature()) }),
  );
  await assert.rejects(fetchPayload({ features: [feature("x".repeat(101))] }));
  const bounded = await fetchPayload({
    features: [feature("x", { place: "p".repeat(201) })],
  });
  assert.equal(bounded.rows[0].place.length, 201);
  const empty = await fetchPayload({ features: [] });
  assert.deepEqual(empty.rows, []);
  assert.equal(empty.totalMatched, 0);
  assert.equal(empty.sourceAt, null);
});
test("place filtering sees the complete byte-bounded source text while display alone is capped", async () => {
  const source = await fetchPayload({
    features: [feature("long", { place: "p".repeat(200) + " Alaska" })],
  });
  assert.match(source.rows[0].place, /Alaska$/);
  const p = await probe(async () => source);
  await p.controller.refresh();
  await p.controller.query({ place: "Alaska" });
  assert.equal(p.controller.state().result.count, 1);
  p.controller.destroy();
});
test("selection reassesses elapsed snapshot age and stamps metadata provenance stale without timers", async () => {
  const { createEarthquakeAnalyst } = await load();
  let now = Date.parse(stamp);
  const p = createEarthquakeAnalyst({
    fetchSnapshot: async () => snapshot(),
    stage: async () => ({ commit() {}, dispose() {} }),
    now: () => now,
  });
  await p.refresh();
  assert.equal(p.state().stale, false);
  now += 16 * 60 * 1000;
  p.select("a");
  assert.equal(p.state().stale, true);
  assert.equal(p.state().result.coverage.feedProvenance.overall, "stale");
  p.destroy();
});
test("clear resets visible query controls before reload to the same default criteria", async () => {
  const p = await controlsProbe();
  await p.click(p.nodes.refresh);
  p.nodes.magnitude.value = "5";
  await p.click(p.nodes.apply);
  assert.equal(p.nodes.list.children.length, 1);
  await p.click(p.nodes.clear);
  assert.equal(p.nodes.magnitude.value, "2.5");
  assert.equal(p.nodes.scope.value, "anywhere");
  await p.click(p.nodes.refresh);
  assert.equal(p.nodes.list.children.length, 3);
  p.destroy();
});
test("actual Cesium primitiveRemoved abort during clear prevents a post-disposal frame", async () => {
  const { PrimitiveCollection, PointPrimitiveCollection } =
    await import("@cesium/engine");
  const { JSDOM } = await import("../../../node_modules/jsdom/lib/api.js");
  const { createEarthquakeDisplay } =
    await import("../src/earthquake-display.js");
  const { createEarthquakeAnalyst } = await load();
  const primitives = new PrimitiveCollection(),
    abort = new AbortController(),
    list = new JSDOM("<ol></ol>").window.document.querySelector("ol");
  let frames = 0;
  const display = createEarthquakeDisplay({
    primitives,
    list,
    createCollection: () => new PointPrimitiveCollection(),
    pointOptions: () => ({}),
  });
  const p = createEarthquakeAnalyst({
    signal: abort.signal,
    fetchSnapshot: async () => snapshot(),
    stage: display.stage,
    requestRender: () => frames++,
  });
  abort.signal.addEventListener("abort", () => display.destroy());
  await p.refresh();
  primitives.primitiveRemoved.addEventListener(() => abort.abort());
  p.clear();
  assert.equal(p.state().stopped, true);
  assert.equal(primitives.length, 0);
  assert.equal(frames, 1);
  primitives.destroy();
});
test("selection during an asynchronous replacement keeps prior failure provenance until the new snapshot commits", async () => {
  let failing = false,
    hold = false,
    finish;
  const p = await probe(
    async () => {
      if (failing) throw new Error("offline");
      return snapshot();
    },
    async () =>
      hold
        ? new Promise((resolve) => {
            finish = () => resolve({ commit() {}, dispose() {} });
          })
        : { commit() {}, dispose() {} },
  );
  await p.controller.refresh();
  failing = true;
  await p.controller.refresh();
  assert.equal(p.controller.state().stale, true);
  failing = false;
  hold = true;
  const pending = p.controller.refresh();
  await new Promise((r) => setImmediate(r));
  p.controller.select("a");
  assert.equal(p.controller.state().stale, true);
  finish();
  await pending;
  assert.equal(p.controller.state().stale, false);
  p.controller.destroy();
});
