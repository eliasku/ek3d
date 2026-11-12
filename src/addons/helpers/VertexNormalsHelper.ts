import { Float32BufferAttribute, type BufferAttribute } from "../../core/BufferAttribute";
import { BufferGeometry } from "../../core/BufferGeometry";
import type { InterleavedBufferAttribute } from "../../core/InterleavedBufferAttribute";
import type { Object3D } from "../../core/Object3D";
import { LineBasicMaterial } from "../../materials/LineBasicMaterial";
import type { Color } from "../../math/Color";
import { Matrix3 } from "../../math/Matrix3";
import { Vector3 } from "../../math/Vector3";
import { LineSegments } from "../../objects/LineSegments";

const _v1 = new Vector3();
const _v2 = new Vector3();
const _normalMatrix = new Matrix3();

/**
 * Visualizes an object's vertex normals. The geometry must have a normal attribute.
 *
 * ```typescript
 * import { VertexNormalsHelper } from 'ek3d/addons/helpers/VertexNormalsHelper';
 * import { BoxGeometry } from 'ek3d/geometries/BoxGeometry';
 * import { MeshStandardMaterial } from 'ek3d/materials/MeshStandardMaterial';
 * import { Mesh } from 'ek3d/objects/Mesh';
 * import { Scene } from 'ek3d/scenes/Scene';
 *
 * const scene = new Scene();
 * const mesh = new Mesh(new BoxGeometry(10, 10, 10, 2, 2, 2), new MeshStandardMaterial());
 * scene.add(mesh, new VertexNormalsHelper(mesh, 1, 0xff0000));
 * ```
 */
export class VertexNormalsHelper extends LineSegments<LineBasicMaterial> {
  object: Object3D & { geometry: BufferGeometry };
  size: number;
  readonly isVertexNormalsHelper: boolean;

  /**
   * @param object - The object for which to visualize vertex normals.
   * @param [size=1] - The helper's size.
   * @param [color=0xff0000] - The helper's color.
   */
  constructor(object: Object3D & { geometry: BufferGeometry }, size = 1, color: Color | string | number = 0xff0000) {
    const geometry = new BufferGeometry();
    const nNormals = object.geometry.attributes.normal.count;
    geometry.setAttribute("position", new Float32BufferAttribute(nNormals * 2 * 3, 3));
    super(geometry, new LineBasicMaterial({ color, toneMapped: false }));
    this.object = object;
    this.size = size;
    this.type = "VertexNormalsHelper";
    this.matrixAutoUpdate = false;
    this.isVertexNormalsHelper = true;
    this.update();
  }

  /** Updates the preview based on the object's world transform. */
  update(): void {
    this.object.updateMatrixWorld(true);
    _normalMatrix.getNormalMatrix(this.object.matrixWorld);
    const matrixWorld = this.object.matrixWorld;
    const position = this.geometry.attributes.position as BufferAttribute;
    const objGeometry = this.object.geometry;
    if (objGeometry) {
      const objPos = objGeometry.attributes.position as BufferAttribute | InterleavedBufferAttribute;
      const objNorm = objGeometry.attributes.normal as BufferAttribute | InterleavedBufferAttribute;
      let idx = 0;
      // Ignore indices and draw ranges, and render every normal.
      for (let j = 0, jl = objPos.count; j < jl; j++) {
        _v1.fromBufferAttribute(objPos, j).applyMatrix4(matrixWorld);
        _v2.fromBufferAttribute(objNorm, j).applyMatrix3(_normalMatrix).normalize().multiplyScalar(this.size).add(_v1);
        position.setXYZ(idx++, _v1.x, _v1.y, _v1.z);
        position.setXYZ(idx++, _v2.x, _v2.y, _v2.z);
      }
    }
    position.needsUpdate = true;
  }

  /** Frees the GPU resources allocated by this helper. */
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
