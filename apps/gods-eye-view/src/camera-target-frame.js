/** Derived from pinned MIT ui/cameraOrientationControls.js:18–24,82–105.
 * Target is explicitly supplied from WGS84 pickEllipsoid; no terrain/tracking.
 * Copyright retained in ../vendor/LICENSE and provenance.json.
 */
import {
  Cartesian3,
  Math as CesiumMath,
  Matrix4,
  Transforms,
} from "@cesium/engine";
const finite = (p) =>
  p && [p.x, p.y, p.z].every(Number.isFinite) && Cartesian3.magnitude(p) > 1;
export function readEllipsoidTargetFrame(camera, target) {
  if (!finite(target) || !finite(camera.positionWC)) return null;
  const transform = Transforms.eastNorthUpToFixedFrame(target);
  const inverse = Matrix4.inverseTransformation(transform, new Matrix4());
  const localOffset = Matrix4.multiplyByPoint(
    inverse,
    camera.positionWC,
    new Cartesian3(),
  );
  const range = Cartesian3.magnitude(localOffset);
  if (!Number.isFinite(range) || range < 1) return null;
  const pitch = -Math.asin(CesiumMath.clamp(localOffset.z / range, -1, 1));
  const targetHeading = Math.atan2(-localOffset.x, -localOffset.y);
  const raw =
    pitch < CesiumMath.toRadians(-88.5) ? camera.heading : targetHeading;
  const wrapped = CesiumMath.zeroToTwoPi(Number.isFinite(raw) ? raw : 0);
  const heading =
    Math.abs(wrapped - CesiumMath.TWO_PI) < CesiumMath.EPSILON10 ? 0 : wrapped;
  return { target: Cartesian3.clone(target), range, heading, pitch };
}
