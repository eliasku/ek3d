import type { Color } from "../math/Color";
import type { Object3D } from "../core/Object3D";
import { Box3 } from "../math/Box3";
import { LineSegments } from "../objects/LineSegments";
import { LineBasicMaterial } from "../materials/LineBasicMaterial";
import { BufferAttribute } from "../core/BufferAttribute";
import { BufferGeometry } from "../core/BufferGeometry";
const _box = /*@__PURE__*/ new Box3();
/**
 * Helper object to graphically show the world-axis-aligned bounding box
 * around an object. The actual bounding box is handled with {@link Box3},
 * this is just a visual helper for debugging. It can be automatically
 * resized with {@link BoxHelper#update} when the object it's created from
 * is transformed. Note that the object must have a geometry for this to work,
 * so it won't work with sprites.
 *
 * ```ts
 * import { BoxHelper } from 'ek3d/helpers/BoxHelper';
 * import { Mesh } from 'ek3d/objects/Mesh';
 * import { MeshBasicMaterial } from 'ek3d/materials/MeshBasicMaterial';
 * import { Scene } from 'ek3d/scenes/Scene';
 * import { SphereGeometry } from 'ek3d/geometries/SphereGeometry';
 *
 * const scene = new Scene();
 *
 * const sphere = new SphereGeometry();
 * const object = new Mesh( sphere, new MeshBasicMaterial( { color: 0xff0000 } ) );
 * const box = new BoxHelper( object, 0xffff00 );
 * scene.add( box );
 * ```
 *
 */
export class BoxHelper extends LineSegments<LineBasicMaterial> {
  object: Object3D | undefined;

  /**
   * Constructs a new box helper.
   *
   * @param [object] - The 3D object to show the world-axis-aligned bounding box.
   * @param [color=0xffff00] - The box's color.
   */
  constructor(object?: Object3D, color: Color | string | number = 0xffff00) {
    const indices = new Uint16Array([0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7]);
    const positions = new Float32Array(8 * 3);
    const geometry = new BufferGeometry();
    geometry.setIndex(new BufferAttribute(indices, 1));
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    super(geometry, new LineBasicMaterial({ color: color, toneMapped: false }));
    /**
     * The 3D object being visualized.
     *
     */
    this.object = object;
    this.type = "BoxHelper";
    this.matrixAutoUpdate = false;
    this.update();
  }
  /**
   * Updates the helper's geometry to match the dimensions of the object,
   * including any children.
   */
  update() {
    if (this.object !== undefined) {
      _box.setFromObject(this.object);
    }
    if (_box.isEmpty()) return;
    const min = _box.min;
    const max = _box.max;
    /*
            5____4
        1/___0/|
        | 6__|_7
        2/___3/

        0: max.x, max.y, max.z
        1: min.x, max.y, max.z
        2: min.x, min.y, max.z
        3: max.x, min.y, max.z
        4: max.x, max.y, min.z
        5: min.x, max.y, min.z
        6: min.x, min.y, min.z
        7: max.x, min.y, min.z
        */
    const position = this.geometry.attributes.position as BufferAttribute;
    const array = position.array;
    array[0] = max.x;
    array[1] = max.y;
    array[2] = max.z;
    array[3] = min.x;
    array[4] = max.y;
    array[5] = max.z;
    array[6] = min.x;
    array[7] = min.y;
    array[8] = max.z;
    array[9] = max.x;
    array[10] = min.y;
    array[11] = max.z;
    array[12] = max.x;
    array[13] = max.y;
    array[14] = min.z;
    array[15] = min.x;
    array[16] = max.y;
    array[17] = min.z;
    array[18] = min.x;
    array[19] = min.y;
    array[20] = min.z;
    array[21] = max.x;
    array[22] = min.y;
    array[23] = min.z;
    position.needsUpdate = true;
    this.geometry.computeBoundingSphere();
  }
  /**
   * Updates the wireframe box for the passed object.
   *
   * @param object - The 3D object to create the helper for.
   * @return A reference to this instance.
   */
  setFromObject(object: Object3D): this {
    this.object = object;
    this.update();
    return this;
  }
  copy(source: BoxHelper, recursive?: boolean): this {
    super.copy(source, recursive);
    this.object = source.object;
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
