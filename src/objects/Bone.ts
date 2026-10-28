import { Object3D } from "../core/Object3D";
/**
 * A bone which is part of a {@link Skeleton}. The skeleton in turn is used by
 * the {@link SkinnedMesh}.
 *
 * ```typescript
 * import { Bone } from 'ek3d/objects/Bone';
 *
 * const root = new Bone();
 * const child = new Bone();
 *
 * root.add( child );
 * child.position.y = 5;
 * ```
 *
 */
export class Bone extends Object3D {
  isBone: boolean;

  /**
   * Constructs a new bone.
   */
  constructor() {
    super();
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isBone = true;
    this.type = "Bone";
  }
}
