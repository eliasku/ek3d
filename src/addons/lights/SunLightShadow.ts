import { OrthographicCamera } from "../../cameras/OrthographicCamera";
import type { PerspectiveCamera } from "../../cameras/PerspectiveCamera";
import type { Light } from "../../lights/Light";
import { LightShadow } from "../../lights/LightShadow";
import { Frustum } from "../../math/Frustum";
import { Matrix4 } from "../../math/Matrix4";
import { Vector3 } from "../../math/Vector3";
import { Vector4 } from "../../math/Vector4";

const _lightOrientationMatrix = /*@__PURE__*/ new Matrix4();
const _viewToLightMatrix = /*@__PURE__*/ new Matrix4();
const _lightDirection = /*@__PURE__*/ new Vector3();
const _up = /*@__PURE__*/ new Vector3();
const _center = /*@__PURE__*/ new Vector3();

const _nearCorners = [
  /*@__PURE__*/ new Vector3(),
  /*@__PURE__*/ new Vector3(),
  /*@__PURE__*/ new Vector3(),
  /*@__PURE__*/ new Vector3(),
];

const _farCorners = [
  /*@__PURE__*/ new Vector3(),
  /*@__PURE__*/ new Vector3(),
  /*@__PURE__*/ new Vector3(),
  /*@__PURE__*/ new Vector3(),
];

const _cascadeCorners = [
  /*@__PURE__*/ new Vector3(),
  /*@__PURE__*/ new Vector3(),
  /*@__PURE__*/ new Vector3(),
  /*@__PURE__*/ new Vector3(),
  /*@__PURE__*/ new Vector3(),
  /*@__PURE__*/ new Vector3(),
  /*@__PURE__*/ new Vector3(),
  /*@__PURE__*/ new Vector3(),
];

// must match the cascade count in the sun shadow shader chunks

const _cascadeCount = 2;

// fraction of each cascade's depth range that blends into the next cascade

const _cascadeFade = 0.1;

export class SunLightShadow extends LightShadow<OrthographicCamera> {
  isSunLightShadow: boolean;
  _cameras: OrthographicCamera[];
  _matrices: Matrix4[];
  _frustums: Frustum[];
  _cascadeSplits: number[];
  _cascadeData: Vector4[];

  constructor() {
    super(new OrthographicCamera(-5, 5, 5, -5, 0.5, 500));

    this.isSunLightShadow = true;

    this.mapSize.set(1024, 1024);

    this._cameras = [];
    this._matrices = [];
    this._frustums = [];
    this._cascadeSplits = Array.from({ length: _cascadeCount + 1 }, () => 0);

    // per cascade ( begin, end, fade start ) view depths, consumed by the renderer

    this._cascadeData = [];

    this._viewportCount = _cascadeCount;
    this._frameExtents.set(2, 1);

    for (let i = 0; i < _cascadeCount; i++) {
      this._cameras.push(new OrthographicCamera());
      this._matrices.push(new Matrix4());
      this._frustums.push(new Frustum());
      this._cascadeData.push(new Vector4());
    }

    while (this._viewports.length < _cascadeCount) this._viewports.push(new Vector4());
  }

  override getCamera(cascadeIndex: number = 0): OrthographicCamera {
    return this._cameras[cascadeIndex];
  }

  getMatrix(cascadeIndex: number = 0): Matrix4 {
    return this._matrices[cascadeIndex];
  }

  override getFrustum(cascadeIndex: number = 0): Frustum {
    return this._frustums[cascadeIndex];
  }

