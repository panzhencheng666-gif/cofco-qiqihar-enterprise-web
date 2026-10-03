/** Stop once after a GPU render failure; reopening is owned by the parent shell. */
export function installRenderFailureHandler({
  viewer,
  effects,
  signal,
  onStopped,
}) {
  let stopped = false;
  return viewer.scene.renderError.addEventListener(() => {
    if (stopped || signal?.aborted || viewer.isDestroyed?.()) return;
    stopped = true;
    viewer.useDefaultRenderLoop = false;
    // Publish the terminal state before cleanup, which itself can fail.
    try {
      onStopped();
    } finally {
      try {
        effects.clear();
      } catch {
        /* Render loop remains stopped. */
      }
    }
  });
}
