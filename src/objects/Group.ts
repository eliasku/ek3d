import { Object3D } from "../core/Object3D";
/**
 * This is almost identical to an {@link Object3D}. Its purpose is to
 * make working with groups of objects syntactically clearer.
 *
 * ```ts
 * import { BoxGeometry } from 'ek3d/geometries/BoxGeometry';
 * import { Group } from 'ek3d/objects/Group';
 * import { Mesh } from 'ek3d/objects/Mesh';
 * import { MeshBasicMaterial } from 'ek3d/materials/MeshBasicMaterial';
 * import { Scene } from 'ek3d/scenes/Scene';
 *
 * const scene = new Scene();
 * const geometry = new BoxGeometry( 1, 1, 1 );
 * const material = new MeshBasicMaterial( { color: 0x00ff00 } );
 * const meshA = new Mesh( geometry, material );
 * const meshB = new Mesh( geometry, material );
 * meshB.position.x = 2;
 *
 * // Create a group and add the two cubes.
 * // These cubes can now be rotated / scaled etc as a group.
 * const group = new Group();
 *
 * group.add( meshA );
 * group.add( meshB );
 *
 * scene.add( group );
 * ```
 *
 */
export class Group extends Object3D {
  isGroup: boolean;

  constructor() {
    super();
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isGroup = true;
    this.type = "Group";
  }
}
