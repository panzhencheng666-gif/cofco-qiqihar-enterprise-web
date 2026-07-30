import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(
  new URL("../node_modules/@playwright/test/cli.js", import.meta.url),
);
const environment = { ...process.env, FORCE_COLOR: "0" };
delete environment.NO_COLOR;

const child = spawn(
  process.execPath,
  [cliPath, "test", ...process.argv.slice(2)],
  {
    env: environment,
    stdio: "inherit",
  },
);

child.on("error", (error) => {
  process.stderr.write(`Unable to start Playwright: ${error.message}\n`);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  if (signal) {
    process.stderr.write(`Playwright stopped by signal ${signal}\n`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