  override updateMatrices(light: Light, viewCamera?: PerspectiveCamera | OrthographicCamera): void {
    if (viewCamera === undefined) return;

    // inset the cascade viewports so shadow filtering cannot read across atlas tiles

    const insetX = Math.min(0.25, (Math.ceil(this.radius) + 1) / this.mapSize.x);
    const insetY = Math.min(0.25, (Math.ceil(this.radius) + 1) / this.mapSize.y);

    for (let i = 0; i < _cascadeCount; i++) {
      this._viewports[i].set(i + insetX, insetY, 1 - 2 * insetX, 1 - 2 * insetY);
    }

    const resolutionX = this.mapSize.x * (1 - 2 * insetX);
    const resolutionY = this.mapSize.y * (1 - 2 * insetY);
    const resolution = Math.min(resolutionX, resolutionY);

    const camera = this.camera;
    const cameraNear = viewCamera.near;
    const cameraFar = Math.max(cameraNear + 1e-6, Math.min(camera.far, viewCamera.far));

    // practical split scheme: the average of uniform and logarithmic splits

    const splits = this._cascadeSplits;
    splits[0] = cameraNear;

    for (let i = 1; i < _cascadeCount; i++) {
      const amount = i / _cascadeCount;
      const uniform = cameraNear + (cameraFar - cameraNear) * amount;
      const logarithmic = cameraNear > 0 ? cameraNear * Math.pow(cameraFar / cameraNear, amount) : uniform;
      splits[i] = (uniform + logarithmic) * 0.5;
    }

    splits[_cascadeCount] = cameraFar;

    _lightDirection.setFromMatrixPosition(light.matrixWorld).negate().normalize();

    _up.set(0, 1, 0);
    if (Math.abs(_up.dot(_lightDirection)) > 0.99) _up.set(0, 0, 1);

    _lightOrientationMatrix.lookAt(_center.set(0, 0, 0), _lightDirection, _up);
    _viewToLightMatrix.copy(_lightOrientationMatrix).transpose().multiply(viewCamera.matrixWorld);

    // view frustum corners in light space; the rotation preserves distances,
    // so the cascades can be fitted and snapped directly in this space

    const zNear = viewCamera.reversedDepth ? 1 : -1;
    const inverseProjectionMatrix = viewCamera.projectionMatrixInverse;

    let globalMaxZ = -Infinity;

    for (let i = 0; i < 4; i++) {
      const x = i === 0 || i === 1 ? 1 : -1;
      const y = i === 0 || i === 3 ? 1 : -1;

      const nearCorner = _nearCorners[i].set(x, y, zNear).applyMatrix4(inverseProjectionMatrix);
      const farCorner = _farCorners[i];

      if (viewCamera.isPerspectiveCamera === true) {
        farCorner.copy(nearCorner).multiplyScalar(cameraFar / cameraNear);
      } else {
        farCorner.set(nearCorner.x, nearCorner.y, -cameraFar);
      }

      nearCorner.applyMatrix4(_viewToLightMatrix);
      farCorner.applyMatrix4(_viewToLightMatrix);

      globalMaxZ = Math.max(globalMaxZ, nearCorner.z, farCorner.z);
    }

    // raise the ceiling one shadow range towards the light so casters outside
    // the view frustum still cast into it

    globalMaxZ += cameraFar;

    const shadowNear = camera.near;

    for (let i = 0; i < _cascadeCount; i++) {
      // each cascade covers the fade band of the previous one so both can be sampled while blending

      const cascadeNear = i === 0 ? splits[0] : this._cascadeData[i - 1].z;
      const cascadeFar = splits[i + 1];
      const fadeStart = cascadeFar - _cascadeFade * (cascadeFar - splits[i]);

      this._cascadeData[i].set(i === 0 ? -1e10 : cascadeNear, cascadeFar, fadeStart, 0);

      // bounding sphere of the cascade slice for a rotation-stable projection

      const nearAlpha = (cascadeNear - cameraNear) / (cameraFar - cameraNear);
      const farAlpha = (cascadeFar - cameraNear) / (cameraFar - cameraNear);

      _center.set(0, 0, 0);

      for (let j = 0; j < 4; j++) {
        _cascadeCorners[j * 2].lerpVectors(_nearCorners[j], _farCorners[j], nearAlpha);
        _cascadeCorners[j * 2 + 1].lerpVectors(_nearCorners[j], _farCorners[j], farAlpha);
        _center.add(_cascadeCorners[j * 2]).add(_cascadeCorners[j * 2 + 1]);
      }

      _center.multiplyScalar(1 / 8);

      let radiusSq = 0;
      let minZ = Infinity;

      for (let j = 0; j < 8; j++) {
        radiusSq = Math.max(radiusSq, _cascadeCorners[j].distanceToSquared(_center));
        minZ = Math.min(minZ, _cascadeCorners[j].z);
      }

      let radius = Math.sqrt(radiusSq);

      // snap to the texel grid to avoid shimmering when the view camera moves

      if (resolution > 1) {
        // pad by half a texel so snapping cannot clip a frustum corner
        radius /= 1 - 1 / resolution;
        const texelSizeX = (2 * radius) / resolutionX;
        const texelSizeY = (2 * radius) / resolutionY;
        _center.x = Math.round(_center.x / texelSizeX) * texelSizeX;
        _center.y = Math.round(_center.y / texelSizeY) * texelSizeY;
      }

      // place the near plane at the caster ceiling

      _center.z = globalMaxZ + shadowNear;
      _center.applyMatrix4(_lightOrientationMatrix);

      const cascadeCamera = this._cameras[i];
      cascadeCamera.position.copy(_center);
      cascadeCamera.quaternion.setFromRotationMatrix(_lightOrientationMatrix);
      cascadeCamera.left = -radius;
      cascadeCamera.right = radius;
      cascadeCamera.top = radius;
      cascadeCamera.bottom = -radius;
      cascadeCamera.near = shadowNear;
      cascadeCamera.far = globalMaxZ - minZ + 2 * shadowNear;
      cascadeCamera.coordinateSystem = camera.coordinateSystem;
      cascadeCamera._reversedDepth = camera.reversedDepth;
      cascadeCamera.updateProjectionMatrix();
      cascadeCamera.updateMatrixWorld();

      this._updateMatrix(cascadeCamera, this._matrices[i], this._frustums[i], this._viewports[i]);
    }
  }
}
