import { Vector3 } from "../../math/Vector3";
import { Matrix4 } from "../../math/Matrix4";

export interface CSMFrustumData {
  webGL?: boolean;
  reversedDepth?: boolean;
  projectionMatrix?: Matrix4;
  maxFar?: number;
}

const inverseProjectionMatrix = new Matrix4();

/**
 * Represents the frustum of a CSM instance.
 *
 * ```ts
 * import { CSMFrustum } from "ek3d/addons/csm/CSMFrustum";
 * ```
 */
export class CSMFrustum {
  zNear: number;
  zFar: number;
  vertices: { near: Vector3[]; far: Vector3[] };

  /**
   * Constructs a new CSM frustum.
   *
   * @param data - The CSM data.
   */
  constructor(data: CSMFrustumData = {}) {
    data = data || {};

    /**
     * The near clip-space value depends on the projection coordinate convention.
     */
    this.zNear = data.webGL === true ? -1 : 0;

    /**
     * The zFar value.
     *
     */
    this.zFar = 1;

    /**
     * An object representing the vertices of the near and
     * far plane in view space.
     *
     */
    this.vertices = {
      near: [new Vector3(), new Vector3(), new Vector3(), new Vector3()],
      far: [new Vector3(), new Vector3(), new Vector3(), new Vector3()],
    };

    if (data.projectionMatrix !== undefined) {
      this.setFromProjectionMatrix(data.projectionMatrix, data.maxFar || 10000);
    }

    // In case of reversed depth buffer, zNear and zFar must be 1 and 0
    // respectively regardless of the coordinate system.
    if (data.reversedDepth === true) {
      this.zNear = 1;
      this.zFar = 0;
    }
  }

  /**
   * Setups this CSM frustum from the given projection matrix and max far value.
   *
   * @param projectionMatrix - The projection matrix, usually of the scene's camera.
   * @param maxFar - The maximum far value.
   * @returns The near and far plane vertices in view space.
   */
  setFromProjectionMatrix(projectionMatrix: Matrix4, maxFar: number) {
    const zNear = this.zNear;
    const zFar = this.zFar;
    const isOrthographic = projectionMatrix.elements[2 * 4 + 3] === 0;

    inverseProjectionMatrix.copy(projectionMatrix).invert();

    // 3 --- 0  vertices.near/far order
    // |     |
    // 2 --- 1
    // clip space spans from [-1, 1]

    this.vertices.near[0].set(1, 1, zNear);
    this.vertices.near[1].set(1, -1, zNear);
    this.vertices.near[2].set(-1, -1, zNear);
    this.vertices.near[3].set(-1, 1, zNear);
    this.vertices.near.forEach(function (v) {
      v.applyMatrix4(inverseProjectionMatrix);
    });

    this.vertices.far[0].set(1, 1, zFar);
    this.vertices.far[1].set(1, -1, zFar);
    this.vertices.far[2].set(-1, -1, zFar);
    this.vertices.far[3].set(-1, 1, zFar);
    this.vertices.far.forEach(function (v) {
      v.applyMatrix4(inverseProjectionMatrix);

      const absZ = Math.abs(v.z);
      if (isOrthographic) {
        v.z *= Math.min(maxFar / absZ, 1.0);
      } else {
        v.multiplyScalar(Math.min(maxFar / absZ, 1.0));
      }
    });

    return this.vertices;
  }

  /**
   * Splits the CSM frustum by the given array. The new CSM frustum are pushed into the given
   * target array.
   *
   * @param breaks - Values in `[0,1]` defining the frustum splits.
   * @param target - The array that holds the new CSM frustums.
   */
  split(breaks: number[], target: CSMFrustum[]) {
    while (breaks.length > target.length) {
      target.push(new CSMFrustum());
    }

    target.length = breaks.length;

    const near = this.vertices.near[0].z;
    const far = this.vertices.far[0].z;

    for (let i = 0; i < breaks.length; i++) {
      const cascade = target[i];

      if (i === 0) {
        for (let j = 0; j < 4; j++) {
          cascade.vertices.near[j].copy(this.vertices.near[j]);
        }
      } else {
        const alpha = (breaks[i - 1] * far - near) / (far - near);

        for (let j = 0; j < 4; j++) {
          cascade.vertices.near[j].lerpVectors(this.vertices.near[j], this.vertices.far[j], alpha);
        }
      }

      if (i === breaks.length - 1) {
        for (let j = 0; j < 4; j++) {
          cascade.vertices.far[j].copy(this.vertices.far[j]);
        }
      } else {
        const alpha = (breaks[i] * far - near) / (far - near);

        for (let j = 0; j < 4; j++) {
          cascade.vertices.far[j].lerpVectors(this.vertices.near[j], this.vertices.far[j], alpha);
        }
      }
    }
  }

  /**
   * Transforms the given target CSM frustum into the different coordinate system defined by the
   * given camera matrix.
   *
   * @param cameraMatrix - The matrix that defines the new coordinate system.
   * @param target - The CSM to convert.
   */
  toSpace(cameraMatrix: Matrix4, target: CSMFrustum) {
    for (let i = 0; i < 4; i++) {
      target.vertices.near[i].copy(this.vertices.near[i]).applyMatrix4(cameraMatrix);

      target.vertices.far[i].copy(this.vertices.far[i]).applyMatrix4(cameraMatrix);
    }
  }
}
