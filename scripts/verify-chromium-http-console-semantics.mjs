import { createServer } from "node:http";
import { chromium } from "playwright";

const responseBody = JSON.stringify({ error: { code: "EXPECTED_FAILURE" } });
const server = createServer((request, response) => {
  if (request.url === "/sw.js") {
    response.writeHead(200, {
      "content-type": "text/javascript; charset=utf-8",
      "service-worker-allowed": "/",
    });
    response.end(`self.addEventListener('fetch', (event) => {
      if (new URL(event.request.url).pathname.startsWith('/status/')) {
        event.respondWith(fetch(event.request));
      }
    });`);
    return;
  }
  if (request.url === "/service-worker") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html><script>
      navigator.serviceWorker.register('/sw.js').then(async () => {
        await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller) {
          location.reload();
          return;
        }
        const results = await Promise.all([401, 502].map(async (status) => {
          const response = await fetch('/status/' + status);
          return { status: response.status, ok: response.ok };
        }));
        window.__results = results;
      });
    </script>`);
    return;
  }
  if (request.url === "/fetch") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html><script>
      Promise.all([401, 502].map(async (status) => {
        const response = await fetch('/status/' + status);
        return { status: response.status, ok: response.ok };
      })).then((results) => { window.__results = results; });
    </script>`);
    return;
  }
  if (request.url === "/document/401" || request.url === "/document/502") {
    const status = Number(request.url.slice(-3));
    response.writeHead(status, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html><h1>HTTP ${status} boundary</h1>`);
    return;
  }
  if (request.url === "/status/401" || request.url === "/status/502") {
    const status = Number(request.url.slice(-3));
    response.writeHead(status, { "content-type": "application/json" });
    response.end(responseBody);
    return;
  }
  response.writeHead(404);
  response.end();
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});

const address = server.address();
if (!address || typeof address === "string") throw new Error("No TCP address");
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const consoleErrors = [];
  const responses = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      responses.push({
        path: new URL(response.url()).pathname,
        status: response.status(),
      });
    }
  });

  await page.goto(`${origin}/fetch`);
  await page.waitForFunction("Array.isArray(window.__results)");
  const fetchResults = await page.evaluate("window.__results");
  const fetchConsoleErrors = [...consoleErrors];

  consoleErrors.length = 0;
  await page.goto(`${origin}/service-worker`);
  await page.waitForFunction("Array.isArray(window.__results)");
  const serviceWorkerResults = await page.evaluate("window.__results");
  const serviceWorkerConsoleErrors = [...consoleErrors];

  consoleErrors.length = 0;
  await page.goto(`${origin}/document/401`);
  const document401 = {
    heading: await page.locator("h1").textContent(),
    consoleErrors: [...consoleErrors],
  };

  consoleErrors.length = 0;
  await page.goto(`${origin}/document/502`);
  const document502 = {
    heading: await page.locator("h1").textContent(),
    consoleErrors: [...consoleErrors],
  };

  const result = {
    chromiumVersion: browser.version(),
    fetch: { results: fetchResults, consoleErrors: fetchConsoleErrors },
    serviceWorkerFetch: {
      results: serviceWorkerResults,
      consoleErrors: serviceWorkerConsoleErrors,
    },
    document401,
    document502,
    failingResponses: responses,
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

  if (
    process.argv.includes("--assert-console-zero") &&
    (fetchConsoleErrors.length > 0 ||
      serviceWorkerConsoleErrors.length > 0 ||
      document401.consoleErrors.length > 0 ||
      document502.consoleErrors.length > 0)
  ) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
