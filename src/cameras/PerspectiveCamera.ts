import type { Vector4 } from "../math/Vector4";
import { Camera } from "./Camera";
import { RAD2DEG, DEG2RAD } from "../math/MathUtils";
import { Vector2 } from "../math/Vector2";
import { Vector3 } from "../math/Vector3";
const _v3 = /*@__PURE__*/ new Vector3();
const _minTarget = /*@__PURE__*/ new Vector2();
const _maxTarget = /*@__PURE__*/ new Vector2();
/**
 * Camera that uses [perspective projection](https://en.wikipedia.org/wiki/Perspective_(graphical)).
 *
 * This projection mode is designed to mimic the way the human eye sees. It
 * is the most common projection mode used for rendering a 3D scene.
 *
 * ```ts
 * import { PerspectiveCamera } from 'ek3d/cameras/PerspectiveCamera';
 * import { Scene } from 'ek3d/scenes/Scene';
 *
 * const scene = new Scene();
 * const width = window.innerWidth;
 * const height = window.innerHeight;
 *
 * const camera = new PerspectiveCamera( 45, width / height, 1, 1000 );
 * scene.add( camera );
 * ```
 *
 */
export class PerspectiveCamera extends Camera {
  /**
   * This flag can be used for type testing.
   *
   * @readonly
   * @default true
   */
  isPerspectiveCamera: boolean = true;

  fov: number;
  zoom: number;
  near: number;
  far: number;
  focus: number;
  aspect: number;
  view: {
    enabled: boolean;
    fullWidth: number;
    fullHeight: number;
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
  } | null;
  filmGauge: number;
  filmOffset: number;
  /** Assigned when this camera is configured as an ArrayCamera subcamera. */
  viewport!: Vector4;

