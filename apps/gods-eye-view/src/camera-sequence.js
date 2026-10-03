import { Cartesian3, Math as CesiumMath, Matrix4 } from "@cesium/engine";
import { sampleCameraMove } from "../vendor/src/director/camera.js";
import { validatePoint } from "./scene-state.js";

export const MAX_SHOTS = 12;
export const FRAME_MS = 1000 / 30;
const bounded = (value, min, max) => {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    throw new TypeError("相机参数或时长超出允许范围。");
  return value;
};

/** Scene-schema bounds; upstream camera interpolation explicitly uses degrees. */
export function captureCameraPose(camera) {
  const position = camera.positionCartographic;
  const point = validatePoint({
    lon: CesiumMath.toDegrees(position.longitude),
    lat: CesiumMath.toDegrees(position.latitude),
  });
  return {
    ...point,
    alt: bounded(position.height, 0, 100000000),
    heading: CesiumMath.toDegrees(
      bounded(camera.heading, -2 * Math.PI, 2 * Math.PI),
    ),
    pitch: CesiumMath.toDegrees(
      bounded(camera.pitch, -Math.PI / 2, Math.PI / 2),
    ),
    roll: CesiumMath.toDegrees(bounded(camera.roll, -2 * Math.PI, 2 * Math.PI)),
  };
}

/** Installed Cesium API: world destination and degree-to-radian orientation. */
export function applyCameraPose(viewer, pose, canRender = () => true) {
  if (!canRender()) return false;
  viewer.camera.setView({
    destination: Cartesian3.fromDegrees(pose.lon, pose.lat, pose.alt),
    orientation: {
      heading: CesiumMath.toRadians(pose.heading),
      pitch: CesiumMath.toRadians(pose.pitch),
      roll: CesiumMath.toRadians(pose.roll),
    },
    endTransform: Matrix4.IDENTITY,
  });
  if (!canRender()) return false;
  viewer.scene.requestRender();
  return true;
}

