#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = join(repositoryRoot, "src", "business");
const outputPath = join(
  repositoryRoot,
  "docs",
  "production-readiness",
  "stage-one-ui-inventory.json",
);
const intrinsicInteractionTags = new Set([
  "a",
  "button",
  "dialog",
  "input",
  "select",
  "textarea",
]);

function productionSourceFiles(directory) {
  return readdirSync(directory)
    .flatMap((name) => {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) {
        return name === "docs" ? [] : productionSourceFiles(path);
      }
      return path.endsWith(".tsx") && !/\.(?:spec|test)\.tsx$/u.test(path)
        ? [path]
        : [];
    })
    .sort();
}

function posixPath(path) {
  return path.split(sep).join("/");
}

function attribute(opening, name) {
  return opening.attributes.properties.find(
    (property) =>
      ts.isJsxAttribute(property) && property.name.getText() === name,
  );
}

function attributeSource(opening, name, sourceFile) {
  const value = attribute(opening, name);
  return value ? value.getText(sourceFile) : null;
}

function staticAttributeValue(opening, name) {
  const value = attribute(opening, name);
  if (!value || !ts.isJsxAttribute(value) || !value.initializer) return null;
  return ts.isStringLiteral(value.initializer) ? value.initializer.text : null;
}

function interactionKind(tag, role) {
  if (role === "dialog" || tag === "dialog") return "DIALOG";
  if (role === "button" || tag === "button") return "BUTTON";
  if (tag === "a") return "LINK";
  return "FILTER_OR_INPUT";
}

function sourceExcerpt(node, sourceFile) {
  const source = node.getText(sourceFile).replace(/\s+/gu, " ").trim();
  return source.length <= 240 ? source : `${source.slice(0, 237)}...`;
}

function inventoryItem(opening, sourceFile, absolutePath) {
  const tag = opening.tagName.getText(sourceFile);
  const role = staticAttributeValue(opening, "role");
  if (
    !intrinsicInteractionTags.has(tag) &&
    role !== "button" &&
    role !== "dialog"
  ) {
    return null;
  }
  const location = sourceFile.getLineAndCharacterOfPosition(opening.getStart());
  const sourcePath = posixPath(relative(repositoryRoot, absolutePath));
  const kind = interactionKind(tag, role);
  return {
    id: `${sourcePath}:${location.line + 1}:${location.character + 1}:${kind}`,
    kind,
    sourceFile: sourcePath,
    line: location.line + 1,
    column: location.character + 1,
    tag,
    accessibleNameSource:
      attributeSource(opening, "aria-label", sourceFile) ??
      attributeSource(opening, "title", sourceFile),
    implementationLocation: `cofco-qiqihar-enterprise-web:${sourcePath}`,
    ownerRepository: "cofco-qiqihar-enterprise-web",
    status: "IMPLEMENTED",
    verificationStage: "阶段二/三",
    sourceExcerpt: sourceExcerpt(opening, sourceFile),
  };
}

function buildInventory() {
  const files = productionSourceFiles(sourceRoot);
  const items = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const sourceFile = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const visit = (node) => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const item = inventoryItem(node, sourceFile, file);
        if (item) items.push(item);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  items.sort((left, right) => left.id.localeCompare(right.id));
  const countsByKind = Object.fromEntries(
    ["BUTTON", "LINK", "FILTER_OR_INPUT", "DIALOG"].map((kind) => [
      kind,
      items.filter((item) => item.kind === kind).length,
    ]),
  );
  const sourceDigest = createHash("sha256")
    .update(
      files
        .map(
          (file) =>
            `${posixPath(relative(repositoryRoot, file))}\0${readFileSync(file, "utf8")}\0`,
        )
        .join(""),
    )
    .digest("hex");
  return {
    schemaVersion: 1,
    scope:
      "src/business 下全部非测试 TSX 的按钮、链接、筛选/输入与弹框静态追踪清单",
    statusSemantics:
      "IMPLEMENTED 只证明源码位置已登记；交互行为仍归阶段二/三真实浏览器与数据库矩阵验证",
    sourceBoundary:
      "src/business/**/*.tsx，排除 *.spec.tsx、*.test.tsx 与 docs",
    sourceFileCount: files.length,
    sourceDigest,
    itemCount: items.length,
    countsByKind,
    items,
  };
}

const rendered = `${JSON.stringify(buildInventory(), null, 2)}\n`;
if (process.argv.includes("--write")) {
  writeFileSync(outputPath, rendered);
  process.stdout.write(`Wrote ${outputPath}\n`);
} else if (process.argv.includes("--check")) {
  if (
    !existsSync(outputPath) ||
    readFileSync(outputPath, "utf8") !== rendered
  ) {
    process.stderr.write(
      "Stage-one UI inventory is stale; run npm run stage1:inventory:write.\n",
    );
    process.exitCode = 1;
  } else {
    process.stdout.write("Stage-one UI inventory is current.\n");
  }
} else {
  process.stderr.write("Use --write or --check.\n");
  process.exitCode = 2;
}
