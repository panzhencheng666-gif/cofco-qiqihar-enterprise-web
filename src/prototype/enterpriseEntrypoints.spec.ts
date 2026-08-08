import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readWorkspaceFile(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("企业平台访问入口", () => {
  it("根地址和兼容地址加载同一套企业平台入口", () => {
    const rootEntry = readWorkspaceFile("../../index.html");
    const compatibilityEntry = readWorkspaceFile("../../prototype.html");

    for (const entry of [rootEntry, compatibilityEntry]) {
      expect(entry).toContain('<div id="prototype-root"></div>');
      expect(entry).toContain(
        '<script type="module" src="/src/prototype/main.tsx"></script>',
      );
    }
  });
});
