import { Cartesian3, Color, PointPrimitiveCollection } from "@cesium/engine";
import { fetchEarthquakes } from "./earthquakes.js";
import { createEarthquakeAnalyst } from "./earthquake-analyst.js";
import { createEarthquakeDisplay } from "./earthquake-display.js";
export function installEarthquakeControls({
  viewer,
  signal,
  nodes,
  onFatalError,
  fetchSnapshot = fetchEarthquakes,
  createCollection = () => new PointPrimitiveCollection(),
}) {
  const disposers = [];
  let disposed = false;
  const listen = (node, type, callback) => {
    node.addEventListener(type, callback);
    disposers.push(() => node.removeEventListener(type, callback));
  };
  const display = createEarthquakeDisplay({
    list: nodes.list,
    primitives: viewer.scene.primitives,
    createCollection,
    onFatalError,
    pointOptions: (row) => ({
      position: Cartesian3.fromDegrees(row.lon, row.lat, 2500),
      pixelSize: Math.min(14, 5 + row.mag),
      color: Color.fromCssColorString(row.mag >= 5 ? "#ff8c64" : "#f3c56c"),
      outlineColor: Color.fromCssColorString("#3a241a"),
      outlineWidth: 1,
      disableDepthTestDistance: 0,
    }),
  });
  const controls = [
    nodes.apply,
    nodes.magnitude,
    nodes.minDepth,
    nodes.maxDepth,
    nodes.place,
    nodes.sort,
    nodes.scope,
    nodes.lat,
    nodes.lon,
    nodes.km,
  ];
  const analyst = createEarthquakeAnalyst({
    signal,
    fetchSnapshot,
    stage: display.stage,
    onFatalError,
    requestRender: () => viewer.scene.requestRender(),
    onState(state) {
      const { snapshot, result, selected, loading, stale, stopped, error } =
        state;
      nodes.refresh.disabled = stopped || loading;
      nodes.clear.disabled = stopped || (!snapshot && !loading);
      for (const node of controls)
        node.disabled = stopped || loading || !snapshot;
      nodes.focus.disabled = stopped || !selected;
      if (stopped) {
        nodes.status.textContent = "地震观察已停止。";
        nodes.summary.textContent = "尚无可查询快照。";
      } else if (loading) nodes.status.textContent = "正在获取 USGS 公开快照…";
      else if (snapshot) {
        nodes.refresh.textContent = "重新获取地震数据";
        nodes.status.textContent = `USGS · 获取 UTC ${snapshot.fetchedAt} · 源生成 UTC ${snapshot.sourceAt || "未提供"} · ${stale ? "可能过时（STALE）" : "手动快照，来源可能延迟"}${error ? ` · ${error}` : ""}。`;
      } else
        nodes.status.textContent = error
          ? `USGS 暂时不可用：${error}。尚无可用数据。`
          : "地震图层已关闭，未继续请求。";
      if (snapshot && result)
        nodes.summary.textContent = `已加载 ${snapshot.rows.length}/${snapshot.totalMatched} 个 M2.5+ 事件（源共 ${snapshot.sourceFeatures} 条）；${snapshot.totalMatched > snapshot.rows.length ? "源记录截断；" : ""}本地匹配 ${result.count} 个，列出前 ${result.items.length} 个${result.truncated ? "（列表截断）" : ""}。${result.query.scope.kind === "radius" ? `范围：中心 ${result.query.scope.center.lat}, ${result.query.scope.center.lon}，${result.query.scope.km} km；` : "范围：全部已加载记录；"}地图点为全部已加载事件。${result.query.sortBy === "depthKm" ? "深度排序排除未提供深度的事件。" : ""}${stale ? "结果来自可能过时的快照。" : ""}`;
      else if (!stopped) nodes.summary.textContent = "尚无可查询快照。";
      nodes.metadata.textContent = selected
        ? `USGS ID ${selected.usgsId ?? selected.stableId} · ${selected.place?.slice(0, 200) || "未提供地点"}${selected.place?.length > 200 ? "（地点显示截断）" : ""} · M${selected.mag.toFixed(1)} · 深度 ${selected.depthKm === null ? "未提供" : `${selected.depthKm} km`} · 纬度 ${selected.lat} · 经度 ${selected.lon} · 震时 UTC ${new Date(selected.time).toISOString()} · 获取 UTC ${snapshot.fetchedAt} · 源生成 UTC ${snapshot.sourceAt || "未提供"}${stale ? " · 可能过时（STALE）" : ""}`
        : "尚未选择地震事件。";
    },
  });
  const refresh = () => analyst.refresh();
  const apply = async () => {
    try {
      const options = {
        minMagnitude: Number(nodes.magnitude.value),
        place: nodes.place.value,
        sort: nodes.sort.value,
        scope: nodes.scope.value,
      };
      for (const [key, node] of [
        ["minDepth", nodes.minDepth],
        ["maxDepth", nodes.maxDepth],
      ])
        if (node.value.trim()) options[key] = Number(node.value);
      if (options.scope === "radius")
        Object.assign(options, {
          lat: numeric(nodes.lat),
          lon: numeric(nodes.lon),
          km: numeric(nodes.km),
        });
      await analyst.query(options);
    } catch (error) {
      if (!disposed && !signal.aborted)
        nodes.summary.textContent = `查询未更改：${error.message}`;
    }
  };
  const numeric = (node) => (node.value.trim() ? Number(node.value) : NaN);
  const select = (event) => {
    const button = event.target.closest?.("button[data-earthquake-id]");
    if (button && nodes.list.contains(button))
      analyst.select(button.dataset.earthquakeId);
  };
  const focus = () => {
    const row = analyst.state().selected;
    if (!row || disposed || signal.aborted) return;
    try {
      analyst.select(row.stableId);
      if (disposed || signal.aborted) return;
      viewer.camera.cancelFlight();
      if (disposed || signal.aborted) return;
      viewer.camera.setView({
        destination: Cartesian3.fromDegrees(row.lon, row.lat, 650000),
        orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 },
      });
      if (!disposed && !signal.aborted) viewer.scene.requestRender();
    } catch (error) {
      onFatalError(error);
    }
  };
  const clear = () => {
    if (disposed || signal.aborted) return;
    for (const [key, value] of Object.entries({
      magnitude: "2.5",
      minDepth: "",
      maxDepth: "",
      place: "",
      sort: "magnitude-desc",
      scope: "anywhere",
      lat: "",
      lon: "",
      km: "100",
    }))
      nodes[key].value = value;
    analyst.clear();
  };
  const destroy = () => {
    if (disposed) return;
    disposed = true;
    signal.removeEventListener("abort", destroy);
    for (const dispose of disposers) dispose();
    try {
      analyst.destroy();
    } finally {
      display.destroy();
    }
  };
  try {
    signal.throwIfAborted();
    listen(nodes.refresh, "click", refresh);
    listen(nodes.clear, "click", clear);
    listen(nodes.apply, "click", apply);
    listen(nodes.list, "click", select);
    listen(nodes.focus, "click", focus);
    signal.addEventListener("abort", destroy, { once: true });
  } catch (error) {
    destroy();
    throw error;
  }
  return destroy;
}
