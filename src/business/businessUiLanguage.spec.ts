import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const forbiddenBusinessUiTerms =
  /后端|本地数据库|演示数据|开发模式|调试信息|测试账号|内部任务|原型|界面样板|技术栈|API\s|接口地址|模板版本|数据版本|结果版本|来源版本|localhost|127\.0\.0\.1|64185|63200/u;

describe("正式业务界面用语", () => {
  it("不把开发、运行和内部版本信息暴露到业务组件", () => {
    const files = componentFiles(join(process.cwd(), "src/business"));
    const violations = files.flatMap((file) => {
      const source = readFileSync(file, "utf8");
      const match = forbiddenBusinessUiTerms.exec(source);
      return match
        ? [`${file.replace(`${process.cwd()}/`, "")}: ${match[0]}`]
        : [];
    });

    expect(violations).toEqual([]);
  });
});

function componentFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "docs" ? [] : componentFiles(path);
    }
    if (!entry.name.endsWith(".tsx") || entry.name.includes(".spec.")) {
      return [];
    }
    return [path];
  });
}
