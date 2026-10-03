import { createUsgsEarthquakeSource } from "../vendor/src/layers/earthquakes/source.js";
const ENDPOINT =
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";
const LIMIT = 2 * 1024 * 1024;
export async function fetchEarthquakes({
  signal,
  fetchImpl = globalThis.fetch,
  timeoutMs = 12000,
} = {}) {
  const timeout = new AbortController();
  const timer = setTimeout(
    () =>
      timeout.abort(new DOMException("USGS request timed out", "TimeoutError")),
    Math.min(Math.max(timeoutMs, 1), 15000),
  );
  const combined = signal
    ? AbortSignal.any([signal, timeout.signal])
    : timeout.signal;
  const guardedFetch = async (url) => {
    combined.throwIfAborted();
    if (url !== ENDPOINT) throw new Error("Unapproved endpoint");
    const response = await fetchImpl(ENDPOINT, {
      signal: combined,
      credentials: "omit",
      redirect: "error",
      headers: { Accept: "application/geo+json, application/json" },
    });
    combined.throwIfAborted();
    if (response.redirected) {
      await response.body?.cancel();
      throw new Error("USGS redirect rejected");
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`USGS HTTP ${response.status}`);
    }
    if (Number(response.headers.get("content-length")) > LIMIT) {
      await response.body?.cancel();
      throw new Error("USGS response too large");
    }
    if (!response.body) throw new Error("USGS empty response");
    const reader = response.body.getReader();
    const chunks = [];
    let bytes = 0;
    const onAbort = () => {
      reader.cancel(combined.reason).catch(() => {});
    };
    combined.addEventListener("abort", onAbort, { once: true });
    try {
      while (true) {
        combined.throwIfAborted();
        const { done, value } = await reader.read();
        combined.throwIfAborted();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > LIMIT) throw new Error("USGS response too large");
        chunks.push(value);
      }
    } catch (e) {
      await reader.cancel().catch(() => {});
      throw e;
    } finally {
      combined.removeEventListener("abort", onAbort);
      reader.releaseLock();
    }
    const body = new Uint8Array(bytes);
    let offset = 0;
    for (const c of chunks) {
      body.set(c, offset);
      offset += c.length;
    }
    return {
      ok: true,
      json: async () =>
        JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)),
    };
  };
  try {
    const rows = await createUsgsEarthquakeSource({
      fetchImpl: guardedFetch,
    }).getSnapshot({ signal: combined });
    if (
      rows.some(
        (r) =>
          r.time === null ||
          !Number.isFinite(r.time) ||
          Math.abs(r.time) > 8640000000000000,
      )
    )
      throw new Error("USGS event timestamp missing");
    combined.throwIfAborted();
    return { rows, fetchedAt: new Date().toISOString() };
  } finally {
    clearTimeout(timer);
  }
}
