import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

it("excludes linked worktrees from unit-test discovery", () => {
  const viteConfig = readFileSync(
    resolve(process.cwd(), "vite.config.ts"),
    "utf8",
  );

  expect(viteConfig).toContain('".worktrees/**"');
});
