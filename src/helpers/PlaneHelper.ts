import type { Color } from "../math/Color";
import type { Plane } from "../math/Plane";
import { Line } from "../objects/Line";
import { Mesh } from "../objects/Mesh";
import { LineBasicMaterial } from "../materials/LineBasicMaterial";
import { MeshBasicMaterial } from "../materials/MeshBasicMaterial";
import { Float32BufferAttribute } from "../core/BufferAttribute";
import { BufferGeometry } from "../core/BufferGeometry";
/**
 * A helper object to visualize an instance of {@link Plane}.
 *
 * ```ts
 * import { Plane } from 'ek3d/math/Plane';
 * import { PlaneHelper } from 'ek3d/helpers/PlaneHelper';
 * import { Scene } from 'ek3d/scenes/Scene';
 * import { Vector3 } from 'ek3d/math/Vector3';
 *
 * const scene = new Scene();
 *
 * const plane = new Plane( new Vector3( 1, 1, 0.2 ), 3 );
 * const helper = new PlaneHelper( plane, 1, 0xffff00 );
 * scene.add( helper );
 * ```
 *
 */
export class PlaneHelper extends Line<LineBasicMaterial> {
  plane: Plane;
  size: number;

  /**
   * Constructs a new plane helper.
   *
   * @param plane - The plane to be visualized.
   * @param [size=1] - The side length of plane helper.
   * @param [hex=0xffff00] - The helper's color.
   */
  constructor(plane: Plane, size: number = 1, hex: Color | string | number = 0xffff00) {
    const color = hex;
    const positions = [1, -1, 0, -1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0, -1, -1, 0, 1, -1, 0, 1, 1, 0];
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.computeBoundingSphere();
    super(geometry, new LineBasicMaterial({ color: color, toneMapped: false }));
    this.type = "PlaneHelper";
    /**
     * The plane being visualized.
     *
     */
    this.plane = plane;
    /**
     * The side length of plane helper.
     *
     * @default 1
     */
    this.size = size;
    const positions2 = [1, 1, 0, -1, 1, 0, -1, -1, 0, 1, 1, 0, -1, -1, 0, 1, -1, 0];
    const geometry2 = new BufferGeometry();
    geometry2.setAttribute("position", new Float32BufferAttribute(positions2, 3));
    geometry2.computeBoundingSphere();
    this.add(
      new Mesh(
        geometry2,
        new MeshBasicMaterial({ color: color, opacity: 0.2, transparent: true, depthWrite: false, toneMapped: false }),
      ) as Mesh & { material: MeshBasicMaterial },
    );
  }
  updateMatrixWorld(force?: boolean) {
    (this as any).position.set(0, 0, 0);
    (this as any).scale.set(0.5 * this.size, 0.5 * this.size, 1);
    this.lookAt(this.plane.normal);
    this.translateZ(-this.plane.constant);
    super.updateMatrixWorld(force);
  }
  /**
   * Updates the helper to match the position and direction of the
   * light being visualized.
   */
  dispose() {
    super.dispose();
    this.geometry.dispose();
    this.material.dispose();
    (this.children[0] as Mesh & { material: MeshBasicMaterial } as any).geometry.dispose();
    (this.children[0] as Mesh & { material: MeshBasicMaterial } as any).material.dispose();
  }
  clone(recursive: boolean = true): this {
    return new (this.constructor as any)().copy(this, recursive);
  }
}
