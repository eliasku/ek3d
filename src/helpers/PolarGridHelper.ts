import { LineSegments } from "../objects/LineSegments";
import { LineBasicMaterial } from "../materials/LineBasicMaterial";
import { Float32BufferAttribute } from "../core/BufferAttribute";
import { BufferGeometry } from "../core/BufferGeometry";
import { Color } from "../math/Color";
/**
 * This helper is an object to define polar grids. Grids are
 * two-dimensional arrays of lines.
 *
 * ```typescript
 * import { PolarGridHelper } from 'ek3d/helpers/PolarGridHelper';
 * import { Scene } from 'ek3d/scenes/Scene';
 *
 * const scene = new Scene();
 *
 * const radius = 10;
 * const sectors = 16;
 * const rings = 8;
 * const divisions = 64;
 *
 * const helper = new PolarGridHelper( radius, sectors, rings, divisions );
 * scene.add( helper );
 * ```
 *
 */
export class PolarGridHelper extends LineSegments<LineBasicMaterial> {
  /**
   * Constructs a new polar grid helper.
   *
   * @param [radius=10] - The radius of the polar grid. This can be any positive number.
   * @param [sectors=16] - The number of sectors the grid will be divided into. This can be any positive integer.
   * @param [rings=8] - The number of rings. This can be any positive integer.
   * @param [divisions=64] - The number of line segments used for each circle. This can be any positive integer.
   * @param [color1=0x444444] - The first color used for grid elements.
   * @param [color2=0x888888] -  The second color used for grid elements.
   */
  constructor(
    radius: number = 10,
    sectors: number = 16,
    rings: number = 8,
    divisions: number = 64,
    color1: Color | string | number = 0x444444,
    color2: Color | string | number = 0x888888,
  ) {
    color1 = new Color(color1);
    color2 = new Color(color2);
    const vertices: any[] = [];
    const colors: any[] = [];
    // create the sectors
    if (sectors > 1) {
      for (let i = 0; i < sectors; i++) {
        const v = (i / sectors) * (Math.PI * 2);
        const x = Math.sin(v) * radius;
        const z = Math.cos(v) * radius;
        vertices.push(0, 0, 0);
        vertices.push(x, 0, z);
        const color = i & 1 ? color1 : color2;
        colors.push(color.r, color.g, color.b);
        colors.push(color.r, color.g, color.b);
      }
    }
    // create the rings
    for (let i = 0; i < rings; i++) {
      const color = i & 1 ? color1 : color2;
      const r = radius - (radius / rings) * i;
      for (let j = 0; j < divisions; j++) {
        // first vertex
        let v = (j / divisions) * (Math.PI * 2);
        let x = Math.sin(v) * r;
        let z = Math.cos(v) * r;
        vertices.push(x, 0, z);
        colors.push(color.r, color.g, color.b);
        // second vertex
        v = ((j + 1) / divisions) * (Math.PI * 2);
        x = Math.sin(v) * r;
        z = Math.cos(v) * r;
        vertices.push(x, 0, z);
        colors.push(color.r, color.g, color.b);
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    const material = new LineBasicMaterial({ vertexColors: true, toneMapped: false });
    super(geometry, material);
    this.type = "PolarGridHelper";
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
