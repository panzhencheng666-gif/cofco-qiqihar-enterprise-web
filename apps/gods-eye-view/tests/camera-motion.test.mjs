import test from "node:test";
import assert from "node:assert/strict";
const module = await import("../src/camera-motion-owner.js").catch(() => ({}));
function fixture() {
  let now = 0,
    serial = 0;
  const queue = new Map(),
    cancelled = [];
  const signal = new AbortController();
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
  assert.equal(
    typeof module.createCameraMotionOwner,
    "function",
    "shared motion authority must exist",
  );
  const owner = module.createCameraMotionOwner({
    signal: signal.signal,
    schedule,
  });
  return {
    owner,
    signal,
    queue,
    cancelled,
    advance(ms = 34) {
      now += ms;
      const entry = queue.entries().next().value;
      if (entry) {
        queue.delete(entry[0]);
        entry[1]();
      }
    },
  };
}
test("shared authority is idle and takeover synchronously stops previous owner before one callback", () => {
  const f = fixture(),
    stopped = [];
  const first = f.owner.register({ stop: () => stopped.push("first") });
  const second = f.owner.register({ stop: () => stopped.push("second") });
  assert.equal(f.queue.size, 0);
  assert.equal(first.claim(), true);
  assert.doesNotThrow(() => first.schedule.cancel(undefined));
  let called = 0;
  first.schedule.request(() => ++called);
  const stale = [...f.queue.values()][0];
  assert.equal(second.claim(), true);
  assert.deepEqual(stopped, ["first"]);
  assert.equal(f.queue.size, 0);
  stale();
  assert.equal(called, 0);
  second.schedule.request(() => ++called);
  assert.throws(
    () => second.schedule.request(() => ++called),
    /already|callback/,
  );
  assert.equal(f.queue.size, 1);
  f.advance();
  assert.equal(called, 1);
  second.release();
  assert.equal(second.valid(), false);
});
test("shared authority cancels stale callbacks on eligibility, abort, release and destruction", () => {
  for (const action of ["hide", "abort", "release", "destroy"]) {
    const f = fixture();
    let visible = true,
      called = 0,
      stopped = 0;
    const scope = f.owner.register({
      stop: () => ++stopped,
      eligible: () => visible,
    });
    assert.equal(scope.claim(), true);
    scope.schedule.request(() => ++called);
    const late = [...f.queue.values()][0];
    if (action === "hide") {
      visible = false;
      f.advance();
    }
    if (action === "abort") f.signal.abort();
    if (action === "release") scope.release();
    if (action === "destroy") f.owner.destroy();
    late();
    assert.equal(called, 0, action);
    assert.equal(f.queue.size, 0, action);
    assert.equal(scope.valid(), false);
    assert.equal(stopped, action === "release" ? 0 : 1);
    f.owner.destroy();
    f.owner.destroy();
  }
});

test("a reentrant third claim in prior stop wins; stale outer claim cannot overwrite or retain its timer", () => {
  const f = fixture();
  let third;
  const first = f.owner.register({
    stop() {
      assert.equal(third.claim(), true);
      third.schedule.request(() => {});
    },
  });
  const second = f.owner.register({ stop() {} });
  third = f.owner.register({ stop() {} });
  first.claim();
  first.schedule.request(() => {});
  assert.equal(second.claim(), false);
  assert.equal(third.valid(), true);
  assert.equal(second.valid(), false);
  assert.equal(f.queue.size, 1);
  f.owner.destroy();
  assert.equal(f.queue.size, 0);
});
