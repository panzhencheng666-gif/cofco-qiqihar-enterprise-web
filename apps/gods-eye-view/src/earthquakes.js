import { createUsgsEarthquakeSource } from "../vendor/src/layers/earthquakes/source.js";
const ENDPOINT =
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";
const LIMIT = 2 * 1024 * 1024;
const MAX_SOURCE_FEATURES = 10000;
const MAX_ROWS = 500;
const validTime = (value) =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  Math.abs(value) <= 8640000000000000;
/** Reject the whole source before upstream normalization, including the omitted tail. */
function validatePayload(payload) {
  if (
    !Array.isArray(payload?.features) ||
    payload.features.length > MAX_SOURCE_FEATURES
  )
    throw new Error("USGS feature count invalid");
  const generated = payload.metadata?.generated;
  if (generated != null && !validTime(generated))
    throw new Error("USGS source timestamp invalid");
  const identities = new Set();
  for (const [index, feature] of payload.features.entries()) {
    const id = feature?.id;
    if (id != null && (typeof id !== "string" || id.length > 100))
      throw new Error("USGS identity invalid");
    const stableId = id || `event-${index + 1}`;
    if (identities.has(stableId)) throw new Error("USGS duplicate identity");
    identities.add(stableId);
    const properties = feature?.properties;
    if (!validTime(properties?.time))
      throw new Error("USGS event timestamp missing");
    if (properties.place != null && typeof properties.place !== "string")
      throw new Error("USGS place invalid");
    if (
      properties.mag != null &&
      (!Number.isFinite(properties.mag) ||
        properties.mag < -10 ||
        properties.mag > 10)
    )
      throw new Error("USGS magnitude invalid");
    const depth = feature?.geometry?.coordinates?.[2];
    if (
      depth != null &&
      (!Number.isFinite(depth) || depth < -10 || depth > 1000)
    )
      throw new Error("USGS depth invalid");
  }
  return {
    sourceAt: generated == null ? null : new Date(generated).toISOString(),
    sourceFeatures: payload.features.length,
  };
}
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
  let provenance;
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
      json: async () => {
        const payload = JSON.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(body),
        );
        provenance = validatePayload(payload);
        return payload;
      },
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
    return {
      rows: rows
        .slice(0, MAX_ROWS)
        .map((row) => Object.freeze({ ...row, place: row.place ?? null })),
      fetchedAt: new Date().toISOString(),
      totalMatched: rows.length,
      ...provenance,
    };
  } finally {
    clearTimeout(timer);
  }
}
