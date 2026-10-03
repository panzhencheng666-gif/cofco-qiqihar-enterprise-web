import { spawnSync } from "node:child_process";
import { commandExitCode } from "../apps/gods-eye-view/src/command-status.js";
import { fileURLToPath } from "node:url";
const app = fileURLToPath(new URL("../apps/gods-eye-view/", import.meta.url));
for (const args of [
  [
    "--test",
    "tests/guards.test.mjs",
    "tests/analyst.test.mjs",
    "tests/camera-sequence.test.mjs",
  ],
  ["build.mjs"],
]) {
  const result = spawnSync(process.execPath, args, {
    cwd: app,
    stdio: "inherit",
  });
  if (commandExitCode(result) !== 0) process.exit(commandExitCode(result));
}
const gate = spawnSync(
  process.execPath,
  [fileURLToPath(new URL("./gods-eye-view-check.mjs", import.meta.url))],
  { stdio: "inherit" },
);
process.exit(commandExitCode(gate));
