import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  applicationCatalog,
  availableApps,
} from "../portal/applicationCatalog.js";
const originalSource = execFileSync(
  "git",
  [
    "show",
    "d99cb3d6d0343c82d61a1707ac73acb6a5c37769:portal/applicationCatalog.js",
  ],
  { encoding: "utf8" },
);
const original = await import(
  `data:text/javascript;base64,${Buffer.from(originalSource).toString("base64")}`
);
test("fourth entry preserves all original application objects and order", () => {
  assert.deepEqual(applicationCatalog.slice(0, 3), original.applicationCatalog);
  assert.equal(availableApps().length, 4);
  assert.equal(availableApps()[3].id, "gods-eye-view");
  assert.equal(
    availableApps()[3].href,
    "/enterprise-portal/depth-7/gods-eye-view/",
  );
});
test("feature switch returns exactly the original three applications", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(
    new URL("../portal/applicationCatalog.js", import.meta.url),
    "utf8",
  );
  assert.ok(source.includes("const godsEyeViewEnabled = true;"));
  const disabled = await import(
    `data:text/javascript;base64,${Buffer.from(source.replace("const godsEyeViewEnabled = true;", "const godsEyeViewEnabled = false;")).toString("base64")}`
  );
  assert.deepEqual(disabled.availableApps(), original.availableApps());
});
