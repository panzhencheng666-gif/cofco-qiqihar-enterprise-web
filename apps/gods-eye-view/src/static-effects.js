import { PostProcessStage } from "cesium";
import { VisualEffects } from "../vendor/src/ui/visualEffects.js";
import { STYLES } from "../vendor/src/ui/visualPresets.js";
/** Own upstream effects with time frozen at zero and no scheduled animation. */
export function createStaticVisualEffects({
  viewer,
  createStage = (options) => new PostProcessStage(options),
}) {
  let effects;
  let destroyed = false;
  const alive = () => !viewer.isDestroyed?.();
  const render = () => {
    if (alive()) viewer.scene.requestRender();
  };
  const clear = () => {
    const previous = effects;
    effects = undefined;
    previous?.stop();
    if (alive()) {
      previous?.destroy();
      render();
    }
  };
  return {
    setStyle(name) {
      if (destroyed || !alive()) return false;
      if (name === "normal") {
        clear();
        return true;
      }
      if (!Object.hasOwn(STYLES, name)) throw new Error("Unknown visual style");
      if (!effects) {
        const acquired = [];
        const candidate = new VisualEffects({
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
        try {
          candidate.initStyles();
        } catch (error) {
          candidate.stop();
          // initStyles publishes stageEntries only after its entire loop succeeds.
          // Track construction separately, including a stage whose add() failed.
          for (const stage of acquired.reverse()) {
            try {
              const removed = viewer.scene.postProcessStages.remove(stage);
              if (removed === false && !stage.isDestroyed?.())
                stage.destroy?.();
            } catch {
              /* Continue releasing the other owned stages. */
            }
          }
          throw error;
        }
        effects = candidate;
      }
      // Injected scheduler never invokes/schedules its callback. Shader time=0.
      for (const [key, stage] of effects.stageEntries)
        effects.setStageIntensity(stage, key === name ? 1 : 0);
      render();
      return true;
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
