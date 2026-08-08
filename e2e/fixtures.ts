import { expect, test as base, type APIRequestContext } from "@playwright/test";

export const controlledApiBaseUrl = "http://127.0.0.1:63181";

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

export async function resetControlledApi(
  request: APIRequestContext,
): Promise<void> {
  const response = await request.post(`${controlledApiBaseUrl}/__e2e/reset`);
  expect(response.ok()).toBe(true);
}

export async function setControlledApiMode(
  request: APIRequestContext,
  mode: "normal" | "empty" | "failure",
): Promise<void> {
  const response = await request.post(`${controlledApiBaseUrl}/__e2e/mode`, {
    data: { mode },
  });
  expect(response.ok()).toBe(true);
}
