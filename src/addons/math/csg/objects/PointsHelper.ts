import { InstancedMesh } from "../../../../objects/InstancedMesh";
import { SphereGeometry } from "../../../../geometries/SphereGeometry";
import { MeshBasicMaterial } from "../../../../materials/MeshBasicMaterial";
import { Matrix4 } from "../../../../math/Matrix4";
import type { Vector3 } from "../../../../math/Vector3";

const _matrix = new Matrix4();
export class PointsHelper extends InstancedMesh {
  get color() {
    return (this.material as MeshBasicMaterial).color;
  }

  constructor(count = 1000, points: Vector3[] = []) {
    super(new SphereGeometry(0.025), new MeshBasicMaterial(), count);
    this.frustumCulled = false;
    this.setPoints(points);
  }

  setPoints(points: Vector3[]) {
    for (let i = 0, l = points.length; i < l; i++) {
      const point = points[i];
      _matrix.makeTranslation(point.x, point.y, point.z);
      this.setMatrixAt(i, _matrix);
    }

    this.count = points.length;
  }
}
