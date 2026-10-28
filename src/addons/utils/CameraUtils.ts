import type { PerspectiveCamera } from "../../cameras/PerspectiveCamera";
import { RAD2DEG } from "../../math/MathUtils";
import { Quaternion } from "../../math/Quaternion";
import { Vector3 } from "../../math/Vector3";

const va = new Vector3(),
  vb = new Vector3(),
  vc = new Vector3();
const vr = new Vector3(),
  vu = new Vector3(),
  vn = new Vector3(),
  vec = new Vector3();
const quat = new Quaternion();

/** Frames a rectangle with an off-axis perspective projection. Do not call updateProjectionMatrix afterwards. */
export function frameCorners(
  camera: PerspectiveCamera,
  bottomLeftCorner: Vector3,
  bottomRightCorner: Vector3,
  topLeftCorner: Vector3,
  estimateViewFrustum = false,
): void {
  const pa = bottomLeftCorner,
    pb = bottomRightCorner,
    pc = topLeftCorner;
  const pe = camera.position,
    n = camera.near,
    f = camera.far;
  vr.copy(pb).sub(pa).normalize();
  vu.copy(pc).sub(pa).normalize();
  vn.crossVectors(vr, vu).normalize();
  va.copy(pa).sub(pe);
  vb.copy(pb).sub(pe);
  vc.copy(pc).sub(pe);
  const d = -va.dot(vn);
  const l = (vr.dot(va) * n) / d,
    r = (vr.dot(vb) * n) / d;
  const b = (vu.dot(va) * n) / d,
    t = (vu.dot(vc) * n) / d;
  quat.setFromUnitVectors(vec.set(0, 1, 0), vu);
  camera.quaternion.setFromUnitVectors(vec.set(0, 0, 1).applyQuaternion(quat), vn).multiply(quat);
  camera.projectionMatrix.set(
    (2 * n) / (r - l),
    0,
    (r + l) / (r - l),
    0,
    0,
    (2 * n) / (t - b),
    (t + b) / (t - b),
    0,
    0,
    0,
    (f + n) / (n - f),
    (2 * f * n) / (n - f),
    0,
    0,
    -1,
    0,
  );
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  if (estimateViewFrustum) {
    camera.fov =
      (RAD2DEG / Math.min(1, camera.aspect)) *
      Math.atan((vec.copy(pb).sub(pa).length() + vec.copy(pc).sub(pa).length()) / va.length());
  }
}
