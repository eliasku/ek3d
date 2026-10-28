import type { Camera } from "../cameras/Camera";
import type { Light } from "./Light";
import type { RenderTarget } from "../core/RenderTarget";
import { Matrix4 } from "../math/Matrix4";
import { Vector2 } from "../math/Vector2";
import { Vector3 } from "../math/Vector3";
import { Vector4 } from "../math/Vector4";
import { Frustum } from "../math/Frustum";
import { TextureType } from "../constants";
const _projScreenMatrix = /*@__PURE__*/ new Matrix4();
const _lightPositionWorld = /*@__PURE__*/ new Vector3();
const _lookTarget = /*@__PURE__*/ new Vector3();
/**
 * Abstract base class for light shadow classes. These classes
 * represent the shadow configuration for different light types.
 *
 * @abstract
 */
export class LightShadow<TCamera extends Camera = Camera> {
  camera: TCamera;
  intensity: number;
  bias: number;
  normalBias: number;
  radius: number;
  blurSamples: number;
  mapSize: Vector2;
  mapType: TextureType;
  map: RenderTarget | null;
  mapPass: RenderTarget | null;
  matrix: Matrix4;
  autoUpdate: boolean;
  needsUpdate: boolean;
  _frustum: Frustum;
  _frameExtents: Vector2;
  _viewportCount: number;
  _viewports: Vector4[];

