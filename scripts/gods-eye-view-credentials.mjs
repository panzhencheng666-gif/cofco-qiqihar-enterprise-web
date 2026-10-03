import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

// JWT-shaped literals must never ship, including in copied SDK workers.
// Report filenames and counts only, never the matched credential text.
export async function checkEmbeddedCredentials(directory) {
  async function walk(relative = "") {
    const entries = await readdir(path.join(directory, relative), {
      withFileTypes: true,
    });
    for (const entry of entries) {
      const filename = path.join(relative, entry.name);
      if (entry.isDirectory()) await walk(filename);
      else if (/\.[cm]?js$/i.test(entry.name)) {
        const source = await readFile(path.join(directory, filename), "utf8");
        const count = (
          source.match(
            /\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
          ) || []
        ).length;
        if (count)
          throw new Error(
            `Embedded credential literals: ${filename} (count: ${count})`,
          );
      }
    }
  }
  await walk();
}
