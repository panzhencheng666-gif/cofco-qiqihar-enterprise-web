import { PostProcessStage } from "cesium";
import { VisualEffects } from "../vendor/src/ui/visualEffects.js";
import {
  STYLES,
  STYLE_PRESET_DEFAULTS,
} from "../vendor/src/ui/visualPresets.js";
import { clampBloomIntensity } from "../vendor/src/bloom.js";

/** Own upstream effects with time frozen at zero and no scheduled animation. */
export function createStaticVisualEffects({
  viewer,
  createStage = (options) => new PostProcessStage(options),
}) {
  let styles, postProcess;
  let activeStyle = "normal";
  let batchDepth = 0;
  let destroyed = false;
  let sharpenEnabled = false,
    bloomEnabled = false;
  let sharpenIntensity = 0.49,
    bloomIntensity = 0;
  const alive = () => !viewer.isDestroyed?.();
  const usable = () => !destroyed && alive();
  const render = () => {
    if (alive() && batchDepth === 0) viewer.scene.requestRender();
  };
  const acquire = (initialize) => {
    const acquired = [];
    const effects = new VisualEffects({
      viewer,
      requestRender: render,
      holdRender: () => {},
      releaseRender: () => {},
      requestFrame: () => null,
      cancelFrame: () => {},
      createStage(options) {
        const stage = createStage(options);
        acquired.push(stage);
        return stage;
      },
      wallNow: () => 0,
      now: () => 0,
    });
    const release = () => {
      effects.stop();
      if (!alive()) return;
      // Upstream publishes stageEntries only after all style additions succeed.
      // Track construction too, including a stage whose add() failed.
      for (const stage of acquired.splice(0).reverse()) {
        try {
          const removed = viewer.scene.postProcessStages.remove(stage);
          if (removed === false && !stage.isDestroyed?.()) stage.destroy?.();
        } catch {
          if (!stage.isDestroyed?.()) {
            try {
              stage.destroy?.();
            } catch {
              /* Continue releasing resources. */
            }
          }
        }
      }
      if (effects.bloomStage && effects.previousBloom) {
        Object.assign(
          effects.bloomStage.uniforms,
          effects.previousBloom.uniforms,
        );
        effects.bloomStage.enabled = effects.previousBloom.enabled;
      }
    };
    try {
      initialize(effects);
    } catch (error) {
      release();
      throw error;
    }
    return { effects, release };
  };
  const releasePostProcess = () => {
    const previous = postProcess;
    postProcess = undefined;
    previous?.release();
  };
  const clear = () => {
    const previous = styles;
    styles = undefined;
    activeStyle = "normal";
    try {
      previous?.release();
    } finally {
      releasePostProcess();
    }
    sharpenEnabled = bloomEnabled = false;
    render();
  };
  const syncPostProcess = () => {
    if (!sharpenEnabled && !bloomEnabled) {
      releasePostProcess();
    } else {
      postProcess ||= acquire((effects) =>
        effects.initPostProcess(sharpenIntensity),
      );
      const effects = postProcess.effects;
      effects.applySharpenIntensity(sharpenIntensity);
      effects.applyBloomIntensity(bloomIntensity);
      effects.setSharpenEnabled(sharpenEnabled);
      effects.setBloomEnabled(bloomEnabled);
    }
    render();
  };
  const metadata = () => STYLES[activeStyle]?.uniforms || {};
  const snapshot = () => ({
    style: activeStyle,
    values: Object.fromEntries(
      Object.keys(metadata()).map((name) => [
        name,
        styles.effects.stages[activeStyle].uniforms[name],
      ]),
    ),
  });
  const plain = (value) =>
    value &&
    typeof value === "object" &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value));
  const validValue = (name, value) =>
    typeof name === "string" &&
    Object.hasOwn(metadata(), name) &&
    Number.isFinite(value) &&
    value >= metadata()[name].min &&
    value <= metadata()[name].max;
  return {
    getStyleParameters() {
      return snapshot();
    },
    getStyleParameterMetadata() {
      return Object.fromEntries(
        Object.entries(metadata()).map(([name, entry]) => [
          name,
          { ...entry, editable: !(activeStyle === "snow" && name === "wind") },
        ]),
      );
    },
    setStyleParameter(name, value) {
      if (!usable()) return false;
      if (
        !validValue(name, value) ||
        (activeStyle === "snow" && name === "wind")
      )
        throw new Error(
          "Unknown, unavailable or out-of-range static parameter",
        );
      styles.effects.stages[activeStyle].uniforms[name] = value;
      render();
      return true;
    },
    // Internal transaction recovery only; scene v1/v2 never accepts these fields.
    restoreStyleParameters(saved) {
      if (!usable()) return false;
      const fail = () => {
        throw new Error("Invalid internal style parameter snapshot");
      };
      if (!plain(saved)) fail();
      const fields = Object.getOwnPropertyDescriptors(saved);
      if (
        Reflect.ownKeys(fields).length !== 2 ||
        !["style", "values"].every(
          (name) =>
            fields[name]?.enumerable && Object.hasOwn(fields[name], "value"),
        ) ||
        fields.style.value !== activeStyle ||
        !plain(fields.values.value)
      )
        fail();
      const keys = Object.keys(metadata());
      const supplied = Object.getOwnPropertyDescriptors(fields.values.value);
      if (Reflect.ownKeys(supplied).length !== keys.length) fail();
      const restored = {};
      for (const name of keys) {
        const descriptor = supplied[name];
        if (
          !descriptor?.enumerable ||
          !Object.hasOwn(descriptor, "value") ||
          !validValue(name, descriptor.value)
        )
          fail();
        restored[name] = descriptor.value;
      }
      if (keys.length)
        Object.assign(styles.effects.stages[activeStyle].uniforms, restored);
      render();
      return true;
    },
    batch(action) {
      if (!usable()) return false;
      ++batchDepth;
      try {
        return action();
      } finally {
        --batchDepth;
        render();
      }
    },
    setStyle(name) {
      if (!usable()) return false;
      if (typeof name !== "string") throw new Error("Unknown visual style");
      if (name === "normal") {
        const previous = styles;
        styles = undefined;
        previous?.release();
      } else {
        if (!Object.hasOwn(STYLES, name))
          throw new Error("Unknown visual style");
        styles ||= acquire((effects) => effects.initStyles());
        // Apply the upstream display preset, not its shader's raw defaults.
        // Only style uniforms belong here; HUD/detection and global post state
        // retain their existing free-edition owners.
        Object.assign(
          styles.effects.stages[name].uniforms,
          Object.fromEntries(
            Object.entries(STYLES[name].uniforms).map(([key, meta]) => [
              key,
              meta.default,
            ]),
          ),
          STYLE_PRESET_DEFAULTS[name]?.styleParams?.[name],
        );
        // Injected scheduler never invokes/schedules its callback. Shader time=0.
        for (const [key, stage] of styles.effects.stageEntries)
          styles.effects.setStageIntensity(stage, key === name ? 1 : 0);
      }
      activeStyle = name;
      render();
      return true;
    },
    setSharpenEnabled(enabled) {
      if (!usable()) return false;
      sharpenEnabled = !!enabled;
      try {
        syncPostProcess();
      } catch (error) {
        sharpenEnabled = bloomEnabled = false;
        throw error;
      }
      return true;
    },
    setBloomEnabled(enabled) {
      if (!usable()) return false;
      bloomEnabled = !!enabled;
      try {
        syncPostProcess();
      } catch (error) {
        sharpenEnabled = bloomEnabled = false;
        throw error;
      }
      return true;
    },
    setSharpenIntensity(value) {
      if (!usable()) return false;
      sharpenIntensity = Number.isFinite(value)
        ? Math.max(0, Math.min(1, value))
        : 0.49;
      postProcess?.effects.applySharpenIntensity(sharpenIntensity);
      return sharpenIntensity;
    },
    setBloomIntensity(value) {
      if (!usable()) return false;
      bloomIntensity = clampBloomIntensity(value);
      postProcess?.effects.applyBloomIntensity(bloomIntensity);
      return bloomIntensity;
    },
    clear() {
      if (!destroyed) clear();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clear();
    },
  };
}
