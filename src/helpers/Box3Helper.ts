import type { Box3 } from "../math/Box3";
import type { Color } from "../math/Color";
import { LineSegments } from "../objects/LineSegments";
import { LineBasicMaterial } from "../materials/LineBasicMaterial";
import { BufferAttribute, Float32BufferAttribute } from "../core/BufferAttribute";
import { BufferGeometry } from "../core/BufferGeometry";
/**
 * A helper object to visualize an instance of {@link Box3}.
 *
 * ```ts
 * import { Box3 } from 'ek3d/math/Box3';
 * import { Box3Helper } from 'ek3d/helpers/Box3Helper';
 * import { Scene } from 'ek3d/scenes/Scene';
 * import { Vector3 } from 'ek3d/math/Vector3';
 *
 * const scene = new Scene();
 *
 * const box = new Box3();
 * box.setFromCenterAndSize( new Vector3( 1, 1, 1 ), new Vector3( 2, 1, 3 ) );
 *
 * const helper = new Box3Helper( box, 0xffff00 );
 * scene.add( helper )
 * ```
 *
 */
export class Box3Helper extends LineSegments<LineBasicMaterial> {
  box: Box3;

  /**
   * Constructs a new box3 helper.
   *
   * @param box - The box to visualize.
   * @param [color=0xffff00] - The box's color.
   */
  constructor(box: Box3, color: Color | string | number = 0xffff00) {
    const indices = new Uint16Array([0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7]);
    const positions = [1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, -1, -1, 1, -1, -1, -1, -1, 1, -1, -1];
    const geometry = new BufferGeometry();
    geometry.setIndex(new BufferAttribute(indices, 1));
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    super(geometry, new LineBasicMaterial({ color: color, toneMapped: false }));
    /**
     * The box being visualized.
     *
     */
    this.box = box;
    this.type = "Box3Helper";
    this.geometry.computeBoundingSphere();
  }
  updateMatrixWorld(force?: boolean) {
    const box = this.box;
    if (box.isEmpty()) return;
    box.getCenter((this as any).position);
    box.getSize((this as any).scale);
    (this as any).scale.multiplyScalar(0.5);
    super.updateMatrixWorld(force);
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
