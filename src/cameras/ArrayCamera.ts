import { PerspectiveCamera } from "./PerspectiveCamera";
/**
 * This type of camera can be used in order to efficiently render a scene with a
 * predefined set of cameras. It supports ordinary multi-viewport rendering.
 *
 * An instance of `ArrayCamera` always has an array of sub cameras. It's mandatory
 * to define for each sub camera the `viewport` property which determines the
 * part of the viewport that is rendered with this camera.
 *
 */
export class ArrayCamera extends PerspectiveCamera {
  isArrayCamera: boolean;
  isMultiViewCamera: boolean;
  cameras: PerspectiveCamera[];
  perCameraFrustumCulled: boolean;

  /**
   * Constructs a new array camera.
   *
   * @param [array=[]] - An array of perspective sub cameras.
   */
  constructor(array: PerspectiveCamera[] = []) {
    super();
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isArrayCamera = true;
    /**
     * Whether this camera is used with multiview rendering or not.
     *
     * @readonly
     * @default false
     */
    this.isMultiViewCamera = false;
    /**
     * An array of perspective sub cameras.
     *
     */
    this.cameras = array;
    /**
     * Whether 3D objects are frustum culled per sub camera or not.
     *
     * Since this requires an additional frustum test per sub camera, it should only be
     * enabled when the frustums of the sub cameras barely overlap. The property has
     * no effect with multiview rendering.
     *
     * @default false
     */
    this.perCameraFrustumCulled = false;
  }
}
