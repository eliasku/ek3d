export class PrimitivePool<T> {
  _getNewPrimitive: () => T;
  _primitives: T[] = [];

  constructor(getNewPrimitive: () => T) {
    this._getNewPrimitive = getNewPrimitive;
  }

  getPrimitive() {
    const primitives = this._primitives;
    if (primitives.length === 0) {
      return this._getNewPrimitive();
    } else {
      return primitives.pop()!;
    }
  }

  releasePrimitive(primitive: T) {
    this._primitives.push(primitive);
  }
}
