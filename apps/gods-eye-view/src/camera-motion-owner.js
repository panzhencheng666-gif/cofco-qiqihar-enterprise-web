/** One per-viewer callback slot and authority generation, idle without a timer. */
export function createCameraMotionOwner({
  signal,
  schedule = {
    now: () => performance.now(),
    request: (callback) => setTimeout(callback, 1000 / 30),
    cancel: (id) => clearTimeout(id),
  },
}) {
  let active,
    pending,
    generation = 0,
    disposed = false;
  const scopes = new Set();
  const alive = () => !disposed && !signal?.aborted;
  const clear = () => {
    ++generation;
    const previous = pending;
    pending = undefined;
    if (previous) schedule.cancel(previous.id);
  };
  const cancel = (reason = "手动操作已取消相机运动。") => {
    const previous = active;
    active = undefined;
    clear();
    previous?.stop(reason);
  };
  const destroy = () => {
    if (disposed) return;
    disposed = true;
    try {
      cancel("观察已结束。");
    } finally {
      signal?.removeEventListener("abort", destroy);
      scopes.clear();
    }
  };
  signal?.addEventListener("abort", destroy, { once: true });
  if (signal?.aborted) destroy();
  return {
    cancel,
    destroy,
    register({ stop, eligible = () => true }) {
      const scope = { stop, eligible };
      scopes.add(scope);
      const valid = () =>
        alive() && scopes.has(scope) && active === scope && eligible();
      const release = () => {
        if (active !== scope) return;
        active = undefined;
        clear();
      };
      return {
        valid,
        claim() {
          if (!alive() || !scopes.has(scope) || !eligible()) return false;
          const ticket = generation + 1;
          cancel("另一相机操作已接管，原运动已停止。");
          // The prior stop callback may grant authority to a third owner.
          if (generation !== ticket) return false;
          if (!alive() || !scopes.has(scope) || !eligible()) return false;
          active = scope;
          return true;
        },
        release,
        destroy() {
          release();
          scopes.delete(scope);
        },
        schedule: {
          now: () => schedule.now(),
          request(callback) {
            if (!valid()) return undefined;
            if (pending)
              throw new Error("An owned callback is already pending.");
            const ticket = generation,
              token = {};
            const id = schedule.request(() => {
              if (pending?.token === token) pending = undefined;
              if (ticket !== generation || active !== scope) return;
              if (!valid()) {
                cancel("面板或页面已隐藏，运动已停止。");
                return;
              }
              callback();
            });
            pending = { id, token };
            return id;
          },
          cancel(id) {
            if (active === scope && pending && pending.id === id) {
              const previous = pending;
              pending = undefined;
              schedule.cancel(previous.id);
            }
          },
        },
      };
    },
  };
}
