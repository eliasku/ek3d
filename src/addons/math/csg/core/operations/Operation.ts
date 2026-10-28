import { BufferGeometry } from "../../../../../core/BufferGeometry";
import type { Material } from "../../../../../materials/Material";
import type { Object3D } from "../../../../../core/Object3D";
import type { CSGOperation } from "../constants";
import { Brush } from "../Brush";
import { ADDITION } from "../constants";

export class Operation extends Brush {
  isOperation: boolean;
  operation: CSGOperation;
  _cachedGeometry: BufferGeometry;
  _cachedMaterials: Material | Material[] | null;
  _previousOperation: CSGOperation | null;

  constructor(...args: ConstructorParameters<typeof Brush>) {
    super(...args);

    this.isOperation = true;
    this.operation = ADDITION;

    this._cachedGeometry = new BufferGeometry();
    this._cachedMaterials = null;
    this._previousOperation = null;
  }

  markUpdated() {
    super.markUpdated();
    this._previousOperation = this.operation;
  }

  isDirty() {
    return this.operation !== this._previousOperation || super.isDirty();
  }

  insertBefore(brush: Object3D) {
    const parent = this.parent!;
    const index = parent.children.indexOf(this);
    parent.children.splice(index, 0, brush);
  }

  insertAfter(brush: Object3D) {
    const parent = this.parent!;
    const index = parent.children.indexOf(this);
    parent.children.splice(index + 1, 0, brush);
  }
}
