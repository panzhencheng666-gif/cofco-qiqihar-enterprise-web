import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function decodeXml(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function encodeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function fillDownloadedXlsx(
  templatePath: string,
  values: Readonly<Record<string, string>>,
): { path: string; cleanup: () => void; headers: readonly string[] } {
  const root = mkdtempSync(join(tmpdir(), "cofco-live-xlsx-"));
  const unpacked = join(root, "workbook");
  const output = join(root, "filled.xlsx");
  mkdirSync(unpacked);
  execFileSync("unzip", ["-q", templatePath, "-d", unpacked]);

  const sheetPath = join(unpacked, "xl", "worksheets", "sheet1.xml");
  const xml = readFileSync(sheetPath, "utf8");
  const headerRow = /<row\b[^>]*\br="2"[^>]*>([\s\S]*?)<\/row>/u.exec(xml)?.[1];
  if (!headerRow) throw new Error("XLSX template is missing its field-code row");
  const cells = [...headerRow.matchAll(
    /<c\b[^>]*\br="([A-Z]+)2"[^>]*>[\s\S]*?<t(?:\s[^>]*)?>([\s\S]*?)<\/t>[\s\S]*?<\/c>/gu,
  )];
  if (cells.length === 0)
    throw new Error("XLSX template field-code row is empty");
  const headers = cells.map((cell) => decodeXml(cell[2] ?? ""));
  const dataCells = cells
    .map((cell, index) => {
      const column = cell[1] ?? "";
      const value = values[headers[index] ?? ""] ?? "";
      return `<c r="${column}3" t="inlineStr" s="0"><is><t xml:space="preserve">${encodeXml(value)}</t></is></c>`;
    })
    .join("");
  const row = `<row r="3">${dataCells}</row>`;
  const filled = xml
    .replace("</sheetData>", `${row}</sheetData>`)
    .replace(
      /(<dimension\b[^>]*\bref="[A-Z]+1:[A-Z]+)2("[^>]*\/>)/u,
      (_match, prefix: string, suffix: string) => `${prefix}3${suffix}`,
    );
  writeFileSync(sheetPath, filled, "utf8");
  execFileSync("zip", ["-q", "-r", output, "."], { cwd: unpacked });

  return {
    path: output,
    headers,
    cleanup: () => rmSync(root, { force: true, recursive: true }),
  };
}
