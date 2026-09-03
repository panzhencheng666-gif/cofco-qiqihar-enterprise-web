import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("enterprise favicon", () => {
  it("publishes an explicit favicon at the conventional browser path", async () => {
    const [html, favicon] = await Promise.all([
      readFile(resolve("index.html"), "utf8"),
      readFile(resolve("public/favicon.ico"), "utf8"),
    ]);

    expect(html).toContain(
      '<link rel="icon" type="image/svg+xml" href="/favicon.ico" />',
    );
    expect(favicon).toMatch(/^<svg[\s>]/);
  });
});
