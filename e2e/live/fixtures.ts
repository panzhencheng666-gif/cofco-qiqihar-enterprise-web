import { execFileSync } from "node:child_process";
import { expect, test as base, type Page } from "@playwright/test";

type BrowserErrorFixture = {
  browserErrors: string[];
};

export const test = base.extend<BrowserErrorFixture>({
  browserErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("pageerror", (error) => errors.push(error.message));
      await use(errors);
      expect(errors).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export const liveBrowserAccounts = {
  operatorOne: { url: "http://127.0.0.1:63184", name: "验收填报员甲" },
  operatorTwo: { url: "http://127.0.0.1:63185", name: "验收填报员乙" },
  reviewer: { url: "http://127.0.0.1:63186", name: "验收审核员" },
  reporter: { url: "http://127.0.0.1:63187", name: "验收报告员" },
  publisher: { url: "http://127.0.0.1:63188", name: "验收发布员" },
} as const;

export function trackBrowserErrors(page: Page): {
  errors: string[];
  assertClean(): void;
} {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return {
    errors,
    assertClean() {
      expect(errors).toEqual([]);
    },
  };
}

export function queryE2eDatabase(sql: string): string {
  const databaseUser = process.env.QIQIHAR_E2E_DB_USERNAME ?? process.env.USER;
  if (!databaseUser) throw new Error("A PostgreSQL E2E database user is required");
  return execFileSync(
    "psql",
    [
      "--username",
      databaseUser,
      "--dbname",
      "qiqihar_enterprise_e2e",
      "--tuples-only",
      "--no-align",
      "--set",
      "ON_ERROR_STOP=1",
      "--command",
      sql,
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        PGPASSWORD: process.env.QIQIHAR_E2E_DB_PASSWORD ?? "",
      },
    },
  ).trim();
}
