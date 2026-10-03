import { feedProvenanceEnvelope } from "../vendor/src/data/layerSnapshot.js";
import { createAnalystEngine } from "../vendor/src/data/analystEngine.js";
export const POINT_LIMIT = 500;
export const LIST_LIMIT = 50;
const STALE_MS = 15 * 60 * 1000;
const number = (value, min, max) => {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    throw new TypeError("查询数值超出范围。");
  return value;
};
/** Only these controls can construct an upstream query; never accept query JSON. */
function querySpec(options = {}) {
  const allowed = [
    "minMagnitude",
    "minDepth",
    "maxDepth",
    "place",
    "sort",
    "scope",
    "lat",
    "lon",
    "km",
  ];
  if (Object.keys(options).some((key) => !allowed.includes(key)))
    throw new TypeError("不支持的查询选项。");
  const filters = [
    {
      field: "magnitude",
      op: "gte",
      value: number(options.minMagnitude ?? 2.5, 2.5, 10),
    },
  ];
  for (const [key, op] of [
    ["minDepth", "gte"],
    ["maxDepth", "lte"],
  ])
    if (options[key] !== undefined)
      filters.push({
        field: "depthKm",
        op,
        value: number(options[key], -10, 1000),
      });
  if (
    options.minDepth !== undefined &&
    options.maxDepth !== undefined &&
    options.minDepth > options.maxDepth
  )
    throw new TypeError("深度范围无效。");
  if (options.place !== undefined) {
    if (typeof options.place !== "string" || options.place.length > 80)
      throw new TypeError("地点文字最多 80 字。");
    if (options.place.trim())
      filters.push({
        field: "place",
        op: "contains",
        value: options.place.trim(),
      });
  }
  const sort = options.sort ?? "magnitude-desc";
  if (
    !["magnitude-desc", "magnitude-asc", "depth-desc", "depth-asc"].includes(
      sort,
    )
  )
    throw new TypeError("排序无效。");
  const depth = sort.startsWith("depth");
  if (depth) filters.push({ field: "depthKm", op: "gte", value: -10 }); // null depth is unknown, never zero
  let scope = { kind: "anywhere" };
  if (options.scope === "radius")
    scope = {
      kind: "radius",
      center: {
        lat: number(options.lat, -90, 90),
        lon: number(options.lon, -180, 180),
      },
      km: number(options.km, 1, 20000),
    };
  else if (options.scope !== undefined && options.scope !== "anywhere")
    throw new TypeError("范围无效。");
  return {
    layers: ["earthquakes"],
    scope,
    filters,
    sortBy: depth ? "depthKm" : "magnitude",
    sortDir: sort.endsWith("asc") ? "asc" : "desc",
    limit: LIST_LIMIT,
  };
}
/** Own snapshot, engine memory, selection, async generations and staged display together. */
export function createEarthquakeAnalyst({
  fetchSnapshot,
  stage,
  onState = () => {},
  requestRender = () => {},
  onFatalError = () => {},
  signal,
  now = () => Date.now(),
}) {
  let snapshot = null,
    result = null,
    selected = null,
    stale = false,
    loading = false,
    stopped = false,
    error = null;
  let generation = 0,
    request,
    display,
    engine,
    options = {};
  const pendingEngines = new Set();
  const state = () => ({
    snapshot,
    result,
    selected,
    stale,
    loading,
    stopped,
    error,
  });
  const emit = () => onState(state());
  const alive = () => !stopped && !signal?.aborted;
  const resetMemory = () => {
    engine?.reset();
    for (const entry of pendingEngines) entry.reset();
  };
  const invalidate = () => {
    ++generation;
    request?.abort();
    resetMemory();
    return generation;
  };
  const release = () => {
    const previous = display;
    display = undefined;
    previous?.dispose();
  };
  const clearState = () => {
    snapshot = result = selected = null;
    engine = undefined;
    stale = loading = false;
    error = null;
  };
  const destroy = () => {
    if (stopped) return;
    stopped = true;
    invalidate();
    signal?.removeEventListener("abort", destroy);
    clearState();
    try {
      release();
    } finally {
      emit();
    }
  };
  const fatal = (failure) => {
    try {
      destroy();
    } finally {
      onFatalError(failure);
    }
  };
  const isExpired = (next, includePriorFailure = true) =>
    Boolean(
      (includePriorFailure && stale) ||
      now() - Date.parse(next.fetchedAt) > STALE_MS ||
      (next.sourceAt && now() - Date.parse(next.sourceAt) > STALE_MS),
    );
  const stampStaleProvenance = () => {
    if (result)
      result = {
        ...result,
        coverage: {
          ...result.coverage,
          feedProvenance: feedProvenanceEnvelope(
            result.coverage.feedProvenance.layers.map((layer) => ({
              ...layer,
              feedState: "stale",
              error,
            })),
          ),
        },
      };
  };
  const reassessAge = () => {
    if (snapshot && isExpired(snapshot)) {
      stale = true;
      stampStaleProvenance();
    }
  };
  const apply = async (next, spec, ticket, freshSource = false) => {
    const expired = isExpired(next, !freshSource);
    const queryEngine = createAnalystEngine({
      getRecords: () =>
        next.rows.map((r) => ({ ...r, id: r.stableId, magnitude: r.mag })),
      getLayerSnapshot: () => ({
        id: "earthquakes",
        name: "USGS",
        enabled: true,
        source: "USGS manual snapshot",
        feedState: expired ? "stale" : "nominal",
        lastUpdate: Date.parse(next.fetchedAt),
        error: null,
      }),
      getRecordCoverage: () => ({
        basis: "bounded-loaded-records",
        examined: next.rows.length,
        total: next.totalMatched,
        truncated: next.totalMatched > next.rows.length,
      }),
      getViewContext: () => ({ lat: 0, lon: 0 }),
      resolveRegionRing: () => {
        throw new Error("Named regions disabled");
      },
    });
    pendingEngines.add(queryEngine);
    let candidate;
    try {
      const nextResult = await queryEngine.query(spec);
      nextResult.query = {
        scope: spec.scope,
        sortBy: spec.sortBy,
        sortDir: spec.sortDir,
      };
      if (!alive() || ticket !== generation) return;
      candidate = await stage({ snapshot: next, result: nextResult });
      if (!alive() || ticket !== generation) {
        candidate.dispose();
        candidate = undefined;
        return;
      }
      // Mount has side effects: failure is terminal because arbitrary renderer rollback cannot be trusted.
      try {
        candidate.commit();
        if (!alive() || ticket !== generation) return;
        release();
        if (!alive() || ticket !== generation) return;
        display = candidate;
        candidate = undefined;
        engine?.reset();
        engine = queryEngine;
        selected =
          next === snapshot &&
          nextResult.items.some((row) => row.id === selected?.stableId)
            ? selected
            : null;
        snapshot = next;
        result = nextResult;
        stale = Boolean(expired);
        error = null;
        emit();
        if (alive() && ticket === generation) requestRender();
      } catch (failure) {
        fatal(failure);
        throw failure;
      }
    } finally {
      pendingEngines.delete(queryEngine);
      if (engine !== queryEngine) queryEngine.reset();
      candidate?.dispose();
    }
  };
  const markFailure = (failure) => {
    resetMemory();
    error = String(failure.message || "USGS 不可用").slice(0, 200);
    stale = Boolean(snapshot);
    stampStaleProvenance();
    emit();
  };
  const refresh = async () => {
    if (!alive()) return;
    reassessAge();
    const ticket = invalidate();
    request = new AbortController();
    loading = true;
    error = null;
    emit();
    try {
      const next = await fetchSnapshot({
        signal: signal
          ? AbortSignal.any([signal, request.signal])
          : request.signal,
      });
      if (!alive() || ticket !== generation) return;
      // Prior displayed provenance stays intact until the newly acquired source commits.
      await apply(next, querySpec(options), ticket, true);
    } catch (failure) {
      if (alive() && ticket === generation) markFailure(failure);
    } finally {
      if (alive() && ticket === generation) {
        loading = false;
        emit();
      }
    }
  };
  const query = async (nextOptions = {}) => {
    const spec = querySpec(nextOptions);
    if (!alive() || !snapshot) return;
    const ticket = invalidate();
    loading = false;
    try {
      await apply(snapshot, spec, ticket);
      if (alive() && ticket === generation) options = { ...nextOptions };
    } catch (failure) {
      if (alive() && ticket === generation) markFailure(failure);
      throw failure;
    }
  };
  const select = (id) => {
    if (!alive() || !snapshot) return null;
    reassessAge();
    selected = result?.items.some((row) => row.id === id)
      ? snapshot.rows.find((row) => row.stableId === id) || null
      : null;
    emit();
    return selected;
  };
  const clear = () => {
    if (!alive()) return;
    const ticket = invalidate();
    options = {};
    clearState();
    try {
      release();
      if (!alive() || ticket !== generation) return;
      emit();
      if (alive() && ticket === generation) requestRender();
    } catch (failure) {
      fatal(failure);
    }
  };
  signal?.addEventListener("abort", destroy, { once: true });
  if (signal?.aborted) destroy();
  return { refresh, query, select, clear, destroy, state };
}
