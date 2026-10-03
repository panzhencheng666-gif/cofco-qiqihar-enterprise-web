import { POINT_LIMIT, LIST_LIMIT } from "./earthquake-analyst.js";
/** Stage detached point resources and plain-text rows before a logical replacement. */
export function createEarthquakeDisplay({
  list,
  primitives,
  createCollection,
  pointOptions,
  onFatalError = () => {},
}) {
  const owned = new Set();
  let listOwner,
    stopped = false;
  const requireAlive = () => {
    if (stopped) throw new Error("地震显示已停止。");
  };
  const release = (collection) => {
    let failure;
    try {
      const removed = primitives.remove(collection);
      if (!removed && !collection.isDestroyed?.()) collection.destroy();
      owned.delete(collection);
    } catch (error) {
      failure = error;
      try {
        if (!collection.isDestroyed?.()) collection.destroy();
      } catch {
        /* Viewer remains the final owner. */
      }
    }
    if (failure) throw failure;
  };
  const stage = ({ snapshot, result }) => {
    if (stopped) throw new Error("地震显示已停止。");
    if (snapshot.rows.length > POINT_LIMIT || result.items.length > LIST_LIMIT)
      throw new Error("地震显示超出范围。");
    const collection = createCollection();
    owned.add(collection);
    const rows = [];
    let disposed = false;
    const token = {};
    const dispose = () => {
      if (disposed) return;
      try {
        release(collection);
        disposed = true;
      } finally {
        if (listOwner === token) {
          listOwner = undefined;
          list.replaceChildren();
        }
      }
    };
    try {
      collection.show = false;
      for (const row of snapshot.rows) {
        requireAlive();
        collection.add(pointOptions(row));
        requireAlive();
      }
      for (const row of result.items) {
        const li = list.ownerDocument.createElement("li"),
          button = list.ownerDocument.createElement("button"),
          time = list.ownerDocument.createElement("time");
        button.type = "button";
        button.dataset.earthquakeId = row.id;
        button.textContent = `M${row.mag.toFixed(1)} · ${row.place?.slice(0, 200) || "未提供地点"}${row.place?.length > 200 ? "（地点显示截断）" : ""}`;
        time.dateTime = new Date(row.time).toISOString();
        time.textContent = `震时 ${time.dateTime} · UTC`;
        li.append(button, time);
        rows.push(li);
      }
    } catch (error) {
      try {
        dispose();
      } catch (failure) {
        onFatalError(failure);
      }
      throw error;
    }
    return {
      commit() {
        if (stopped || disposed) throw new Error("地震显示已停止。");
        primitives.add(collection);
        requireAlive();
        list.replaceChildren(...rows);
        requireAlive();
        listOwner = token;
        collection.show = true;
        requireAlive();
      },
      dispose,
    };
  };
  const destroy = () => {
    stopped = true;
    const failures = [];
    for (const collection of owned) {
      try {
        release(collection);
      } catch (error) {
        failures.push(error);
      }
    }
    listOwner = undefined;
    list.replaceChildren();
    if (failures.length)
      throw new AggregateError(failures, "地震资源释放失败。");
  };
  return { stage, destroy };
}
