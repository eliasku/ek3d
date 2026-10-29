import { LineSegments } from "../../objects/LineSegments";
import { BufferGeometry } from "../../core/BufferGeometry";
import { Float32BufferAttribute } from "../../core/BufferAttribute";
import { LineBasicMaterial } from "../../materials/LineBasicMaterial";
import type { Color } from "../../math/Color";
import type { Octree } from "../math/Octree";

/**
 * A helper for visualizing an Octree.
 *
 * ```ts
 * import { Scene } from 'ek3d/scenes/Scene';
 * import { Octree } from 'ek3d/addons/math/Octree';
 * import { OctreeHelper } from 'ek3d/addons/helpers/OctreeHelper';
 *
 * const scene = new Scene();
 * const octree = new Octree().fromGraphNode(scene);
 * const helper = new OctreeHelper(octree);
 * scene.add(helper);
 * ```
 *
 * @augments LineSegments
 */
export class OctreeHelper extends LineSegments<LineBasicMaterial> {
  octree: Octree;
  color: Color | string | number;

  /**
   * Constructs a new Octree helper.
   *
   * @param octree - The octree to visualize.
   * @param [color=0xffff00] - The helper's color.
   */
  constructor(octree: Octree, color: Color | string | number = 0xffff00) {
    super(new BufferGeometry(), new LineBasicMaterial({ color: color, toneMapped: false }));

    /**
     * The octree to visualize.
     *
     */
    this.octree = octree;

    /**
     * The helper's color.
     *
     */
    this.color = color;

    this.type = "OctreeHelper";

    this.update();
  }

  /**
   * Updates the helper. This method must be called whenever the Octree's
   * structure is changed.
   */
  update() {
    const vertices: number[] = [];

    function traverse(tree: Octree[]) {
      for (let i = 0; i < tree.length; i++) {
        const min = tree[i].box!.min;
        const max = tree[i].box!.max;

        vertices.push(max.x, max.y, max.z);
        vertices.push(min.x, max.y, max.z); // 0, 1
        vertices.push(min.x, max.y, max.z);
        vertices.push(min.x, min.y, max.z); // 1, 2
        vertices.push(min.x, min.y, max.z);
        vertices.push(max.x, min.y, max.z); // 2, 3
        vertices.push(max.x, min.y, max.z);
        vertices.push(max.x, max.y, max.z); // 3, 0

        vertices.push(max.x, max.y, min.z);
        vertices.push(min.x, max.y, min.z); // 4, 5
        vertices.push(min.x, max.y, min.z);
        vertices.push(min.x, min.y, min.z); // 5, 6
        vertices.push(min.x, min.y, min.z);
        vertices.push(max.x, min.y, min.z); // 6, 7
        vertices.push(max.x, min.y, min.z);
        vertices.push(max.x, max.y, min.z); // 7, 4

        vertices.push(max.x, max.y, max.z);
        vertices.push(max.x, max.y, min.z); // 0, 4
        vertices.push(min.x, max.y, max.z);
        vertices.push(min.x, max.y, min.z); // 1, 5
        vertices.push(min.x, min.y, max.z);
        vertices.push(min.x, min.y, min.z); // 2, 6
        vertices.push(max.x, min.y, max.z);
        vertices.push(max.x, min.y, min.z); // 3, 7

        traverse(tree[i].subTrees);
      }
    }

    traverse(this.octree.subTrees);

    this.geometry.dispose();

    this.geometry = new BufferGeometry();
    this.geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  }

  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever this instance is no longer used in your app.
   */
  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
