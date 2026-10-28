import { Object3D } from "../../core/Object3D";
import { Quaternion } from "../../math/Quaternion";
import { Vector3 } from "../../math/Vector3";

const translationObject = new Vector3();
const quaternionObject = new Quaternion();
const scaleObject = new Vector3();
const translationWorld = new Vector3();
const quaternionWorld = new Quaternion();
const scaleWorld = new Vector3();

/** Inherits position and scale from its parent while retaining local world orientation. */
export class Gyroscope extends Object3D {
  override updateMatrixWorld(force?: boolean): void {
    if (this.matrixAutoUpdate) this.updateMatrix();
    if (this.matrixWorldNeedsUpdate || force) {
      if (this.parent !== null) {
        this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
        this.matrixWorld.decompose(translationWorld, quaternionWorld, scaleWorld);
        this.matrix.decompose(translationObject, quaternionObject, scaleObject);
        this.matrixWorld.compose(translationWorld, quaternionObject, scaleWorld);
      } else {
        this.matrixWorld.copy(this.matrix);
      }
      this.matrixWorldNeedsUpdate = false;
      force = true;
    }
    for (const child of this.children) child.updateMatrixWorld(force);
  }
}