/** Memory-only authored poses. The only scheduled owner exists during explicit play. */
export function createCameraSequence({
  viewer,
  signal,
  motionOwner,
  onChange = () => {},
  canAnimate = () => true,
  canRender = () => true,
  schedule = {
    now: () => performance.now(),
    request: (callback) => setTimeout(callback, FRAME_MS),
    cancel: (id) => clearTimeout(id),
  },
}) {
  let shots = [],
    selected = -1,
    time = 0,
    status = "idle",
    message = "尚无镜头。";
  let disposed = false,
    generation = 0,
    pending,
    lastFrame,
    origin;
  const total = () => shots.reduce((sum, shot) => sum + shot.durationSec, 0);
  const alive = () => !disposed && !signal?.aborted && !viewer.isDestroyed?.();
  const state = () => ({
    shots: shots.map((shot) => ({ ...shot, pose: { ...shot.pose } })),
    selected,
    time,
    total: total(),
    status,
    message,
  });
  const notify = () => onChange(state());
  const unschedule = () => {
    ++generation;
    const previous = pending;
    pending = undefined;
    if (previous !== undefined) schedule.cancel(previous);
  };
  const stop = (reason = "已停止。") => {
    unschedule();
    authority?.release();
    if (!alive()) return;
    if (status === "playing") {
      status = "stopped";
      message = reason;
      notify();
    }
  };
  const fail = (error) => {
    unschedule();
    authority?.release();
    if (!alive()) return;
    status = "error";
    message = `镜头操作未完成：${error.message || "相机不可用"}`;
    notify();
  };
  const sample = (seconds) => {
    let end = 0;
    for (let index = 0; index < shots.length; index++) {
      const start = end;
      end += shots[index].durationSec;
      if (seconds <= end || index === shots.length - 1) {
        selected = index;
        return index === 0
          ? shots[0].pose
          : sampleCameraMove(
              {
                from: shots[index - 1].pose,
                to: shots[index].pose,
                easing: shots[index].easing,
              },
              (seconds - start) / shots[index].durationSec,
            );
      }
    }
  };
  const render = () => {
    const ticket = generation;
    return applyCameraPose(
      viewer,
      sample(time),
      () =>
        alive() &&
        ticket === generation &&
        canRender() &&
        (!authority || authority.valid()),
    );
  };
  const edit = (action) => {
    if (!alive()) return false;
    stop("编辑镜头，已停止播放。");
    action();
    time = 0;
    status = "idle";
    message = "镜头已更新，仅在本次观察中保留。";
    notify();
    return true;
  };
  const seek = (seconds) => {
    if (!alive() || !canRender() || !shots.length) return false;
    bounded(seconds, 0, total());
    stop("手动定位时间线，已停止播放。");
    if (authority && !authority.claim()) return false;
    const ticket = generation;
    try {
      time = seconds;
      viewer.camera.cancelFlight();
      if (!render()) return false;
      if (!alive() || ticket !== generation) return false;
      status = "seeking";
      message = "已手动定位；播放需再次点击开始。";
      notify();
      return true;
    } catch (error) {
      if (ticket === generation) fail(error);
      return false;
    } finally {
      authority?.release();
    }
  };
  const start = () => {
    if (!alive() || !canAnimate() || !shots.length || status === "playing")
      return false;
    unschedule();
    if (authority && !authority.claim()) return false;
    const ticket = generation;
    try {
      if (time >= total()) time = 0;
      viewer.camera.cancelFlight();
      if (!render()) {
        stop();
        return false;
      }
      if (!alive() || ticket !== generation) return false;
      if (shots.length === 1) {
        time = total();
        authority?.release();
        status = "complete";
        message = "单镜头已定位，无需动画。";
        notify();
        return true;
      }
      lastFrame = schedule.now();
      if (!Number.isFinite(lastFrame)) throw new TypeError("播放时钟不可用。");
      origin = lastFrame - time * 1000;
      status = "playing";
      message = "正在播放本地镜头。";
      notify();
      const tick = () => {
        if (!alive() || ticket !== generation || status !== "playing") return;
        pending = undefined;
        try {
          // Visibility state changes before queued DOM events are delivered.
          if (!canRender() || !canAnimate()) {
            stop("镜头面板或页面已隐藏，播放已停止。");
            return;
          }
          const now = schedule.now();
          if (!Number.isFinite(now)) throw new TypeError("播放时钟不可用。");
          if (now - lastFrame >= FRAME_MS) {
            lastFrame = now;
            time = Math.min(total(), Math.max(time, (now - origin) / 1000));
            if (!render()) {
              stop("镜头面板或页面已隐藏，播放已停止。");
              return;
            }
            if (!alive() || ticket !== generation || status !== "playing")
              return;
            if (time >= total()) {
              unschedule();
              authority?.release();
              status = "complete";
              message = "本地镜头播放完成。";
              notify();
              return;
            }
            notify();
          }
          if (alive() && ticket === generation && status === "playing")
            pending = schedule.request(tick);
        } catch (error) {
          if (ticket === generation) fail(error);
        }
      };
      if (alive() && ticket === generation && status === "playing")
        pending = schedule.request(tick);
      return true;
    } catch (error) {
      if (ticket === generation) fail(error);
      return false;
    }
  };
  const destroy = () => {
    if (disposed) return;
    unschedule();
    disposed = true;
    authority?.destroy();
    shots = [];
    selected = -1;
    status = "disposed";
    signal?.removeEventListener("abort", destroy);
  };
  const authority = motionOwner?.register({
    stop,
    eligible: () => alive() && canRender(),
  });
  if (authority) schedule = authority.schedule;
  signal?.addEventListener("abort", destroy, { once: true });
  if (signal?.aborted) destroy();
  return {
    state,
    stop,
    seek,
    start,
    destroy,
    capture(label, durationSec, easing) {
      if (!alive()) return false;
      if (shots.length >= MAX_SHOTS)
        throw new TypeError("最多保留 12 个镜头。");
      const pose = captureCameraPose(viewer.camera);
      const plain = validatePoint(
        { lon: pose.lon, lat: pose.lat, label },
        true,
      ).label;
      bounded(durationSec, 0.2, 30);
      if (!["cubic", "linear"].includes(easing))
        throw new TypeError("请选择平滑或线性插值。");
      return edit(() => {
        shots.push({ label: plain, durationSec, easing, pose });
        selected = shots.length - 1;
      });
    },
    remove(index) {
      if (!Number.isInteger(index) || index < 0 || index >= shots.length)
        return false;
      return edit(() => {
        shots.splice(index, 1);
        selected = Math.min(index, shots.length - 1);
      });
    },
    reorder(index, offset) {
      const next = index + offset;
      if (
        !Number.isInteger(index) ||
        ![-1, 1].includes(offset) ||
        index < 0 ||
        index >= shots.length ||
        next < 0 ||
        next >= shots.length
      )
        return false;
      return edit(() => {
        [shots[index], shots[next]] = [shots[next], shots[index]];
        selected = next;
      });
    },
    select(index) {
      if (!Number.isInteger(index) || index < 0 || index >= shots.length)
        return false;
      return seek(
        shots
          .slice(0, index + 1)
          .reduce((sum, shot) => sum + shot.durationSec, 0),
      );
    },
  };
}
