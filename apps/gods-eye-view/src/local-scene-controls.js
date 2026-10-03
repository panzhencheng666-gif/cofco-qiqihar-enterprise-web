import { createLocalGeometry } from "./local-geometry.js";
import { exportScene, MAX_SCENE_BYTES, parseScene } from "./scene-state.js";

/** Explicit local inputs only. No file access occurs until the user chooses one. */
export function installLocalSceneControls({
  viewer,
  signal,
  nodes,
  capture,
  apply,
  createGeometry = createLocalGeometry,
}) {
  const removers = [],
    rowRemovers = [];
  let local,
    disposed = false,
    generation = 0;
  const alive = () => !disposed && !signal?.aborted && !viewer.isDestroyed?.();
  const error = (value) => {
    if (alive())
      nodes.status.textContent = value.message || "操作未完成，请检查输入。";
  };
  const forgetExport = () => {
    nodes.output.value = "";
  };
  const emptyRows = () => {
    for (const remove of rowRemovers.splice(0)) remove();
    nodes.list.replaceChildren();
  };
  const changed = (state, distance) => {
    if (!alive()) return;
    ++generation;
    emptyRows();
    forgetExport();
    const document = nodes.list.ownerDocument;
    state.annotations.forEach((point, index) => {
      const row = document.createElement("li"),
        text = document.createElement("span"),
        remove = document.createElement("button");
      text.textContent = `${point.label} · ${point.lat.toFixed(4)}, ${point.lon.toFixed(4)}`;
      remove.type = "button";
      remove.textContent = "删除";
      remove.setAttribute("aria-label", `删除注释：${point.label}`);
      const click = () => {
        if (!alive()) return;
        ++generation;
        const next = local.snapshot();
        next.annotations.splice(index, 1);
        local.replace(next);
      };
      remove.addEventListener("click", click);
      rowRemovers.push(() => remove.removeEventListener("click", click));
      row.append(text, remove);
      nodes.list.append(row);
    });
    nodes.status.textContent =
      `${state.annotations.length}/50 个本地注释。` +
      (distance !== undefined
        ? `WGS84 椭球表面估算：${(distance / 1000).toFixed(3)} km；非道路或地形距离。`
        : state.measurement.length
          ? "已选择第一个测量点；请再选择第二个点。"
          : "尚无两点测量。");
    nodes.cancel.disabled = true;
  };
  const release = () => {
    if (disposed) return;
    disposed = true;
    ++generation;
    signal?.removeEventListener("abort", release);
    for (const remove of removers.splice(0).reverse()) remove();
    emptyRows();
    local?.destroy();
    nodes.input.value = nodes.output.value = nodes.file.value = "";
  };
  const listen = (node, event, action) => {
    const handler = () => {
      if (!alive()) return;
      try {
        action();
      } catch (value) {
        error(value);
      }
    };
    node.addEventListener(event, handler);
    removers.push(() => node.removeEventListener(event, handler));
  };
  const importText = (text) => {
    const next = parseScene(text);
    local.prepare(next); // Validate the geodesic as well, before map/style/camera mutation.
    apply(next, local);
    nodes.status.textContent += " 已导入本地场景。";
  };
  try {
    local = createGeometry({
      viewer,
      signal,
      onChange: changed,
      onError: error,
    });
    changed(local.snapshot());
    listen(nodes.add, "click", () => {
      ++generation;
      if (!nodes.lat.value.trim() || !nodes.lon.value.trim())
        throw new TypeError("请输入纬度与经度。");
      const point = {
        lat: Number(nodes.lat.value),
        lon: Number(nodes.lon.value),
      };
      if (nodes.kind.value === "measurement") local.addMeasurement(point);
      else local.addAnnotation({ ...point, label: nodes.label.value });
    });
    listen(nodes.pick, "click", () => {
      ++generation;
      local.beginPick(nodes.kind.value, nodes.label.value);
      nodes.cancel.disabled = false;
      nodes.status.textContent =
        "选择模式已开启：点击地球表面放置一个点；也可取消选择或使用坐标输入。";
    });
    listen(nodes.cancel, "click", () => {
      local.cancelPick();
      nodes.cancel.disabled = true;
      nodes.status.textContent = "已取消地球选择。";
    });
    listen(nodes.clear, "click", () => {
      ++generation;
      local.clear();
    });
    listen(nodes.import, "click", () => {
      ++generation;
      importText(nodes.input.value);
    });
    listen(nodes.file, "change", () => {
      const file = nodes.file.files?.[0],
        ticket = ++generation;
      nodes.file.value = "";
      local.cancelPick();
      nodes.cancel.disabled = true;
      if (!file) return;
      if (
        !Number.isFinite(file.size) ||
        file.size > MAX_SCENE_BYTES ||
        file.size < 0
      ) {
        nodes.file.value = "";
        throw new TypeError("场景文件超过 64 KiB 限制，未读取。");
      }
      void file
        .text()
        .then((text) => {
          if (alive() && ticket === generation) importText(text);
        })
        .catch((value) => {
          if (alive() && ticket === generation) error(value);
        });
    });
    listen(nodes.export, "click", () => {
      nodes.output.value = exportScene({ ...capture(), ...local.snapshot() });
      nodes.status.textContent =
        "已生成本地 JSON 文本。点击选择后自行复制；没有自动保存文件。";
    });
    listen(nodes.select, "click", () => {
      nodes.output.focus();
      nodes.output.select();
    });
    signal?.addEventListener("abort", release, { once: true });
    if (signal?.aborted) release();
    return release;
  } catch (value) {
    release();
    throw value;
  }
}
