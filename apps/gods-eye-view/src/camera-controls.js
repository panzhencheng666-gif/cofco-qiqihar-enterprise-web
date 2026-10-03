import {
  Cartesian3,
  Ellipsoid,
  HeadingPitchRange,
  IntersectionTests,
  Matrix4,
  Ray,
} from "@cesium/engine";

const vector = (value) =>
  value && [value.x, value.y, value.z].every(Number.isFinite)
    ? { x: value.x, y: value.y, z: value.z }
    : null;
const length = (value) => Math.hypot(value.x, value.y, value.z);

/** One copied world-space camera pose, kept only for this viewer's lifetime. */
export function createCameraCommands({ viewer, signal }) {
  let saved;
  let destroyed = false;
  const alive = () => !destroyed && !signal?.aborted && !viewer.isDestroyed?.();
  const apply = (view) => {
    if (!alive()) return false;
    viewer.camera.cancelFlight();
    viewer.camera.setView(view);
    viewer.scene.requestRender();
    return true;
  };
  const tilt = (pitch) =>
    Number.isFinite(viewer.camera.heading) &&
    apply({ orientation: { heading: viewer.camera.heading, pitch, roll: 0 } });
  return {
    overhead: () => alive() && tilt(-Math.PI / 2),
    oblique() {
      if (!alive() || !Number.isFinite(viewer.camera.heading)) return false;
      const position = vector(viewer.camera.positionWC);
      const direction = vector(viewer.camera.directionWC);
      if (!position || !direction || length(direction) === 0) return false;
      const ellipsoid = Ellipsoid.WGS84;
      const ray = new Ray(position, direction);
      const hit = IntersectionTests.rayEllipsoid(ray, ellipsoid);
      const target =
        hit && hit.start > 0
          ? Ray.getPoint(ray, hit.start)
          : ellipsoid.scaleToGeodeticSurface(position);
      if (!target) return false;
      // Aim at the current ground target. A pitch-only tilt at whole-globe
      // altitude misses Earth. Limit target range to 1 km–2,000 km.
      const range = Math.max(
        1000,
        Math.min(2000000, Cartesian3.distance(position, target)),
      );
      const heading = viewer.camera.heading;
      viewer.camera.cancelFlight();
      try {
        viewer.camera.lookAt(
          target,
          new HeadingPitchRange(heading, -Math.PI / 4, range),
        );
      } finally {
        // Release the temporary target frame for ordinary globe navigation.
        viewer.camera.lookAtTransform(Matrix4.IDENTITY);
      }
      viewer.scene.requestRender();
      return true;
    },
    save() {
      if (!alive()) return false;
      const destination = vector(viewer.camera.positionWC);
      const direction = vector(viewer.camera.directionWC);
      const up = vector(viewer.camera.upWC);
      if (!destination || !direction || !up) return false;
      const directionLength = length(direction);
      const upLength = length(up);
      const dot = direction.x * up.x + direction.y * up.y + direction.z * up.z;
      if (
        !Number.isFinite(length(destination)) ||
        length(destination) === 0 ||
        !Number.isFinite(directionLength) ||
        directionLength === 0 ||
        !Number.isFinite(upLength) ||
        upLength === 0 ||
        !Number.isFinite(dot) ||
        Math.abs(dot / directionLength / upLength) > 0.000001
      )
        return false;
      saved = { destination, orientation: { direction, up } };
      return true;
    },
    restore() {
      if (!alive() || !saved) return false;
      return apply({
        destination: { ...saved.destination },
        orientation: {
          direction: { ...saved.orientation.direction },
          up: { ...saved.orientation.up },
        },
      });
    },
    destroy() {
      destroyed = true;
      saved = undefined;
    },
  };
}
