import { EqualStencilFunc, IncrementStencilOp } from "../../constants";
import { MeshBasicMaterial } from "../../materials/MeshBasicMaterial";
import { Matrix4 } from "../../math/Matrix4";
import { Mesh } from "../../objects/Mesh";
import type { Plane } from "../../math/Plane";
import type { Vector4 } from "../../math/Vector4";

const shadowMatrix = new Matrix4();

/** Projects a mesh onto a plane using a stencil to avoid overlapping shadows. */
export class ShadowMesh extends Mesh<MeshBasicMaterial> {
  isShadowMesh: boolean = true;
  meshMatrix: Matrix4;

  constructor(mesh: Mesh) {
    super(
      mesh.geometry,
      new MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        stencilWrite: true,
        stencilFunc: EqualStencilFunc,
        stencilRef: 0,
        stencilZPass: IncrementStencilOp,
      }),
    );
    this.meshMatrix = mesh.matrixWorld;
    this.frustumCulled = false;
    this.matrixAutoUpdate = false;
  }

  update(plane: Plane, lightPosition4D: Vector4): void {
    const { x, y, z, w } = lightPosition4D;
    const normal = plane.normal;
    const dot = normal.x * x + normal.y * y + normal.z * z - plane.constant * w;
    const e = shadowMatrix.elements;
    e[0] = dot - x * normal.x;
    e[4] = -x * normal.y;
    e[8] = -x * normal.z;
    e[12] = x * plane.constant;
    e[1] = -y * normal.x;
    e[5] = dot - y * normal.y;
    e[9] = -y * normal.z;
    e[13] = y * plane.constant;
    e[2] = -z * normal.x;
    e[6] = -z * normal.y;
    e[10] = dot - z * normal.z;
    e[14] = z * plane.constant;
    e[3] = -w * normal.x;
    e[7] = -w * normal.y;
    e[11] = -w * normal.z;
    e[15] = dot + w * plane.constant;
    this.matrix.multiplyMatrices(shadowMatrix, this.meshMatrix);
  }
}
