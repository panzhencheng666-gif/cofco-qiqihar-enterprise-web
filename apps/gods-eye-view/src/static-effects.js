import { PostProcessStage } from "cesium";
import { VisualEffects } from "../vendor/src/ui/visualEffects.js";
import { STYLES } from "../vendor/src/ui/visualPresets.js";
import { clampBloomIntensity } from "../vendor/src/bloom.js";

/** Own upstream effects with time frozen at zero and no scheduled animation. */
export function createStaticVisualEffects({
  viewer,
  createStage = (options) => new PostProcessStage(options),
}) {
  let styles, postProcess;
  let destroyed = false;
  let sharpenEnabled = false,
    bloomEnabled = false;
  let sharpenIntensity = 0.49,
    bloomIntensity = 0;
  const alive = () => !viewer.isDestroyed?.();
  const usable = () => !destroyed && alive();
  const render = () => {
    if (alive()) viewer.scene.requestRender();
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
  return {
    setStyle(name) {
      if (!usable()) return false;
      if (name === "normal") {
        const previous = styles;
        styles = undefined;
        previous?.release();
      } else {
        if (!Object.hasOwn(STYLES, name))
          throw new Error("Unknown visual style");
        styles ||= acquire((effects) => effects.initStyles());
        // Injected scheduler never invokes/schedules its callback. Shader time=0.
        for (const [key, stage] of styles.effects.stageEntries)
          styles.effects.setStageIntensity(stage, key === name ? 1 : 0);
      }
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
