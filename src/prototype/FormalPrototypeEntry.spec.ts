import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("formal prototype entry", () => {
  it("mounts only the approved formal enterprise system", () => {
    const mainSource = readFileSync(
      resolve(process.cwd(), "src/prototype/main.tsx"),
      "utf8",
    );
    const htmlSource = readFileSync(
      resolve(process.cwd(), "prototype.html"),
      "utf8",
    );

    expect(mainSource).toContain('from "./FormalEnterprisePrototype"');
    expect(mainSource).not.toContain("EnterpriseArchitecturePrototype");
    expect(mainSource).not.toContain("./prototype.css");
    expect(htmlSource).toContain("<title>齐齐哈尔粮食商情企业平台</title>");
    expect(htmlSource).not.toContain("界面样板");
  });
});
