import { Group } from "../../../../../objects/Group";
import { Matrix4 } from "../../../../../math/Matrix4";

export class OperationGroup extends Group {
  isOperationGroup: boolean;
  _previousMatrix: Matrix4;

  constructor() {
    super();
    this.isOperationGroup = true;
    this._previousMatrix = new Matrix4();
  }

  markUpdated() {
    this._previousMatrix.copy(this.matrix);
  }

  isDirty() {
    const { matrix, _previousMatrix } = this;
    const el1 = matrix.elements;
    const el2 = _previousMatrix.elements;
    for (let i = 0; i < 16; i++) {
      if (el1[i] !== el2[i]) {
        return true;
      }
    }

    return false;
  }
}
