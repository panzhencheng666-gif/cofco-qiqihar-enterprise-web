import assert from "node:assert/strict";
import test from "node:test";

import { validateRuntime } from "./verify-runtime.mjs";

const engines = {
  node: ">=24.15.0 <25",
  npm: ">=11.6.0 <12",
};

test("accepts the declared Node and npm boundaries", () => {
  assert.deepEqual(
    validateRuntime({ nodeVersion: "24.15.0", npmVersion: "11.6.0", engines }),
    [],
  );
  assert.deepEqual(
    validateRuntime({ nodeVersion: "24.99.0", npmVersion: "11.99.0", engines }),
    [],
  );
});

test("rejects every unsupported Node and npm boundary", () => {
  assert.deepEqual(
    validateRuntime({ nodeVersion: "22.23.2", npmVersion: "10.9.8", engines }),
    [
      "Node 22.23.2 does not satisfy >=24.15.0 <25",
      "npm 10.9.8 does not satisfy >=11.6.0 <12",
    ],
  );
  assert.deepEqual(
    validateRuntime({ nodeVersion: "25.0.0", npmVersion: "12.0.0", engines }),
    [
      "Node 25.0.0 does not satisfy >=24.15.0 <25",
      "npm 12.0.0 does not satisfy >=11.6.0 <12",
    ],
  );
});

test("fails closed when the version string or constraint is malformed", () => {
  assert.throws(
    () =>
      validateRuntime({
        nodeVersion: "development",
        npmVersion: "11.6.0",
        engines,
      }),
    /invalid Node version/u,
  );
  assert.throws(
    () =>
      validateRuntime({
        nodeVersion: "24.15.0",
        npmVersion: "11.6.0",
        engines: { node: "latest", npm: engines.npm },
      }),
    /unsupported Node constraint/u,
  );
});
