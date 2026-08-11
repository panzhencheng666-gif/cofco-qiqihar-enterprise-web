import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("正式企业平台入口", () => {
  it("mounts only the approved formal enterprise system", () => {
    const mainSource = readFileSync(
      resolve(process.cwd(), "src/enterprise/main.tsx"),
      "utf8",
    );
    const htmlSource = readFileSync(
      resolve(process.cwd(), "index.html"),
      "utf8",
    );

    expect(mainSource).toContain("EnterpriseBusinessApplication");
    expect(mainSource).toContain("../business/EnterpriseBusinessApplication");
    expect(mainSource).not.toMatch(/prototype|demo|mock|codex/iu);
    expect(mainSource).not.toContain("EnterpriseArchitecturePrototype");
    expect(mainSource).not.toContain("./prototype.css");
    expect(htmlSource).toContain("<title>齐齐哈尔粮食商情企业平台</title>");
    expect(htmlSource).not.toMatch(/prototype|demo|mock|codex|64185/iu);
  });
});
