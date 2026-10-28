import { LineSegments } from "../objects/LineSegments";
import { LineBasicMaterial } from "../materials/LineBasicMaterial";
import { Float32BufferAttribute } from "../core/BufferAttribute";
import { BufferGeometry } from "../core/BufferGeometry";
import { Color } from "../math/Color";
/**
 * The helper is an object to define grids. Grids are two-dimensional
 * arrays of lines.
 *
 * ```typescript
 * import { GridHelper } from 'ek3d/helpers/GridHelper';
 * import { Scene } from 'ek3d/scenes/Scene';
 *
 * const scene = new Scene();
 *
 * const size = 10;
 * const divisions = 10;
 *
 * const gridHelper = new GridHelper( size, divisions );
 * scene.add( gridHelper );
 * ```
 *
 */
export class GridHelper extends LineSegments<LineBasicMaterial> {
  /**
   * Constructs a new grid helper.
   *
   * @param [size=10] - The size of the grid.
   * @param [divisions=10] - The number of divisions across the grid.
   * @param [color1=0x444444] - The color of the center line.
   * @param [color2=0x888888] - The color of the lines of the grid.
   */
  constructor(
    size: number = 10,
    divisions: number = 10,
    color1: Color | string | number = 0x444444,
    color2: Color | string | number = 0x888888,
  ) {
    color1 = new Color(color1);
    color2 = new Color(color2);
    const center = divisions / 2;
    const step = size / divisions;
    const halfSize = size / 2;
    const vertices: any[] = [],
      colors: any[] = [];
    for (let i = 0, j = 0, k = -halfSize; i <= divisions; i++, k += step) {
      vertices.push(-halfSize, 0, k, halfSize, 0, k);
      vertices.push(k, 0, -halfSize, k, 0, halfSize);
      const color = i === center ? color1 : color2;
      color.toArray(colors, j);
      j += 3;
      color.toArray(colors, j);
      j += 3;
      color.toArray(colors, j);
      j += 3;
      color.toArray(colors, j);
      j += 3;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    const material = new LineBasicMaterial({ vertexColors: true, toneMapped: false });
    super(geometry, material);
    this.type = "GridHelper";
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
