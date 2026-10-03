import {
  Cartesian3,
  Color,
  Math as CesiumMath,
  OpenStreetMapImageryProvider,
  ImageryLayer,
  PointPrimitiveCollection,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Cartographic,
  UrlTemplateImageryProvider,
  GeographicTilingScheme,
} from "@cesium/engine";
import { createApplication } from "../vendor/src/app/application.js";
import { parseCoordinateQuery } from "../vendor/src/search/coordinateParser.js";
import { createApplicationViewer, installTrackpadPinchZoom } from "./viewer.js";
import { fetchEarthquakes } from "./earthquakes.js";
import { installSearchControls } from "./search-controls.js";
import { NATURAL_EARTH_OPTIONS } from "./basemaps.js";
import { createStaticVisualEffects } from "./static-effects.js";
import { installRenderFailureHandler } from "./render-errors.js";
import {
  installDisplayControls,
  updateVisualEffectStatus,
} from "./display-controls.js";
const CITIES = new Map(
  Object.entries({
    齐齐哈尔: [47.3543, 123.9182],
    北京: [39.9042, 116.4074],
    上海: [31.2304, 121.4737],
    广州: [23.1291, 113.2644],
    深圳: [22.5431, 114.0579],
    香港: [22.3193, 114.1694],
    成都: [30.5728, 104.0668],
    东京: [35.6762, 139.6503],
    伦敦: [51.5074, -0.1278],
    纽约: [40.7128, -74.006],
    巴黎: [48.8566, 2.3522],
    悉尼: [-33.8688, 151.2093],
    beijing: [39.9042, 116.4074],
    shanghai: [31.2304, 121.4737],
    london: [51.5074, -0.1278],
  }),
);
const $ = (id) => document.getElementById(id);
export async function startGlobe(signal) {
  const externalSignal = signal;
  let renderStopped = false;
  const app = createApplication({
    createScene({ defer, signal }) {
      signal.throwIfAborted();
      defer(() => externalSignal.removeEventListener("abort", destroy));
      const viewer = createApplicationViewer({
        container: $("globe"),
        creditContainer: $("credits"),
      });
      defer(() => {
        if (!viewer.isDestroyed()) viewer.destroy();
      });
      const scene = viewer.scene;
      let imagery;
      let removeImageryError;
      const clearImagery = () => {
        removeImageryError?.();
        removeImageryError = undefined;
        if (imagery && !viewer.isDestroyed())
          viewer.imageryLayers.remove(imagery, true);
        imagery = undefined;
      };
      defer(clearImagery);
      const onError = () => {
        if (renderStopped) return;
        $("globe-status").textContent =
          "地球渲染不可用，请检查浏览器图形支持后重新打开。";
      };
      const removeError = scene.renderError.addEventListener(onError);
      defer(removeError);
      const home = () => {
        viewer.camera.cancelFlight();
        viewer.camera.flyTo({
          destination: Cartesian3.fromDegrees(108, 24, 28000000),
          duration: 1.2,
        });
        scene.requestRender();
      };
      const go = (lat, lon, height = 220000) => {
        viewer.camera.cancelFlight();
        viewer.camera.flyTo({
          destination: Cartesian3.fromDegrees(lon, lat, height),
          orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 },
          duration: 1.2,
        });
        scene.requestRender();
      };
      const setStyle = (value) => {
        if (signal.aborted || viewer.isDestroyed()) return;
        clearImagery();
        if (value === "natural") {
          const provider = new UrlTemplateImageryProvider({
            ...NATURAL_EARTH_OPTIONS,
            tilingScheme: new GeographicTilingScheme(),
          });
          removeImageryError = provider.errorEvent.addEventListener(() => {
            if (signal.aborted || viewer.isDestroyed()) return;
            $("map-state").textContent =
              "本地概览地图暂时不可用，可切换纯净地球。";
          });
          imagery = new ImageryLayer(provider);
          viewer.imageryLayers.add(imagery);
          $("map-state").textContent =
            "Natural Earth · 历史全球概览 · 非近期影像";
        } else if (value === "osm") {
          $("map-state").textContent = "OpenStreetMap · 正在加载街道地图…";
          const provider = new OpenStreetMapImageryProvider({
            url: "https://tile.openstreetmap.org/",
            maximumLevel: 17,
            enablePickFeatures: false,
          });
          removeImageryError = provider.errorEvent.addEventListener(() => {
            if (signal.aborted || viewer.isDestroyed()) return;
            $("map-state").textContent = "街道地图暂时不可用，可切换纯净地球。";
          });
          imagery = new ImageryLayer(provider);
          viewer.imageryLayers.add(imagery);
          $("map-state").textContent = "OpenStreetMap 街道地图 · 非卫星影像";
        } else $("map-state").textContent = "纯净地球 · 椭球表面";
        scene.requestRender();
      };
      setStyle("natural");
      home();
      return { viewer, home, go, setStyle };
    },
    createControls({ scene: { viewer, home, go, setStyle }, defer, signal }) {
      const listen = (node, event, fn) => {
        node.addEventListener(event, fn);
        defer(() => node.removeEventListener(event, fn));
      };
      const navigate = (query) => {
        const city =
          CITIES.get(query.trim().toLowerCase()) || CITIES.get(query.trim());
        const location = city
          ? { lat: city[0], lon: city[1], label: query }
          : parseCoordinateQuery(query);
        if (!location) {
          $("search-status").textContent =
            "未找到本地城市。请输入纬度, 经度，例如 47.35, 123.92。";
          return;
        }
        go(location.lat, location.lon);
        $("search-status").textContent = `已定位：${location.label}`;
      };
      defer(
        installSearchControls({
          input: $("query"),
          button: $("search-button"),
          onQuery: navigate,
        }),
      );
      document
        .querySelectorAll("[data-city]")
        .forEach((button) =>
          listen(button, "click", () => navigate(button.dataset.city)),
        );
      listen($("home"), "click", home);
      listen($("map-style"), "change", (event) => setStyle(event.target.value));
      const effects = createStaticVisualEffects({ viewer });
      defer(() => effects.destroy());
      const displayNodes = {
        overhead: $("overhead"),
        oblique: $("oblique"),
        save: $("save-view"),
        restore: $("restore-view"),
        cameraStatus: $("camera-status"),
        clean: $("clean-view"),
        sharpen: $("sharpen"),
        sharpenIntensity: $("sharpen-intensity"),
        bloom: $("bloom"),
        bloomIntensity: $("bloom-intensity"),
        effectStatus: $("effect-status"),
        style: $("visual-style"),
      };
      defer(
        installDisplayControls({
          viewer,
          effects,
          signal,
          overlays: [...document.querySelectorAll("[data-clean-overlay]")],
          nodes: displayNodes,
        }),
      );
      defer(
        installRenderFailureHandler({
          viewer,
          effects,
          signal,
          onStopped() {
            renderStopped = true;
            $("globe-status").textContent =
              "地球渲染已停止，请使用上方“暂停地球观察”后重新打开。";
            $("effect-status").textContent =
              "视觉渲染已停止，当前画面不可继续使用。";
            document.querySelectorAll("button,input,select").forEach((node) => {
              node.disabled = true;
            });
            // Abort all application work immediately; cleanup runs after this
            // render callback and disposes controls/data before the widget.
            void app.destroy().catch(() => {});
          },
        }),
      );
      listen($("visual-style"), "change", (event) => {
        try {
          effects.setStyle(event.target.value);
          updateVisualEffectStatus(displayNodes);
        } catch {
          effects.clear();
          $("visual-style").value = "normal";
          $("sharpen").checked = false;
          $("bloom").checked = false;
          $("effect-status").textContent =
            "此浏览器暂时无法使用该视觉风格，已恢复原始画面。";
        }
      });
      listen($("zoom-in"), "click", () => {
        viewer.camera.zoomIn(
          Math.max(viewer.camera.positionCartographic.height * 0.4, 100),
        );
        viewer.scene.requestRender();
      });
      listen($("zoom-out"), "click", () => {
        viewer.camera.zoomOut(
          Math.max(viewer.camera.positionCartographic.height * 0.4, 100),
        );
        viewer.scene.requestRender();
      });
      listen($("north"), "click", () => {
        viewer.camera.setView({
          orientation: { heading: 0, pitch: viewer.camera.pitch, roll: 0 },
        });
        viewer.scene.requestRender();
      });
      defer(installTrackpadPinchZoom(viewer));
      const handler = new ScreenSpaceEventHandler(viewer.canvas);
      defer(() => handler.destroy());
      handler.setInputAction((movement) => {
        if (signal.aborted) return;
        const ray = viewer.camera.getPickRay(movement.endPosition);
        const hit = ray && viewer.scene.globe.pick(ray, viewer.scene);
        if (hit) {
          const coordinate = Cartographic.fromCartesian(hit);
          $("coordinates").textContent =
            `${Math.abs(CesiumMath.toDegrees(coordinate.latitude)).toFixed(4)}° ${coordinate.latitude >= 0 ? "N" : "S"} · ${Math.abs(CesiumMath.toDegrees(coordinate.longitude)).toFixed(4)}° ${coordinate.longitude >= 0 ? "E" : "W"}`;
        }
      }, ScreenSpaceEventType.MOUSE_MOVE);
      return {};
    },
    createData({ scene: { viewer, go }, defer, signal }) {
      const points = viewer.scene.primitives.add(
        new PointPrimitiveCollection(),
      );
      defer(() => viewer.scene.primitives.remove(points));
      let request;
      let generation = 0;
      const clear = () => {
        ++generation;
        request?.abort();
        points.removeAll();
        $("events").replaceChildren();
        $("clear").disabled = true;
        viewer.scene.requestRender();
      };
      defer(clear);
      const refresh = async () => {
        const ticket = ++generation;
        request?.abort();
        request = new AbortController();
        const combined = AbortSignal.any([signal, request.signal]);
        $("refresh").disabled = true;
        $("feed-status").textContent = "正在获取 USGS 公开快照…";
        try {
          const { rows, fetchedAt } = await fetchEarthquakes({
            signal: combined,
          });
          combined.throwIfAborted();
          if (ticket !== generation) return;
          points.removeAll();
          $("events").replaceChildren();
          for (const row of rows) {
            points.add({
              position: Cartesian3.fromDegrees(row.lon, row.lat, 2500),
              pixelSize: Math.min(14, 5 + row.mag),
              color:
                row.mag >= 5
                  ? Color.fromCssColorString("#ff8c64")
                  : Color.fromCssColorString("#f3c56c"),
              outlineColor: Color.fromCssColorString("#3a241a"),
              outlineWidth: 1,
              disableDepthTestDistance: 0,
            });
          }
          for (const row of [...rows].sort((a, b) => b.time - a.time)) {
            const li = document.createElement("li");
            const button = document.createElement("button");
            button.textContent = `M${row.mag.toFixed(1)} · ${row.place || "未提供地点"}`;
            button.addEventListener("click", () =>
              go(row.lat, row.lon, 650000),
            );
            const time = document.createElement("time");
            time.dateTime = new Date(row.time).toISOString();
            time.textContent = `震时 ${time.dateTime} · UTC`;
            li.append(button, time);
            $("events").append(li);
          }
          $("clear").disabled = false;
          $("feed-status").textContent =
            `${rows.length} 个事件 · 获取时间 ${fetchedAt}（UTC）。来源可能延迟，点击重新获取。`;
          $("refresh").textContent = "重新获取地震数据";
          viewer.scene.requestRender();
        } catch (error) {
          if (ticket === generation && !signal.aborted)
            $("feed-status").textContent =
              `USGS 暂时不可用：${error.name === "TimeoutError" ? "请求超时" : error.message}。${points.length ? "保留上次快照，数据可能过时。" : "尚无可用数据。"}`;
        } finally {
          if (ticket === generation && !signal.aborted)
            $("refresh").disabled = false;
        }
      };
      const clearClick = () => {
        clear();
        $("refresh").disabled = false;
        $("feed-status").textContent = "地震图层已关闭，未继续请求。";
      };
      $("refresh").addEventListener("click", refresh);
      $("clear").addEventListener("click", clearClick);
      defer(() => {
        $("refresh").removeEventListener("click", refresh);
        $("clear").removeEventListener("click", clearClick);
      });
      return {};
    },
    createTools() {
      return {};
    },
  });
  const destroy = () => {
    externalSignal.removeEventListener("abort", destroy);
    void app.destroy().catch(() => {});
  };
  signal.addEventListener("abort", destroy, { once: true });
  try {
    signal.throwIfAborted();
    await app.start();
    signal.throwIfAborted();
    if (renderStopped) return;
    $("globe-status").textContent = "地球就绪 · 按需加载公开来源";
  } catch (error) {
    destroy();
    if (renderStopped) return;
    throw error;
  }
}
