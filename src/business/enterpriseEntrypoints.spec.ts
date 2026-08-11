import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readWorkspaceFile(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("企业平台访问入口", () => {
  it("只保留 63182 根地址对应的正式企业平台入口", () => {
    const rootEntry = readWorkspaceFile("../../index.html");

    expect(rootEntry).toContain('<div id="enterprise-root"></div>');
    expect(rootEntry).toContain(
      '<script type="module" src="/src/enterprise/main.tsx"></script>',
    );
    expect(existsSync(resolve(process.cwd(), "prototype.html"))).toBe(false);
    expect(existsSync(resolve(process.cwd(), "src/prototype"))).toBe(false);
    expect(existsSync(resolve(process.cwd(), "src/business"))).toBe(true);
  });

  it("运行脚本不再声明原型入口或历史端口", () => {
    const packageSource = readWorkspaceFile("../../package.json");
    const packageJson = JSON.parse(packageSource) as {
      scripts: Record<string, string>;
    };

    expect(Object.keys(packageJson.scripts)).not.toContain("prototype");
    expect(Object.keys(packageJson.scripts)).not.toContain("build:prototype");
    expect(packageSource).not.toContain("64185");
  });
});
