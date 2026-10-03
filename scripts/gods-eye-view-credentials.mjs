import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(
  new URL("../apps/gods-eye-view/package.json", import.meta.url),
);
const { transformSync } = require("esbuild");
const contracts = [
  {
    module: "Core/Ion.js",
    length: 177,
    sha256: "a6affedc45babc764bc5fda804e1fcd30f96bf1f76f2825db9d6537f15a506d9",
  },
  {
    module: "Scene/ArcGisMapService.js",
    length: 252,
    sha256: "46ffdd313a62c4615bacd2b667a66b24c4f15ef9e46fb1e123473a6ba9bfb9ae",
  },
];
const readSdkModule = (module) =>
  readFile(require.resolve(`@cesium/engine/Source/${module}`), "utf8");

async function readKnownDefaults(readModule) {
  const defaults = [];
  for (const contract of contracts) {
    // Only read the two public installed SDK sources. Never inspect user secrets.
    // A missing/changed module or literal fails closed, with no source disclosure.
    try {
      const source = await readModule(contract.module);
      transformSync(source, { loader: "js", logLevel: "silent" });
      const matches = [
        ...source.matchAll(
          /const defaultAccessToken\s*=\s*(["'])([^"'\r\n]+)\1\s*;/g,
        ),
      ];
      if (matches.length !== 1) throw new Error();
      const literal = matches[0][2];
      if (
        literal.length !== contract.length ||
        createHash("sha256").update(literal).digest("hex") !== contract.sha256
      )
        throw new Error();
      defaults.push(literal);
    } catch {
      throw new Error(
        `SDK default credential contract mismatch: ${contract.module}`,
      );
    }
  }
  return defaults;
}

export async function checkSdkDefaultCredentialContracts(
  readModule = readSdkModule,
) {
  return { knownDefaultsChecked: (await readKnownDefaults(readModule)).length };
}

// Match exact known SDK defaults and JWT shapes, including copied workers/chunks.
// Do not classify legitimate long base64 assets as credentials. Errors expose
// filenames/counts only; values remain in memory and are never returned/persisted.
export async function checkEmbeddedCredentials(directory) {
  const defaults = await readKnownDefaults(readSdkModule);
  let filesScanned = 0;
  async function walk(relative = "") {
    const entries = await readdir(path.join(directory, relative), {
      withFileTypes: true,
    });
    for (const entry of entries) {
      const filename = path.join(relative, entry.name);
      if (entry.isDirectory()) await walk(filename);
      else if (/\.[cm]?js$/i.test(entry.name)) {
        filesScanned++;
        const source = await readFile(path.join(directory, filename), "utf8");
        const positions = new Set(
          [
            ...source.matchAll(
              /\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
            ),
          ].map((match) => match.index),
        );
        for (const literal of defaults) {
          let index = source.indexOf(literal);
          while (index !== -1) {
            positions.add(index);
            index = source.indexOf(literal, index + literal.length);
          }
        }
        if (positions.size)
          throw new Error(
            `Embedded credential literals: ${filename} (count: ${positions.size})`,
          );
      }
    }
  }
  await walk();
  return {
    filesScanned,
    knownDefaultsChecked: defaults.length,
    credentialMatches: 0,
  };
}
