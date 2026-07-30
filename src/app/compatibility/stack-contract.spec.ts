import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface PackageManifest {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

describe("locked enterprise stack", () => {
  it("pins the reviewed compatibility baseline", () => {
    const manifest = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
    ) as PackageManifest;

    expect(manifest.dependencies).toMatchObject({
      react: "19.2.8",
      "@refinedev/core": "5.0.12",
      antd: "5.29.3",
      "@ant-design/pro-components": "2.8.10",
      "@ant-design/v5-patch-for-react-19": "1.0.3",
    });
    expect(manifest.devDependencies).toMatchObject({
      typescript: "5.9.3",
      vite: "8.1.5",
    });
  });
});