  /**
   * Constructs a new light shadow.
   *
   * @param camera - The light's view of the world.
   */
  constructor(camera: NoInfer<TCamera>) {
    /**
     * The light's view of the world.
     *
     */
    this.camera = camera;
    /**
     * The intensity of the shadow. The default is `1`.
     * Valid values are in the range `[0, 1]`.
     *
     * @default 1
     */
    this.intensity = 1;
    /**
     * Shadow map bias, how much to add or subtract from the normalized depth
     * when deciding whether a surface is in shadow.
     *
     * The default is `0`. Very tiny adjustments here (in the order of `0.0001`)
     * may help reduce artifacts in shadows.
     *
     * @default 0
     */
    this.bias = 0;
    /**
     * Defines how much the position used to query the shadow map is offset along
     * the object normal. The default is `0`. Increasing this value can be used to
     * reduce shadow acne especially in large scenes where light shines onto
     * geometry at a shallow angle. The cost is that shadows may appear distorted.
     *
     * @default 0
     */
    this.normalBias = 0;
    /**
     * Setting this to values greater than 1 will blur the edges of the shadow.
     * High values will cause unwanted banding effects in the shadows - a greater
     * map size will allow for a higher value to be used here before these effects
     * become visible.
     *
     * The property has no effect when the shadow map type is `ShadowMap.Basic`.
     *
     * @default 1
     */
    this.radius = 1;
    /**
     * The amount of samples to use when blurring a VSM shadow map.
     *
     * @default 8
     */
    this.blurSamples = 8;
    /**
     * Defines the width and height of the shadow map. Higher values give better quality
     * shadows at the cost of computation time. Values must be powers of two.
     *
     * @default (512,512)
     */
    this.mapSize = new Vector2(512, 512);
    /**
     * The type of shadow texture. The default is `TextureType.UnsignedByte`.
     *
     * @default TextureType.UnsignedByte
     */
    this.mapType = TextureType.UnsignedByte;
    /**
     * The depth map generated using the internal camera; a location beyond a
     * pixel's depth is in shadow. Computed internally during rendering.
     *
     * @default null
     */
    this.map = null;
    /**
     * The distribution map generated using the internal camera; an occlusion is
     * calculated based on the distribution of depths. Computed internally during
     * rendering.
     *
     * @default null
     */
    this.mapPass = null;
    /**
     * Model to shadow camera space, to compute location and depth in shadow map.
     * This is computed internally during rendering.
     *
     */
    this.matrix = new Matrix4();
    /**
     * Enables automatic updates of the light's shadow. If you do not require dynamic
     * lighting / shadows, you may set this to `false`.
     *
     * @default true
     */
    this.autoUpdate = true;
    /**
     * When set to `true`, shadow maps will be updated in the next `render` call.
     * If you have set {@link LightShadow#autoUpdate} to `false`, you will need to
     * set this property to `true` and then make a render call to update the light's shadow.
     *
     * @default false
     */
    this.needsUpdate = false;
    this._frustum = new Frustum();
    this._frameExtents = new Vector2(1, 1);
    this._viewportCount = 1;
    this._viewports = [new Vector4(0, 0, 1, 1)];
  }
  /**
   * Used internally by the renderer to get the number of viewports that need
   * to be rendered for this shadow.
   *
   * @return The viewport count.
   */
  getViewportCount(): number {
    return this._viewportCount;
  }
  /**
   * Used internally by the renderer to get the camera that renders the given viewport.
   *
   * @param [viewportIndex=0] - The viewport index.
   * @return The shadow camera.
   */
  getCamera(/* viewportIndex */): Camera {
    return this.camera;
  }
  /**
   * Gets the shadow cameras frustum. Used internally by the renderer to cull objects.
   *
   * @return The shadow camera frustum.
   */
  getFrustum(): Frustum {
    return this._frustum;
  }
  /**
   * Update the matrices for the camera and shadow, used internally by the renderer.
   *
   * @param light - The light for which the shadow is being rendered.
   */
  updateMatrices(light: Light) {
    const shadowCamera = this.camera;
    _lightPositionWorld.setFromMatrixPosition(light.matrixWorld);
    shadowCamera.position.copy(_lightPositionWorld);
    _lookTarget.setFromMatrixPosition((light as any).target.matrixWorld);
    shadowCamera.lookAt(_lookTarget);
    shadowCamera.updateMatrixWorld();
    this._updateMatrix(shadowCamera, this.matrix, this._frustum);
  }
  /**
   * Updates a shadow projection matrix and its corresponding frustum.
   *
   * @private
   * @param shadowCamera - The shadow camera.
   * @param shadowMatrix - The target shadow matrix.
   * @param frustum - The target frustum.
   * @param [viewport] - The viewport within the shadow atlas.
   */
  _updateMatrix(shadowCamera: Camera, shadowMatrix: Matrix4, frustum: Frustum, viewport?: Vector4) {
    _projScreenMatrix.multiplyMatrices(shadowCamera.projectionMatrix, shadowCamera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(_projScreenMatrix, shadowCamera.coordinateSystem, shadowCamera.reversedDepth);
    const frameExtents = this._frameExtents;
    const scaleX = viewport ? viewport.z / frameExtents.x : 1;
    const scaleY = viewport ? viewport.w / frameExtents.y : 1;
    const offsetX = viewport ? viewport.x / frameExtents.x : 0;
    const offsetY = viewport ? viewport.y / frameExtents.y : 0;
    if (shadowCamera.reversedDepth) {
      shadowMatrix.set(
        0.5 * scaleX,
        0.0,
        0.0,
        0.5 * scaleX + offsetX,
        0.0,
        0.5 * scaleY,
        0.0,
        0.5 * scaleY + offsetY,
        0.0,
        0.0,
        1.0,
        0.0, // Identity Z (preserving the correct [0, 1] range from the projection matrix)
        0.0,
        0.0,
        0.0,
        1.0,
      );
    } else {
      shadowMatrix.set(
        0.5 * scaleX,
        0.0,
        0.0,
        0.5 * scaleX + offsetX,
        0.0,
        0.5 * scaleY,
        0.0,
        0.5 * scaleY + offsetY,
        0.0,
        0.0,
        0.5,
        0.5,
        0.0,
        0.0,
        0.0,
        1.0,
      );
    }
    shadowMatrix.multiply(_projScreenMatrix);
  }
  /**
   * Returns a viewport definition for the given viewport index.
   *
   * @param viewportIndex - The viewport index.
   * @return The viewport.
   */
  getViewport(viewportIndex: number): Vector4 {
    return this._viewports[viewportIndex];
  }
  /**
   * Returns the frame extends.
   *
   * @return The frame extends.
   */
  getFrameExtents(): Vector2 {
    return this._frameExtents;
  }
  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever this instance is no longer used in your app.
   */
  dispose() {
    if (this.map) {
      this.map.dispose();
    }
    if (this.mapPass) {
      this.mapPass.dispose();
    }
  }
  /**
   * Copies the values of the given light shadow instance to this instance.
   *
   * @param source - The light shadow to copy.
   * @return A reference to this light shadow instance.
   */
  copy(source: LightShadow): this {
    this.camera = source.camera.clone() as TCamera;
    this.intensity = source.intensity;
    this.bias = source.bias;
    this.radius = source.radius;
    this.autoUpdate = source.autoUpdate;
    this.needsUpdate = source.needsUpdate;
    this.normalBias = source.normalBias;
    this.blurSamples = source.blurSamples;
    this.mapSize.copy(source.mapSize);
    this.mapType = source.mapType;
    return this;
  }
  /**
   * Returns a new light shadow instance with copied values from this instance.
   *
   * @return A clone of this instance.
   */
  clone(_recursive?: boolean): this {
    return new (this.constructor as any)().copy(this);
  }
  /**
   * Serializes the light shadow into JSON.
   *
   * @return A JSON object representing the serialized light shadow.
   * @see {@link ObjectLoader#parse}
   */
  toJSON() {
    const object: any = {};
    object.intensity = this.intensity;
    object.bias = this.bias;
    object.normalBias = this.normalBias;
    object.radius = this.radius;
    object.blurSamples = this.blurSamples;
    object.mapSize = this.mapSize.toArray();
    object.mapType = this.mapType;
    object.camera = this.camera.toJSON(false).object;
    delete object.camera.matrix;
    return object;
  }
}
