import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const fixtures: string[] = [];
const budgetScript = resolve(
  process.cwd(),
  "scripts/check-initial-bundle-budget.mjs",
);

afterEach(async () => {
  await Promise.all(
    fixtures
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("production JavaScript budget CLI", () => {
  it("fails when a dynamically loaded production chunk exceeds 900 KiB", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "grain-budget-"));
    fixtures.push(root);
    await mkdir(resolve(root, "dist/.vite"), { recursive: true });
    await mkdir(resolve(root, "dist/assets"), { recursive: true });
    await writeFile(
      resolve(root, "dist/index.html"),
      '<script type="module" src="/assets/entry.js"></script>',
    );
    await writeFile(
      resolve(root, "dist/.vite/manifest.json"),
      JSON.stringify({
        "src/main.tsx": {
          file: "assets/entry.js",
          isEntry: true,
          dynamicImports: ["src/lazy.tsx"],
        },
        "src/lazy.tsx": {
          file: "assets/lazy.js",
          isDynamicEntry: true,
        },
      }),
    );
    await writeFile(resolve(root, "dist/assets/entry.js"), "export{}");
    await writeFile(
      resolve(root, "dist/assets/lazy.js"),
      Buffer.alloc(900 * 1024 + 1, "x"),
    );

    const result = spawnSync(process.execPath, [budgetScript], {
      cwd: root,
      encoding: "utf8",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("largest production chunk");
  });
});
