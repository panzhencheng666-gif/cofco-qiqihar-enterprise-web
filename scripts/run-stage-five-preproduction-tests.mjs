import { spawn } from "node:child_process";
import { resolveVerifiedNginx } from "./verified-nginx-tool.mjs";

const testFiles = [
  "scripts/preproduction-config.spec.mjs",
  "scripts/preproduction-assets.spec.mjs",
  "scripts/preproduction-runtime.spec.mjs",
  "scripts/preproduction-transaction.spec.mjs",
  "scripts/preproduction-bundle.spec.mjs",
  "scripts/preproduction-nginx-tool.spec.mjs",
  "scripts/preproduction-nginx.spec.mjs",
  "scripts/preproduction-operations.spec.mjs",
];

function printTool(tool) {
  process.stdout.write(
    `NGINX_TEST_TOOL_READY version=nginx/${tool.version} source_sha256=${tool.sourceSha256} binary=${tool.binaryPath}\n`,
  );
}

const tool = await resolveVerifiedNginx();
printTool(tool);

if (process.argv[2] === "--resolve-nginx") {
  process.exitCode = 0;
} else {
  const child = spawn(process.execPath, ["--test", ...testFiles], {
    env: { ...process.env, COFCO_TEST_NGINX_BIN: tool.binaryPath },
    stdio: "inherit",
  });
  const result = await new Promise((resolveChild, rejectChild) => {
    child.once("error", rejectChild);
    child.once("exit", (code, signal) => resolveChild({ code, signal }));
  });
  if (result.signal) {
    throw new Error(`stage-five tests terminated by ${result.signal}`);
  }
  process.exitCode = result.code ?? 1;
}