  /**
   * Constructs a new perspective camera.
   *
   * @param [fov=50] - The vertical field of view.
   * @param [aspect=1] - The aspect ratio.
   * @param [near=0.1] - The camera's near plane.
   * @param [far=2000] - The camera's far plane.
   */
  constructor(fov: number = 50, aspect: number = 1, near: number = 0.1, far: number = 2000) {
    super();
    this.type = "PerspectiveCamera";
    /**
     * The vertical field of view, from bottom to top of view,
     * in degrees.
     *
     * @default 50
     */
    this.fov = fov;
    /**
     * The zoom factor of the camera.
     *
     * @default 1
     */
    this.zoom = 1;
    /**
     * The camera's near plane. The valid range is greater than `0`
     * and less than the current value of {@link PerspectiveCamera#far}.
     *
     * Note that, unlike for the {@link OrthographicCamera}, `0` is <em>not</em> a
     * valid value for a perspective camera's near plane.
     *
     * @default 0.1
     */
    this.near = near;
    /**
     * The camera's far plane. Must be greater than the
     * current value of {@link PerspectiveCamera#near}.
     *
     * @default 2000
     */
    this.far = far;
    /**
     * Object distance used for depth-of-field effects. This
     * parameter does not influence the projection matrix.
     *
     * @default 10
     */
    this.focus = 10;
    /**
     * The aspect ratio, usually the canvas width / canvas height.
     *
     * @default 1
     */
    this.aspect = aspect;
    /**
     * Represents the frustum window specification. This property should not be edited
     * directly but via {@link PerspectiveCamera#setViewOffset} and {@link PerspectiveCamera#clearViewOffset}.
     *
     * @default null
     */
    this.view = null;
    /**
     * Film size used for the larger axis. Default is `35` (millimeters). This
     * parameter does not influence the projection matrix unless {@link PerspectiveCamera#filmOffset}
     * is set to a nonzero value.
     *
     * @default 35
     */
    this.filmGauge = 35;
    /**
     * Horizontal off-center offset in the same unit as {@link PerspectiveCamera#filmGauge}.
     *
     * @default 0
     */
    this.filmOffset = 0;
    this.updateProjectionMatrix();
  }
  copy(source: any, recursive?: any): this {
    super.copy(source, recursive);
    this.fov = source.fov;
    this.zoom = source.zoom;
    this.near = source.near;
    this.far = source.far;
    this.focus = source.focus;
    this.aspect = source.aspect;
    this.view = source.view === null ? null : Object.assign({}, source.view);
    this.filmGauge = source.filmGauge;
    this.filmOffset = source.filmOffset;
    return this;
  }
  /**
   * Sets the FOV by focal length in respect to the current {@link PerspectiveCamera#filmGauge}.
   *
   * The default film gauge is 35, so that the focal length can be specified for
   * a 35mm (full frame) camera.
   *
   * @param focalLength - Values for focal length and film gauge must have the same unit.
   */
  setFocalLength(focalLength: number) {
    /** see {@link http://www.bobatkins.com/photography/technical/field_of_view.html} */
    const vExtentSlope = (0.5 * this.getFilmHeight()) / focalLength;
    this.fov = RAD2DEG * 2 * Math.atan(vExtentSlope);
    this.updateProjectionMatrix();
  }
  /**
   * Returns the focal length from the current {@link PerspectiveCamera#fov} and
   * {@link PerspectiveCamera#filmGauge}.
   *
   * @return The computed focal length.
   */
  getFocalLength(): number {
    const vExtentSlope = Math.tan(DEG2RAD * 0.5 * this.fov);
    return (0.5 * this.getFilmHeight()) / vExtentSlope;
  }
  /**
   * Returns the current vertical field of view angle in degrees considering {@link PerspectiveCamera#zoom}.
   *
   * @return The effective FOV.
   */
  getEffectiveFOV(): number {
    return RAD2DEG * 2 * Math.atan(Math.tan(DEG2RAD * 0.5 * this.fov) / this.zoom);
  }
  /**
   * Returns the width of the image on the film. If {@link PerspectiveCamera#aspect} is greater than or
   * equal to one (landscape format), the result equals {@link PerspectiveCamera#filmGauge}.
   *
   * @return The film width.
   */
  getFilmWidth(): number {
    // film not completely covered in portrait format (aspect < 1)
    return this.filmGauge * Math.min(this.aspect, 1);
  }
  /**
   * Returns the height of the image on the film. If {@link PerspectiveCamera#aspect} is greater than or
   * equal to one (landscape format), the result equals {@link PerspectiveCamera#filmGauge}.
   *
   * @return The film width.
   */
  getFilmHeight(): number {
    // film not completely covered in landscape format (aspect > 1)
    return this.filmGauge / Math.max(this.aspect, 1);
  }
  /**
   * Computes the 2D bounds of the camera's viewable rectangle at a given distance along the viewing direction.
   * Sets `minTarget` and `maxTarget` to the coordinates of the lower-left and upper-right corners of the view rectangle.
   *
   * @param distance - The viewing distance.
   * @param minTarget - The lower-left corner of the view rectangle is written into this vector.
   * @param maxTarget - The upper-right corner of the view rectangle is written into this vector.
   */
  getViewBounds(distance: number, minTarget: Vector2, maxTarget: Vector2) {
    _v3.set(-1, -1, 0.5).applyMatrix4(this.projectionMatrixInverse);
    minTarget.set(_v3.x, _v3.y).multiplyScalar(-distance / _v3.z);
    _v3.set(1, 1, 0.5).applyMatrix4(this.projectionMatrixInverse);
    maxTarget.set(_v3.x, _v3.y).multiplyScalar(-distance / _v3.z);
  }
  /**
   * Computes the width and height of the camera's viewable rectangle at a given distance along the viewing direction.
   *
   * @param distance - The viewing distance.
   * @param target - The target vector that is used to store result where x is width and y is height.
   * @returns The view size.
   */
  getViewSize(distance: number, target: Vector2): Vector2 {
    this.getViewBounds(distance, _minTarget, _maxTarget);
    return target.subVectors(_maxTarget, _minTarget);
  }
  /**
   * Sets an offset in a larger frustum. This is useful for multi-window or
   * multi-monitor/multi-machine setups.
   *
   * For example, if you have 3x2 monitors and each monitor is 1920x1080 and
   * the monitors are in grid like this
   *```
   *   +---+---+---+
   *   | A | B | C |
   *   +---+---+---+
   *   | D | E | F |
   *   +---+---+---+
   *```
   * then for each monitor you would call it like this:
   *```ts
   * import { PerspectiveCamera } from 'ek3d/cameras/PerspectiveCamera';
   *
   * const camera = new PerspectiveCamera();
   *
   * const w = 1920;
   * const h = 1080;
   * const fullWidth = w * 3;
   * const fullHeight = h * 2;
   *
   * // --A--
   * camera.setViewOffset( fullWidth, fullHeight, w * 0, h * 0, w, h );
   * // --B--
   * camera.setViewOffset( fullWidth, fullHeight, w * 1, h * 0, w, h );
   * // --C--
   * camera.setViewOffset( fullWidth, fullHeight, w * 2, h * 0, w, h );
   * // --D--
   * camera.setViewOffset( fullWidth, fullHeight, w * 0, h * 1, w, h );
   * // --E--
   * camera.setViewOffset( fullWidth, fullHeight, w * 1, h * 1, w, h );
   * // --F--
   * camera.setViewOffset( fullWidth, fullHeight, w * 2, h * 1, w, h );
   * ```
   *
   * Note there is no reason monitors have to be the same size or in a grid.
   *
   * @param fullWidth - The full width of multiview setup.
   * @param fullHeight - The full height of multiview setup.
   * @param x - The horizontal offset of the subcamera.
   * @param y - The vertical offset of the subcamera.
   * @param width - The width of subcamera.
   * @param height - The height of subcamera.
   */
  setViewOffset(fullWidth: number, fullHeight: number, x: number, y: number, width: number, height: number) {
    this.aspect = fullWidth / fullHeight;
    if (this.view === null) {
      this.view = {
        enabled: true,
        fullWidth: 1,
        fullHeight: 1,
        offsetX: 0,
        offsetY: 0,
        width: 1,
        height: 1,
      };
    }
    this.view.enabled = true;
    this.view.fullWidth = fullWidth;
    this.view.fullHeight = fullHeight;
    this.view.offsetX = x;
    this.view.offsetY = y;
    this.view.width = width;
    this.view.height = height;
    this.updateProjectionMatrix();
  }
  /**
   * Removes the view offset from the projection matrix.
   */
  clearViewOffset() {
    if (this.view !== null) {
      this.view.enabled = false;
    }
    this.updateProjectionMatrix();
  }
  /**
   * Updates the camera's projection matrix. Must be called after any change of
   * camera properties.
   */
  updateProjectionMatrix() {
    const near = this.near;
    let top = (near * Math.tan(DEG2RAD * 0.5 * this.fov)) / this.zoom;
    let height = 2 * top;
    let width = this.aspect * height;
    let left = -0.5 * width;
    const view = this.view;
    if (this.view !== null && this.view.enabled) {
      const fullWidth = view!.fullWidth,
        fullHeight = view!.fullHeight;
      left += (view!.offsetX * width) / fullWidth;
      top -= (view!.offsetY * height) / fullHeight;
      width *= view!.width / fullWidth;
      height *= view!.height / fullHeight;
    }
    const skew = this.filmOffset;
    if (skew !== 0) left += (near * skew) / this.getFilmWidth();
    this.projectionMatrix.makePerspective(
      left,
      left + width,
      top,
      top - height,
      near,
      this.far,
      this.coordinateSystem,
      this.reversedDepth,
    );
    this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
  }
  toJSON(meta?: any) {
    const data = super.toJSON(meta);
    data.object.fov = this.fov;
    data.object.zoom = this.zoom;
    data.object.near = this.near;
    data.object.far = this.far;
    data.object.focus = this.focus;
    data.object.aspect = this.aspect;
    if (this.view !== null) data.object.view = Object.assign({}, this.view);
    data.object.filmGauge = this.filmGauge;
    data.object.filmOffset = this.filmOffset;
    return data;
  }
}
