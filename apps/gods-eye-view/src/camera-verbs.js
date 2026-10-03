/** Narrow derivative of pinned MIT cameraVerbs.js constants and non-route ticks.
 * Keeps upstream movement/ease-out; per-viewer ownership replaces global clock.
 * Continuous hard30s, lazy scratch preflight, fixed-world camera application.
 * Copyright retained in ../vendor/LICENSE; exact originals/hashes in provenance.
 */
import {
  Camera,
  Cartesian2,
  Cartesian3,
  Ellipsoid,
  HeadingPitchRange,
  Math as CesiumMath,
  Matrix4,
} from "@cesium/engine";
import { captureCameraPose, FRAME_MS } from "./camera-sequence.js";
import { readEllipsoidTargetFrame } from "./camera-target-frame.js";
const ORBIT_DEG_S = { slow: 2, normal: 6, fast: 15 };
const TILT_DEG_S = { slow: 4, normal: 10, fast: 20 };
const PAN_VIEW_FRACTION_S = { slow: 0.08, normal: 0.2, fast: 0.45 };
const ONCE = {
  orbitDeg: 30,
  tiltDeg: 15,
  rotateDeg: 15,
  panViewFraction: 0.25,
  durationS: 0.9,
};
const PITCH_MIN = CesiumMath.toRadians(-89),
  PITCH_MAX = CesiumMath.toRadians(-5);
const names = { orbit: "环绕", pan: "平移", tilt: "倾斜", rotate: "转向" };
const finiteVector = (p) =>
  p && [p.x, p.y, p.z].every(Number.isFinite) && Cartesian3.magnitude(p) > 0;
