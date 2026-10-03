import * as Cesium from "@cesium/engine";
import { applyModelAtmosphereWorkaround } from "../vendor/src/app/atmosphereCompat.js";

const PINCH_ZOOM_MULTIPLIER = 8;
const MAX_PINCH_PIXEL_DELTA = 120;

function boundedPinchDelta(delta) {
  if (!Number.isFinite(delta) || delta === 0) return delta;
  return (
    Math.sign(delta) *
    Math.min(Math.abs(delta) * PINCH_ZOOM_MULTIPLIER, MAX_PINCH_PIXEL_DELTA)
  );
}

/**
 * Add browser trackpad pinch to Cesium's zoom inputs and return its disposer.
 * Browsers expose this gesture as a small pixel-mode Ctrl+wheel event.
 */
export function installTrackpadPinchZoom(
  viewer,
  { createWheelEvent = (type, init) => new WheelEvent(type, init) } = {},
) {
  const controller = viewer?.scene?.screenSpaceCameraController;
  const container = viewer?.container;
  const canvas = viewer?.canvas;
  if (!controller || !container || !canvas)
    throw new TypeError("A complete Cesium viewer is required");

  const originalZoomEventTypes = controller.zoomEventTypes;
  const zoomEventTypes = Array.isArray(originalZoomEventTypes)
    ? originalZoomEventTypes
    : originalZoomEventTypes === undefined
      ? []
      : [originalZoomEventTypes];
  const alreadyHandlesControlWheel = zoomEventTypes.some(
    (binding) =>
      binding?.eventType === Cesium.CameraEventType.WHEEL &&
      binding?.modifier === Cesium.KeyboardEventModifier.CTRL,
  );
  const configuredZoomEventTypes = alreadyHandlesControlWheel
    ? originalZoomEventTypes
    : [
        ...zoomEventTypes,
        {
          eventType: Cesium.CameraEventType.WHEEL,
          modifier: Cesium.KeyboardEventModifier.CTRL,
        },
      ];
  if (!alreadyHandlesControlWheel)
    controller.zoomEventTypes = configuredZoomEventTypes;

  const relayedEvents = new WeakSet();
  const relayPinch = (event) => {
    if (
      !event.ctrlKey ||
      relayedEvents.has(event) ||
      event.deltaMode !== 0 ||
      !Number.isFinite(event.deltaY) ||
      event.deltaY === 0
    )
      return;
    let relayed;
    try {
      relayed = createWheelEvent("wheel", {
        deltaX: event.deltaX,
        deltaY: boundedPinchDelta(event.deltaY),
        deltaZ: event.deltaZ,
        deltaMode: event.deltaMode,
        screenX: event.screenX,
        screenY: event.screenY,
        clientX: event.clientX,
        clientY: event.clientY,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
        view: globalThis.window,
      });
    } catch {
      // The registered Ctrl+wheel binding can still consume the original.
      return;
    }
    relayedEvents.add(relayed);
    event.preventDefault();
    event.stopPropagation();
    canvas.dispatchEvent(relayed);
  };
  container.addEventListener("wheel", relayPinch, {
    capture: true,
    passive: false,
  });

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    container.removeEventListener("wheel", relayPinch, true);
    if (
      !alreadyHandlesControlWheel &&
      controller.zoomEventTypes === configuredZoomEventTypes
    )
      controller.zoomEventTypes = originalZoomEventTypes;
  };
}

/** Derived from upstream viewer: CesiumWidget avoids Viewer/Knockout eval. */
export function createApplicationViewer({ container, creditContainer }) {
  if (!container || !creditContainer)
    throw new TypeError("Viewer and credit containers are required");
  const viewer = new Cesium.CesiumWidget(container, {
    baseLayer: false,
    showRenderLoopErrors: false,
    terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    creditContainer,
    requestRenderMode: true,
    maximumRenderTimeChange: Infinity,
    targetFrameRate: 30,
    msaaSamples: 1,
    contextOptions: { webgl: { preserveDrawingBuffer: false } },
  });
  try {
    viewer.targetFrameRate = 30;
    viewer.resolutionScale = Math.min(1, 1 / globalThis.devicePixelRatio || 1);
    viewer.clock.shouldAnimate = false;
    applyModelAtmosphereWorkaround(viewer.scene);
    viewer.scene.globe.tileCacheSize = 64;
    viewer.scene.globe.maximumScreenSpaceError = 4;
    viewer.scene.globe.preloadAncestors = false;
    viewer.scene.globe.preloadSiblings = false;
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#153e49");
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#040b12");
    viewer.scene.skyAtmosphere.saturationShift = -0.2;
    viewer.scene.skyAtmosphere.brightnessShift = -0.1;
    Cesium.RequestScheduler.maximumRequestsPerServer = 4;
    return viewer;
  } catch (error) {
    viewer.destroy();
    throw error;
  }
}
