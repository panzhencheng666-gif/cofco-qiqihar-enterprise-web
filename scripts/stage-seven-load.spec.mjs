import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import {
  buildWeightedSchedule,
  runHttpLoad,
  scaleProfiles,
} from "./stage-seven-load.mjs";

const profile = {
  profiles: [
    { code: "baseline", concurrency: 60, durationSeconds: 120 },
    { code: "peak", concurrency: 300, durationSeconds: 300 },
    {
      code: "capacity",
      concurrencySteps: [300, 375],
      durationSecondsPerStep: 60,
    },
  ],
  localProportional: {
    concurrencyScale: 0.02,
    durationScale: 0.02,
    minimumDurationSeconds: 2,
    maximumDurationSeconds: 6,
  },
};

test("scales every profile without losing a capacity step", () => {
  assert.deepEqual(scaleProfiles(profile), [
    { code: "baseline", concurrency: 2, durationSeconds: 3 },
    { code: "peak", concurrency: 6, durationSeconds: 6 },
    { code: "capacity-300", concurrency: 6, durationSeconds: 2 },
    { code: "capacity-375", concurrency: 8, durationSeconds: 2 },
  ]);
});

test("builds an exact deterministic weighted schedule", () => {
  const schedule = buildWeightedSchedule(
    [
      { code: "read", weight: 60 },
      { code: "write", weight: 30 },
      { code: "photo", weight: 10 },
    ],
    20,
  );
  assert.equal(schedule.length, 20);
  assert.equal(schedule.filter((code) => code === "read").length, 12);
  assert.equal(schedule.filter((code) => code === "write").length, 6);
  assert.equal(schedule.filter((code) => code === "photo").length, 2);
  assert.deepEqual(
    schedule,
    buildWeightedSchedule(
      [
        { code: "read", weight: 60 },
        { code: "write", weight: 30 },
        { code: "photo", weight: 10 },
      ],
      20,
    ),
  );
});

test("runs bounded concurrent HTTP load and records every latency and status", async (context) => {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end('{"ok":true}');
  });
  await new Promise((resolvePromise) =>
    server.listen(0, "127.0.0.1", resolvePromise),
  );
  context.after(
    () => new Promise((resolvePromise) => server.close(resolvePromise)),
  );
  const { port } = server.address();

  const result = await runHttpLoad({
    baseUrl: `http://127.0.0.1:${port}`,
    concurrency: 3,
    iterations: 12,
    schedule: ["read", "map"],
    requestFor: (code) => ({ path: `/${code}` }),
  });

  assert.equal(result.attempts, 12);
  assert.equal(result.unexpectedErrors, 0);
  assert.equal(result.latenciesMs.length, 12);
  assert.deepEqual(result.byWorkload.read, {
    attempts: 6,
    unexpectedErrors: 0,
  });
  assert.deepEqual(result.byWorkload.map, { attempts: 6, unexpectedErrors: 0 });
});