function worldPose(camera) {
  captureCameraPose(camera);
  if (![camera.positionWC, camera.directionWC, camera.upWC].every(finiteVector))
    throw new Error("相机向量不可用。");
  return {
    destination: Cartesian3.clone(camera.positionWC),
    orientation: {
      direction: Cartesian3.clone(camera.directionWC),
      up: Cartesian3.clone(camera.upWC),
    },
    endTransform: Matrix4.IDENTITY,
  };
}
export function createCameraVerbs({
  viewer,
  signal,
  motionOwner,
  canRender = () => true,
  onChange = () => {},
}) {
  let scratch,
    active,
    disposed = false,
    pending,
    generation = 0;
  let status = "idle",
    message = "选择操作后手动开始。",
    seconds = 0;
  const alive = () => !disposed && !signal?.aborted && !viewer.isDestroyed?.();
  const state = () => ({ status, message, seconds, motion: active?.motion });
  const notify = () => onChange(state());
  const stop = (reason = "相机运动已停止。") => {
    ++generation;
    authority.schedule.cancel(pending);
    pending = undefined;
    authority.release();
    active = undefined;
    if (status === "playing") {
      status = "stopped";
      message = reason;
      if (alive()) notify();
    }
  };
  const authority = motionOwner.register({
    stop,
    eligible: () => alive() && canRender(),
  });
  const eligible = (ticket) =>
    ticket === generation && alive() && authority.valid() && canRender();
  const fail = (error) => {
    stop();
    status = "error";
    message = error.message || "相机操作未完成。";
    if (alive()) notify();
  };
  const candidate = (m, dt, share) => {
    scratch ||= new Camera(viewer.scene);
    scratch.setView(worldPose(viewer.camera));
    if (m.motion === "orbit") {
      const heading =
        m.mode === "once"
          ? m.frame.heading +
            CesiumMath.toRadians(ONCE.orbitDeg) *
              (m.direction === "left" ? -1 : 1) *
              share
          : m.heading +
            CesiumMath.toRadians(ORBIT_DEG_S[m.speed]) *
              (m.direction === "left" ? -1 : 1) *
              dt;
      scratch.lookAt(
        m.frame.target,
        new HeadingPitchRange(heading, m.frame.pitch, m.frame.range),
      );
      scratch.lookAtTransform(Matrix4.IDENTITY);
      m.heading = heading;
    } else if (m.motion === "pan") {
      const heightM = Math.max(50, scratch.positionCartographic.height);
      const step =
        m.mode === "once"
          ? heightM * ONCE.panViewFraction * (share - m.lastShare)
          : heightM * PAN_VIEW_FRACTION_S[m.speed] * dt;
      const method = {
        left: "moveLeft",
        right: "moveRight",
        up: "moveUp",
        down: "moveDown",
      }[m.direction];
      scratch[method](step);
    } else {
      const stepRad =
        m.mode === "once"
          ? CesiumMath.toRadians(
              m.motion === "tilt" ? ONCE.tiltDeg : ONCE.rotateDeg,
            ) *
            (share - m.lastShare)
          : CesiumMath.toRadians(TILT_DEG_S[m.speed]) * dt;
      if (m.motion === "tilt") {
        const next =
          scratch.pitch + (m.direction === "up" ? stepRad : -stepRad);
        if (next > PITCH_MAX || next < PITCH_MIN)
          throw new RangeError("倾斜已到 −89° 至 −5° 范围边界。");
        scratch[m.direction === "up" ? "lookUp" : "lookDown"](stepRad);
      } else
        scratch[m.direction === "left" ? "lookLeft" : "lookRight"](stepRad);
    }
    m.lastShare = share;
    return worldPose(scratch); // Reject geographic/height/vector bounds BEFORE live mutation.
  };
  const apply = (pose, ticket) => {
    if (!eligible(ticket)) {
      if (ticket === generation) stop("面板或页面已隐藏，运动已停止。");
      return false;
    }
    viewer.camera.setView(pose); // A target transform is never installed on the live camera.
    if (!eligible(ticket)) {
      if (ticket === generation) stop("相机控制已切换，运动已停止。");
      return false;
    }
    viewer.scene.requestRender();
    if (!eligible(ticket)) {
      if (ticket === generation) stop("面板或页面已隐藏，运动已停止。");
      return false;
    }
    return true;
  };
  const complete = (text) => {
    stop();
    status = "complete";
    message = text;
    if (alive()) notify();
  };
  const start = ({ motion, direction, mode, speed, instant = false } = {}) => {
    if (!alive() || !canRender()) return false;
    let m, instantPose;
    try {
      const directions = {
        orbit: ["left", "right"],
        pan: ["left", "right", "up", "down"],
        tilt: ["up", "down"],
        rotate: ["left", "right"],
      };
      if (
        !directions[motion]?.includes(direction) ||
        !["once", "continuous"].includes(mode) ||
        !Object.hasOwn(ORBIT_DEG_S, speed) ||
        typeof instant !== "boolean" ||
        (instant && mode !== "once")
      )
        throw new Error("请选择有效的相机操作、方向、速度及模式。");
      worldPose(viewer.camera);
      m = { motion, direction, mode, speed, lastShare: 0 };
      if (motion === "tilt") {
        const pitch = viewer.camera.pitch;
        if (
          (direction === "up" &&
            pitch >= PITCH_MAX - CesiumMath.toRadians(0.5)) ||
          (direction === "down" &&
            pitch <= PITCH_MIN + CesiumMath.toRadians(0.5))
        )
          throw new RangeError("已到倾斜边界，请选择另一方向。");
      }
      if (motion === "orbit") {
        const canvas = viewer.scene.canvas || viewer.canvas;
        const width = canvas?.clientWidth || canvas?.width,
          height = canvas?.clientHeight || canvas?.height;
        if (![width, height].every((v) => Number.isFinite(v) && v > 0))
          throw new Error("观察窗口尺寸不可用。");
        const target = viewer.camera.pickEllipsoid(
          new Cartesian2(width / 2, height / 2),
          Ellipsoid.WGS84,
        );
        m.frame = readEllipsoidTargetFrame(viewer.camera, target);
        if (!m.frame)
          throw new Error("画面中心未命中 WGS84 椭球，请先定位地球。");
        m.heading = m.frame.heading;
      }
      m.started = m.lastMs = authority.schedule.now();
      if (!Number.isFinite(m.started)) throw new Error("运动时钟不可用。");
      if (instant) instantPose = candidate(m, 0, 1);
    } catch (error) {
      message = error.message;
      notify();
      return false;
    }
    if (!authority.claim()) return false;
    const ticket = ++generation;
    active = m;
    status = "playing";
    seconds = 0;
    message = `${names[motion]}进行中；可随时停止。`;
    try {
      viewer.camera.cancelFlight();
      if (!eligible(ticket)) {
        stop();
        return false;
      }
      if (instant) {
        if (!apply(instantPose, ticket)) return false;
        complete(`${names[motion]}已手动定位（减少动态）。`);
        return true;
      }
      const tick = () => {
        if (!eligible(ticket)) {
          if (ticket === generation) stop();
          return;
        }
        pending = undefined;
        try {
          const now = authority.schedule.now();
          if (!Number.isFinite(now) || now < m.lastMs)
            throw new Error("运动时钟不可用。");
          if (m.mode === "continuous" && now - m.started >= 30000) {
            seconds = 30;
            complete("连续运动已达 30 秒上限，请手动重新开始。");
            return;
          }
          const elapsedMs = now - m.lastMs;
          if (elapsedMs >= FRAME_MS) {
            const dt = Math.min(0.25, Math.max(0.001, elapsedMs / 1000));
            m.lastMs = now;
            seconds = (now - m.started) / 1000;
            const t = Math.min(1, seconds / ONCE.durationS),
              share = 1 - (1 - t) * (1 - t);
            const pose = candidate(m, dt, share);
            if (!apply(pose, ticket)) return;
            if (m.mode === "once" && t >= 1) {
              complete(`${names[motion]}单次操作完成。`);
              return;
            }
            notify();
          }
          if (eligible(ticket)) pending = authority.schedule.request(tick);
        } catch (error) {
          if (ticket === generation) fail(error);
        }
      };
      notify();
      if (eligible(ticket)) pending = authority.schedule.request(tick);
      return eligible(ticket);
    } catch (error) {
      if (ticket === generation) fail(error);
      return false;
    }
  };
  const destroy = () => {
    if (disposed) return;
    stop();
    disposed = true;
    status = "disposed";
    scratch = undefined;
    authority.destroy();
    signal?.removeEventListener("abort", destroy);
  };
  signal?.addEventListener("abort", destroy, { once: true });
  if (signal?.aborted) destroy();
  return { start, stop, state, destroy };
}
