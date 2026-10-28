import { LineSegments } from "../objects/LineSegments";
import { LineBasicMaterial } from "../materials/LineBasicMaterial";
import { Float32BufferAttribute } from "../core/BufferAttribute";
import { BufferGeometry } from "../core/BufferGeometry";
import { Color } from "../math/Color";
/**
 * An axis object to visualize the 3 axes in a simple way.
 * The X axis is red. The Y axis is green. The Z axis is blue.
 *
 * ```typescript
 * import { AxesHelper } from 'ek3d/helpers/AxesHelper';
 * import { Scene } from 'ek3d/scenes/Scene';
 *
 * const scene = new Scene();
 *
 * const axesHelper = new AxesHelper( 5 );
 * scene.add( axesHelper );
 * ```
 *
 */
export class AxesHelper extends LineSegments<LineBasicMaterial> {
  /**
   * Constructs a new axes helper.
   *
   * @param [size=1] - Size of the lines representing the axes.
   */
  constructor(size: number = 1) {
    const vertices = [0, 0, 0, size, 0, 0, 0, 0, 0, 0, size, 0, 0, 0, 0, 0, 0, size];
    const colors = [1, 0, 0, 1, 0.6, 0, 0, 1, 0, 0.6, 1, 0, 0, 0, 1, 0, 0.6, 1];
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    const material = new LineBasicMaterial({ vertexColors: true, toneMapped: false });
    super(geometry, material);
    this.type = "AxesHelper";
  }
  /**
   * Defines the colors of the axes helper.
   *
   * @param xAxisColor - The color for the x axis.
   * @param yAxisColor - The color for the y axis.
   * @param zAxisColor - The color for the z axis.
   * @return A reference to this axes helper.
   */
  setColors(
    xAxisColor: Color | string | number,
    yAxisColor: Color | string | number,
    zAxisColor: Color | string | number,
  ): this;
  setColors(
    xAxisColor: Color | string | number,
    yAxisColor: Color | string | number,
    zAxisColor?: Color | string | number,
  ): this {
    const color = new Color();
    const array = (this.geometry.attributes.color as Float32BufferAttribute).array;
    color.set(xAxisColor);
    color.toArray(array, 0);
    color.toArray(array, 3);
    color.set(yAxisColor);
    color.toArray(array, 6);
    color.toArray(array, 9);
    color.set(zAxisColor);
    color.toArray(array, 12);
    color.toArray(array, 15);
    this.geometry.attributes.color.needsUpdate = true;
    return this;
  }
  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever this instance is no longer used in your app.
   */
  dispose() {
    super.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
  clone(recursive: boolean = true): this {
    return new (this.constructor as any)().copy(this, recursive);
  }
}
