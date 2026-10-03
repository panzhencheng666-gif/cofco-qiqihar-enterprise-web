import {
  Cartesian3,
  Math as CesiumMath,
  OpenStreetMapImageryProvider,
  ImageryLayer,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Cartographic,
  UrlTemplateImageryProvider,
  GeographicTilingScheme,
} from "@cesium/engine";
import { createApplication } from "../vendor/src/app/application.js";
import { parseCoordinateQuery } from "../vendor/src/search/coordinateParser.js";
import { createApplicationViewer, installTrackpadPinchZoom } from "./viewer.js";
import { installEarthquakeControls } from "./earthquake-controls.js";
import { installLocalSceneControls } from "./local-scene-controls.js";
import { installSearchControls } from "./search-controls.js";
import { NATURAL_EARTH_OPTIONS } from "./basemaps.js";
import { createStaticVisualEffects } from "./static-effects.js";
import { installRenderFailureHandler } from "./render-errors.js";
import {
  installDisplayControls,
  updateVisualEffectStatus,
} from "./display-controls.js";
import { installCameraSequenceControls } from "./camera-sequence-controls.js";
import { createCameraMotionOwner } from "./camera-motion-owner.js";
import { installCameraVerbsControls } from "./camera-verbs-controls.js";
import { installWhiteboardControls } from "./whiteboard-controls.js";
import { installPointerNavigationCancellation } from "./pointer-navigation.js";
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
      const motionOwner = createCameraMotionOwner({ signal });
      defer(() => motionOwner.destroy());
      let cancelPointer = () => {};
      const beforeCamera = () => {
        motionOwner.cancel();
        cancelPointer();
      };
      let imagery;
      let removeImageryError;
      const clearImagery = () => {
        const previous = imagery,
          removeError = removeImageryError,
          failures = [];
        imagery = removeImageryError = undefined;
        try {
          removeError?.();
        } catch (error) {
          failures.push(error);
        }
        if (previous && !previous.isDestroyed?.()) {
          try {
            const removed =
              !viewer.isDestroyed() &&
              viewer.imageryLayers.remove(previous, true);
            // add() can fail before transferring the new layer to the viewer.
            if (!removed && !previous.isDestroyed?.()) previous.destroy();
          } catch (error) {
            failures.push(error);
            if (!previous.isDestroyed?.()) {
              try {
                previous.destroy();
              } catch (failure) {
                failures.push(failure);
              }
            }
          }
        }
        if (failures.length)
          throw new AggregateError(failures, "场景地图资源释放失败。");
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
        beforeCamera();
        viewer.camera.cancelFlight();
        viewer.camera.flyTo({
          destination: Cartesian3.fromDegrees(108, 24, 28000000),
          duration: 1.2,
        });
        scene.requestRender();
      };
      const go = (lat, lon, height = 220000) => {
        beforeCamera();
        viewer.camera.cancelFlight();
        viewer.camera.flyTo({
          destination: Cartesian3.fromDegrees(lon, lat, height),
          orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 },
          duration: 1.2,
        });
        scene.requestRender();
      };
      const setStyle = (value, render = true) => {
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
        if (render) scene.requestRender();
      };
      setStyle("natural");
      home();
      return {
        viewer,
        home,
        go,
        setStyle,
        beforeCamera,
        motionOwner,
        setPointerCancel(fn) {
          cancelPointer = fn;
        },
      };
    },
    createControls({
      scene: {
        viewer,
        home,
        go,
        setStyle,
        beforeCamera,
        motionOwner,
        setPointerCancel,
      },
      defer,
      signal,
    }) {
      let whiteboard, localRelease;
      setPointerCancel(() => {
        whiteboard?.cancel();
        localRelease?.cancelPick();
      });
      defer(() => setPointerCancel(() => {}));
      const sequence = installCameraSequenceControls({
        viewer,
        signal,
        motionOwner,
        beforeMotion: beforeCamera,
        nodes: Object.fromEntries(
          [
            "panel",
            "label",
            "duration",
            "easing",
            "capture",
            "shots",
            "select",
            "remove",
            "up",
            "down",
            "play",
            "stop",
            "seek",
            "progress",
            "status",
            "allow",
            "motion",
          ].map((key) => [key, $("sequence-" + key)]),
        ),
      });
      defer(() => sequence.destroy());
      const verbs = installCameraVerbsControls({
        viewer,
        signal,
        motionOwner,
        beforeMotion: beforeCamera,
        nodes: Object.fromEntries(
          [
            "panel",
            "motion",
            "direction",
            "speed",
            "once",
            "continuous",
            "stop",
            "status",
            "allow",
            "preference",
          ].map((key) => [key, $("verb-" + key)]),
        ),
      });
      defer(() => verbs.destroy());
      defer(
        installPointerNavigationCancellation({
          viewer,
          signal,
          cancel: beforeCamera,
        }),
      );
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
          beforeCamera,
          onCleanChange: (visible) => whiteboard?.setVisible(visible),
          overlays: [...document.querySelectorAll("[data-clean-overlay]")],
          nodes: displayNodes,
        }),
      );
      const stopRendering = (message) => {
        beforeCamera();
        if (renderStopped) return;
        renderStopped = true;
        viewer.useDefaultRenderLoop = false;
        $("globe-status").textContent = message;
        $("effect-status").textContent =
          "视觉渲染已停止，当前画面不可继续使用。";
        document
          .querySelectorAll("button,input,select,textarea")
          .forEach((node) => {
            node.disabled = true;
          });
        // Abort synchronously; application disposal releases controls/data
        // before the widget. The parent shell's pause/reopen remains reachable.
        void app.destroy().catch(() => {});
      };
      const capture = () => {
        const position = viewer.camera.positionCartographic;
        return {
          camera: {
            lon: CesiumMath.toDegrees(position.longitude),
            lat: CesiumMath.toDegrees(position.latitude),
            height: position.height,
            heading: viewer.camera.heading,
            pitch: viewer.camera.pitch,
            roll: viewer.camera.roll,
          },
          map: $("map-style").value,
          style: {
            name: displayNodes.style.value,
            sharpen: displayNodes.sharpen.checked,
            sharpenIntensity: Number(displayNodes.sharpenIntensity.value),
            bloom: displayNodes.bloom.checked,
            bloomIntensity: Number(displayNodes.bloomIntensity.value),
          },
          ...(whiteboard?.snapshot().length
            ? { drawings: whiteboard.snapshot() }
            : {}),
        };
      };
      const applySceneState = (next) => {
        beforeCamera();
        viewer.camera.cancelFlight();
        effects.setStyle(next.style.name);
        effects.setSharpenIntensity(next.style.sharpenIntensity);
        effects.setBloomIntensity(next.style.bloomIntensity);
        effects.setSharpenEnabled(next.style.sharpen);
        effects.setBloomEnabled(next.style.bloom);
        // Always install the requested map on recovery, even when a failed
        // acquisition left the selector unchanged but removed its imagery.
        setStyle(next.map, false);
        const { lon, lat, height, heading, pitch, roll } = next.camera;
        viewer.camera.setView({
          destination: Cartesian3.fromDegrees(lon, lat, height),
          orientation: { heading, pitch, roll },
        });
        $("map-style").value = next.map;
        displayNodes.style.value = next.style.name;
        displayNodes.sharpen.checked = next.style.sharpen;
        displayNodes.sharpenIntensity.value = String(
          next.style.sharpenIntensity,
        );
        displayNodes.bloom.checked = next.style.bloom;
        displayNodes.bloomIntensity.value = String(next.style.bloomIntensity);
        updateVisualEffectStatus(displayNodes);
      };
      whiteboard = installWhiteboardControls({
        viewer,
        signal,
        beforePick: beforeCamera,
        onChange: () => localRelease?.invalidate(),
        onFatalError() {
          stopRendering("手动画板资源失败，地球已停止；请暂停后重新打开。");
        },
        nodes: Object.fromEntries(
          [
            "panel",
            "shape",
            "label",
            "color",
            "lat",
            "lon",
            "begin",
            "add",
            "undo",
            "finish",
            "cancel",
            "clear",
            "status",
            "list",
            "overlay",
          ].map((key) => [key, $("whiteboard-" + key)]),
        ),
      });
      defer(() => whiteboard.destroy());
      localRelease = installLocalSceneControls({
        viewer,
        signal,
        beforeCamera,
        nodes: Object.fromEntries(
          Object.entries({
            lat: "local-lat",
            lon: "local-lon",
            label: "local-label",
            kind: "local-kind",
            add: "local-add",
            pick: "local-pick",
            cancel: "local-cancel",
            clear: "local-clear",
            status: "local-status",
            list: "local-list",
            input: "scene-input",
            file: "scene-file",
            import: "scene-import",
            export: "scene-export",
            output: "scene-output",
            select: "scene-select",
          }).map(([key, id]) => [key, $(id)]),
        ),
        capture,
        onFatalError() {
          stopRendering(
            "本地场景资源释放失败，地球渲染已停止；请使用上方“暂停地球观察”后重新打开。",
          );
        },
        apply(next, local) {
          whiteboard.prepare(next.drawings || []);
          const previous = { ...capture(), ...local.snapshot() };
          let failure;
          try {
            effects.batch(() => {
              try {
                applySceneState(next);
                local.replace(next, { render: false });
                whiteboard.replace(next.drawings || [], { render: false });
              } catch (error) {
                if (!signal.aborted && !viewer.isDestroyed()) {
                  try {
                    applySceneState(previous);
                    // Candidate acquisition failure preserves the original
                    // geometry. Avoid reacquiring it unless it was committed.
                    if (
                      JSON.stringify(local.snapshot()) !==
                      JSON.stringify({
                        annotations: previous.annotations,
                        measurement: previous.measurement,
                      })
                    )
                      local.replace(previous, { render: false });
                    if (
                      JSON.stringify(whiteboard.snapshot()) !==
                      JSON.stringify(previous.drawings || [])
                    )
                      whiteboard.replace(previous.drawings || [], {
                        render: false,
                      });
                  } catch {
                    stopRendering(
                      "本地场景恢复失败，地球渲染已停止；请使用上方“暂停地球观察”后重新打开。",
                    );
                  }
                }
                failure = error;
              }
            });
          } catch (error) {
            // batch's final requestRender can throw after application or
            // rollback. Stop ownership instead of hiding a render exception.
            stopRendering(
              "本地场景显示失败，地球渲染已停止；请使用上方“暂停地球观察”后重新打开。",
            );
            throw error;
          }
          if (failure) throw failure;
        },
      });
      defer(localRelease);
      defer(
        installRenderFailureHandler({
          viewer,
          effects,
          signal,
          onStopped() {
            stopRendering(
              "地球渲染已停止，请使用上方“暂停地球观察”后重新打开。",
            );
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
        beforeCamera();
        viewer.camera.zoomIn(
          Math.max(viewer.camera.positionCartographic.height * 0.4, 100),
        );
        viewer.scene.requestRender();
      });
      listen($("zoom-out"), "click", () => {
        beforeCamera();
        viewer.camera.zoomOut(
          Math.max(viewer.camera.positionCartographic.height * 0.4, 100),
        );
        viewer.scene.requestRender();
      });
      listen($("north"), "click", () => {
        beforeCamera();
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
    createData({ scene: { viewer, beforeCamera }, defer, signal }) {
      defer(
        installEarthquakeControls({
          viewer,
          signal,
          beforeCamera,
          nodes: Object.fromEntries(
            Object.entries({
              refresh: "refresh",
              clear: "clear",
              list: "events",
              status: "feed-status",
              summary: "analyst-status",
              metadata: "event-metadata",
              focus: "event-focus",
              apply: "analyst-apply",
              magnitude: "analyst-magnitude",
              minDepth: "analyst-min-depth",
              maxDepth: "analyst-max-depth",
              place: "analyst-place",
              sort: "analyst-sort",
              scope: "analyst-scope",
              lat: "analyst-lat",
              lon: "analyst-lon",
              km: "analyst-km",
            }).map(([key, id]) => [key, $(id)]),
          ),
          onFatalError() {
            beforeCamera();
            if (renderStopped) return;
            renderStopped = true;
            viewer.useDefaultRenderLoop = false;
            $("globe-status").textContent =
              "地震显示资源无法恢复，地球渲染已停止；请暂停后重新打开。";
            document
              .querySelectorAll("button,input,select,textarea")
              .forEach((node) => {
                node.disabled = true;
              });
            void app.destroy().catch(() => {});
          },
        }),
      );
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
