import { Float32BufferAttribute, type BufferAttribute } from "../../core/BufferAttribute";
import { BufferGeometry } from "../../core/BufferGeometry";
import type { InterleavedBufferAttribute } from "../../core/InterleavedBufferAttribute";
import type { Object3D } from "../../core/Object3D";
import { LineBasicMaterial } from "../../materials/LineBasicMaterial";
import type { Color } from "../../math/Color";
import { Vector3 } from "../../math/Vector3";
import { LineSegments } from "../../objects/LineSegments";

const _v1 = new Vector3();
const _v2 = new Vector3();

/**
 * Visualizes an object's vertex tangents. The geometry must have a tangent attribute.
 *
 * ```typescript
 * import { VertexTangentsHelper } from 'ek3d/addons/helpers/VertexTangentsHelper';
 * import { BoxGeometry } from 'ek3d/geometries/BoxGeometry';
 * import { MeshStandardMaterial } from 'ek3d/materials/MeshStandardMaterial';
 * import { Mesh } from 'ek3d/objects/Mesh';
 * import { Scene } from 'ek3d/scenes/Scene';
 *
 * const scene = new Scene();
 * const geometry = new BoxGeometry();
 * geometry.computeTangents();
 * const mesh = new Mesh(geometry, new MeshStandardMaterial());
 * scene.add(mesh, new VertexTangentsHelper(mesh, 1, 0xff0000));
 * ```
 */
export class VertexTangentsHelper extends LineSegments<LineBasicMaterial> {
  object: Object3D & { geometry: BufferGeometry };
  size: number;

  /**
   * @param object - The object for which to visualize vertex tangents.
   * @param [size=1] - The helper's size.
   * @param [color=0x00ffff] - The helper's color.
   */
  constructor(object: Object3D & { geometry: BufferGeometry }, size = 1, color: Color | string | number = 0x00ffff) {
    const geometry = new BufferGeometry();
    const nTangents = object.geometry.attributes.tangent.count;
    geometry.setAttribute("position", new Float32BufferAttribute(nTangents * 2 * 3, 3));
    super(geometry, new LineBasicMaterial({ color, toneMapped: false }));
    this.object = object;
    this.size = size;
    this.type = "VertexTangentsHelper";
    this.matrixAutoUpdate = false;
    this.update();
  }

  /** Updates the preview based on the object's world transform. */
  update(): void {
    this.object.updateMatrixWorld(true);
    const matrixWorld = this.object.matrixWorld;
    const position = this.geometry.attributes.position as BufferAttribute;
    const objGeometry = this.object.geometry;
    const objPos = objGeometry.attributes.position as BufferAttribute | InterleavedBufferAttribute;
    const objTan = objGeometry.attributes.tangent as BufferAttribute | InterleavedBufferAttribute;
    let idx = 0;
    // Ignore indices and draw ranges, and render every tangent.
    for (let j = 0, jl = objPos.count; j < jl; j++) {
      _v1.fromBufferAttribute(objPos, j).applyMatrix4(matrixWorld);
      _v2.fromBufferAttribute(objTan, j).transformDirection(matrixWorld).multiplyScalar(this.size).add(_v1);
      position.setXYZ(idx++, _v1.x, _v1.y, _v1.z);
      position.setXYZ(idx++, _v2.x, _v2.y, _v2.z);
    }
    position.needsUpdate = true;
  }

  /** Frees the GPU resources allocated by this helper. */
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
